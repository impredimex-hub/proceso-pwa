/**
 * Ranking de puntos que más fallan (SPEC-007).
 *
 * El objetivo no es sólo verificar que se sigan los procedimientos, sino
 * **mejorar los procedimientos a partir del cumplimiento**. Para eso hace falta
 * saber qué punto concreto falla, no qué auditoría salió mal.
 *
 * Un punto que falla en el 60% de las revisiones, con gente distinta y máquinas
 * distintas, no es un problema de disciplina: el estándar está mal escrito, es
 * irreal, falta la herramienta para cumplirlo, o nunca se entrenó.
 */

/** Mínimo de revisiones para que un porcentaje signifique algo. */
export const UMBRAL_REVISIONES = 5;

export interface ItemSnapshotRk {
  id: number;
  seccion: string;
  queObservar: string;
}

export interface AuditoriaRk {
  maquinaId?: string;
  maquinaNombre?: string;
  tipoMaquina?: string;
  tipoAuditoria?: string;
  turno?: string;
  respuestas?: Record<string, string>;
  itemsSnapshot?: ItemSnapshotRk[];
  fechaAuditoria?: string;
}

/** Cómo le fue a un punto dentro de un corte (una máquina, un turno…). */
export interface Desglose {
  etiqueta: string;
  no: number;
  total: number;
  tasa: number;
}

export interface FilaRanking {
  puntoId: number;
  texto: string;
  seccion: string;
  /** Veces que se respondió «NO». */
  no: number;
  /** Veces que se respondió, sea SI o NO. */
  total: number;
  /** `no / total`, de 0 a 100. */
  tasa: number;
  /** Por debajo del umbral: se muestra aparte, no se ordena con los demás. */
  sinHistoria: boolean;
  porMaquina: Desglose[];
  porTurno: Desglose[];
}

const vacio = (): { no: number; total: number } => ({ no: 0, total: 0 });

const aDesglose = (m: Map<string, { no: number; total: number }>): Desglose[] =>
  [...m.entries()]
    .map(([etiqueta, v]) => ({
      etiqueta,
      no: v.no,
      total: v.total,
      tasa: v.total ? Math.round((100 * v.no) / v.total) : 0
    }))
    .sort((a, b) => b.tasa - a.tasa || b.total - a.total);

/**
 * Arma el ranking.
 *
 * **Los dos tipos de auditoría no se mezclan nunca.** El checklist de 5S es el
 * mismo para toda la planta, así que su ranking es comparable entre máquinas.
 * El de proceso es por familia, y sus puntos sólo se comparan contra auditorías
 * de la misma familia: cruzarlos daría un ranking sin significado, porque el
 * «punto 4» de Pegado y el de Flexografía no son la misma pregunta.
 *
 * Por eso `familia` es obligatorio para `PROCESO` y se ignora para `5S`.
 */
