/**
 * El foco compartido con Control de Procesos (SPEC-012).
 *
 * El objetivo habla de reducir errores **que cuesten productividad y
 * rechazos**. Sin ligar la auditoría con el costo real se puede demostrar que
 * se audita mucho, pero no que auditar esté reduciendo algo.
 *
 * ## De dónde salen estos números
 *
 * Del histórico de merma que Control de Procesos ya tiene cargado: 1 095
 * registros de 2025 y 2026. Aquí van **totalizados por máquina**, que es todo
 * lo que esta app necesita para decidir dónde auditar primero.
 *
 * ## Por qué es una copia y no una consulta
 *
 * Las dos apps viven en proyectos de Firebase distintos —esta en `proceso-pwa`,
 * Control en `impredimex-procesos`— y la cuota del plan gratuito es por
 * proyecto. Consultar la base de la otra app en cada carga sería repetir la
 * crisis de lecturas que costó semanas arreglar en la suite.
 *
 * Es el mismo patrón que Control usa consigo mismo: una semilla incrustada que
 * un dato cargado después puede sustituir (`SEMILLA_CARGADA || SEMILLA`).
 *
 * ## Lo que falta para que se actualice solo
 *
 * Que Control **publique** este resumen —veintitantas máquinas y un número cada
 * una— en un documento del proyecto de la suite, al que las dos apps ya se
 * conectan, y que se reescriba cuando se cargue merma nueva. Ese cambio es del
 * repositorio de Control y todavía no existe. `MERMA_PUBLICADA` es el hueco
 * donde entra sin tocar nada más.
 */

/**
 * Metros rechazados por máquina, 2025–2026.
 *
 * Copiado del histórico de Control el 29 de septiembre de 2026.
 */
export const MERMA_SEMILLA: Record<string, number> = {
  RT7: 445106,
  RT6: 244859,
  FL1: 233510,
  FL4: 83077,
  PEG2: 70888,
  FL3: 58814,
  PEG1: 40756,
  FL2: 12951,
  REF1: 2913,
  REF2: 2023,
  REF3: 1702,
  RT5: 1630,
  COR2: 864,
  COR3: 846,
  LAM1: 693,
  REV4: 189
};

/**
 * Los 15 059 metros que no aparecen arriba.
 *
 * El histórico de Control trae identificadores que el catálogo de esta app no
 * tiene: `LAM`, `PEG`, `PEG3`, `PEG7`, `PEG1 ` —con un espacio al final—,
 * `XEIKON` y `OMEGA`. Algunos son máquinas que ya no están y otros parecen la
 * misma máquina escrita de dos formas.
 *
 * **Son el 1.2% de la merma**, así que no cambian ninguna decisión, pero vale
 * la pena depurarlos del lado de Control en algún momento. Se deja escrito para
 * que el número de esta app no se lea como el total de la planta.
 */
export const METROS_SIN_CRUZAR = 15059;

/** Lo que publique Control algún día. Mientras sea `null`, manda la semilla. */
export let MERMA_PUBLICADA: Record<string, number> | null = null;

export const fijarMermaPublicada = (datos: Record<string, number> | null) => {
  MERMA_PUBLICADA = datos;
};

export const mermaVigente = (): Record<string, number> => MERMA_PUBLICADA || MERMA_SEMILLA;

/** Metros rechazados de una máquina. `0` si nunca ha rechazado. */
export const mermaDe = (maquinaId: string): number => mermaVigente()[maquinaId] || 0;

/**
 * El total contra el que se calculan los porcentajes.
 *
 * **Incluye los metros que no cruzan.** Si se dividiera solo entre las máquinas
 * de este catálogo, RT7 saldría en 37.1% aquí y en 36.6% en la pantalla de
 * Calidad, y nadie sabría cuál creer. Los porcentajes de esta app suman 98.8%
 * a propósito: el 1.2% que falta es lo que no cruza, y está declarado arriba.
 */
const totalDeLaPlanta = (): number => {
  const propio = Object.values(mermaVigente()).reduce((a, b) => a + b, 0);
  // Cuando Control publique el resumen ya vendrá completo y no hará falta sumar.
  return MERMA_PUBLICADA ? propio : propio + METROS_SIN_CRUZAR;
};

/** Qué parte del total de la planta explica esa máquina, de 0 a 100. */
export const participacionDe = (maquinaId: string): number => {
  const total = totalDeLaPlanta();
  if (!total) return 0;
  return (100 * (mermaVigente()[maquinaId] || 0)) / total;
};

