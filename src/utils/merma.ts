/**
 * El foco compartido con Control de Procesos (SPEC-012 y SPEC-017).
 *
 * El objetivo habla de reducir errores **que cuesten productividad y
 * rechazos**. Sin ligar la auditoría con el costo real se puede demostrar que
 * se audita mucho, pero no que auditar esté reduciendo algo.
 *
 * ## De dónde salen estos números
 *
 * Del histórico de merma que Control de Procesos tiene cargado: 1 095 registros
 * de 2025 y 2026. Aquí van **mes por mes**, que es el detalle más fino que
 * Control guarda, y de ahí se derivan los totales y los defectos de cualquier
 * periodo (SPEC-017). Antes solo se copiaban los totales, y eso impedía mirar
 * un mes concreto.
 *
 * ## Por qué es una copia y no una consulta
 *
 * Las dos apps viven en proyectos de Firebase distintos —esta en `proceso-pwa`,
 * Control en `impredimex-procesos`— y la cuota del plan gratuito es por
 * proyecto. Consultar la base de la otra app en cada carga sería repetir la
 * crisis de lecturas que costó semanas arreglar en la suite. Pesa 10 KB y viaja
 * en el propio código: no cuesta una sola lectura.
 *
 * ## Lo que falta para que se actualice solo
 *
 * Que Control **publique** este resumen en un documento del proyecto de la
 * suite, al que las dos apps ya se conectan, y lo reescriba cuando se cargue
 * merma nueva. Ese cambio es del repositorio de Control y todavía no existe.
 * `MERMA_PUBLICADA` es el hueco donde entra sin tocar nada más.
 */

