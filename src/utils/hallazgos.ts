/**
 * Hallazgos: reincidencia, seguridad y qué sigue abierto.
 *
 * Reúne las SPEC-009, SPEC-010 y SPEC-011, que miran el mismo dato desde tres
 * ángulos. Vive fuera de `App.tsx` para poder probarse sin montar React: son
 * reglas donde una comparación mal puesta cambia lo que la planta ve como
 * urgente.
 */

export type EstadoCumplimiento = 'PENDIENTE' | 'TERMINADO' | 'PENDIENTE_ATRASADO';

export interface HallazgoBase {
  id: string;
  puntoId?: number;
  esExtra?: boolean;
  /** Marca manual de seguridad. Solo la usan los `esExtra` (SPEC-010). */
  esSeguridad?: boolean;
  esReincidente?: boolean;
  hallazgo: string;
  accion: string;
  responsable: string;
  /** Fecha **comprometida** de cierre, capturada al levantarlo. */
  fechaCierre: string;
  /** Cuándo se marcó terminado de verdad. Distinto del compromiso (SPEC-009). */
  cerradoEn?: string;
  estadoSeguimiento?: EstadoCumplimiento;
}

export interface ItemSnapshot {
  id: number;
  seccion: string;
  queObservar: string;
  comoVerifica?: string;
}

export interface AuditoriaConHallazgos {
  id?: string;
  maquinaId?: string;
  maquinaNombre?: string;
  ordenTrabajo?: string;
  auditor?: string;
  fechaAuditoria?: string;
  tipoAuditoria?: string;
  hallazgos?: HallazgoBase[];
  itemsSnapshot?: ItemSnapshot[];
}

/** Un hallazgo ya con el contexto de su auditoría y todo resuelto. */
export interface HallazgoPlano extends HallazgoBase {
  docId: string;
  hallazgoIdx: number;
  maquinaId: string;
  maquinaNombre: string;
  ordenTrabajo: string;
  auditor: string;
  fechaAuditoria: string;
  tipoAuditoria: string;
  /** El texto del punto del checklist, cuando viene de uno. */
  textoPunto: string;
  seccionPunto: string;
  /** Resuelto por la SPEC-010, no por lo que traiga guardado. */
  seguridad: boolean;
  /** Resuelto contra la fecha de hoy, no por lo guardado. */
  estado: EstadoCumplimiento;
  /** Días de retraso sobre el compromiso. 0 si no está vencido. */
  diasVencido: number;
  /** El cierre anterior del mismo punto en la misma máquina (SPEC-009). */
  reincidenciaDe: ReincidenciaPrevia | null;
  /** Cuántas veces falló antes este punto en esta máquina. */
  vecesPrevias: number;
}

export interface ReincidenciaPrevia {
  fechaAuditoria: string;
  accion: string;
  responsable: string;
  /** Cuándo se cerró de verdad, si se registró. */
  cerradoEn: string | null;
  /** Días entre aquel cierre y esta nueva falla. `null` sin fecha de cierre. */
  diasHastaVolver: number | null;
}

/* ── SPEC-010 · Qué cuenta como seguridad ────────────────────────────────
   Decidido el 29/09/2026. **Un solo lugar**: si mañana cambia el criterio, se
   cambia aquí y no en cinco pantallas.

   La clasificación es por punto, no por sección: la sección 3 no es seguridad
   completa, pero uno de sus puntos sí lo es. */

/** Secciones que son de seguridad completas. */
export const SECCIONES_SEGURIDAD = ['4. SEGURIDAD'];

/**
 * Puntos sueltos de otras secciones que también cuentan.
 *
 * Se reconocen por texto y no por `id` **a propósito**: los `id` los reasigna
 * el editor de plantillas, y un número que se mueve clasificaría mal en
 * silencio. El texto es frágil de otra manera —si alguien reescribe el punto,
 * deja de coincidir— pero eso se nota, y este comentario dice dónde arreglarlo.
 */
export const TEXTOS_SEGURIDAD = [
  ['guardas', 'protecciones']   // «Guardas, cubiertas y protecciones de seguridad…»
];