/** Las máquinas que explican el 80% de la merma. El foco de la inspección. */
export const maquinasDelOchenta = (): string[] => {
  const datos = mermaVigente();
  const total = totalDeLaPlanta();
  if (!total) return [];
  const orden = Object.keys(datos).sort((a, b) => datos[b] - datos[a]);
  const salida: string[] = [];
  let suma = 0;
  for (const id of orden) {
    salida.push(id);
    suma += datos[id];
    if (suma / total >= 0.8) break;
  }
  return salida;
};

/* ── El cuadrante ─────────────────────────────────────────────────────────
   Control mide en metros rechazados, que es pérdida consumada. Esta app mide
   en porcentaje de cumplimiento. **Un promedio de las dos no significaría
   nada**, así que son dos ejes y lo que se lee es el cuadrante. */

export type Cuadrante = 'PRIMERO' | 'REVISAR_CHECKLIST' | 'CORREGIR' | 'EN_ORDEN' | 'SIN_DATOS';

export const ETIQUETA_CUADRANTE: Record<Cuadrante, string> = {
  PRIMERO: 'Ahí vas primero',
  REVISAR_CHECKLIST: 'El checklist no pregunta lo que importa',
  CORREGIR: 'Corregir, sin urgencia',
  EN_ORDEN: 'En orden',
  SIN_DATOS: 'Sin auditorías todavía'
};

/**
 * En qué cuadrante cae una máquina.
 *
 * El caso interesante es `REVISAR_CHECKLIST`: una máquina que **cumple bien la
 * auditoría y aun así rechaza mucho** significa que el checklist no está
 * preguntando por lo que de verdad causa los rechazos. Eso es un hallazgo sobre
 * el checklist, no sobre la máquina, y es justo el objetivo de mejorar los
 * procedimientos a partir del cumplimiento.
 *
 * `cumplimiento` es `null` cuando esa máquina no tiene auditorías: sin ellas no
 * hay eje vertical y no se inventa uno.
 */
export const cuadranteDe = (
  maquinaId: string,
  cumplimiento: number | null,
  umbralCumplimiento = 85
): Cuadrante => {
  if (cumplimiento === null) return 'SIN_DATOS';
  const cara = maquinasDelOchenta().includes(maquinaId);
  const cumple = cumplimiento >= umbralCumplimiento;
  if (cara && !cumple) return 'PRIMERO';
  if (cara && cumple) return 'REVISAR_CHECKLIST';
  if (!cara && !cumple) return 'CORREGIR';
  return 'EN_ORDEN';
};

/**
 * Reordena la cobertura cruzándola con el costo (SPEC-012).
 *
 * La SPEC-008 ordenaba solo por abandono. Una máquina con seis semanas sin
 * revisar que explica el 36% de la merma no es lo mismo que una con seis
 * semanas que no rechaza nada, y esta función es esa diferencia.
 *
 * **Primero lo atrasado, y dentro de lo atrasado, lo que más cuesta.** No se
 * multiplican días por metros: ese número no significaría nada y escondería de
 * cuál de los dos viene la urgencia. Lo atrasado es la condición; el costo,
 * el desempate.
 */
export const ordenarPorRiesgo = <T extends {
  id: string;
  nombre: string;
  proceso: { atrasado: boolean; dias: number | null };
  cincoS: { atrasado: boolean; dias: number | null };
  peorDias: number | null;
  nunca: number;
}>(filas: T[]): T[] => {
  const atrasada = (f: T) => f.proceso.atrasado || f.cincoS.atrasado;
  return [...filas].sort((a, b) => {
    const aa = atrasada(a), ba = atrasada(b);
    if (aa !== ba) return aa ? -1 : 1;
    const ma = mermaDe(a.id), mb = mermaDe(b.id);
    if (ma !== mb) return mb - ma;
    if (a.nunca !== b.nunca) return b.nunca - a.nunca;
    const da = a.peorDias ?? -1, db = b.peorDias ?? -1;
    if (da !== db) return db - da;
    return a.nombre.localeCompare(b.nombre);
  });
};

/** Cumplimiento promedio por máquina, de las auditorías que existan. */
export const cumplimientoPorMaquina = (
  auditorias: { maquinaId?: string; cumplimiento?: number }[]
): Record<string, number> => {
  const acc = new Map<string, { suma: number; n: number }>();
  for (const a of auditorias) {
    if (!a.maquinaId || typeof a.cumplimiento !== 'number') continue;
    const v = acc.get(a.maquinaId) || { suma: 0, n: 0 };
    v.suma += a.cumplimiento; v.n++;
    acc.set(a.maquinaId, v);
  }
  const salida: Record<string, number> = {};
  acc.forEach((v, k) => { salida[k] = Math.round(v.suma / v.n); });
  return salida;
};
