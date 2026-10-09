/**
 * Catálogo de máquinas y zonas (SPEC-020).
 *
 * El listado de equipo vivía escrito en `App.tsx`. Cuando entraba una máquina
 * nueva o salía una que ya no existe, había que tocar el código de esta app
 * —y de cualquier otra que tuviera su propia copia— y volver a publicar. Es el
 * mismo problema que tenía la lista de personal antes de que RRHH se quedara
 * con ella: varias copias, actualizadas a distinto ritmo.
 *
 * El dueño del catálogo es la app de Mantenimiento. Aquí solo se lee.
 *
 * ── Lo que cuida el consumo ──────────────────────────────────────────────
 *
 * Mantenimiento vive en Realtime Database, que cobra por **bytes bajados**, no
 * por documentos leídos. Bajar las 56 fichas en cada apertura serían unos 8 KB
 * por aparato por vez, para descubrir casi siempre que son las mismas de ayer.
 *
 * Así que primero se lee `catalogoVer`, un número de unos quince bytes que
 * Mantenimiento mueve solo cuando el catálogo cambia de verdad. Si coincide con
 * el que ya está guardado aquí, no se baja nada más. En la práctica el catálogo
 * cambia unas cuantas veces al año, así que el costo de régimen son esos quince
 * bytes.
 *
 * ── Lo que pasa si esto falla ────────────────────────────────────────────
 *
 * Nada. La lectura es en segundo plano y nadie la espera: la app arranca con lo
 * último que se guardó, y si nunca se ha guardado nada, con la lista escrita en
 * el código. Un corte de red, una regla de Firebase mal puesta o un proyecto
 * caído dejan la app exactamente como estaba antes de este cambio.
 *
 * Por eso mismo el catálogo nuevo entra **en la siguiente apertura** y no al
 * instante: lo que se baja se guarda para el próximo arranque, en lugar de
 * cambiar las listas debajo de alguien que está capturando una auditoría.
 */

import { ref, get } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { conectarManto } from './manto';
import { suiteAuth } from './suite';

// La `v2` es la forma de la ficha, no la versión del catálogo. Al cambiar de
// forma —la SPEC-021 le sumó `nombreManto` y `naves`— la llave cambia también,
// así que una caché vieja simplemente no se encuentra y se baja de nuevo. Es
// más seguro que leer una ficha incompleta y escribir una OT mal armada.
const LLAVE_CACHE = 'catalogoManto.v2';
const LLAVE_VERSION = 'catalogoMantoVer.v2';

/** La forma que esta app necesita. `tipo` es la `familia` de Mantenimiento. */
export interface MaquinaCatalogo {
  id: string;
  nombre: string;
  tipo: string;
  moduloProceso: boolean;
  modulo5S: boolean;
  /**
   * El nombre con que Mantenimiento conoce la máquina (SPEC-021).
   *
   * Hace falta para levantar una OT: el campo `equipo` de una orden guarda el
   * **nombre**, no la clave, y para tres máquinas no coinciden —Omega/OME1,
   * Depuradora/DEP1, Depuradora acondicionado/DEP2—. Escribir la clave ahí
   * crearía una OT que nadie puede ligar a una máquina.
   *
   * Opcional porque una caché guardada antes de la SPEC-021 no lo trae.
   */
  nombreManto?: string;
  /** Naves donde está. También la pide la OT. */
  naves?: string[];
}

/* ── Lo que manda Mantenimiento ────────────────────────────────────────── */

interface FichaManto {
  id?: string;
  clave?: string;
  nombre?: string;
  familia?: string;
  descripcion?: string;
  naves?: string[];
  usos?: { cincoS?: boolean; proceso?: boolean };
  activo?: boolean;
}

/**
 * Traduce una ficha de Mantenimiento a lo que usa esta app.
 *
 * El `id` de aquí es la `clave` de allá, no su `id`: las auditorías ya
 * guardadas apuntan a `FL1`, y Mantenimiento la tiene registrada como `mq01`
 * porque sus órdenes de trabajo apuntan a eso. Cada app conserva la llave con
 * la que ya escribió su historial; la ficha carga las dos.
 *
 * Devuelve `null` para lo que esta app no audita, que es la mayor parte del
 * equipo de Mantenimiento: compresores, rampas, extractores.
 */
const traducir = (f: FichaManto): MaquinaCatalogo | null => {
  const clave = (f.clave || '').trim();
  const nombre = (f.nombre || '').trim();
  if (!clave || !nombre) return null;
  if (f.activo === false) return null;

  const proceso = !!f.usos?.proceso;
  const cincoS = !!f.usos?.cincoS;
  if (!proceso && !cincoS) return null;

  const desc = (f.descripcion || '').trim();
  return {
    id: clave,
    // Se arma igual que la lista escrita a mano —«FL1 (Flexográfica 1)»— para
    // que las pantallas no cambien de aspecto cuando el catálogo empiece a
    // llegar de Mantenimiento.
    nombre: desc && desc !== clave ? `${clave} (${desc})` : clave,
    tipo: (f.familia || 'Sin familia').trim(),
    moduloProceso: proceso,
    modulo5S: cincoS,
    nombreManto: nombre,
    naves: Array.isArray(f.naves) ? f.naves : []
  };
};

