/**
 * Cobertura de auditoría: qué no se ha revisado (SPEC-008).
 *
 * Toda la aplicación mira hacia lo registrado. Esta es la única pantalla que
 * mira hacia lo que falta, y existe porque **las áreas de oportunidad no
 * detectadas no se pueden encontrar en una lista de lo que sí se auditó**: por
 * definición viven en lo que nadie ha mirado.
 *
 * La lógica vive aquí, fuera de `App.tsx`, para poder probarla sin montar
 * React. Un error de un día en el cálculo de antigüedad no se nota a simple
 * vista y cambiaría el orden de la pantalla entera.
 */

/** Días objetivo entre auditorías. Decidido el 29/09/2026 (SPEC-008). */
export const DIAS_OBJETIVO_DEFECTO = 15;

/** Lo que esta utilidad necesita de una máquina del catálogo. */
export interface MaquinaCobertura {
  id: string;
  nombre: string;
  tipo: string;
  moduloProceso: boolean;
  modulo5S: boolean;
}

/** Lo que necesita de una auditoría guardada. */
export interface AuditoriaCobertura {
  maquinaId?: string;
  fechaAuditoria?: string;
  tipoAuditoria?: string;
}

/** El estado de un tipo de auditoría en una máquina. */
export interface EstadoTipo {
  /** `false` en las áreas auxiliares, que no llevan validación de proceso. */
  aplica: boolean;
  /** `AAAA-MM-DD` de la última, o `null` si nunca se ha auditado. */
  ultima: string | null;
  /** Días transcurridos, o `null` si nunca se ha auditado. */
  dias: number | null;
  /** Pasó el objetivo, o nunca se auditó. `false` cuando no aplica. */
  atrasado: boolean;
}

export interface FilaCobertura {
  id: string;
  nombre: string;
  tipo: string;
  proceso: EstadoTipo;
  cincoS: EstadoTipo;
  /** Cuántos tipos aplicables no se han auditado nunca: 2, 1 o 0. */
  nunca: number;
  /** El mayor abandono entre los tipos que aplican. `null` si nunca. */
  peorDias: number | null;
}

/** `AAAA-MM-DD` de hoy, en hora local. */
export const hoyISO = (): string => {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

/**
 * Días entre dos fechas `AAAA-MM-DD`.
 *
 * Se anclan ambas al mediodía antes de restar. Con medianoche, un cambio de
 * horario de verano mete una hora de más o de menos y la división da 0.96 o
 * 1.04 días, que al truncar se convierte en un día de diferencia. Al mediodía
 * esa hora no alcanza a cruzar ninguna frontera.
 */
export const diasEntre = (desde: string, hasta: string): number => {
  const a = new Date(`${desde}T12:00:00`);
  const b = new Date(`${hasta}T12:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

/** Normaliza el tipo guardado: cualquier cosa que no sea 5S es proceso. */
const esCincoS = (a: AuditoriaCobertura) => (a.tipoAuditoria || 'PROCESO').toUpperCase() === '5S';

/**
 * Arma la tabla de cobertura.
 *
 * **Se calcula sobre todas las auditorías, no sobre las del usuario.** Un
 * supervisor que solo viera las suyas encontraría media planta «sin auditar»
 * cuando en realidad la revisó alguien más. Eso sería un hueco falso, que es lo
 * contrario de lo que esta pantalla existe para mostrar. La fecha de la última
 * revisión de una máquina no es un dato sensible.
 */
export const calcularCobertura = (
  catalogo: MaquinaCobertura[],
  auditorias: AuditoriaCobertura[],
  diasObjetivo: number = DIAS_OBJETIVO_DEFECTO,
  hoy: string = hoyISO()
): FilaCobertura[] => {
  // Última fecha por máquina y por tipo, en una sola pasada.
  const ultimaProceso = new Map<string, string>();
  const ultima5S = new Map<string, string>();

  for (const a of auditorias) {
    const id = a.maquinaId;
    const fecha = a.fechaAuditoria;
    if (!id || !fecha) continue;

    const mapa = esCincoS(a) ? ultima5S : ultimaProceso;
    const previa = mapa.get(id);
    // Las fechas `AAAA-MM-DD` se comparan como texto sin riesgo.
    if (!previa || fecha > previa) mapa.set(id, fecha);
  }

  const estadoDe = (aplica: boolean, ultima: string | undefined): EstadoTipo => {
    if (!aplica) return { aplica: false, ultima: null, dias: null, atrasado: false };
    if (!ultima) return { aplica: true, ultima: null, dias: null, atrasado: true };
    const dias = diasEntre(ultima, hoy);
    return { aplica: true, ultima, dias, atrasado: dias >= diasObjetivo };
  };

  const filas: FilaCobertura[] = catalogo.map(m => {
    const proceso = estadoDe(m.moduloProceso, ultimaProceso.get(m.id));
    const cincoS = estadoDe(m.modulo5S, ultima5S.get(m.id));

    const aplicables = [proceso, cincoS].filter(e => e.aplica);
    const nunca = aplicables.filter(e => e.ultima === null).length;
    const conFecha = aplicables.filter(e => e.dias !== null).map(e => e.dias as number);
    const peorDias = conFecha.length ? Math.max(...conFecha) : null;

    return { id: m.id, nombre: m.nombre, tipo: m.tipo, proceso, cincoS, nunca, peorDias };
  });

  // El orden es por abandono, no alfabético: la pantalla existe para que lo
  // olvidado salte a la vista.
  //
  // Una máquina sin ninguna auditoría es el caso más grave y va primero, y
  // entre esas, la que no tiene ninguno de los dos tipos antes que la que solo
  // le falta uno. Después, por los días de la más abandonada.
  return filas.sort((a, b) => {
    if (a.nunca !== b.nunca) return b.nunca - a.nunca;
    const da = a.peorDias ?? -1;
    const db = b.peorDias ?? -1;
    if (da !== db) return db - da;
    return a.nombre.localeCompare(b.nombre);
  });
};

/** Cuántas filas están atrasadas en al menos un tipo. Para el resumen. */
export const contarAtrasadas = (filas: FilaCobertura[]): number =>
  filas.filter(f => f.proceso.atrasado || f.cincoS.atrasado).length;

/** Cuántas nunca se han auditado en ningún tipo aplicable. */
export const contarNuncaAuditadas = (filas: FilaCobertura[]): number =>
  filas.filter(f => {
    const aplicables = [f.proceso, f.cincoS].filter(e => e.aplica);
    return aplicables.length > 0 && aplicables.every(e => e.ultima === null);
  }).length;