/** Metros rechazados por máquina, defecto y mes (`AAAA-MM`). */
export const MERMA_MENSUAL: Record<string, Record<string, Record<string, number>>> =
{ "COR2": { "PUNTEADO": { "2025-09": 864 } }, "COR3": { "PUNTEADO": { "2025-01": 846 } }, "FL1": { "ARRUGA": { "2025-01": 2476, "2025-02": 4286, "2025-04": 848 }, "CURLING": { "2025-01": 3238, "2025-03": 2119, "2025-08": 4263, "2026-06": 3667 }, "DESLAMINADO": { "2025-02": 848, "2025-05": 848, "2025-08": 571, "2025-10": 380, "2025-11": 830 }, "EXCESO DE PRESIÓN": { "2026-02": 671 }, "FALTA DE PRESIÓN": { "2025-06": 1413, "2025-09": 492, "2026-01": 667, "2026-02": 524, "2026-03": 1079, "2026-04": 880, "2026-05": 3934, "2026-07": 4644 }, "FALTA DE TINTA": { "2025-09": 1238, "2026-02": 574 }, "FUERA DE REGISTRO": { "2026-03": 13469, "2026-04": 1055, "2026-05": 667 }, "GRABADO": { "2025-03": 1695 }, "IMPRESIÓN FALTANTE": { "2025-03": 378, "2025-04": 2084, "2025-05": 1238, "2025-06": 1272, "2025-08": 200, "2025-10": 1079, "2025-12": 1413 }, "LAGRIMEO": { "2025-02": 6994 }, "LAMINACIÓN": { "2025-01": 316, "2025-07": 1672 }, "LIMPIEZA": { "2026-06": 695, "2026-07": 1747 }, "MANCHAS": { "2025-01": 1918, "2025-02": 1719, "2025-03": 960, "2025-04": 962, "2025-05": 5832, "2025-06": 365, "2025-07": 1935, "2025-08": 633, "2025-09": 2128, "2025-10": 489, "2025-11": 1079, "2025-12": 695, "2026-02": 2001, "2026-03": 1650, "2026-04": 447, "2026-05": 18600, "2026-06": 209, "2026-07": 1341 }, "PIOJOS": { "2025-08": 7430, "2026-05": 1775 }, "POROSIDAD": { "2025-08": 7556, "2026-05": 3477 }, "RAYA": { "2025-01": 848, "2025-02": 1511, "2025-03": 3702, "2025-04": 7329, "2025-06": 2068, "2025-07": 933, "2025-08": 3566, "2025-09": 1429, "2025-10": 489, "2025-12": 1238, "2026-01": 937, "2026-02": 646, "2026-03": 4887, "2026-04": 2296, "2026-05": 1079, "2026-06": 5362 }, "REGISTRO": { "2025-01": 4239, "2026-01": 430, "2026-04": 527, "2026-06": 2191 }, "REMOSQUEO": { "2025-01": 2543, "2025-02": 2265, "2025-03": 2797, "2025-06": 822, "2025-07": 2648, "2026-01": 1314, "2026-02": 701, "2026-03": 4363, "2026-07": 382 }, "REPINTE": { "2025-03": 4662, "2025-04": 11387, "2025-09": 848, "2026-05": 4892 }, "TABLETEO": { "2025-06": 619, "2025-08": 254, "2026-03": 833 }, "TONOS": { "2025-02": 3673, "2026-03": 1667, "2026-06": 556 }, "VELO": { "2025-06": 612, "2025-08": 300 } }, "FL2": { "CURLING": { "2025-01": 1180 }, "FALTA DE PRESIÓN": { "2026-01": 548, "2026-02": 1945 }, "FUERA DE REGISTRO": { "2025-03": 548 }, "LAGRIMEO": { "2026-06": 3112 }, "PUNTEADO": { "2026-07": 600 }, "RAYA": { "2025-10": 289, "2026-02": 2540, "2026-06": 1331 }, "REGISTRO": { "2025-02": 548, "2025-12": 310 } }, "FL3": { "ARRUGA": { "2025-10": 170, "2026-07": 571 }, "DESLAMINADO": { "2026-05": 598 }, "DESPRENDIMIENTO": { "2025-05": 2515, "2026-01": 1730 }, "EMPLASTADO": { "2026-04": 5344 }, "FALTA DE PRESIÓN": { "2026-06": 800, "2026-07": 305 }, "FUERA DE REGISTRO": { "2026-04": 1956, "2026-05": 1466, "2026-06": 3077, "2026-07": 582 }, "IMPRESIÓN FALTANTE": { "2025-02": 340, "2025-10": 635 }, "LAMINACIÓN": { "2025-03": 510 }, "MANCHAS": { "2025-03": 1238, "2025-08": 80, "2026-01": 1730, "2026-03": 2084, "2026-04": 865, "2026-05": 1683, "2026-07": 435 }, "PIOJOS": { "2025-04": 223, "2026-02": 141, "2026-03": 1524, "2026-06": 797 }, "RAYA": { "2025-07": 1083, "2025-08": 229, "2025-09": 35, "2026-02": 591, "2026-07": 2547 }, "REGISTRO": { "2025-12": 1730, "2026-01": 1730, "2026-02": 108, "2026-04": 865 }, "SOBRE SUAJADO": { "2025-06": 94, "2025-09": 4115, "2025-10": 12909, "2026-07": 461 }, "VELO": { "2025-08": 41, "2026-07": 877 } }, "FL4": { "ARRUGA": { "2025-07": 2159 }, "CURLING": { "2025-04": 2400, "2025-08": 3186 }, "DESLAMINADO": { "2025-02": 5640 }, "EXCESO DE PRESIÓN": { "2026-02": 745 }, "FALTA DE PRESIÓN": { "2025-07": 2015, "2026-05": 2674 }, "FALTA DE TINTA": { "2026-02": 2235 }, "FUERA DE REGISTRO": { "2026-02": 3604, "2026-03": 1079, "2026-07": 313 }, "GRABADO": { "2025-08": 1079 }, "IMPRESIÓN FALTANTE": { "2025-02": 1511, "2025-03": 1364, "2025-04": 3444, "2025-05": 1195, "2025-06": 1490, "2025-08": 745, "2025-11": 513, "2026-07": 1445 }, "LAGRIMEO": { "2025-05": 197, "2026-06": 1490 }, "MANCHAS": { "2025-02": 2433, "2025-03": 2159, "2025-04": 673, "2026-02": 578, "2026-03": 808, "2026-04": 1319, "2026-05": 1778 }, "RAYA": { "2025-01": 2159, "2025-08": 407, "2026-06": 964, "2026-07": 777 }, "REGISTRO": { "2025-05": 3077, "2025-07": 3553 }, "REMOSQUEO": { "2025-03": 1741, "2026-03": 4420 }, "TONOS": { "2025-04": 9954, "2025-11": 4655 }, "VELO": { "2025-04": 586, "2025-07": 513 } }, "LAM1": { "LAMINACIÓN": { "2026-07": 693 } }, "PEG1": { "ADHESIVO": { "2025-08": 352, "2025-09": 1162, "2025-10": 3729, "2025-11": 3315, "2025-12": 2357, "2026-01": 1058, "2026-02": 352, "2026-04": 2121, "2026-05": 421, "2026-06": 2408, "2026-07": 3357 }, "ANCHO PLANO": { "2025-03": 283, "2026-05": 350 }, "DOBLEZ": { "2025-03": 86 }, "MANGA PEGADA": { "2025-02": 352, "2025-06": 3143, "2025-07": 352, "2026-07": 730 }, "PEGADO": { "2025-08": 400 }, "PUNTEADO": { "2025-02": 2848, "2025-03": 1410, "2025-04": 1762, "2025-07": 1706, "2025-09": 2400, "2025-11": 600, "2026-01": 2220 }, "TRASLAPE": { "2025-07": 1482 } }, "PEG2": { "ADHESIVO": { "2025-05": 1231, "2025-06": 705, "2025-07": 888, "2025-08": 12002, "2025-09": 3878, "2025-10": 5001, "2025-11": 705, "2025-12": 62, "2026-02": 1219, "2026-04": 692, "2026-05": 1288, "2026-06": 3020 }, "ANCHO PLANO": { "2025-02": 833, "2025-03": 2468, "2025-05": 1799, "2025-10": 1202, "2025-12": 2596, "2026-04": 2115, "2026-06": 1802, "2026-07": 2026 }, "DOBLEZ": { "2025-04": 338, "2025-10": 338, "2025-12": 125, "2026-01": 1762 }, "EMPALMES": { "2026-04": 705 }, "MANGA ABIERTA": { "2026-03": 533 }, "MANGA PEGADA": { "2025-01": 352, "2025-02": 837, "2025-04": 1363, "2025-05": 2016, "2025-06": 5640, "2025-12": 1013 }, "PEGADO": { "2026-01": 730 }, "PUNTEADO": { "2025-01": 2468, "2025-02": 705, "2025-04": 1762, "2025-07": 352, "2025-08": 1355, "2026-04": 352, "2026-06": 600 }, "TRASLAPE": { "2026-06": 2010 } }, "REF1": { "ADHESIVO": { "2026-06": 680 }, "EMPALMES": { "2026-05": 750, "2026-06": 189 }, "MANCHAS": { "2026-03": 829 }, "REFILADO MOVIDO": { "2025-08": 465 } }, "REF2": { "MAL REFILADO": { "2025-06": 736 }, "REFILADO MOVIDO": { "2025-11": 1287 } }, "REF3": { "MAL REFILADO": { "2025-07": 1655 }, "ONDULACIÓN": { "2025-09": 47 } }, "REV4": { "ARRUGA": { "2025-10": 189 } }, "RT5": { "LAGRIMEO": { "2025-01": 737 }, "MANCHAS": { "2025-05": 455 }, "RAYA": { "2025-06": 69 }, "REGISTRO": { "2025-01": 369 } }, "RT6": { "ADHESIVO": { "2025-08": 352, "2026-02": 1058, "2026-05": 352 }, "ANCHO PLANO": { "2026-07": 338 }, "DESPRENDIMIENTO": { "2025-05": 682 }, "EMPALMES": { "2026-06": 536, "2026-07": 352 }, "FALTA DE PRESIÓN": { "2025-12": 540, "2026-05": 3850 }, "FALTA DE TINTA": { "2026-02": 352, "2026-07": 1735 }, "FUERA DE REGISTRO": { "2025-10": 189, "2026-02": 352, "2026-04": 352, "2026-06": 1407, "2026-07": 705 }, "IMPRESIÓN FALTANTE": { "2025-03": 2468, "2025-05": 590, "2025-11": 352 }, "LAGRIMEO": { "2025-01": 5970, "2025-02": 4632, "2025-03": 705, "2025-04": 3878, "2025-05": 1800, "2025-06": 4582, "2025-07": 690, "2025-09": 705, "2025-10": 633, "2026-01": 3784, "2026-02": 352, "2026-03": 2018, "2026-04": 1058, "2026-05": 1441, "2026-06": 705, "2026-07": 400 }, "MAL REFILADO": { "2025-04": 352, "2025-07": 705 }, "MANCHAS": { "2025-01": 1474, "2025-02": 705, "2025-04": 189, "2025-05": 9442, "2025-06": 352, "2025-09": 705, "2025-10": 3878, "2025-11": 705, "2026-01": 1762, "2026-02": 705, "2026-04": 2115, "2026-05": 700, "2026-06": 3163, "2026-07": 1815 }, "MANGA PEGADA": { "2025-09": 352 }, "PEGADO": { "2026-02": 352 }, "PIOJOS": { "2025-03": 352, "2025-06": 352 }, "PUNTEADO": { "2026-07": 1072 }, "RAYA": { "2006-06": 1072, "2025-01": 417, "2025-02": 3860, "2025-03": 984, "2025-04": 3133, "2025-05": 6095, "2025-06": 7755, "2025-07": 5606, "2025-08": 3159, "2025-09": 3896, "2025-10": 8258, "2025-11": 3502, "2025-12": 352, "2026-01": 13673, "2026-02": 3525, "2026-04": 9124, "2026-05": 7000, "2026-06": 10763, "2026-07": 12984 }, "REFILADO MOVIDO": { "2025-01": 833, "2025-09": 1410, "2026-05": 1510 }, "REGISTRO": { "2025-01": 833, "2025-02": 3750, "2025-05": 7988, "2025-06": 2115, "2026-01": 1175, "2026-02": 1058, "2026-03": 338, "2026-04": 705, "2026-05": 4675, "2026-06": 2235, "2026-07": 1762 }, "REPINTE": { "2025-07": 321, "2026-05": 705, "2026-07": 1058 }, "RESEQUEDAD": { "2025-01": 1925, "2025-04": 705, "2025-05": 352, "2025-11": 352, "2026-04": 352, "2026-05": 1514, "2026-07": 352 }, "TONOS": { "2025-02": 2115, "2025-04": 3525, "2025-10": 1058, "2026-01": 705, "2026-02": 352 }, "VELO": { "2025-02": 1058, "2025-03": 4925, "2025-04": 352, "2025-05": 1132, "2025-06": 804, "2025-09": 352, "2025-10": 705, "2026-02": 352, "2026-05": 1410, "2026-06": 1271, "2026-07": 400 } }, "RT7": { "ADHESIVO": { "2025-08": 562, "2025-11": 1287, "2026-02": 482, "2026-04": 400, "2026-05": 755 }, "ARRUGA": { "2025-05": 1028, "2026-04": 347 }, "DESPRENDIMIENTO": { "2025-04": 23166 }, "EXCESO DE PRESIÓN": { "2026-02": 400, "2026-07": 2666 }, "FALTA DE PRESIÓN": { "2026-03": 2133, "2026-05": 141, "2026-07": 3469 }, "FALTA DE TINTA": { "2026-02": 966, "2026-06": 340 }, "FUERA DE REGISTRO": { "2025-10": 378, "2026-02": 1154, "2026-03": 493, "2026-05": 1435, "2026-06": 4169, "2026-07": 513 }, "GOLPE": { "2025-12": 3895, "2026-02": 5967 }, "IMPRESIÓN FALTANTE": { "2025-02": 1414, "2025-03": 40900, "2025-04": 1053, "2025-06": 566, "2025-11": 15600, "2026-03": 566 }, "LAGRIMEO": { "2025-01": 2746, "2025-02": 682, "2025-03": 755, "2025-04": 363, "2025-05": 6862, "2025-06": 3034, "2025-07": 7293, "2025-08": 3671, "2025-09": 3845, "2025-10": 7434, "2025-11": 7639, "2025-12": 508, "2026-01": 2574, "2026-02": 9177, "2026-03": 600, "2026-04": 3107, "2026-05": 5743, "2026-06": 12432, "2026-07": 8846 }, "LIMPIEZA": { "2025-11": 1399 }, "MAL REFILADO": { "2026-03": 189 }, "MANCHAS": { "2025-01": 8835, "2025-02": 562, "2025-03": 189, "2025-04": 2932, "2025-05": 2913, "2025-06": 1666, "2025-07": 1314, "2025-09": 682, "2025-11": 1544, "2025-12": 378, "2026-01": 603, "2026-02": 944, "2026-03": 5266, "2026-04": 529, "2026-05": 2228, "2026-06": 1209, "2026-07": 4099 }, "MANGA PEGADA": { "2025-01": 189, "2025-07": 1072 }, "PEGADO": { "2026-02": 965 }, "PIOJOS": { "2025-06": 566, "2026-02": 800 }, "POROSIDAD": { "2025-08": 4500 }, "PUNTEADO": { "2025-08": 3900 }, "RAYA": { "2025-02": 944, "2025-03": 771, "2025-04": 2250, "2025-06": 8868, "2025-07": 11853, "2025-08": 2631, "2025-09": 3281, "2025-10": 189, "2025-11": 827, "2026-01": 9044, "2026-02": 2574, "2026-03": 6637, "2026-04": 3645, "2026-05": 3675, "2026-06": 5175, "2026-07": 15850 }, "REFILADO MOVIDO": { "2025-06": 730, "2025-10": 378 }, "REGISTRO": { "2025-02": 536, "2025-03": 257, "2025-05": 1942, "2025-06": 378, "2025-07": 15455, "2025-08": 751, "2025-11": 5242, "2025-12": 566, "2026-01": 13777, "2026-02": 4201, "2026-03": 755, "2026-04": 378, "2026-05": 2575, "2026-06": 1678, "2026-07": 4031 }, "REMOSQUEO": { "2025-08": 5454, "2026-02": 3600 }, "REPINTE": { "2025-03": 830, "2026-05": 1200 }, "RESEQUEDAD": { "2025-02": 786, "2026-05": 924 }, "TEXTO FALTANTE": { "2026-02": 566, "2026-05": 400 }, "TONOS": { "2026-03": 349, "2026-05": 1079, "2026-06": 600 }, "TRASLAPE": { "2026-06": 1255 }, "VELO": { "2025-01": 3457, "2025-03": 771, "2025-05": 11416, "2025-06": 2069, "2025-07": 6698, "2025-09": 1125, "2025-10": 1855, "2025-11": 2727, "2025-12": 566, "2026-01": 1363, "2026-02": 5177, "2026-03": 2045, "2026-04": 1202, "2026-05": 777, "2026-06": 340, "2026-07": 1602 } } };

