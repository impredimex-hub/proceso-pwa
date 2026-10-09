/**
 * Órdenes de trabajo de Mantenimiento (SPEC-021).
 *
 * Al terminar un check de 5S y condiciones, el auditor está parado frente a la
 * máquina con el hallazgo fresco. Antes tenía que acordarse, salir, abrir la
 * otra app y buscar si ya había una OT por lo mismo. En la práctica eso no pasa
 * y el hallazgo se queda en el reporte.
 *
 * Aquí se lee qué OT están abiertas en esa máquina y, si ninguna cubre lo que
 * encontró, se levanta una.
 *
 * ── Lo que esta app hace y lo que no ─────────────────────────────────────
 *
 * Solo levanta. Tomar la orden, asignar técnico, registrar actividades,
 * refacciones, pausas y cierre siguen siendo de la app de Mantenimiento, que es
 * donde vive ese flujo completo. Esta app escribe en dos rutas y nada más.
 *
 * ── Lo que cuida el consumo ──────────────────────────────────────────────
 *
 * Las OT no se consultan de `manto_db/ots`. Las reglas de Mantenimiento no
 * tienen `.indexOn`, así que una consulta filtrada por máquina descargaría el
 * nodo completo —de 123 a 613 KB por revisión—, y Realtime Database cobra por
 * bytes bajados.
 *
 * Mantenimiento publica `manto_db/abiertasPorMaquina/<clave>` con lo justo para
 * decidir. Esta app lee solo la máquina que acaba de auditar, y solo cuando el
 * auditor contesta que sí quiere ver las OT: no en cada check.
 */

import { ref, get, update, runTransaction } from 'firebase/database';
import { conectarManto, cabeceraDeSesion, SERVICIO_MANTO } from './manto';


/**
 * El aviso de OT nueva no va directo a OneSignal: pasa por un Worker de
 * Cloudflare que recibe las nóminas y el texto. Es el mismo que usa
 * Mantenimiento, así que un aviso levantado aquí llega igual que cualquier otro.
 */
const WORKER_PUSH = SERVICIO_MANTO;

/**
 * Tipo de servicio con el que se levantan las OT de auditoría.
 *
 * Siempre `MTTO-MAQ-PROD`, incluso cuando el hallazgo es de seguridad. En
 * Mantenimiento, `MTTO-SEGURIDAD` cambia el significado del campo `equipo`:
 * en lugar de la máquina guarda el tipo de riesgo, y la OT dejaría de poder
 * ligarse a una máquina del catálogo.
 *
 * La urgencia de un hallazgo de seguridad se transmite por `prioridad`, que es
 * lo que de verdad mueve la atención del equipo.
 */
const TIPO_SERVICIO = 'MTTO-MAQ-PROD';

// SPEC-026: la conexión entra con la credencial de la persona, no anónima.
const conectar = conectarManto;

/* ── Leer las OT abiertas ──────────────────────────────────────────────── */

export interface OTAbierta {
  id: string;
  folio: string;
  desc: string;
  status: string;
  prioridad: string;
  fechaAlta: string;
  origen: string;
}

export interface ResultadoAbiertas {
  estado: 'ok' | 'error';
  ots: OTAbierta[];
  motivo?: string;
}

const ETIQUETA_STATUS: Record<string, string> = {
  abierto: 'Sin tomar',
  proceso: 'En proceso',
  espera: 'En espera',
  validar: 'Por validar'
};

export const etiquetaStatus = (s: string): string => ETIQUETA_STATUS[s] || s;

/**
 * Las OT abiertas de una máquina, de la más vieja a la más nueva.
 *
 * Nunca lanza. Si falla, devuelve `estado: 'error'` y una lista vacía: la
 * pantalla dice que no se pudieron consultar en lugar de afirmar que no hay
 * ninguna, que es la mentira peligrosa —el auditor levantaría una OT duplicada.
 */
export const otsAbiertasDe = async (clave: string): Promise<ResultadoAbiertas> => {
  if (!clave) return { estado: 'error', ots: [], motivo: 'sin clave de máquina' };
  try {
    const bd = await conectar();
    const snap = await get(ref(bd, `manto_db/abiertasPorMaquina/${clave}`));
    const val = snap.val() || {};
    const ots: OTAbierta[] = Object.keys(val).map((id) => {
      const o = val[id] || {};
      return {
        id,
        folio: String(o.folio || ''),
        desc: String(o.desc || ''),
        status: String(o.status || 'abierto'),
        prioridad: String(o.prioridad || 'Normal'),
        fechaAlta: String(o.fechaAlta || ''),
        origen: String(o.origen || 'SOLICITUD')
      };
    });
    ots.sort((a, b) => a.fechaAlta.localeCompare(b.fechaAlta));
    return { estado: 'ok', ots };
  } catch (e) {
    return {
      estado: 'error',
      ots: [],
      motivo: e instanceof Error ? e.message : 'no se pudieron consultar'
    };
  }
};

