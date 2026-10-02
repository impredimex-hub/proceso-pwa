/**
 * Comportamiento personal (SPEC-019).
 *
 * Las demás pantallas miran la planta. Esta mira a **una persona**, en los dos
 * papeles que tiene en el sistema:
 *
 * - **Como auditor**: de las máquinas que tiene asignadas, a cuáles ya les hizo
 *   su revisión y a cuáles no.
 * - **Como auditado**: cómo salieron las auditorías que le hicieron a él.
 *
 * Es la diferencia entre «la planta va así» y «tú vas así», y es lo que
 * convierte el seguimiento en algo que una persona puede accionar sola.
 */

export interface MaquinaAsignable {
  id: string;
  nombre: string;
  tipo: string;
  moduloProceso: boolean;
  modulo5S: boolean;
}

export interface AuditoriaComp {
  id?: string;
  maquinaId?: string;
  maquinaNombre?: string;
  tipoAuditoria?: string;
  fechaAuditoria?: string;
  cumplimiento?: number;
  estadoFinal?: string;
  auditor?: string;
  /** Desde la SPEC-019 se guarda; los documentos viejos no lo traen. */
  nominaAuditor?: string;
  nominaAuditado?: string;
  nominaSupervisor?: string;
  hallazgos?: unknown[];
}

/* ── A quién le toca cada máquina ────────────────────────────────────────
   La matriz estaba dentro de `App.tsx`, mezclada con la búsqueda en el
   padrón. Aquí queda la regla sola, en nóminas, para poder preguntarle lo
   contrario: **qué máquinas le tocan a una persona**, que es lo que esta
   pantalla necesita y antes no se podía averiguar.

   Sigue siendo una lista fija en código, que es la deuda técnica 2 del
   proyecto: debería salir de datos. Al menos ahora está en un solo lugar. */

export const nominasDeMaquina = (m: MaquinaAsignable): string[] => {
  const { id, tipo } = m;
  if (tipo === 'Digital' || tipo === 'Suajado') return ['885'];
  if (tipo === 'Rotograbado' || tipo === 'Flexografía' || tipo === 'Laminado' || id === 'DEP1') {
    return ['2308', '2398', '2159'];
  }
  if (['Refilado', 'Pegado', 'Revisión', 'Corte'].includes(tipo) || id === 'DEP2') {
    return ['1853', '2377'];
  }
  if (id === 'area-tintas') return ['2129'];
  if (id === 'area-mp' || id === 'area-pt') return ['1802'];
  if (id === 'area-mant') return ['2432'];
  if (id === 'area-banos') return ['2308', '2398', '2159', '1853', '2377'];
  return [];
};

/** Las máquinas y áreas que le tocan a una nómina. */
export const maquinasDe = (nomina: string, catalogo: MaquinaAsignable[]): MaquinaAsignable[] =>
  catalogo.filter((m) => nominasDeMaquina(m).includes(String(nomina).trim()));

/** Para comparar nombres sin que acentos ni mayúsculas los separen. */
const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * ¿La hizo esta persona?
 *
 * Los documentos nuevos traen `nominaAuditor` y la respuesta es exacta. Los
 * anteriores a la SPEC-019 solo guardan el **nombre escrito a mano** en
 * `auditor`, así que ahí se compara por nombre: el campo venía prellenado con
 * el del usuario, pero es editable y alguien pudo cambiarlo.
 */
export const laHizo = (a: AuditoriaComp, nomina: string, nombre: string): boolean => {
  if (a.nominaAuditor) return String(a.nominaAuditor).trim() === String(nomina).trim();
  const n = norm(nombre);
  if (!n) return false;
  return norm(a.auditor || '') === n;
};

/** ¿Esta persona fue la auditada? */
export const fueAuditado = (a: AuditoriaComp, nomina: string): boolean => {
  const n = String(nomina).trim();
  return String(a.nominaAuditado || '').trim() === n
      || String(a.nominaSupervisor || '').trim() === n;
};

const esCincoS = (a: AuditoriaComp) => (a.tipoAuditoria || 'PROCESO').toUpperCase() === '5S';

export interface EstadoRevision {
  /** `false` cuando esa máquina no lleva ese tipo de auditoría. */
  aplica: boolean;
  hecha: boolean;
  fecha: string | null;
  cumplimiento: number | null;
}

export interface FilaMaquina {
  id: string;
  nombre: string;
  tipo: string;
  proceso: EstadoRevision;
  cincoS: EstadoRevision;
  /** Le falta al menos una de las que sí le aplican. */
  pendiente: boolean;
}