/** Un periodo cerrado. `null` significa todo el histórico. */
export interface Periodo { desde: string; hasta: string }

/** Un defecto con su peso dentro de la máquina. */
export interface DefectoPrincipal {
  nombre: string;
  metros: number;
  /** Qué parte de la merma **de esa máquina** explica, no de la planta. */
  pct: number;
}

/**
 * Metros que el histórico trae con una fecha imposible.
 *
 * Un registro: RT6 · RAYA · **2006-06** · 1 072 m. Es un año mal tecleado en la
 * captura original —2026 o 2025— y no se puede adivinar cuál, porque RT6 ya
 * tiene raya registrada en los dos junios.
 *
 * Se conserva en el total del histórico completo, porque Control también lo
 * cuenta y los números de las dos apps tienen que coincidir. Queda fuera del
 * selector de meses, donde «junio de 2006» solo confundiría. Conviene
 * corregirlo del lado de Control.
 */
export const METROS_FECHA_INVALIDA = 1072;

/** Desde cuándo se considera válido un mes. Ver `METROS_FECHA_INVALIDA`. */
const PRIMER_MES_VALIDO = '2025-01';

/**
 * Los 15 059 metros que no aparecen en ninguna máquina de este catálogo.
 *
 * El histórico de Control trae identificadores que esta app no tiene: `LAM`,
 * `PEG`, `PEG3`, `PEG7`, `PEG1 ` —con un espacio al final—, `XEIKON` y
 * `OMEGA`. Son el **1.2%** de la merma, así que no cambian ninguna decisión,
 * pero **se suman al denominador del histórico completo a propósito**: si se
 * dividiera solo entre las máquinas de aquí, RT7 saldría en 37.1% y en la
 * pantalla de Calidad en 36.6%, y nadie sabría cuál creer.
 *
 * No se pueden repartir por mes, así que al filtrar un periodo los porcentajes
 * son sobre lo registrado en ese periodo. La pantalla lo dice.
 */
