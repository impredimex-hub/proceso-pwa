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

import { esPuntoDeSeguridad } from './hallazgos';

/** Mínimo de revisiones para que un porcentaje signifique algo. */
export const UMBRAL_REVISIONES = 5;

/** Para comparar textos sin que acentos, mayúsculas o espacios los separen. */
const normalizar = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

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
  /** Identidad real de la fila: número de punto **y** texto (ver abajo). */
  clave: string;
  puntoId: number;
  texto: string;
  seccion: string;
  /** Resuelto con la misma regla que los hallazgos (SPEC-010). */
  seguridad: boolean;
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
  /**
   * La llave agrupa por **número de punto y texto**, no solo por número.
   *
   * Los `id` son por plantilla: el punto 7 de la plantilla de Pegado y el 7 de
   * la de Flexografía son preguntas distintas. Agrupando solo por número, en
   * cuanto alguien edite una plantilla el ranking sumaría dos preguntas como si
   * fueran la misma, y nadie lo notaría.
   *
   * Incluir el texto cambia el modo de falla: dos preguntas distintas ya no se
   * mezclan nunca, y una misma pregunta reescrita aparece partida en dos
   * renglones —un error a la vista, no uno silencioso—.
   */
  const acumulado = new Map<string, {
    puntoId: number;
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
      const texto = item?.queObservar || `Punto #${puntoId}`;
      const llave = `${puntoId}::${normalizar(texto)}`;

      let acc = acumulado.get(llave);
      if (!acc) {
        acc = {
          puntoId,
          texto,
          seccion: item?.seccion || '',
          no: 0, total: 0,
          maquinas: new Map(), turnos: new Map()
        };
        acumulado.set(llave, acc);
      }

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

  const filas: FilaRanking[] = [...acumulado.entries()].map(([clave, acc]) => ({
    clave,
    puntoId: acc.puntoId,
    texto: acc.texto,
    seccion: acc.seccion,
    // La misma regla que clasifica los hallazgos, no una copia (SPEC-010).
    seguridad: esPuntoDeSeguridad({ id: acc.puntoId, seccion: acc.seccion, queObservar: acc.texto }),
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

/**
 * Puntos de seguridad que ya fallaron, aunque todavía no lleguen al umbral.
 *
 * La regla del umbral es correcta —con cuatro revisiones el porcentaje es
 * ruido— pero aplicarla a la seguridad la esconde. Un punto de guardas fallando
 * 3 de 4 veces no necesita significancia estadística para atenderse, y la
 * SPEC-010 dice que la seguridad va primero en cualquier pantalla donde
 * compita con otra cosa.
 *
 * Así que no se mueven al ranking —seguirían sin historia suficiente para
 * ordenarse contra los demás— sino que se sacan aparte, a la vista.
 */
export const seguridadPendiente = (filas: FilaRanking[]): FilaRanking[] =>
  filas
    .filter(f => f.seguridad && f.sinHistoria && f.no > 0)
    .sort((a, b) => b.tasa - a.tasa || b.no - a.no);

/** Las familias de máquina que tienen al menos una auditoría de proceso. */
export const familiasConProceso = (auditorias: AuditoriaRk[]): string[] =>
  [...new Set(
    auditorias
      .filter(a => (a.tipoAuditoria || 'PROCESO') === 'PROCESO' && a.tipoMaquina)
      .map(a => a.tipoMaquina as string)
  )].sort();