/**
 * Cómo va una persona **como auditor**, máquina por máquina.
 *
 * `desde` acota a un periodo: sin él, «ya la revisó» acabaría siendo cierto
 * para siempre en cuanto la revisara una vez, y la pantalla dejaría de pedir
 * nada.
 */
export const comoAuditor = (
  nomina: string,
  nombre: string,
  catalogo: MaquinaAsignable[],
  auditorias: AuditoriaComp[],
  desde?: string | null
): FilaMaquina[] => {
  const mias = auditorias.filter(
    (a) => laHizo(a, nomina, nombre) && (!desde || (a.fechaAuditoria || '') >= desde)
  );

  return maquinasDe(nomina, catalogo).map((m) => {
    const deLaMaquina = mias.filter((a) => a.maquinaId === m.id);

    const estado = (aplica: boolean, lista: AuditoriaComp[]): EstadoRevision => {
      if (!aplica) return { aplica: false, hecha: false, fecha: null, cumplimiento: null };
      if (lista.length === 0) return { aplica: true, hecha: false, fecha: null, cumplimiento: null };
      // La más reciente manda.
      const u = [...lista].sort((x, y) => (y.fechaAuditoria || '').localeCompare(x.fechaAuditoria || ''))[0];
      return {
        aplica: true, hecha: true,
        fecha: u.fechaAuditoria || null,
        cumplimiento: typeof u.cumplimiento === 'number' ? u.cumplimiento : null
      };
    };

    const proceso = estado(m.moduloProceso, deLaMaquina.filter((a) => !esCincoS(a)));
    const cincoS = estado(m.modulo5S, deLaMaquina.filter(esCincoS));

    return {
      id: m.id, nombre: m.nombre, tipo: m.tipo, proceso, cincoS,
      pendiente: (proceso.aplica && !proceso.hecha) || (cincoS.aplica && !cincoS.hecha)
    };
  });
};

export interface ResumenAuditado {
  total: number;
  /** Promedio de cumplimiento, redondeado. `null` sin auditorías. */
  promedio: number | null;
  aprobadas: number;
  conHallazgos: number;
  /** Total de hallazgos levantados en su contra. */
  hallazgos: number;
  /** De la más reciente a la más vieja. */
  detalle: {
    id: string;
    fecha: string;
    maquina: string;
    tipo: string;
    cumplimiento: number | null;
    hallazgos: number;
    aprobada: boolean;
    auditor: string;
  }[];
}

/** Cómo le fue a una persona **como auditado**. */
export const comoAuditado = (
  nomina: string,
  auditorias: AuditoriaComp[],
  desde?: string | null
): ResumenAuditado => {
  const mias = auditorias
    .filter((a) => fueAuditado(a, nomina) && (!desde || (a.fechaAuditoria || '') >= desde))
    .sort((a, b) => (b.fechaAuditoria || '').localeCompare(a.fechaAuditoria || ''));

  const conNota = mias.filter((a) => typeof a.cumplimiento === 'number');
  const promedio = conNota.length
    ? Math.round(conNota.reduce((s, a) => s + (a.cumplimiento as number), 0) / conNota.length)
    : null;

  const detalle = mias.map((a) => {
    const n = Array.isArray(a.hallazgos) ? a.hallazgos.length : 0;
    return {
      id: a.id || '',
      fecha: a.fechaAuditoria || '',
      maquina: a.maquinaNombre || a.maquinaId || '',
      tipo: esCincoS(a) ? '5S' : 'PROCESO',
      cumplimiento: typeof a.cumplimiento === 'number' ? a.cumplimiento : null,
      hallazgos: n,
      // Se cree lo que el documento declara; si no lo trae, se deduce de que
      // no haya hallazgos, que es la misma regla con que se guardó.
      aprobada: a.estadoFinal ? a.estadoFinal === 'APROBADO' : n === 0,
      auditor: a.auditor || ''
    };
  });

  return {
    total: mias.length,
    promedio,
    aprobadas: detalle.filter((d) => d.aprobada).length,
    conHallazgos: detalle.filter((d) => !d.aprobada).length,
    hallazgos: detalle.reduce((s, d) => s + d.hallazgos, 0),
    detalle
  };
};

/** Quiénes tienen al menos una máquina asignada. Para el selector del ADMIN. */
export const nominasConMaquinas = (catalogo: MaquinaAsignable[]): string[] =>
  [...new Set(catalogo.flatMap(nominasDeMaquina))].sort();