export const METROS_SIN_CRUZAR = 15059;

/** Lo que publique Control algún día. Mientras sea `null`, manda la copia. */
export let MERMA_PUBLICADA: Record<string, Record<string, Record<string, number>>> | null = null;

export const fijarMermaPublicada = (d: typeof MERMA_PUBLICADA) => { MERMA_PUBLICADA = d; };

const vigente = () => MERMA_PUBLICADA || MERMA_MENSUAL;

const dentro = (mes: string, p?: Periodo | null) =>
  !p || (mes >= p.desde && mes <= p.hasta);

/** Metros rechazados de una máquina en un periodo. `0` si no rechazó. */
export const mermaDe = (maquinaId: string, periodo?: Periodo | null): number => {
  const dd = vigente()[maquinaId];
  if (!dd) return 0;
  let total = 0;
  for (const meses of Object.values(dd)) {
    for (const [mes, m] of Object.entries(meses)) if (dentro(mes, periodo)) total += m;
  }
  return total;
};

/** Los defectos de una máquina en un periodo, de mayor a menor. */
export const defectosDe = (
  maquinaId: string, periodo?: Periodo | null, cuantos = 4
): DefectoPrincipal[] => {
  const dd = vigente()[maquinaId];
  if (!dd) return [];
  const suma: Record<string, number> = {};
  for (const [defecto, meses] of Object.entries(dd)) {
    for (const [mes, m] of Object.entries(meses)) {
      if (dentro(mes, periodo)) suma[defecto] = (suma[defecto] || 0) + m;
    }
  }
  const total = Object.values(suma).reduce((a, b) => a + b, 0);
  if (!total) return [];
  return Object.entries(suma)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, cuantos)
    .map(([nombre, metros]) => ({
      nombre, metros, pct: Math.round((1000 * metros) / total) / 10
    }));
};