const normalizar = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** ¿Este punto del checklist es de seguridad? */
export const esPuntoDeSeguridad = (item?: ItemSnapshot | null): boolean => {
  if (!item) return false;
  if (SECCIONES_SEGURIDAD.includes((item.seccion || '').trim().toUpperCase())) return true;
  const t = normalizar(item.queObservar);
  return TEXTOS_SEGURIDAD.some(claves => claves.every(k => t.includes(normalizar(k))));
};

/**
 * ¿Este hallazgo es de seguridad?
 *
 * Los que nacen de un punto del checklist se deducen de su sección. Los
 * `esExtra` no tienen punto de dónde deducirlo, así que dependen de la casilla
 * que se marca al levantarlos: es el único dato nuevo de todo el paquete.
 */
export const hallazgoEsDeSeguridad = (h: HallazgoBase, items?: ItemSnapshot[]): boolean => {
  if (h.esExtra) return h.esSeguridad === true;
  const item = (items || []).find(i => i.id === h.puntoId);
  return esPuntoDeSeguridad(item);
};

/* ── SPEC-011 · Abierto, vencido y cerrado ───────────────────────────────── */

/** Días entre dos fechas `AAAA-MM-DD`. Ancladas al mediodía; ver `cobertura.ts`. */
export const diasEntre = (desde: string, hasta: string): number => {
  const a = new Date(`${desde}T12:00:00`);
  const b = new Date(`${hasta}T12:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

/**
 * El estado real de un hallazgo hoy.
 *
 * `PENDIENTE_ATRASADO` **no se guarda**, se deduce: un hallazgo pendiente cuya
 * fecha comprometida ya pasó está atrasado desde que amanece, sin que nadie lo
 * toque. Guardarlo obligaría a recorrer la base cada noche.
 */
export const estadoReal = (h: HallazgoBase, hoy: string): EstadoCumplimiento => {
  if (h.estadoSeguimiento === 'TERMINADO') return 'TERMINADO';
  if (h.fechaCierre && hoy > h.fechaCierre) return 'PENDIENTE_ATRASADO';
  return 'PENDIENTE';
};

export const estaAbierto = (e: EstadoCumplimiento) => e !== 'TERMINADO';

/* ── Aplanado y SPEC-009 · Reincidencia ──────────────────────────────────── */

/**
 * Convierte las auditorías en una lista de hallazgos con su contexto, y marca
 * las reincidencias.
 *
 * **La llave de la reincidencia es `(maquinaId, puntoId)`.** Un hallazgo
 * reincide cuando ese mismo punto ya falló antes en esa misma máquina y aquel
 * hallazgo se cerró. Sustituye a la detección anterior, que buscaba la palabra
 * «reincidente» dentro del texto escrito a mano y fallaba en los dos sentidos.
 *
 * Los `esExtra` quedan fuera: sin `puntoId` no hay con qué ligarlos, y se
 * prefiere decirlo a fingir cobertura total.
 */
export const aplanarHallazgos = (
  auditorias: AuditoriaConHallazgos[],
  hoy: string
): HallazgoPlano[] => {
  const planos: HallazgoPlano[] = [];

  for (const a of auditorias) {
    if (!Array.isArray(a.hallazgos)) continue;
    const items = a.itemsSnapshot || [];

    a.hallazgos.forEach((h, idx) => {
      const item = items.find(i => i.id === h.puntoId);
      const estado = estadoReal(h, hoy);
      const fechaAuditoria = a.fechaAuditoria || hoy;

      planos.push({
        ...h,
        docId: a.id || '',
        hallazgoIdx: idx,
        maquinaId: a.maquinaId || '',
        maquinaNombre: a.maquinaNombre || '',
        ordenTrabajo: a.ordenTrabajo || '',
        auditor: a.auditor || '',
        fechaAuditoria,
        tipoAuditoria: a.tipoAuditoria || 'PROCESO',
        textoPunto: item?.queObservar || (h.esExtra ? 'Hallazgo fuera del checklist' : ''),
        seccionPunto: item?.seccion || '',
        seguridad: hallazgoEsDeSeguridad(h, items),
        estado,
        diasVencido: estado === 'PENDIENTE_ATRASADO' ? diasEntre(h.fechaCierre, hoy) : 0,
        reincidenciaDe: null,
        vecesPrevias: 0
      });
    });
  }

  // Orden cronológico para que «antes» signifique algo al buscar el cierre
  // anterior de cada punto.
  planos.sort((x, y) => x.fechaAuditoria.localeCompare(y.fechaAuditoria));

  // Historia por punto y máquina, construida sobre la marcha.
  const historia = new Map<string, HallazgoPlano[]>();

  for (const p of planos) {
    if (p.esExtra || p.puntoId === undefined || !p.maquinaId) continue;
    const llave = `${p.maquinaId}|${p.puntoId}`;
    const previos = historia.get(llave) || [];

    // Solo cuentan los **cerrados** anteriores: si el anterior sigue abierto, no
    // es que el punto haya vuelto a fallar, es que nunca se resolvió.
    const cerradosAntes = previos.filter(
      q => q.estadoSeguimiento === 'TERMINADO' && q.fechaAuditoria < p.fechaAuditoria
    );

    if (cerradosAntes.length > 0) {
      const ultimo = cerradosAntes[cerradosAntes.length - 1];
      p.reincidenciaDe = {
        fechaAuditoria: ultimo.fechaAuditoria,
        accion: ultimo.accion || 'Sin registrar',
        responsable: ultimo.responsable || 'No asignado',
        cerradoEn: ultimo.cerradoEn || null,
        diasHastaVolver: ultimo.cerradoEn ? diasEntre(ultimo.cerradoEn, p.fechaAuditoria) : null
      };
      p.vecesPrevias = cerradosAntes.length;
    }

    historia.set(llave, [...previos, p]);
  }

  return planos;
};

/**
 * Lo que el tablero muestra (SPEC-011): **solo lo abierto**.
 *
 * Primero lo de seguridad, luego lo vencido por antigüedad del retraso, y al
 * final lo pendiente en plazo. Un Gantt con lo ya cerrado es un archivo, no una
 * herramienta; lo cerrado sigue en su auditoría y en el historial del punto.
 */
export const tableroAbiertos = (planos: HallazgoPlano[]): HallazgoPlano[] =>
  planos
    .filter(p => estaAbierto(p.estado))
    .sort((a, b) => {
      if (a.seguridad !== b.seguridad) return a.seguridad ? -1 : 1;
      if (a.diasVencido !== b.diasVencido) return b.diasVencido - a.diasVencido;
      // Entre reincidentes y nuevos, primero el que ya había fallado.
      if (a.vecesPrevias !== b.vecesPrevias) return b.vecesPrevias - a.vecesPrevias;
      return a.fechaAuditoria.localeCompare(b.fechaAuditoria);
    });

/**
 * La línea de tiempo de un punto en una máquina (SPEC-009 y SPEC-011).
 *
 * Es donde vive lo cerrado: no se archiva ni se borra, se consulta por aquí.
 * Si algún día lo cerrado se moviera a otro lado, la reincidencia dejaría de
 * funcionar el mismo día.
 */
export const historialDePunto = (
  planos: HallazgoPlano[],
  maquinaId: string,
  puntoId: number
): HallazgoPlano[] =>
  planos
    .filter(p => p.maquinaId === maquinaId && p.puntoId === puntoId && !p.esExtra)
    .sort((a, b) => b.fechaAuditoria.localeCompare(a.fechaAuditoria));

/** Resumen para las tarjetas del tablero. */
export const resumenTablero = (planos: HallazgoPlano[]) => {
  const abiertos = planos.filter(p => estaAbierto(p.estado));
  return {
    abiertos: abiertos.length,
    vencidos: abiertos.filter(p => p.estado === 'PENDIENTE_ATRASADO').length,
    seguridad: abiertos.filter(p => p.seguridad).length,
    reincidentes: abiertos.filter(p => p.reincidenciaDe !== null).length
  };
};