/* ── Levantar una OT ───────────────────────────────────────────────────── */

export interface DatosNuevaOT {
  /** La clave con la que esta app conoce la máquina ('FL1'). Indexa la OT. */
  clave: string;
  /** El nombre con que Mantenimiento conoce la máquina ('Omega'). No la clave. */
  equipo: string;
  nave: string;
  desc: string;
  prioridad: 'Normal' | 'Urgente';
  solicitante: string;
  nomina: string;
  /** De qué auditoría salió, para poder medir el programa después. */
  auditoriaTipo: 'PROCESO' | '5S';
  auditoriaFecha: string;
  auditor: string;
  hallazgoTexto: string;
  refHallazgo?: string;
}

export interface ResultadoAlta {
  estado: 'ok' | 'error';
  folio?: string;
  /** El aviso al equipo falló aunque la OT quedó registrada. */
  sinAviso?: boolean;
  /** Por qué falló el aviso. Se muestra para no tener que adivinar. */
  motivoAviso?: string;
  motivo?: string;
}

/**
 * Aparta un folio con una transacción.
 *
 * El contador vive en `manto_db/folioSig` y lo comparten las dos apps. Una
 * transacción la atiende el servidor de una en una, así que dos altas
 * simultáneas —de aquí y de Mantenimiento— no se llevan el mismo número.
 *
 * A diferencia de Mantenimiento, aquí **no hay respaldo con contador local**:
 * si el servidor no confirma, no se levanta la OT. Un folio inventado desde
 * esta app sería un número que choca con el de una orden real y que nadie puede
 * rastrear, y es peor que pedirle al auditor que lo intente otra vez.
 */
const apartarFolio = async (bd: Awaited<ReturnType<typeof conectar>>): Promise<string> => {
  const res = await runTransaction(ref(bd, 'manto_db/folioSig'), (actual) => {
    const base = typeof actual === 'number' && actual >= 1 ? actual : 1;
    return base + 1;
  });
  if (!res.committed) throw new Error('el servidor no confirmó el folio');
  const asignado = Number(res.snapshot.val()) - 1;
  if (!Number.isFinite(asignado) || asignado < 1) throw new Error('folio inválido');
  return String(asignado).padStart(6, '0');
};

/**
 * Avisa al equipo de mantenimiento.
 *
 * Nunca lanza, y **dice por qué falló** en lugar de devolver un sí/no mudo.
 * Cuando el aviso no sale, la OT ya existe y alguien tiene que decidir qué
 * hacer; sin el motivo, ni el auditor ni quien revise el código después pueden
 * distinguir «no hay a quién avisar» de «el servicio rechazó» o de «no se pudo
 * llegar al servicio», que se arreglan en lugares distintos.
 */
const avisar = async (
  bd: Awaited<ReturnType<typeof conectar>>,
  folio: string,
  desc: string,
  equipo: string,
  nave: string,
  urgente: boolean
): Promise<{ ok: boolean; motivo?: string }> => {
  let nominas: unknown;
  let url: string | undefined;
  try {
    const [snapNom, snapUrl] = await Promise.all([
      get(ref(bd, 'manto_db/notificarA')),
      get(ref(bd, 'manto_db/urlApp'))
    ]);
    nominas = snapNom.val();
    url = snapUrl.val() || undefined;
  } catch (e) {
    return {
      ok: false,
      motivo: 'no se pudo leer la lista de destinatarios: ' +
        (e instanceof Error ? e.message : 'error de lectura')
    };
  }

  if (!Array.isArray(nominas) || nominas.length === 0) {
    // Mantenimiento publica esa lista al conectarse con el padrón cargado. Si
    // está vacía, nadie ha abierto esa app desde que se instaló el cambio.
    return { ok: false, motivo: 'Mantenimiento todavía no publica a quién avisar' };
  }

  try {
    // SPEC-026: el servicio solo envía avisos de alguien con sesión activa.
    const r = await fetch(WORKER_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await cabeceraDeSesion()) },
      body: JSON.stringify({
        nominas: nominas.map(String),
        title: `${urgente ? 'URGENTE' : 'Nueva OT'} #${folio} · de auditoría`,
        message: `${desc.slice(0, 60)} - ${equipo} NAVE ${nave}`,
        url
      })
    });
    if (!r.ok) {
      let detalle = '';
      try { detalle = (await r.text()).slice(0, 120); } catch { /* sin cuerpo */ }
      return { ok: false, motivo: `el servicio de avisos respondió ${r.status}${detalle ? ': ' + detalle : ''}` };
    }
    return { ok: true };
  } catch (e) {
    // Un `fetch` que truena sin respuesta es red o CORS.
    //
    // CORS es poco probable: las dos apps se publican por ruta dentro del mismo
    // sitio —`/proceso-pwa/` y `/Mantenimiento-Impredimex/`— y para el
    // navegador el origen es el host, no la ruta. Si el Worker acepta la
    // llamada de Mantenimiento, tiene que aceptar ésta igual.
    //
    // Queda mencionado porque el mensaje del navegador no distingue los dos
    // casos, y quien lea esto después merece saber qué ya se descartó.
    return {
      ok: false,
      motivo: 'no se pudo contactar el servicio de avisos: ' +
        (e instanceof Error ? e.message : 'sin respuesta')
    };
  }
};