/**
 * El total contra el que se calculan los porcentajes.
 *
 * En el histórico completo incluye los metros que no cruzan, para que RT7 diga
 * 36.6% aquí y 36.6% en Calidad. En un periodo no puede: esos metros no están
 * desglosados por mes, así que el porcentaje es sobre lo registrado entonces.
 */
const totalDeLaPlanta = (periodo?: Periodo | null): number => {
  const propio = Object.keys(vigente()).reduce((s, id) => s + mermaDe(id, periodo), 0);
  if (periodo || MERMA_PUBLICADA) return propio;
  return propio + METROS_SIN_CRUZAR;
};

/** Qué parte del total explica esa máquina, de 0 a 100. */
export const participacionDe = (maquinaId: string, periodo?: Periodo | null): number => {
  const total = totalDeLaPlanta(periodo);
  if (!total) return 0;
  return (100 * mermaDe(maquinaId, periodo)) / total;
};

/** Las máquinas que explican el 80% de la merma del periodo. */
export const maquinasDelOchenta = (periodo?: Periodo | null): string[] => {
  const total = totalDeLaPlanta(periodo);
  if (!total) return [];
  const orden = Object.keys(vigente())
    .map((id) => [id, mermaDe(id, periodo)] as const)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1]);
  const salida: string[] = [];
  let suma = 0;
  for (const [id, m] of orden) {
    salida.push(id);
    suma += m;
    if (suma / total >= 0.8) break;
  }
  return salida;
};

/**
 * Los meses con datos, del más reciente al más viejo.
 *
 * Deja fuera los anteriores a 2025, que son capturas con el año mal tecleado
 * (`METROS_FECHA_INVALIDA`).
 */
export const mesesDisponibles = (): string[] =>
  [...new Set(
    Object.values(vigente())
      .flatMap((dd) => Object.values(dd).flatMap((meses) => Object.keys(meses)))
  )].filter((m) => m >= PRIMER_MES_VALIDO).sort().reverse();

const NOMBRES_MES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** `'2026-07'` → `'julio 2026'`. */
export const nombreDeMes = (mes: string): string => {
  const [a, m] = mes.split('-');
  return `${NOMBRES_MES[Number(m)] || mes} ${a}`;
};

/** Los últimos N meses **con datos**, no los últimos N del calendario. */
export const ultimosMeses = (n: number): Periodo | null => {
  const ms = mesesDisponibles();
  if (ms.length === 0) return null;
  const tramo = ms.slice(0, n);
  return { desde: tramo[tramo.length - 1], hasta: tramo[0] };
};