export const calcularRanking = (
  auditorias: AuditoriaRk[],
  tipo: 'PROCESO' | '5S',
  familia: string | null,
  umbral: number = UMBRAL_REVISIONES
): FilaRanking[] => {
  const acumulado = new Map<number, {
    texto: string;
    seccion: string;
    no: number;
    total: number;
    maquinas: Map<string, { no: number; total: number }>;
    turnos: Map<string, { no: number; total: number }>;
  }>();

  for (const a of auditorias) {
    if ((a.tipoAuditoria || 'PROCESO') !== tipo) continue;
    // Para proceso, solo la familia pedida. Para 5S, toda la planta.
    if (tipo === 'PROCESO' && familia && a.tipoMaquina !== familia) continue;

    const respuestas = a.respuestas || {};
    const items = a.itemsSnapshot || [];
    if (Object.keys(respuestas).length === 0) continue;

    const maquina = a.maquinaNombre || a.maquinaId || 'Sin máquina';
    const turno = a.turno || 'Sin turno';

    for (const [clave, valor] of Object.entries(respuestas)) {
      const puntoId = Number(clave);
      if (!Number.isFinite(puntoId)) continue;
      const v = (valor || '').toUpperCase();
      if (v !== 'SI' && v !== 'NO') continue;   // sin responder no cuenta

      const item = items.find(i => i.id === puntoId);
      let acc = acumulado.get(puntoId);
      if (!acc) {
        acc = {
          texto: item?.queObservar || `Punto #${puntoId}`,
          seccion: item?.seccion || '',
          no: 0, total: 0,
          maquinas: new Map(), turnos: new Map()
        };
        acumulado.set(puntoId, acc);
      }
      // El texto puede haberse editado en la plantilla; se queda el más
      // reciente que se haya visto, que es el que la gente reconoce hoy.
      if (item?.queObservar) { acc.texto = item.queObservar; acc.seccion = item.seccion; }

      const esNo = v === 'NO';
      acc.total++; if (esNo) acc.no++;

      const mm = acc.maquinas.get(maquina) || vacio();
      mm.total++; if (esNo) mm.no++;
      acc.maquinas.set(maquina, mm);

      const tt = acc.turnos.get(turno) || vacio();
      tt.total++; if (esNo) tt.no++;
      acc.turnos.set(turno, tt);
    }
  }

  const filas: FilaRanking[] = [...acumulado.entries()].map(([puntoId, acc]) => ({
    puntoId,
    texto: acc.texto,
    seccion: acc.seccion,
    no: acc.no,
    total: acc.total,
    tasa: acc.total ? Math.round((100 * acc.no) / acc.total) : 0,
    sinHistoria: acc.total < umbral,
    porMaquina: aDesglose(acc.maquinas),
    porTurno: aDesglose(acc.turnos)
  }));

  // Los que tienen historia primero, por tasa. Con dos o tres revisiones el
  // porcentaje es ruido —uno respondido una vez y fallado daría 100%— así que
  // los de abajo del umbral no compiten por el primer lugar: se listan aparte.
  return filas.sort((a, b) => {
    if (a.sinHistoria !== b.sinHistoria) return a.sinHistoria ? 1 : -1;
    if (a.tasa !== b.tasa) return b.tasa - a.tasa;
    return b.total - a.total;
  });
};

/**
 * ¿El punto falla parejo, o sólo en un lado?
 *
 * Es la lectura que vuelve accionable el ranking, y la que decide qué se hace:
 * si falla en todas partes, se corrige el estándar; si falla en una sola
 * máquina o un solo turno, se repara o se entrena ahí. Sin esto el ranking
 * señala pero no orienta.
 *
 * «Concentrado» significa que un solo corte explica más de dos tercios de las
 * fallas teniendo otros con qué compararse.
 */
export const dondeFalla = (fila: FilaRanking): {
  patron: 'PAREJO' | 'CONCENTRADO' | 'INSUFICIENTE';
  culpable: string | null;
} => {
  if (fila.sinHistoria || fila.no === 0) return { patron: 'INSUFICIENTE', culpable: null };

  for (const corte of [fila.porMaquina, fila.porTurno]) {
    const conFallas = corte.filter(d => d.no > 0);
    if (corte.length < 2 || conFallas.length === 0) continue;
    const mayor = conFallas[0];
    if (conFallas.length === 1 || mayor.no / fila.no > 0.67) {
      return { patron: 'CONCENTRADO', culpable: mayor.etiqueta };
    }
  }
  return { patron: 'PAREJO', culpable: null };
};

/** Las familias de máquina que tienen al menos una auditoría de proceso. */
export const familiasConProceso = (auditorias: AuditoriaRk[]): string[] =>
  [...new Set(
    auditorias
      .filter(a => (a.tipoAuditoria || 'PROCESO') === 'PROCESO' && a.tipoMaquina)
      .map(a => a.tipoMaquina as string)
  )].sort();