/**
 * Levanta la OT en Mantenimiento.
 *
 * El orden importa y es deliberado:
 *
 * 1. Se aparta el folio. Si falla, no se escribe nada.
 * 2. Se escribe la OT **y su entrada en el índice** en una sola operación, así
 *    que no puede quedar una OT que Procesos no vea, ni una entrada de índice
 *    sin OT detrás.
 * 3. Se avisa al equipo. Si esto falla la OT ya existe, así que se devuelve
 *    `sinAviso: true` y la pantalla le dice al auditor que hable con
 *    Mantenimiento. Una OT que nadie sabe que entró es peor que no levantarla.
 */
export const levantarOT = async (d: DatosNuevaOT): Promise<ResultadoAlta> => {
  if (!d.equipo) {
    return { estado: 'error', motivo: 'no se sabe cómo llama Mantenimiento a esta máquina' };
  }
  if (!d.clave) return { estado: 'error', motivo: 'falta la clave de la máquina' };
  if (!d.desc.trim()) return { estado: 'error', motivo: 'falta la descripción' };
  if (!d.nave) return { estado: 'error', motivo: 'falta la nave' };

  let bd: Awaited<ReturnType<typeof conectar>>;
  let folio: string;
  try {
    bd = await conectar();
    folio = await apartarFolio(bd);
  } catch (e) {
    return {
      estado: 'error',
      motivo: e instanceof Error ? e.message : 'no se pudo apartar el folio'
    };
  }

  // La forma de la OT es la de Mantenimiento, campo por campo. Los arreglos
  // vacíos van explícitos porque su código los recorre sin preguntar.
  const ot = {
    id: folio,
    folio: `#${folio}`,
    tipo: TIPO_SERVICIO,
    nave: d.nave,
    equipo: d.equipo,
    desc: d.desc.trim(),
    prioridad: d.prioridad,
    status: 'abierto',
    solicitante: d.solicitante,
    nomina: d.nomina,
    tecnico: null,
    tecnicos: [],
    fechaAlta: new Date().toISOString(),
    avance: 0,
    actividades: [],
    refacciones: [],
    comentarios: [],
    espera: null,
    // SPEC-021: de dónde salió. Sin esto no habría forma de saber cuántas OT
    // nacen de auditorías ni cuántas de ésas se cierran, que es la medida de
    // si el programa de 5S sirve o solo levanta papel.
    origen: 'AUDITORIA',
    auditoriaTipo: d.auditoriaTipo,
    auditoriaFecha: d.auditoriaFecha,
    auditor: d.auditor,
    hallazgoTexto: d.hallazgoTexto.slice(0, 200),
    refHallazgo: d.refHallazgo || ''
  };

  const resumen = {
    folio: ot.folio,
    desc: ot.desc.slice(0, 140),
    status: ot.status,
    prioridad: ot.prioridad,
    fechaAlta: ot.fechaAlta,
    origen: 'AUDITORIA'
  };

  try {
    // Las dos rutas en una sola operación: Realtime Database aplica un
    // `update` de forma atómica, así que no puede quedar una OT que Procesos
    // no vea en el índice, ni una entrada de índice sin orden detrás.
    await update(ref(bd, 'manto_db'), {
      [`ots/${folio}`]: ot,
      [`abiertasPorMaquina/${d.clave}/${folio}`]: resumen
    });
  } catch (e) {
    return {
      estado: 'error',
      motivo: e instanceof Error ? e.message : 'no se pudo registrar la orden'
    };
  }

  const aviso = await avisar(bd, folio, ot.desc, d.equipo, d.nave, d.prioridad === 'Urgente');
  if (!aviso.ok) console.warn('[OT] el aviso no salió:', aviso.motivo);
  return { estado: 'ok', folio: ot.folio, sinAviso: !aviso.ok, motivoAviso: aviso.motivo };
};