/** Una zona siempre va a 5S y nunca a validación de proceso. */
const traducirZona = (f: FichaManto): MaquinaCatalogo | null => {
  const clave = (f.clave || '').trim();
  const nombre = (f.nombre || '').trim();
  if (!clave || !nombre || f.activo === false) return null;
  return {
    id: clave, nombre, tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true,
    nombreManto: nombre, naves: Array.isArray(f.naves) ? f.naves : []
  };
};

/* ── Caché ─────────────────────────────────────────────────────────────── */

const normalizar = (v: unknown): FichaManto[] => {
  if (Array.isArray(v)) return v as FichaManto[];
  if (v && typeof v === 'object') return Object.values(v as Record<string, FichaManto>);
  return [];
};

/**
 * Lo último que se bajó. Síncrono a propósito: `App.tsx` lo usa al cargar el
 * módulo, antes de que React monte nada, igual que usaba la lista escrita.
 *
 * Devuelve `null` ante cualquier duda —sin guardar, ilegible, vacío, con forma
 * rara— para que quien llame se vaya a la lista del código.
 */
export const catalogoGuardado = (): MaquinaCatalogo[] | null => {
  try {
    const crudo = localStorage.getItem(LLAVE_CACHE);
    if (!crudo) return null;
    const lista = JSON.parse(crudo);
    if (!Array.isArray(lista) || lista.length === 0) return null;
    const limpia = lista.filter(
      (m: unknown): m is MaquinaCatalogo =>
        !!m && typeof m === 'object' &&
        typeof (m as MaquinaCatalogo).id === 'string' &&
        typeof (m as MaquinaCatalogo).nombre === 'string' &&
        typeof (m as MaquinaCatalogo).tipo === 'string'
    );
    return limpia.length ? limpia : null;
  } catch {
    return null;
  }
};

/** Cuándo se bajó lo que está guardado. `''` si no hay nada. */
export const versionGuardada = (): string => {
  try {
    return localStorage.getItem(LLAVE_VERSION) || '';
  } catch {
    return '';
  }
};

/* ── Refresco ──────────────────────────────────────────────────────────── */

let yaCorrio = false;

export interface ResultadoRefresco {
  estado: 'sin-cambios' | 'actualizado' | 'sin-datos' | 'error';
  total?: number;
  version?: string;
  motivo?: string;
}

/**
 * Pregunta a Mantenimiento si el catálogo cambió y, si cambió, lo guarda para
 * el próximo arranque.
 *
 * Corre una vez por carga de página. No lanza: cualquier problema vuelve como
 * `estado: 'error'`, porque quien la llama no tiene nada que hacer al respecto
 * más que seguir con lo que ya tenía.
 */
export const refrescarCatalogo = async (): Promise<ResultadoRefresco> => {
  if (yaCorrio) return { estado: 'sin-cambios', motivo: 'ya se consultó en esta carga' };
  yaCorrio = true;

  try {
    // SPEC-026: la base de Mantenimiento ya no abre a sesiones anónimas; se
    // entra con la credencial de la persona. Antes de iniciar sesión no hay
    // credencial, así que la consulta se aplaza hasta que alguien entre.
    await suiteAuth.authStateReady();
    if (!suiteAuth.currentUser) {
      yaCorrio = false;
      const dejar = onAuthStateChanged(suiteAuth, (u) => {
        if (!u) return;
        dejar();
        refrescarCatalogo().catch(() => { /* no lanza; se cubre por si acaso */ });
      });
      return { estado: 'error', motivo: 'sin sesión: se consultará al entrar' };
    }

    const bd = await conectarManto();

    // Primero el sello: quince bytes para saber si vale la pena lo demás.
    const sello = await get(ref(bd, 'manto_db/catalogoVer'));
    const version = String(sello.val() ?? '0');

    if (version !== '0' && version === versionGuardada() && catalogoGuardado()) {
      return { estado: 'sin-cambios', version };
    }

    const [snapMaq, snapZon] = await Promise.all([
      get(ref(bd, 'manto_db/maquinas')),
      get(ref(bd, 'manto_db/zonas'))
    ]);

    const maquinas = normalizar(snapMaq.val())
      .map(traducir)
      .filter((m): m is MaquinaCatalogo => m !== null);
    const zonas = normalizar(snapZon.val())
      .map(traducirZona)
      .filter((m): m is MaquinaCatalogo => m !== null);

    const lista = [...maquinas, ...zonas];

    // Un catálogo vacío casi siempre significa que algo salió mal del otro
    // lado, no que la planta se quedó sin máquinas. No se guarda: es mejor
    // seguir con la lista de ayer que quedarse sin ninguna.
    if (lista.length === 0) {
      return { estado: 'sin-datos', motivo: 'Mantenimiento no devolvió máquinas' };
    }

    try {
      localStorage.setItem(LLAVE_CACHE, JSON.stringify(lista));
      localStorage.setItem(LLAVE_VERSION, version);
    } catch {
      // Modo privado o almacenamiento lleno. Se perdió el viaje, no la app.
      return { estado: 'error', motivo: 'no se pudo guardar el catálogo' };
    }

    return { estado: 'actualizado', total: lista.length, version };
  } catch (e) {
    return { estado: 'error', motivo: e instanceof Error ? e.message : 'falló la lectura' };
  }
};
