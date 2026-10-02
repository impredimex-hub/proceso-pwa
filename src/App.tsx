import React, { useState, useEffect } from 'react';
import { db } from './services/firebase';
import {
  entrar, salir, alCambiarSesion, nominaDeUsuario,
  traerColaborador, traerUsuariosDeLaApp, mensajeDeError, APP_ID,
} from './services/suite';
import { collection, onSnapshot, addDoc, updateDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { aplanarHallazgos, tableroAbiertos, resumenTablero, historialDePunto } from './utils/hallazgos';
import type { HallazgoPlano } from './utils/hallazgos';
import { calcularRanking, dondeFalla, familiasConProceso, seguridadPendiente, UMBRAL_REVISIONES } from './utils/ranking';
import type { FilaRanking } from './utils/ranking';
import {
  mermaDe, defectosDe, participacionDe, maquinasDelOchenta, mesesDisponibles,
  aniosDisponibles, mesesDeAnio, nombreDeMes, ultimosMeses,
  METROS_SIN_CRUZAR, METROS_FECHA_INVALIDA
} from './utils/merma';
import type { Periodo } from './utils/merma';

(window as any).db = db;

// --- ESTILOS COMPARTIDOS DEL SISTEMA DE DISEÑO ---
const STYLES = {
  glassCard: {
    background: 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.98)',
    outline: '0.5px solid rgba(0, 32, 96, 0.06)',
    boxShadow: '0 0 0 0.5px rgba(0,32,96,.06), 0 2px 8px rgba(0,32,96,.06), 0 8px 24px rgba(0,32,96,.08), inset 0 1px 1px #ffffff',
    padding: '1.4rem',
    marginBottom: '1rem',
  },
  metricCard: {
    background: 'rgba(0, 32, 96, 0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 4px 12px rgba(0,32,96,.18), 0 12px 30px rgba(0,32,96,.15), inset 0 1px 1px rgba(255,255,255,.18)',
    padding: '16px',
    color: '#ffffff',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid rgba(0, 32, 96, 0.12)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.85)',
    color: '#0D1A2E',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  }
};

// --- USUARIOS (SPEC-001) ---
// La lista ya no vive aquí. Se lee de `colaboradores` en Impredimex-suite,
// filtrada por quienes tienen 'procesos' en su campo `apps`. Se llena una sola
// vez, justo después de iniciar sesión y antes de mostrar la app.
/**
 * Avisa al arranque de la página si hay sesión (SPEC-006). La función vive en
 * `index.html` porque tiene que correr antes de que React cargue.
 */
const avisarArranque = (haySesion: boolean) =>
  (window as unknown as { arranqueListo?: (s: boolean) => void }).arranqueListo?.(haySesion);

export interface UserProfile {
  nomina: string;
  nombre: string;
  puesto: string;
  activo: boolean;
  /** Papel dentro de esta app, leído de `roles.procesos` en la suite. */
  rol: string;
}

let USUARIOS_SISTEMA: UserProfile[] = [];

// --- CATÁLOGO DE MÁQUINAS Y ÁREAS ---
interface Maquina {
  id: string;
  nombre: string;
  tipo: string;
  moduloProceso: boolean;
  modulo5S: boolean;
}

const CATALOGO: Maquina[] = [
  { id: 'FL1', nombre: 'FL1 (Flexográfica 1)', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'FL2', nombre: 'FL2 (Flexográfica 2)', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'FL3', nombre: 'FL3 (Flexográfica 3)', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'FL4', nombre: 'FL4 (Flexográfica 4)', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'RT5', nombre: 'RT5 (Rotograbado 5)', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'RT6', nombre: 'RT6 (Rotograbado 6)', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'RT7', nombre: 'RT7 (Rotograbado 7)', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'LAM1', nombre: 'LAM1 (Laminadora)', tipo: 'Laminado', moduloProceso: true, modulo5S: true },
  { id: 'DEP1', nombre: 'DEP1 (Depuradora Impresión)', tipo: 'Depuración', moduloProceso: true, modulo5S: true },
  { id: 'ZEI1', nombre: 'ZEI1 (Impresora Digital)', tipo: 'Digital', moduloProceso: true, modulo5S: true },
  { id: 'OME1', nombre: 'OME1 (Suajadora)', tipo: 'Suajado', moduloProceso: true, modulo5S: true },
  { id: 'REF1', nombre: 'REF1 (Refiladora 1)', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  { id: 'REF2', nombre: 'REF2 (Refiladora 2)', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  { id: 'REF3', nombre: 'REF3 (Refiladora 3)', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  { id: 'PEG1', nombre: 'PEG1 (Pegadora 1)', tipo: 'Pegado', moduloProceso: true, modulo5S: true },
  { id: 'PEG2', nombre: 'PEG2 (Pegadora 2)', tipo: 'Pegado', moduloProceso: true, modulo5S: true },
  { id: 'REV1', nombre: 'REV1 (Revisadora 1)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV2', nombre: 'REV2 (Revisadora 2)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV3', nombre: 'REV3 (Revisadora 3)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV4', nombre: 'REV4 (Revisadora 4)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV6', nombre: 'REV6 (Revisadora 6)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'REV8', nombre: 'REV8 (Revisadora 8)', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'DEP2', nombre: 'DEP2 (Depuración Etiquetas)', tipo: 'Depuración', moduloProceso: true, modulo5S: true },
  { id: 'COR1', nombre: 'COR1 (Cortadora 1)', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'COR2', nombre: 'COR2 (Cortadora 2)', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'COR3', nombre: 'COR3 (Cortadora 3)', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'area-tintas', nombre: 'Área de Tintas', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-banos', nombre: 'Baños de Producción', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-mp', nombre: 'Almacén Materia Prima', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-pt', nombre: 'Almacén Producto Terminado', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-mant', nombre: 'Taller Mantenimiento', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-prep', nombre: 'Área Pre-prensa', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-cal', nombre: 'Laboratorio Calidad', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true }
];

const FAMILIAS_TODAS = Array.from(new Set(CATALOGO.map((m) => m.tipo)));
const FAMILIAS_PROCESO = Array.from(new Set(CATALOGO.filter((m) => m.moduloProceso).map((m) => m.tipo)));
const FAMILIAS_5S = Array.from(new Set(CATALOGO.filter((m) => m.modulo5S).map((m) => m.tipo)));

// --- MATRIZ DE SUPERVISORES POR MÁQUINA ---
const obtenerSupervisoresPorMaquina = (maquina: Maquina | null): UserProfile[] => {
  if (!maquina) return [];
  const maqId = maquina.id;
  const tipo = maquina.tipo;

  if (tipo === 'Digital' || tipo === 'Suajado') return USUARIOS_SISTEMA.filter((u) => u.nomina === '885');
  if (tipo === 'Rotograbado' || tipo === 'Flexografía' || tipo === 'Laminado' || maqId === 'DEP1') {
    return USUARIOS_SISTEMA.filter((u) => ['2308', '2398', '2159'].includes(u.nomina));
  }
  if (['Refilado', 'Pegado', 'Revisión', 'Corte'].includes(tipo) || maqId === 'DEP2') {
    return USUARIOS_SISTEMA.filter((u) => ['1853', '2377'].includes(u.nomina));
  }
  if (maqId === 'area-tintas') return USUARIOS_SISTEMA.filter((u) => u.nomina === '2129');
  if (maqId === 'area-mp' || maqId === 'area-pt') return USUARIOS_SISTEMA.filter((u) => u.nomina === '1802');
  if (maqId === 'area-mant') return USUARIOS_SISTEMA.filter((u) => u.nomina === '2432');
  if (maqId === 'area-banos') return USUARIOS_SISTEMA.filter((u) => ['2308', '2398', '2159', '1853', '2377'].includes(u.nomina));
  return [];
};

interface ItemChecklist {
  id: number;
  seccion: string;
  queObservar: string;
  comoVerifica: string;
}

const CHECKLIST_BASE_PEGADO: ItemChecklist[] = [
  { id: 1, seccion: 'A · SOLVENTE Y APORTE', queObservar: 'El solvente montado corresponde al sustrato del pedido', comoVerifica: 'Comparar etiqueta del bote vs. sustrato de la ficha; lote anotado en reporte' },
  { id: 2, seccion: 'A · SOLVENTE Y APORTE', queObservar: 'El operador realizó y registró la prueba de aporte', comoVerifica: 'Pedir el cálculo: mL ÷ velocidad = 0.015' },
  { id: 3, seccion: 'A · SOLVENTE Y APORTE', queObservar: 'La aguja fue calibrada en el arranque / tras romperse el material', comoVerifica: 'Preguntar cuándo la calibró; chorro recto y continuo' },
  { id: 4, seccion: 'A · SOLVENTE Y APORTE', queObservar: 'Presión de aire del tanque de adhesivo en rango', comoVerifica: 'Manómetro entre 0.51 y 0.65 MPa' },
  { id: 5, seccion: 'A · SOLVENTE Y APORTE', queObservar: 'Velocidades de activar/desactivar solvente configuradas', comoVerifica: 'Activar = trabajo −100 · Desactivar = programada −50' },
  { id: 6, seccion: 'B · PARÁMETROS DE MANGA', queObservar: 'Presión del NIP dentro de rango', comoVerifica: 'Manómetro 35–40 PSI (mín. 28 solo sin deslizamiento)' },
  { id: 7, seccion: 'B · PARÁMETROS DE MANGA', queObservar: 'Aguja en zona cristal de 3 mm, ~1 mm de altura, 45°', comoVerifica: 'Observación visual de la aguja en la unidad' },
  { id: 8, seccion: 'B · PARÁMETROS DE MANGA', queObservar: 'Grosor de adhesivo dentro de parámetro', comoVerifica: 'Medir muestra: 2.0–2.8 mm' },
  { id: 9, seccion: 'B · PARÁMETROS DE MANGA', queObservar: 'Ancho plano y doblez coinciden con ficha gráfica', comoVerifica: 'Medir con regla flexible vs. ficha' },
  { id: 10, seccion: 'C · DETECCIÓN Y TRAZABILIDAD', queObservar: 'Rango de alarma configurado y 3 alarmas en ON', comoVerifica: 'Pantalla: ±0.3 mm · Falta Cinta / Fluorescente / Defecto Ancho' },
  { id: 11, seccion: 'C · DETECCIÓN Y TRAZABILIDAD', queObservar: 'Interruptores encendidos (Medidor Ancho Plano, Luz UV, Sistema Etiqueta)', comoVerifica: 'Revisar panel central' },
  { id: 12, seccion: 'C · DETECCIÓN Y TRAZABILIDAD', queObservar: 'Banderas rojas colocadas en arranque y fin de pedido', comoVerifica: 'Inspección de la bobina / rebobinador' },
  { id: 13, seccion: 'C · DETECCIÓN Y TRAZABILIDAD', queObservar: 'Hoja viajera llenada con NCR y etiquetas de rastreo por rollo', comoVerifica: 'Revisar hoja viajera del máster en proceso' },
  { id: 14, seccion: 'D · VALIDACIÓN Y LIBERACIÓN', queObservar: 'Firma de validación de preparación de máquina del supervisor', comoVerifica: 'Revisar F1-PR-PA-03 firmado' },
  { id: 15, seccion: 'D · VALIDACIÓN Y LIBERACIÓN', queObservar: 'Arranque autorizado por Calidad (no se arrancó sin autorización)', comoVerifica: 'Confirmar liberación de calidad antes del arranque' },
  { id: 16, seccion: 'D · VALIDACIÓN Y LIBERACIÓN', queObservar: 'Reporte de producción sin espacios en blanco ni tachaduras; ancho plano y solvente registrados hora por hora', comoVerifica: 'Revisar F1-PR-PA-03' }
];

const CHECKLIST_OFICIAL_5S: ItemChecklist[] = [
  { id: 1, seccion: '1. ORDEN Y 5S', queObservar: 'Todas las herramientas y utensilios se encuentran y tienen lugar asignado', comoVerifica: 'Revisión visual de tableros, mesas y gavetas' },
  { id: 2, seccion: '1. ORDEN Y 5S', queObservar: 'Todos materiales, rollos, tarimas o contenedores se encuentran en su ubicación definida', comoVerifica: 'Verificar delimitaciones en piso y estantes' },
  { id: 3, seccion: '1. ORDEN Y 5S', queObservar: 'Pasillos, accesos y zonas de operación se encuentran despejados', comoVerifica: 'Inspección de líneas peatonales y áreas de maniobra' },
  { id: 4, seccion: '1. ORDEN Y 5S', queObservar: 'El área de trabajo se encuentra ordenada y libre de objetos innecesarios', comoVerifica: 'Revisión de superficies de apoyo y periferia' },
  { id: 5, seccion: '2. LIMPIEZA', queObservar: 'El área y la máquina se encuentran limpias', comoVerifica: 'Inspección de estructura, paneles y piso general' },
  { id: 6, seccion: '2. LIMPIEZA', queObservar: 'Sin derrames de tinta, solvente, aceite, agua u otros productos', comoVerifica: 'Revisar charolas, piso y conexiones de fluidos' },
  { id: 7, seccion: '2. LIMPIEZA', queObservar: 'Sin acumulación de papel, película, tinta, adhesivo o residuos alrededor de la máquina', comoVerifica: 'Inspección de desbobinador, rebobinador y piso' },
  { id: 8, seccion: '2. LIMPIEZA', queObservar: 'Los residuos y merma se encuentran correctamente segregados', comoVerifica: 'Verificar botes identificados y bolsas correspondientes' },
  { id: 9, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'La máquina esta sin daños físicos visibles que puedan afectar su operación', comoVerifica: 'Inspección de rodillos, guías y estructura' },
  { id: 10, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'Sin reparaciones temporales, improvisaciones o soluciones provisionales', comoVerifica: 'Verificar sujeciones, ensambles y componentes' },
  { id: 11, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'Sin fugas de aceite, aire, agua, tinta o solvente', comoVerifica: 'Revisión de manómetros, mangueras y cilindros' },
  { id: 12, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'Sin cables, mangueras o conexiones dañadas, expuestas o improvisadas', comoVerifica: 'Inspección del cableado eléctrico y neumático' },
  { id: 13, seccion: '3. CONDICIÓN DE MÁQUINA', queObservar: 'Guardas, cubiertas y protecciones de seguridad se encuentran instaladas y en buen estado', comoVerifica: 'Verificación física de guardas de protección' },
  { id: 14, seccion: '4. SEGURIDAD', queObservar: 'El paro de emergencia se encuentra accesible y sin obstrucciones', comoVerifica: 'Comprobar acceso libre inmediato al botón de paro' },
  { id: 15, seccion: '4. SEGURIDAD', queObservar: 'Extintores, rutas de evacuación y equipos de emergencia se encuentran despejados', comoVerifica: 'Inspección visual del área circundante' },
  { id: 16, seccion: '4. SEGURIDAD', queObservar: 'Sin condiciones que representen riesgo inmediato de atrapamiento, corte, golpe, incendio o derrame', comoVerifica: 'Evaluación general de riesgos en la estación' },
  { id: 17, seccion: '5. INFRAESTRUCTURA', queObservar: 'Sin presencia de goteras en maquina o periferia', comoVerifica: 'Inspección visual de techos e iluminación' },
  { id: 18, seccion: '5. INFRAESTRUCTURA', queObservar: 'Piso en condiciones de operación', comoVerifica: 'Verificar piso sin grietas graves ni desniveles riesgosos' },
  { id: 19, seccion: '5. INFRAESTRUCTURA', queObservar: 'Anaqueles y estantes disponibles para la operación', comoVerifica: 'Revisar orden y capacidad en estantería' },
  { id: 20, seccion: '5. INFRAESTRUCTURA', queObservar: 'Casilleros disponibles para articulos personales', comoVerifica: 'Inspección de gavetas asignadas al personal' }
];

type EstadoCumplimiento = 'PENDIENTE' | 'TERMINADO' | 'PENDIENTE_ATRASADO';

interface Hallazgo {
  id: string;
  puntoId?: number;
  esExtra?: boolean;
  /** Marca manual de seguridad; solo la usan los `esExtra` (SPEC-010). */
  esSeguridad?: boolean;
  /** Se conserva por los documentos viejos. La detección real es la SPEC-009. */
  esReincidente?: boolean;
  hallazgo: string;
  accion: string;
  responsable: string;
  /** Fecha **comprometida** de cierre, capturada al levantarlo. */
  fechaCierre: string;
  /** Cuándo se marcó terminado de verdad (SPEC-009). */
  cerradoEn?: string;
  estadoSeguimiento?: EstadoCumplimiento;
}

/**
 * De qué tipo es una auditoría guardada.
 *
 * **Se cree lo que el documento dice de sí mismo.** Toda auditoría guardada por
 * la app trae `tipoAuditoria` explícito, escrito por la pantalla que la levantó,
 * y no hay nada que adivinar.
 *
 * Antes no era así: la regla deducía el tipo, y una de sus condiciones decía que
 * cualquier auditoría con respuestas en una máquina que no fuera Pegado era 5S.
 * Eso reescribía en silencio auditorías de proceso bien guardadas de las otras
 * 22 máquinas, y dejaba la columna «sin validar proceso» de la cobertura
 * (SPEC-008) diciendo «Nunca» para siempre.
 *
 * La deducción se conserva **solo como respaldo**, para un documento sin
 * `tipoAuditoria` o con un valor que no se entiende. Al 29/09/2026 no existe
 * ninguno: la colección se vació ese día.
 */
const resolverTipoAuditoria = (docData: any): 'PROCESO' | '5S' => {
  const tipoOriginal = (docData.tipoAuditoria || '').toUpperCase();
  if (tipoOriginal === '5S' || tipoOriginal === 'PROCESO') return tipoOriginal;

  const tipoMaq = docData.tipoMaquina || '';
  const totalRespuestas = Object.keys(docData.respuestas || {}).length;
  if (totalRespuestas >= 17 || (tipoMaq !== 'Pegado' && totalRespuestas > 0)) {
    return '5S';
  }
  return 'PROCESO';
};

// --- GEOMETRÍA ISOMÉTRICA CON AMPLITUD REAL DE PASILLOS ---
interface ElementoLayout3D {
  id: string;
  label: string;
  tipoEntidad: 'MAQUINA' | 'AREA_SOPORTE' | 'ZONA';
  maquinaCatalogoId?: string;
  gridX: number; // Coordenada X en cuadrícula de nave
  gridY: number; // Coordenada Y en cuadrícula de nave
  width: number;
  depth: number;
  height: number;
}

const ELEMENTOS_LAYOUT_3D: ElementoLayout3D[] = [
  // Franja Superior: Soporte y Servicios (Y = 20)
  { id: 'comedor', label: 'Comedor', tipoEntidad: 'AREA_SOPORTE', gridX: 30, gridY: 20, width: 85, depth: 55, height: 20 },
  { id: 'compresor', label: 'Compresor / Secador', tipoEntidad: 'AREA_SOPORTE', gridX: 135, gridY: 20, width: 85, depth: 55, height: 22 },
  { id: 'banos', label: 'Baños Producción', tipoEntidad: 'AREA_SOPORTE', maquinaCatalogoId: 'area-banos', gridX: 240, gridY: 20, width: 95, depth: 55, height: 22 },
  { id: 'recepcion', label: 'Recepción / Médico', tipoEntidad: 'AREA_SOPORTE', gridX: 355, gridY: 20, width: 95, depth: 55, height: 22 },
  { id: 'lockers', label: 'Lockers', tipoEntidad: 'AREA_SOPORTE', gridX: 470, gridY: 20, width: 75, depth: 55, height: 18 },

  // Bloque Refilado (Y = 120, calle de 45px respecto al comedor)
  { id: 'ref1', label: 'REF 1', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'REF1', gridX: 40, gridY: 120, width: 75, depth: 70, height: 28 },
  { id: 'ref2', label: 'REF 2', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'REF2', gridX: 160, gridY: 120, width: 80, depth: 75, height: 32 },
  { id: 'ref3', label: 'REF 3', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'REF3', gridX: 285, gridY: 120, width: 75, depth: 70, height: 30 },
  { id: 'calidad-nueva', label: 'Lab. Calidad', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'area-cal', gridX: 430, gridY: 120, width: 85, depth: 65, height: 22 },

  // Bloque Pegado y Depuración (Y = 260, pasillo central amplio de 65px)
  { id: 'peg1', label: 'PEG 1', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'PEG1', gridX: 45, gridY: 260, width: 75, depth: 110, height: 38 },
  { id: 'peg2', label: 'PEG 2', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'PEG2', gridX: 175, gridY: 260, width: 75, depth: 110, height: 38 },
  { id: 'rev8', label: 'REV 8', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'REV8', gridX: 305, gridY: 260, width: 55, depth: 65, height: 25 },
  { id: 'dep2', label: 'DEP 2 (Etiquetas)', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'DEP2', gridX: 420, gridY: 260, width: 65, depth: 75, height: 28 },

  // Bloque Revisadoras (Y = 445, sin REV5 ni REV7)
  { id: 'rev1', label: 'REV 1', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'REV1', gridX: 35, gridY: 445, width: 50, depth: 60, height: 24 },
  { id: 'rev2', label: 'REV 2', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'REV2', gridX: 105, gridY: 445, width: 50, depth: 60, height: 24 },
  { id: 'rev3', label: 'REV 3', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'REV3', gridX: 175, gridY: 445, width: 50, depth: 60, height: 24 },
  { id: 'rev6', label: 'REV 6', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'REV6', gridX: 275, gridY: 445, width: 55, depth: 60, height: 25 },

  // Batería Cortadoras (Y escalonada con 25px de separación vertical)
  { id: 'cor1', label: 'COR 1', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'COR1', gridX: 35, gridY: 555, width: 85, depth: 45, height: 24 },
  { id: 'cor2', label: 'COR 2', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'COR2', gridX: 35, gridY: 625, width: 85, depth: 45, height: 24 },
  { id: 'cor3', label: 'COR 3', tipoEntidad: 'MAQUINA', maquinaCatalogoId: 'COR3', gridX: 35, gridY: 695, width: 85, depth: 45, height: 24 },

  // Empaque y Almacenaje
  { id: 'empacadora', label: 'Empacadora', tipoEntidad: 'AREA_SOPORTE', gridX: 220, gridY: 565, width: 85, depth: 85, height: 28 },
  { id: 'area-empaque', label: 'Área Empaque', tipoEntidad: 'AREA_SOPORTE', gridX: 330, gridY: 565, width: 95, depth: 85, height: 16 },
  { id: 'cajas-carton', label: 'Almacén Cajas', tipoEntidad: 'AREA_SOPORTE', gridX: 445, gridY: 565, width: 85, depth: 85, height: 16 }
];

export const App: React.FC = () => {
  // --- ESTADO DE SESIÓN ---
  const [usuarioActivo, setUsuarioActivo] = useState<UserProfile | null>(null);
  // Panel de la sesión: en el teléfono es el único lugar donde el nombre y el
  // puesto caben completos.
  const [panelAbierto, setPanelAbierto] = useState(false);
  // Conexión según lo que reporta el teléfono, el mismo criterio que RRHH.
  const [enLinea, setEnLinea] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener('online', si);
    window.addEventListener('offline', no);
    return () => { window.removeEventListener('online', si); window.removeEventListener('offline', no); };
  }, []);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const [inputLoginNomina, setInputLoginNomina] = useState('');
  const [inputLoginPin, setInputLoginPin] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [entrando, setEntrando] = useState(false);

  // Estados de navegación
  const [vista, setVista] = useState<'LAUNCHER' | 'MODULO_PROCESO' | 'MODULO_5S' | 'EVALUACION' | 'HISTORIAL' | 'EDITOR_PLANTILLAS' | 'COBERTURA' | 'RANKING'>('LAUNCHER');
  const [tipoAuditoriaActiva, setTipoAuditoriaActiva] = useState<'PROCESO' | '5S'>('PROCESO');
  const [subVistaHistorial, setSubVistaHistorial] = useState<'AUDITORIAS' | 'GANTT'>('AUDITORIAS');

  /** La tarjeta que está al frente en su cartera (SPEC-016). */
  const [maquinaAlFrente, setMaquinaAlFrente] = useState<string | null>(null);
  /* El periodo que se mira, en tres controles (SPEC-018). El año y el mes van
     por separado para que ninguna lista se vuelva larga, y el atajo de los tres
     meses no cabe en ninguno de los dos porque cruza años. */
  const [anioRechazos, setAnioRechazos] = useState<string>('');
  const [mesRechazos, setMesRechazos] = useState<string>('');
  const [ultimos3, setUltimos3] = useState(false);

  /* ── Ranking de puntos (SPEC-007) ─────────────────────────────────────── */
  const [tipoRanking, setTipoRanking] = useState<'5S' | 'PROCESO'>('5S');
  const [familiaRanking, setFamiliaRanking] = useState('');
  const [puntoAbierto, setPuntoAbierto] = useState<number | null>(null);
  const [maquinaSeleccionada, setMaquinaSeleccionada] = useState<Maquina | null>(null);

  // Modal Layout 3D
  const [modalLayout3DAbierto, setModalLayout3DAbierto] = useState(false);
  const [detalleElementoLayout, setDetalleElementoLayout] = useState<{
    elem: ElementoLayout3D;
    maquina: Maquina | null;
    auditoriasRelacionadas: any[];
    hallazgosPendientes: any[];
    cumplimientoPromedio: number;
  } | null>(null);

  // Modal Detalle Auditoría
  const [auditoriaDetalleModal, setAuditoriaDetalleModal] = useState<any | null>(null);

  // Modal Reincidencia
  const [modalReincidencia, setModalReincidencia] = useState<{
    abierto: boolean;
    puntoId: number;
    itemCheck: ItemChecklist | null;
    hallazgosPrevios: any[];
  }>({
    abierto: false,
    puntoId: 0,
    itemCheck: null,
    hallazgosPrevios: []
  });

  // Estados Formulario Desviación
  const [mostrarFormNuevoHallazgoModal, setMostrarFormNuevoHallazgoModal] = useState(false);
  const [tipoNuevoHallazgoModal, setTipoNuevoHallazgoModal] = useState<'PREESTABLECIDO' | 'EXTRA'>('PREESTABLECIDO');
  /** Solo para los hallazgos fuera del checklist (SPEC-010). */
  const [seguridadNuevoHallazgoModal, setSeguridadNuevoHallazgoModal] = useState(false);
  /** El punto cuyo historial se está viendo (SPEC-009 y SPEC-011). */
  /**
   * Lo que se cerró en esta visita al tablero (SPEC-014).
   *
   * Vive en memoria, no en la base: al salir del tablero se vacía, así que el
   * tablero sigue sin acumular hallazgos cerrados entre visitas.
   */
  const [cerradosAhora, setCerradosAhora] = useState<Set<string>>(new Set());

  const [puntoHistorial, setPuntoHistorial] = useState<
    { maquinaId: string; puntoId?: number; texto: string; maquinaNombre: string } | null
  >(null);
  const [puntoSeleccionadoModal, setPuntoSeleccionadoModal] = useState<string>('');
  const [descNuevoHallazgoModal, setDescNuevoHallazgoModal] = useState('');
  const [accionNuevoHallazgoModal, setAccionNuevoHallazgoModal] = useState('');
  const [respNuevoHallazgoModal, setRespNuevoHallazgoModal] = useState('');
  const [fechaCierreNuevoHallazgoModal, setFechaCierreNuevoHallazgoModal] = useState('');
  const [guardandoHallazgoModal, setGuardandoHallazgoModal] = useState(false);

  // Selectores dependientes
  const [filtroProcesoFamilia, setFiltroProcesoFamilia] = useState('');
  const [filtroProcesoMaquinaId, setFiltroProcesoMaquinaId] = useState('');
  const [filtro5SFamilia, setFiltro5SFamilia] = useState('');
  const [filtro5SMaquinaId, setFiltro5SMaquinaId] = useState('');

  // Filtros Auditorías
  const [filtroAudTipoRevision, setFiltroAudTipoRevision] = useState('');
  const [filtroAudFamilia, setFiltroAudFamilia] = useState('');
  const [filtroAudMaquinaId, setFiltroAudMaquinaId] = useState('');
  const [filtroAudMes, setFiltroAudMes] = useState('');

  // Plantillas dinámicas
  const [plantillasProceso, setPlantillasProceso] = useState<Record<string, ItemChecklist[]>>({ Pegado: CHECKLIST_BASE_PEGADO });
  const [plantillas5S, setPlantillas5S] = useState<Record<string, ItemChecklist[]>>({});

  // Editor de plantillas
  const [moduloEditor, setModuloEditor] = useState<'PROCESO' | '5S'>('PROCESO');
  const [tipoSeleccionadoEditor, setTipoSeleccionadoEditor] = useState<string>('Flexografía');
  const [checklistEnEdicion, setChecklistEnEdicion] = useState<ItemChecklist[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nuevaSeccion, setNuevaSeccion] = useState('');
  const [nuevoQueObservar, setNuevoQueObservar] = useState('');
  const [nuevoComoVerifica, setNuevoComoVerifica] = useState('');
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  // Formulario Evaluación
  const [ordenTrabajo, setOrdenTrabajo] = useState('');
  const [auditor, setAuditor] = useState('');
  const [nominaAuditado, setNominaAuditado] = useState('');
  const [supervisorNomina, setSupervisorNomina] = useState('');
  const [turno, setTurno] = useState('Matutino (6:00–14:00)');
  const [respuestas, setRespuestas] = useState<Record<number, 'SI' | 'NO' | null>>({});
  const [puntosSoloReincidentes, setPuntosSoloReincidentes] = useState<number[]>([]);
  const [hallazgos, setHallazgos] = useState<Record<string, Hallazgo>>({});
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);

  // Filtros Gantt
  const [filtroOrigenGantt, setFiltroOrigenGantt] = useState('');
  const [filtroMaquinaGantt, setFiltroMaquinaGantt] = useState('');
  const [filtroMesGantt, setFiltroMesGantt] = useState('');
  const [filtroDiaGantt, setFiltroDiaGantt] = useState('');
  const [filtroCumplimientoGantt, setFiltroCumplimientoGantt] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (usuarioActivo) setAuditor(usuarioActivo.nombre);
  }, [usuarioActivo]);

  useEffect(() => {
    setSupervisorNomina('');
  }, [maquinaSeleccionada, vista]);

  /* Al salir del tablero se olvida lo que se cerró ahí (SPEC-014). Se conserva
     mientras se está viendo, para confirmar el cambio y poder deshacerlo; al
     volver, el tablero vuelve a mostrar solo lo abierto. */
  useEffect(() => {
    if (vista !== 'HISTORIAL' || subVistaHistorial !== 'GANTT') {
      setCerradosAhora((prev) => (prev.size === 0 ? prev : new Set()));
    }
  }, [vista, subVistaHistorial]);

  useEffect(() => {
    const unsubAuditorias = onSnapshot(collection(db, 'evaluaciones_proceso'), (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const tipoCorregido = resolverTipoAuditoria(data);
        return { id: docSnap.id, ...data, tipoAuditoria: tipoCorregido };
      });
      docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHistorial(docs);

      if (auditoriaDetalleModal) {
        const docActivo = docs.find((d) => d.id === auditoriaDetalleModal.id);
        if (docActivo) setAuditoriaDetalleModal(docActivo);
      }
    }, (error) => console.error('Error Firestore:', error));

    const unsubPlantillasProceso = onSnapshot(collection(db, 'plantillas_checklists'), (snapshot) => {
      const dataP: Record<string, ItemChecklist[]> = { Pegado: CHECKLIST_BASE_PEGADO };
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.items && Array.isArray(data.items)) dataP[d.id] = data.items;
      });
      setPlantillasProceso(dataP);
    });

    const unsubPlantillas5S = onSnapshot(collection(db, 'plantillas_5s'), (snapshot) => {
      const data5: Record<string, ItemChecklist[]> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.items && Array.isArray(data.items)) data5[d.id] = data.items;
      });
      setPlantillas5S(data5);
    });


    return () => {
      unsubAuditorias();
      unsubPlantillasProceso();
      unsubPlantillas5S();
    };
  }, [auditoriaDetalleModal?.id]);

  useEffect(() => {
    const fuente = moduloEditor === 'PROCESO' ? plantillasProceso : plantillas5S;
    const baseDefault = moduloEditor === 'PROCESO' ? (tipoSeleccionadoEditor === 'Pegado' ? CHECKLIST_BASE_PEGADO : []) : CHECKLIST_OFICIAL_5S;
    const items = fuente[tipoSeleccionadoEditor] || baseDefault;
    setChecklistEnEdicion(Array.isArray(items) ? [...items] : []);
    cancelarEdicionPregunta();
  }, [tipoSeleccionadoEditor, moduloEditor, plantillasProceso, plantillas5S]);

  const itemsChecklistActivo: ItemChecklist[] = maquinaSeleccionada
    ? (tipoAuditoriaActiva === 'PROCESO'
        ? (plantillasProceso[maquinaSeleccionada.tipo] || (maquinaSeleccionada.tipo === 'Pegado' ? CHECKLIST_BASE_PEGADO : []))
        : (plantillas5S[maquinaSeleccionada.tipo] || CHECKLIST_OFICIAL_5S))
    : [];

  const supervisoresDisponibles = obtenerSupervisoresPorMaquina(maquinaSeleccionada);

  // --- FILTRO DE SEGURIDAD POR PERFIL ---
  // SPEC-004: el administrador se define en la suite, no en el código.
  const esAdminTotal = usuarioActivo?.rol === 'ADMIN';


  const historialPermitido = historial.filter((item) => {
    if (esAdminTotal) return true;
    if (!usuarioActivo) return false;

    const nomUser = usuarioActivo.nomina.trim();
    const nombrePartes = usuarioActivo.nombre.toUpperCase().split(' ').filter((p) => p.length > 2);

    if (String(item.nominaSupervisor || '').trim() === nomUser) return true;
    if (String(item.nominaAuditado || '').trim() === nomUser) return true;

    const supTexto = String(item.nombreSupervisor || '').toUpperCase();
    const auditadoTexto = String(item.nominaAuditado || '').toUpperCase();
    if (nombrePartes.some((p) => supTexto.includes(p) || auditadoTexto.includes(p))) return true;

    if (item.hallazgos && Array.isArray(item.hallazgos)) {
      const asignado = item.hallazgos.some((h: any) => {
        const resp = String(h.responsable || '').toUpperCase();
        return resp.includes(nomUser) || nombrePartes.some((p) => resp.includes(p));
      });
      if (asignado) return true;
    }

    const maqId = item.maquinaId || '';
    const tipo = item.tipoMaquina || '';
    if (nomUser === '2129' && (maqId === 'area-tintas' || tipo.includes('Tintas'))) return true;
    if (nomUser === '1802' && (maqId === 'area-mp' || maqId === 'area-pt' || tipo.includes('Almacén'))) return true;
    if (nomUser === '2432' && (maqId === 'area-mant' || tipo.includes('Mantenimiento'))) return true;
    if (nomUser === '885' && (tipo === 'Digital' || tipo === 'Suajado' || maqId === 'ZEI1' || maqId === 'OME1')) return true;
    if (['1853', '2377'].includes(nomUser) && ['Refilado', 'Pegado', 'Revisión', 'Corte', 'Depuración'].includes(tipo)) return true;
    if (['2308', '2398', '2159'].includes(nomUser) && ['Rotograbado', 'Flexografía', 'Laminado', 'Depuración'].includes(tipo)) return true;

    return false;
  });

  // --- CÁLCULO DE ESTADO Y COLOR PASTEL 3D (40% TRANSPARENCIA) ---
  const obtenerEstadoEquipoLayout = (maqCatalogoId?: string) => {
    if (!maqCatalogoId) {
      return {
        fillTop: 'rgba(226, 232, 240, 0.45)',
        fillFront: 'rgba(203, 213, 225, 0.45)',
        fillSide: 'rgba(148, 163, 184, 0.45)',
        stroke: '#64748B',
        badgeColor: '#64748B',
        texto: 'Sin auditorías'
      };
    }

    const auds = historial.filter((h) => h.maquinaId === maqCatalogoId);
    if (auds.length === 0) {
      return {
        fillTop: 'rgba(226, 232, 240, 0.45)',
        fillFront: 'rgba(203, 213, 225, 0.45)',
        fillSide: 'rgba(148, 163, 184, 0.45)',
        stroke: '#64748B',
        badgeColor: '#64748B',
        texto: 'Sin auditorías'
      };
    }

    let tieneAtrasados = false;
    let tienePendientes = false;

    auds.forEach((aud) => {
      if (aud.hallazgos && Array.isArray(aud.hallazgos)) {
        aud.hallazgos.forEach((h: any) => {
          const est = h.estadoSeguimiento || 'PENDIENTE';
          if (est === 'PENDIENTE_ATRASADO' || (est !== 'TERMINADO' && todayStr > (h.fechaCierre || todayStr))) {
            tieneAtrasados = true;
          } else if (est === 'PENDIENTE') {
            tienePendientes = true;
          }
        });
      }
    });

    if (tieneAtrasados) {
      return {
        fillTop: 'rgba(254, 202, 202, 0.45)',   // Rojo Pastel 40%
        fillFront: 'rgba(252, 165, 165, 0.45)',
        fillSide: 'rgba(248, 113, 113, 0.45)',
        stroke: '#DC2626',
        badgeColor: '#DC2626',
        texto: 'Atrasado'
      };
    }

    if (tienePendientes) {
      return {
        fillTop: 'rgba(254, 240, 138, 0.45)',   // Amarillo Pastel 40%
        fillFront: 'rgba(253, 224, 71, 0.45)',
        fillSide: 'rgba(234, 179, 8, 0.45)',
        stroke: '#D97706',
        badgeColor: '#D97706',
        texto: 'Pendiente'
      };
    }

    return {
      fillTop: 'rgba(167, 243, 208, 0.45)',     // Verde Pastel 40%
      fillFront: 'rgba(110, 231, 183, 0.45)',
      fillSide: 'rgba(52, 211, 153, 0.45)',
      stroke: '#059669',
      badgeColor: '#059669',
      texto: '100% OK'
    };
  };

  const handleAbrirDetalleElementoLayout = (elem: ElementoLayout3D) => {
    const maquinaEncontrada = elem.maquinaCatalogoId ? CATALOGO.find((m) => m.id === elem.maquinaCatalogoId) || null : null;
    const auds = elem.maquinaCatalogoId ? historial.filter((h) => h.maquinaId === elem.maquinaCatalogoId) : [];

    const hallazgosPend: any[] = [];
    let sumaCumplimiento = 0;

    auds.forEach((a) => {
      sumaCumplimiento += (a.cumplimiento || 0);
      if (a.hallazgos && Array.isArray(a.hallazgos)) {
        a.hallazgos.forEach((h: any) => {
          if (h.estadoSeguimiento !== 'TERMINADO') {
            hallazgosPend.push({ ...h, fechaAuditoria: a.fechaAuditoria, auditor: a.auditor });
          }
        });
      }
    });

    const prom = auds.length > 0 ? Math.round(sumaCumplimiento / auds.length) : 100;

    setDetalleElementoLayout({
      elem,
      maquina: maquinaEncontrada,
      auditoriasRelacionadas: auds,
      hallazgosPendientes: hallazgosPend,
      cumplimientoPromedio: prom
    });
  };

  const handleIniciarAuditoriaDesdeLayout = (tipo: 'PROCESO' | '5S') => {
    if (!detalleElementoLayout?.maquina) return;
    setMaquinaSeleccionada(detalleElementoLayout.maquina);
    setTipoAuditoriaActiva(tipo);
    setDetalleElementoLayout(null);
    setModalLayout3DAbierto(false);
    setVista('EVALUACION');
  };

  // SPEC-001: carga la lista de gente con acceso y arma el perfil de quien entró.
  const prepararSesion = async (nomina: string): Promise<UserProfile | null> => {
    const [yo, usuarios] = await Promise.all([traerColaborador(nomina), traerUsuariosDeLaApp()]);
    if (!yo || yo.estatus !== 'ACTIVO' || !yo.apps?.includes(APP_ID)) return null;
    USUARIOS_SISTEMA = usuarios.map((u) => ({
      nomina: u.noNomina, nombre: u.nombreCompleto, puesto: u.puesto, activo: true,
      rol: u.roles?.[APP_ID] ?? 'SUPERVISOR',
    }));
    return {
      nomina: yo.noNomina,
      nombre: yo.nombreCompleto,
      puesto: yo.puesto,
      activo: true,
      rol: yo.roles?.[APP_ID] ?? 'SUPERVISOR',
    };
  };

  // SPEC-001: Firebase restaura la sesión al cargar la página.
  useEffect(() => {
    return alCambiarSesion(async (user) => {
      const nomina = nominaDeUsuario(user);
      if (!nomina) {
        USUARIOS_SISTEMA = [];
        setUsuarioActivo(null);
        setCargandoSesion(false);
        avisarArranque(false);
        return;
      }
      try {
        const perfil = await prepararSesion(nomina);
        if (!perfil) {
          // La marca se quita antes, o taparía el aviso con el motivo.
          avisarArranque(false);
          await salir();
          setErrorLogin('Tu cuenta no tiene acceso a esta aplicación.');
        } else {
          avisarArranque(true);
        }
        setUsuarioActivo(perfil);
      } catch (err) {
        avisarArranque(false);
        console.error('No se pudo cargar el perfil:', err);
        setErrorLogin('No se pudo cargar tu perfil. Revisa tu conexión.');
      } finally {
        setCargandoSesion(false);
      }
    });
  }, []);

  const handleIniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLogin('');
    const nomina = inputLoginNomina.trim();
    if (!nomina) { setErrorLogin('Escribe tu número de nómina.'); return; }
    if (inputLoginPin.trim().length < 6) { setErrorLogin('La clave es de 6 dígitos.'); return; }

    setEntrando(true);
    try {
      await entrar(nomina, inputLoginPin.trim());  // el resto lo hace alCambiarSesion
      setInputLoginPin('');
    } catch (err: any) {
      setErrorLogin(mensajeDeError(err?.code ?? ''));
    } finally {
      setEntrando(false);
    }
  };

  const handleCerrarSesion = async () => {
    if (confirm('¿Deseas cerrar tu sesión actual?')) {
      avisarArranque(false);
      await salir();
      setVista('LAUNCHER');
    }
  };

  const handleRespuesta = (puntoId: number, valor: 'SI' | 'NO') => {
    setRespuestas((prev) => ({ ...prev, [puntoId]: valor }));
    const key = `punto_${puntoId}`;

    if (valor === 'SI') {
      if (hallazgos[key]) {
        setHallazgos((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }
      setPuntosSoloReincidentes((prev) => prev.filter((id) => id !== puntoId));
      return;
    }

    if (valor === 'NO') {
      const item = itemsChecklistActivo.find((i) => i.id === puntoId);
      const hallazgosAnteriores: any[] = [];
      historial.forEach((aud) => {
        if (aud.maquinaNombre === maquinaSeleccionada?.nombre && aud.hallazgos && Array.isArray(aud.hallazgos)) {
          aud.hallazgos.forEach((h: any) => {
            if (h.puntoId === puntoId) {
              hallazgosAnteriores.push({ ...h, fechaAuditoria: aud.fechaAuditoria || 'Fecha no registrada', auditor: aud.auditor });
            }
          });
        }
      });

      if (hallazgosAnteriores.length > 0) {
        setModalReincidencia({ abierto: true, puntoId, itemCheck: item || null, hallazgosPrevios: hallazgosAnteriores });
      } else {
        if (!hallazgos[key]) {
          setHallazgos((prev) => ({
            ...prev,
            [key]: {
              id: key,
              puntoId,
              esExtra: false,
              esReincidente: false,
              hallazgo: `Desviación en: ${item?.queObservar || ''}`,
              accion: '',
              responsable: '',
              fechaCierre: todayStr,
              estadoSeguimiento: 'PENDIENTE'
            }
          }));
        }
      }
    }
  };

  const handleConfirmarReincidencia = (marcarComoNuevo: boolean) => {
    const { puntoId, itemCheck } = modalReincidencia;
    const key = `punto_${puntoId}`;

    if (marcarComoNuevo) {
      setHallazgos((prev) => ({
        ...prev,
        [key]: {
          id: key,
          puntoId,
          esExtra: false,
          esReincidente: true,
          hallazgo: `(Reincidente) Desviación en: ${itemCheck?.queObservar || ''}`,
          accion: '',
          responsable: '',
          fechaCierre: todayStr,
          estadoSeguimiento: 'PENDIENTE'
        }
      }));
      setPuntosSoloReincidentes((prev) => prev.filter((id) => id !== puntoId));
    } else {
      if (hallazgos[key]) {
        setHallazgos((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }
      setPuntosSoloReincidentes((prev) => Array.from(new Set([...prev, puntoId])));
    }
    setModalReincidencia({ abierto: false, puntoId: 0, itemCheck: null, hallazgosPrevios: [] });
  };

  const handleAddHallazgoExtra = () => {
    const extraId = `extra_${Date.now()}`;
    setHallazgos((prev) => ({
      ...prev,
      [extraId]: {
        id: extraId,
        esExtra: true,
        esReincidente: false,
        hallazgo: '',
        accion: '',
        responsable: '',
        fechaCierre: todayStr,
        estadoSeguimiento: 'PENDIENTE'
      }
    }));
  };

  const handleRemoveHallazgoExtra = (key: string) => {
    setHallazgos((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleHallazgoChange = (key: string, campo: keyof Hallazgo, valor: string) => {
    setHallazgos((prev) => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }));
  };

  const totalRespondidos = Object.values(respuestas).filter((v) => v !== null).length;
  const totalSi = Object.values(respuestas).filter((v) => v === 'SI').length;
  const totalNo = Object.values(respuestas).filter((v) => v === 'NO').length;
  const listaHallazgos = Object.values(hallazgos);

  const cumplimiento = itemsChecklistActivo.length > 0
    ? totalRespondidos > 0 ? Math.round((totalSi / itemsChecklistActivo.length) * 100) : 0
    : listaHallazgos.length === 0 ? 100 : 80;

  const handleGuardarEvaluacion = async () => {
    if (!auditor.trim()) {
      alert('Por favor ingrese el Nombre del Auditor.');
      return;
    }
    if (tipoAuditoriaActiva === 'PROCESO' && !ordenTrabajo.trim()) {
      alert('Por favor ingrese la Orden de Trabajo (OP).');
      return;
    }
    if (supervisoresDisponibles.length > 0 && !supervisorNomina) {
      alert('Por favor selecciona el Nombre del Supervisor de la lista.');
      return;
    }

    if (itemsChecklistActivo.length > 0 && totalRespondidos < itemsChecklistActivo.length) {
      alert(`Faltan responder ${itemsChecklistActivo.length - totalRespondidos} puntos del checklist.`);
      return;
    }

    const supObj = USUARIOS_SISTEMA.find((u) => u.nomina === supervisorNomina);
    const supNombre = supObj ? supObj.nombre : (supervisorNomina || 'N/A');

    setGuardando(true);
    try {
      await addDoc(collection(db, 'evaluaciones_proceso'), {
        tipoAuditoria: tipoAuditoriaActiva,
        maquinaId: maquinaSeleccionada?.id,
        maquinaNombre: maquinaSeleccionada?.nombre,
        tipoMaquina: maquinaSeleccionada?.tipo,
        ordenTrabajo: ordenTrabajo.trim() || 'N/A 5S',
        auditor: auditor.trim(),
        nominaAuditado: nominaAuditado.trim(),
        nominaSupervisor: supervisorNomina || 'N/A',
        nombreSupervisor: supNombre,
        turno,
        cumplimiento,
        totalSi: itemsChecklistActivo.length > 0 ? totalSi : (listaHallazgos.length === 0 ? 1 : 0),
        totalNo: itemsChecklistActivo.length > 0 ? totalNo : listaHallazgos.length,
        fechaAuditoria: todayStr,
        respuestas: itemsChecklistActivo.length > 0 ? respuestas : {},
        puntosSoloReincidentes,
        hallazgos: listaHallazgos,
        itemsSnapshot: itemsChecklistActivo,
        estadoFinal: (itemsChecklistActivo.length > 0 ? totalNo === 0 : listaHallazgos.length === 0) ? 'APROBADO' : 'CON_HALLAZGOS',
        createdAt: serverTimestamp()
      });

      alert('✅ Auditoría guardada correctamente.');
      setRespuestas({});
      setPuntosSoloReincidentes([]);
      setHallazgos({});
      setOrdenTrabajo('');
      setNominaAuditado('');
      setSupervisorNomina('');
      setVista('HISTORIAL');
      setSubVistaHistorial('AUDITORIAS');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar en Firebase.');
    } finally {
      setGuardando(false);
    }
  };

  const obtenerPlantillaAuditoriaModal = (auditoria: any): ItemChecklist[] => {
    if (!auditoria) return [];
    if (auditoria.itemsSnapshot && Array.isArray(auditoria.itemsSnapshot) && auditoria.itemsSnapshot.length > 0) {
      return auditoria.itemsSnapshot;
    }
    const tipoReal = auditoria.tipoAuditoria || 'PROCESO';
    if (tipoReal === '5S' || auditoria.tipoMaquina !== 'Pegado') {
      return plantillas5S[auditoria.tipoMaquina] || CHECKLIST_OFICIAL_5S;
    }
    return plantillasProceso[auditoria.tipoMaquina] || CHECKLIST_BASE_PEGADO;
  };

  const handleGuardarDesviacionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditoriaDetalleModal) return;
    if (tipoNuevoHallazgoModal === 'PREESTABLECIDO' && !puntoSeleccionadoModal) {
      alert('Por favor selecciona el punto del checklist.');
      return;
    }
    if (!descNuevoHallazgoModal.trim()) {
      alert('Por favor describe la desviación.');
      return;
    }

    setGuardandoHallazgoModal(true);
    try {
      const plantilla = obtenerPlantillaAuditoriaModal(auditoriaDetalleModal);
      const docId = auditoriaDetalleModal.id;
      const hallazgosActuales = [...(auditoriaDetalleModal.hallazgos || [])];
      const respuestasActuales = { ...(auditoriaDetalleModal.respuestas || {}) };

      let nuevoHallazgoObj: Hallazgo;

      if (tipoNuevoHallazgoModal === 'PREESTABLECIDO') {
        const pId = parseInt(puntoSeleccionadoModal, 10);
        respuestasActuales[pId] = 'NO';
        nuevoHallazgoObj = {
          id: `punto_${pId}_${Date.now()}`,
          puntoId: pId,
          esExtra: false,
          esReincidente: false,
          hallazgo: descNuevoHallazgoModal.trim(),
          accion: accionNuevoHallazgoModal.trim() || 'Sin registrar',
          responsable: respNuevoHallazgoModal.trim() || 'No asignado',
          fechaCierre: fechaCierreNuevoHallazgoModal || todayStr,
          estadoSeguimiento: 'PENDIENTE'
        };
      } else {
        nuevoHallazgoObj = {
          id: `extra_${Date.now()}`,
          esExtra: true,
          esReincidente: false,
          // Los hallazgos fuera del checklist no tienen punto de dónde deducir
          // si son de seguridad, así que se pregunta (SPEC-010). Es el único
          // dato nuevo que pide la captura en todo este paquete.
          esSeguridad: seguridadNuevoHallazgoModal,
          hallazgo: descNuevoHallazgoModal.trim(),
          accion: accionNuevoHallazgoModal.trim() || 'Sin registrar',
          responsable: respNuevoHallazgoModal.trim() || 'No asignado',
          fechaCierre: fechaCierreNuevoHallazgoModal || todayStr,
          estadoSeguimiento: 'PENDIENTE'
        };
      }

      hallazgosActuales.push(nuevoHallazgoObj);

      const totalPuntos = plantilla.length > 0 ? plantilla.length : Object.keys(respuestasActuales).length;
      const totalSiCalc = Object.values(respuestasActuales).filter((v) => v === 'SI').length;
      const totalNoCalc = Object.values(respuestasActuales).filter((v) => v === 'NO').length;
      const nuevoCumplimiento = totalPuntos > 0 ? Math.round((totalSiCalc / totalPuntos) * 100) : (hallazgosActuales.length === 0 ? 100 : 70);

      const docRef = doc(db, 'evaluaciones_proceso', docId);
      await updateDoc(docRef, {
        hallazgos: hallazgosActuales,
        respuestas: respuestasActuales,
        totalSi: totalSiCalc,
        totalNo: totalNoCalc + (tipoNuevoHallazgoModal === 'EXTRA' ? 1 : 0),
        cumplimiento: nuevoCumplimiento,
        estadoFinal: 'CON_HALLAZGOS'
      });

      setAuditoriaDetalleModal((prev: any) => ({
        ...prev,
        hallazgos: hallazgosActuales,
        respuestas: respuestasActuales,
        totalSi: totalSiCalc,
        totalNo: totalNoCalc,
        cumplimiento: nuevoCumplimiento,
        estadoFinal: 'CON_HALLAZGOS'
      }));

      setMostrarFormNuevoHallazgoModal(false);
      setPuntoSeleccionadoModal('');
      setDescNuevoHallazgoModal('');
      setAccionNuevoHallazgoModal('');
      setRespNuevoHallazgoModal('');
      setFechaCierreNuevoHallazgoModal('');
      setSeguridadNuevoHallazgoModal(false);
      alert('✅ Desviación agregada con éxito.');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar desviación.');
    } finally {
      setGuardandoHallazgoModal(false);
    }
  };

  const handleGuardarOEditarPregunta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoQueObservar.trim() || !nuevoComoVerifica.trim()) {
      alert('Completa los campos.');
      return;
    }

    if (editandoId !== null) {
      setChecklistEnEdicion((prev) =>
        prev.map((item) =>
          item.id === editandoId
            ? { ...item, seccion: nuevaSeccion.trim() || item.seccion, queObservar: nuevoQueObservar.trim(), comoVerifica: nuevoComoVerifica.trim() }
            : item
        )
      );
      cancelarEdicionPregunta();
    } else {
      const nuevoId = checklistEnEdicion.length > 0 ? Math.max(...checklistEnEdicion.map((i) => i.id)) + 1 : 1;
      const seccionDefault = moduloEditor === '5S' ? '1. ORDEN Y 5S' : 'PARÁMETROS OPERATIVOS';
      const nuevoItem: ItemChecklist = {
        id: nuevoId,
        seccion: nuevaSeccion.trim() || seccionDefault,
        queObservar: nuevoQueObservar.trim(),
        comoVerifica: nuevoComoVerifica.trim()
      };
      setChecklistEnEdicion((prev) => [...prev, nuevoItem]);
      setNuevoQueObservar('');
      setNuevoComoVerifica('');
      setNuevaSeccion('');
    }
  };

  const iniciarEdicionPregunta = (item: ItemChecklist) => {
    setEditandoId(item.id);
    setNuevaSeccion(item.seccion);
    setNuevoQueObservar(item.queObservar);
    setNuevoComoVerifica(item.comoVerifica);
  };

  const cancelarEdicionPregunta = () => {
    setEditandoId(null);
    setNuevaSeccion('');
    setNuevoQueObservar('');
    setNuevoComoVerifica('');
  };

  const handleEliminarPregunta = (id: number) => {
    if (confirm(`¿Deseas eliminar el punto #${id}?`)) {
      setChecklistEnEdicion((prev) => prev.filter((item) => item.id !== id));
      if (editandoId === id) cancelarEdicionPregunta();
    }
  };

  const handleGuardarPlantillaEnFirebase = async () => {
    setGuardandoPlantilla(true);
    try {
      const coleccionTarget = moduloEditor === 'PROCESO' ? 'plantillas_checklists' : 'plantillas_5s';
      const docRef = doc(db, coleccionTarget, tipoSeleccionadoEditor);
      await setDoc(docRef, {
        tipo: tipoSeleccionadoEditor,
        modulo: moduloEditor,
        items: checklistEnEdicion,
        actualizadoEn: serverTimestamp()
      });

      if (moduloEditor === 'PROCESO') {
        setPlantillasProceso((prev) => ({ ...prev, [tipoSeleccionadoEditor]: [...checklistEnEdicion] }));
      } else {
        setPlantillas5S((prev) => ({ ...prev, [tipoSeleccionadoEditor]: [...checklistEnEdicion] }));
      }
      alert(`✅ Plantilla de ${moduloEditor} guardada.`);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar plantilla.');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  // --- ALTERNAR ESTADO EN GANTT ---
  const handleToggleEstadoHallazgo = async (docId: string, hallazgoIdx: number, estadoActual?: EstadoCumplimiento) => {
    try {
      let nuevoEstado: EstadoCumplimiento = 'PENDIENTE';
      if (estadoActual === 'PENDIENTE' || !estadoActual) nuevoEstado = 'TERMINADO';
      else if (estadoActual === 'TERMINADO') nuevoEstado = 'PENDIENTE';
      else if (estadoActual === 'PENDIENTE_ATRASADO') nuevoEstado = 'TERMINADO';

      const docEncontrado = historial.find((h) => h.id === docId);
      if (docEncontrado && docEncontrado.hallazgos) {
        const nuevosHallazgos = [...docEncontrado.hallazgos];
        nuevosHallazgos[hallazgoIdx] = {
          ...nuevosHallazgos[hallazgoIdx],
          estadoSeguimiento: nuevoEstado,
          // Cuándo se cerró **de verdad** (SPEC-009). `fechaCierre` es el
          // compromiso capturado al levantarlo, no la fecha real, y sin este
          // dato no se puede decir cuánto aguantó cerrado antes de volver.
          cerradoEn: nuevoEstado === 'TERMINADO' ? todayStr : ''
        };
        const docRef = doc(db, 'evaluaciones_proceso', docId);
        await updateDoc(docRef, { hallazgos: nuevosHallazgos });

        // Se conserva a la vista lo que se acaba de cerrar, y se suelta lo que
        // se acaba de reabrir (SPEC-014).
        setCerradosAhora((prev) => {
          const sig = new Set(prev);
          const llave = `${docId}|${hallazgoIdx}`;
          if (nuevoEstado === 'TERMINADO') sig.add(llave);
          else sig.delete(llave);
          return sig;
        });
      }
    } catch (error) {
      // Antes esto solo iba a la consola: una escritura fallida se veía igual
      // que no haber hecho nada, y el renglón se quedaba como estaba sin que
      // nadie supiera por qué.
      console.error('Error al actualizar:', error);
      alert('No se pudo guardar el cambio de estatus. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  // --- HALLAZGOS GANTT ---
  /* ── El tablero (SPEC-009, SPEC-010 y SPEC-011) ─────────────────────────
     El Gantt dibujaba **cada hallazgo de cada auditoría**, incluidos los ya
     cerrados. Con uso real eran cientos de barras: un archivo histórico, no una
     herramienta para decidir. Ahora la fuente es `tableroAbiertos`, que deja
     solo lo abierto y lo ordena poniendo delante la seguridad y lo más vencido.

     Lo cerrado **no se borró ni se archivó**: sigue en su auditoría y en el
     historial de su punto, que es de donde la reincidencia lo lee.

     Se cambia la fuente y no la vista a propósito: la tabla, las barras y las
     exportaciones beben de este mismo arreglo, así que quedan acotadas las
     tres de una vez, sin tocar su dibujo. */
  const hallazgosPlanos = aplanarHallazgos(historialPermitido as any, todayStr);

  const hallazgosFiltradosGantt = tableroAbiertos(hallazgosPlanos, cerradosAhora)
    .filter((p) => {
      if (filtroOrigenGantt && p.tipoAuditoria !== filtroOrigenGantt) return false;
      if (filtroMaquinaGantt && p.maquinaNombre !== filtroMaquinaGantt) return false;
      if (filtroMesGantt && p.fechaAuditoria.split('-')[1] !== filtroMesGantt) return false;
      if (filtroDiaGantt && p.fechaAuditoria.split('-')[2] !== filtroDiaGantt.padStart(2, '0')) return false;
      if (filtroCumplimientoGantt && p.estado !== filtroCumplimientoGantt) return false;
      return true;
    })
    .map((p) => ({
      ...p,
      // Nombres que la vista y las exportaciones ya usaban.
      fechaInicio: p.fechaAuditoria,
      fechaFin: p.fechaCierre || todayStr,
      estadoSeguimiento: p.estado,
      // Ya no sale de buscar la palabra «reincidente» en el texto escrito a
      // mano, sino de que el punto haya fallado y se haya cerrado antes en esta
      // misma máquina (SPEC-009).
      esReincidente: p.reincidenciaDe !== null
    }));

  const resumenDelTablero = resumenTablero(hallazgosPlanos);

  // --- AUDITORÍAS FILTRADAS ---
  const auditoriasFiltradas = historialPermitido.filter((item) => {
    const tipoDoc = item.tipoAuditoria || 'PROCESO';
    if (filtroAudTipoRevision && tipoDoc !== filtroAudTipoRevision) return false;
    if (filtroAudFamilia && item.tipoMaquina !== filtroAudFamilia) return false;
    if (filtroAudMaquinaId && item.maquinaId !== filtroAudMaquinaId) return false;
    if (filtroAudMes) {
      const mesDoc = (item.fechaAuditoria || todayStr).split('-')[1];
      if (mesDoc !== filtroAudMes) return false;
    }
    return true;
  });

  const diasGantt = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const diasLetra = ['D', 'L', 'M', 'MI', 'J', 'V', 'S'];
    return {
      iso,
      letra: diasLetra[d.getDay()],
      diaNum: d.getDate(),
      mesNum: d.getMonth() + 1
    };
  });

  // --- EXPORTAR A EXCEL ---
  const handleExportarExcelGantt = () => {
    if (hallazgosFiltradosGantt.length === 0) {
      alert('No hay datos en el Gantt.');
      return;
    }

    const rowsHtml = hallazgosFiltradosGantt.map((item: any, index: number) => {
      const dIni = new Date(item.fechaInicio);
      const dFin = new Date(item.fechaFin);
      const diffTime = Math.abs(dFin.getTime() - dIni.getTime());
      const diasTotal = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${item.tipoAuditoria}</td>
          <td>${item.fechaAuditoria}</td>
          <td>${item.maquinaNombre}</td>
          <td>${item.ordenTrabajo || 'N/A'}</td>
          <td>${item.auditor}</td>
          <td>${item.hallazgo || ''}</td>
          <td>${item.accion || 'Sin acción'}</td>
          <td>${item.responsable || 'No asignado'}</td>
          <td>${item.fechaInicio}</td>
          <td>${item.fechaFin}</td>
          <td>${diasTotal}</td>
          <td>${item.estadoSeguimiento}</td>
        </tr>
      `;
    }).join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>
        <body>
          <h2>IMPREDIMEX — Reporte de Cronograma Gantt</h2>
          <table border="1">
            <thead>
              <tr>
                <th>#</th><th>Tipo</th><th>Fecha</th><th>Máquina</th><th>OP</th><th>Auditor</th>
                <th>Desviación</th><th>Acción</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Estatus</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gantt_IMPREDIMEX_${todayStr}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Exporta **solo el Gantt** (SPEC-015).
   *
   * Antes llamaba a `window.print()`, que imprime la página completa: salían
   * los filtros, las tarjetas del resumen y el encabezado de la app, y el
   * cronograma quedaba repartido en cuatro hojas.
   *
   * Ahora se arma un documento con los datos —los mismos que ya alimentan la
   * exportación a Excel— y se imprime **ese**. Se hace en un marco oculto en
   * vez de una ventana nueva porque una ventana emergente la bloquea el
   * navegador; el marco no.
   */
  const handleExportarPDFGantt = () => {
    if (hallazgosFiltradosGantt.length === 0) {
      alert('No hay datos en el Gantt.');
      return;
    }

    const esc = (t: any) => String(t ?? '').replace(/[&<>]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

    const filas = hallazgosFiltradosGantt.map((item: any, i: number) => {
      const dIni = new Date(item.fechaInicio);
      const dFin = new Date(item.fechaFin);
      const dias = Math.max(1, Math.ceil(Math.abs(dFin.getTime() - dIni.getTime()) / 86400000) + 1);
      const est = item.estadoSeguimiento === 'PENDIENTE_ATRASADO' ? 'VENCIDO'
        : item.estadoSeguimiento === 'TERMINADO' ? 'CERRADO' : 'PENDIENTE';
      const clase = item.estadoSeguimiento === 'PENDIENTE_ATRASADO' ? 'venc'
        : item.estadoSeguimiento === 'TERMINADO' ? 'cerr' : 'pend';
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(item.fechaAuditoria)}</td>
        <td><b>${esc(item.maquinaNombre)}</b></td>
        <td>${item.seguridad ? '<span class="seg">SEGURIDAD</span> ' : ''}${
          item.reincidenciaDe ? '<span class="rei">REINCIDE</span> ' : ''}${esc(item.hallazgo)}</td>
        <td>${esc(item.accion || 'Sin acción')}</td>
        <td>${esc(item.responsable || 'No asignado')}</td>
        <td class="num">${esc(item.fechaInicio)}</td>
        <td class="num">${esc(item.fechaFin)}</td>
        <td class="num">${dias}</td>
        <td class="num"><span class="${clase}">${est}</span></td>
      </tr>`;
    }).join('');

    const filtros = [
      filtroOrigenGantt && `Módulo: ${filtroOrigenGantt === '5S' ? 'Condiciones y 5S' : 'Validación de proceso'}`,
      filtroMaquinaGantt && `Máquina: ${filtroMaquinaGantt}`,
      filtroMesGantt && `Mes: ${filtroMesGantt}`,
      filtroDiaGantt && `Día: ${filtroDiaGantt}`,
      filtroCumplimientoGantt && `Estatus: ${filtroCumplimientoGantt}`
    ].filter(Boolean).join(' · ');

    const doc2 = `<!doctype html><html lang="es"><head><meta charset="utf-8">
      <title>Cronograma de hallazgos — IMPREDIMEX</title>
      <style>
        @page { size: A4 landscape; margin: 12mm 10mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0D1A2E; margin: 0; }
        h1 { font-size: 15px; color: #002060; margin: 0; letter-spacing: .04em; }
        .sub { font-size: 10px; color: #5A6A80; margin: 2px 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
        th { background: #003580; color: #fff; padding: 5px 6px; text-align: left;
             font-size: 8px; text-transform: uppercase; letter-spacing: .04em; }
        td { padding: 4px 6px; border-bottom: 1px solid #E8EEF8; vertical-align: top; }
        tr:nth-child(even) td { background: #f8f9ff; }
        .num { text-align: center; white-space: nowrap; }
        .venc, .pend, .cerr, .seg, .rei {
          display: inline-block; padding: 1px 5px; border-radius: 3px; font-weight: 700; font-size: 7.5px;
        }
        .venc { background: #F9E8EB; color: #7A0B1D; }
        .pend { background: #FDF0D8; color: #7A4500; }
        .cerr { background: #E0F2EC; color: #085041; }
        .seg  { background: #C8102E; color: #fff; }
        .rei  { background: #FDF0D8; color: #7A4500; border: 1px solid #D4840A; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
      </style></head><body>
      <h1>IMPREDIMEX · Cronograma de hallazgos</h1>
      <div class="sub">
        ${hallazgosFiltradosGantt.length} hallazgos · generado el ${todayStr} por ${esc(usuarioActivo?.nombre || '')}
        ${filtros ? ` · ${esc(filtros)}` : ''}
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Fecha</th><th>Máquina</th><th>Desviación</th><th>Acción</th>
          <th>Responsable</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Estatus</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table></body></html>`;

    const marco = document.createElement('iframe');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(marco);
    const d = marco.contentWindow?.document;
    if (!d) { document.body.removeChild(marco); alert('No se pudo preparar el PDF.'); return; }
    d.open(); d.write(doc2); d.close();
    marco.onload = () => {
      marco.contentWindow?.focus();
      marco.contentWindow?.print();
      // Se retira después de imprimir; sin la espera, algunos navegadores
      // cancelan el diálogo al quitarse el marco.
      setTimeout(() => { if (marco.parentNode) document.body.removeChild(marco); }, 1000);
    };
  };

  // --- PANTALLA DE INGRESO ---
  if (cargandoSesion) {
    return (
      // La misma marca que pinta el arranque de la página, para que las seis
      // apps se vean idénticas mientras abren (SPEC-006).
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
        <span className="hdr-marca" style={{ fontSize: '22px' }}>IMPREDIMEX</span>
      </div>
    );
  }

  if (!usuarioActivo) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #F0F4F8 0%, #D9E2EC 100%)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '16px'
      }}>
        <div style={{
          ...STYLES.glassCard, maxWidth: '420px', width: '100%', padding: '2.4rem 2rem',
          textAlign: 'center', boxShadow: '0 20px 40px rgba(0,32,96,0.15)'
        }}>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#002060', letterSpacing: '.02em' }}>IMPREDIMEX</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#003580', marginTop: '4px', marginBottom: '2rem' }}>
            Departamento de operaciones
          </div>

          <form onSubmit={handleIniciarSesion} style={{ textAlign: 'left' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                Nomina:
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej. 2308"
                value={inputLoginNomina}
                onChange={(e) => { setInputLoginNomina(e.target.value); setErrorLogin(''); }}
                style={{ ...STYLES.input, fontSize: '18px', textAlign: 'center', letterSpacing: '2px', fontWeight: 700 }}
                required
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                Clave de acceso (6 dígitos):
              </label>
              <input
                type="password"
                maxLength={20}
                placeholder="••••••"
                value={inputLoginPin}
                onChange={(e) => { setInputLoginPin(e.target.value); setErrorLogin(''); }}
                style={{ ...STYLES.input, fontSize: '18px', textAlign: 'center', letterSpacing: '8px', fontWeight: 700 }}
                required
              />
            </div>

            {errorLogin && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '8px 12px', borderRadius: '6px', fontSize: '11.5px', marginBottom: '14px', textAlign: 'center', fontWeight: 600 }}>
                {errorLogin}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%', padding: '12px', background: '#003580', color: '#ffffff',
                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,53,128,0.3)', letterSpacing: '.02em'
              }}
            >
              {entrando ? 'Verificando…' : 'Ingresar al Sistema →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#0D1A2E', position: 'relative' }}>
      
      {/* Encabezado estándar de la suite (SPEC-035 de RRHH) */}
      <header style={{
        // Opaco y sin desenfoque: el efecto de cristal dejaba pasar el fondo y,
        // en iOS, lavaba el logotipo. Fijo arriba, capa 45: por encima del
        // contenido y por debajo de todas las ventanas emergentes (900 en adelante).
        background: '#ffffff',
        borderBottom: '0.5px solid rgba(0,32,96,0.08)',
        boxShadow: '0 2px 8px rgba(0,32,96,0.05)',
        position: 'sticky', top: 0, zIndex: 45,
        padding: '6px 12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>

          {/* Orilla izquierda: regreso (solo fuera del inicio) y la marca. La
              flecha va a la izquierda, como en cualquier app de teléfono. */}
          <div className="hdr-orilla">
            {vista !== 'LAUNCHER' && (
              <button type="button" className="hdr-boton" onClick={() => setVista('LAUNCHER')}
                title="Volver al inicio" aria-label="Volver al inicio">
                <span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </span>
              </button>
            )}
            <div style={{ cursor: 'pointer', minWidth: 0 }} onClick={() => setVista('LAUNCHER')} title="Ir al inicio">
              <div className="hdr-marca">IMPREDIMEX</div>
              <div className="hdr-app">Ingeniería de Procesos</div>
            </div>
          </div>

          {/* Quién entró: solo en pantalla ancha, centrado. */}
          <div className="hdr-identidad">
            <div className="hdr-nombre">{usuarioActivo.nombre}</div>
            <div className="hdr-puesto">{usuarioActivo.puesto || usuarioActivo.rol}</div>
          </div>

          <div className="hdr-orilla" style={{ justifyContent: 'flex-end' }}>
            {/* Histórico: con borde y no relleno. El relleno azul queda solo
                para el círculo de la nómina, para no confundir el conteo de
                auditorías con el número de quien entró. */}
            <button type="button" className="hdr-boton"
              onClick={() => { setVista('HISTORIAL'); setSubVistaHistorial('AUDITORIAS'); }}
              title={`Histórico: ${historialPermitido.length} auditorías`}
              aria-label={`Histórico: ${historialPermitido.length} auditorías`}>
              <span>{historialPermitido.length}</span>
            </button>

            <a href="https://impredimex-hub.github.io/" className="hdr-boton" title="Volver al portal" aria-label="Volver al portal">
              <span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </span>
            </a>

            <button type="button" onClick={() => setPanelAbierto(v => !v)}
              aria-label={`Tu sesión: ${usuarioActivo.nombre}`} aria-expanded={panelAbierto}
              style={{ width: '44px', height: '44px', background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ position: 'relative', width: '34px', height: '34px', display: 'block' }}>
                <span title={`Nómina ${usuarioActivo.nomina} · ${usuarioActivo.rol}`} style={{
                  background: '#003580', color: '#fff', width: '34px', height: '34px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11.5px',
                  boxShadow: panelAbierto ? '0 0 0 3px rgba(0,53,128,.18)' : 'none'
                }}>
                  {usuarioActivo.nomina}
                </span>
                {/* El estado de conexión va sobre la nómina, no en su propio renglón. */}
                <span title={enLinea ? 'En línea' : 'Sin conexión'} style={{
                  position: 'absolute', right: '-1px', bottom: '-1px', width: '10px', height: '10px',
                  borderRadius: '50%', background: enLinea ? '#0F7A55' : '#C8102E', border: '2px solid #fff', display: 'block'
                }} />
              </span>
            </button>
          </div>

          {/* Panel de la sesión. Aquí el nombre y el puesto tienen ancho completo
              y pueden ocupar dos renglones: ninguno se corta, mida lo que mida. */}
          {panelAbierto && (
            <>
              <div onClick={() => setPanelAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '10px', zIndex: 41,
                width: '250px', background: '#fff', borderRadius: '14px', textAlign: 'left',
                boxShadow: '0 2px 8px rgba(0,32,96,.10), 0 12px 32px rgba(0,32,96,.14)',
                padding: '14px 15px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#002060', lineHeight: 1.35 }}>{usuarioActivo.nombre}</div>
                {usuarioActivo.puesto && (
                  <div style={{ fontSize: '11.5px', color: '#5A6A80', lineHeight: 1.4, marginTop: '2px' }}>{usuarioActivo.puesto}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '8px', fontSize: '11px', color: '#5A6A80' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: enLinea ? '#0F7A55' : '#C8102E', display: 'inline-block' }} />
                  {enLinea ? 'En línea' : 'Sin conexión'}
                  <span style={{ color: 'rgba(0,32,96,.18)' }}>|</span>
                  <span>Nómina {usuarioActivo.nomina}</span>
                  <span style={{ color: 'rgba(0,32,96,.18)' }}>|</span>
                  <span>{usuarioActivo.rol === 'ADMIN' ? 'Administrador' : usuarioActivo.rol === 'SUPERVISOR' ? 'Supervisor' : usuarioActivo.rol}</span>
                </div>
                <div style={{ height: '1px', background: 'rgba(0,32,96,.10)', margin: '12px 0' }} />
                <a href="https://impredimex-hub.github.io/" style={{ display: 'flex', alignItems: 'center', gap: '9px', minHeight: '44px', fontSize: '12.5px', fontWeight: 600, color: '#003580', textDecoration: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                  Ir al portal
                </a>
                <button type="button" onClick={() => { setPanelAbierto(false); handleCerrarSesion(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '9px', minHeight: '44px', width: '100%', background: 'transparent', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, color: '#9B0E24', textAlign: 'left', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main style={{ maxWidth: '1220px', margin: '0 auto', padding: '1.2rem 1rem 3rem' }}>

        {/* 1. VISTA LAUNCHER */}
        {vista === 'LAUNCHER' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '0.5rem' }}>
              <div onClick={() => setVista('MODULO_PROCESO')} style={{ ...STYLES.glassCard, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Módulo Operativo</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Validación de Proceso</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Checklists de arranque, control de parámetros, solvente, mangas y liberación de tiro.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#0F7A55', background: '#E0F2EC', padding: '3px 9px', borderRadius: '5px' }}>
                  26 Equipos de Proceso
                </span>
              </div>

              <div onClick={() => setVista('MODULO_5S')} style={{ ...STYLES.glassCard, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Módulo de Condiciones</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Condiciones y 5S</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Auditoría de 20 puntos: orden, limpieza, condición de máquina, seguridad e infraestructura.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#003580', background: '#E8EEF8', padding: '3px 9px', borderRadius: '5px' }}>
                  33 Áreas y Máquinas
                </span>
              </div>

              {/* Cobertura (SPEC-008). Va antes del editor porque es de uso
                  diario, y el editor es de configuración. */}
              <div onClick={() => setVista('COBERTURA')} style={{ ...STYLES.glassCard, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Seguimiento</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Prioridades a revisar</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Cuántos metros rechaza cada máquina y por qué defectos. De ahí sale a cuál conviene
                  entrarle primero.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#C8102E', background: '#F9E8EB', padding: '3px 9px', borderRadius: '5px' }}>
                  {maquinasDelOchenta().length} máquinas explican el 80%
                </span>
              </div>

              {/* Ranking (SPEC-007). */}
              <div onClick={() => setVista('RANKING')} style={{ ...STYLES.glassCard, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Análisis</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Puntos que más fallan</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Qué punto del checklist falla más, y si falla parejo o solo en una máquina o un turno.
                  Un punto que falla en todas partes es un procedimiento que corregir.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#003580', background: '#E8EEF8', padding: '3px 9px', borderRadius: '5px' }}>
                  Necesita {UMBRAL_REVISIONES} revisiones por punto
                </span>
              </div>

              <div onClick={() => setVista('EDITOR_PLANTILLAS')} style={{ ...STYLES.glassCard, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Configuración</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Editor de Plantillas y Listas de Verificación</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Agrega nuevas preguntas, modifica las existentes o elimina puntos en Proceso y 5S.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#003580', background: '#E8EEF8', padding: '3px 9px', borderRadius: '5px' }}>
                  Gestión Dinámica
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 1b. VISTA RECHAZOS (SPEC-013, presentación de la SPEC-016)
            Una lista de 33 renglones obligaba a filtrar para encontrar algo.
            Ahora cada proceso es un bloque, y dentro las máquinas se apilan
            como tarjetas de cartera: se ve el lomo de todas y la elegida se
            trae al frente con su información completa. */}
        {vista === 'COBERTURA' && (() => {
          /* El periodo que se está mirando (SPEC-017). Todo lo de abajo
             —metros, defectos, participación y hasta qué máquinas explican el
             80%— se recalcula con él: el perfil de una máquina cambia según el
             mes, y promediarlo todo escondía eso. */
          const periodo: Periodo | null =
            ultimos3 ? ultimosMeses(3)
            : mesRechazos ? { desde: mesRechazos, hasta: mesRechazos }
            : anioRechazos ? { desde: `${anioRechazos}-01`, hasta: `${anioRechazos}-12` }
            : null;

          const meses = mesesDisponibles();
          const anios = aniosDisponibles();
          const mesesDelAnio = anioRechazos ? mesesDeAnio(anioRechazos) : [];

          /** Cualquier cambio de periodo cierra la tarjeta: ya no corresponde. */
          const cambiarPeriodo = (fn: () => void) => { fn(); setMaquinaAlFrente(null); };
          const lasDelOchenta = maquinasDelOchenta(periodo);

          const maquinas = CATALOGO.map((m) => ({
            ...m,
            metros: mermaDe(m.id, periodo),
            defectos: defectosDe(m.id, periodo),
            pct: participacionDe(m.id, periodo)
          }));
          const totalMetros = maquinas.reduce((s, m) => s + m.metros, 0);

          // Un bloque por proceso, ordenados por lo que cuesta cada uno.
          const bloques = FAMILIAS_TODAS.map((fam) => {
            const suyas = maquinas
              .filter((m) => m.tipo === fam)
              .sort((a, b) => b.metros - a.metros || a.nombre.localeCompare(b.nombre));
            return { fam, suyas, metros: suyas.reduce((s, m) => s + m.metros, 0) };
          }).sort((a, b) => b.metros - a.metros || a.fam.localeCompare(b.fam));

          return (
            <div>
              <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#002060' }}>Prioridades a revisar</div>
                  <div style={{ fontSize: '11.5px', color: '#5A6A80', marginTop: '2px' }}>
                    Un bloque por proceso. Toca una máquina para traerla al frente.
                  </div>
                </div>
                <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  ← Inicio
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '1.2rem' }}>
                <div style={{ ...STYLES.metricCard }}>
                  <div style={{ fontSize: '10px', opacity: .75, textTransform: 'uppercase', letterSpacing: '.06em' }}>Metros rechazados</div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>{totalMetros.toLocaleString('es-MX')}</div>
                </div>
                <div style={{ ...STYLES.metricCard }}>
                  <div style={{ fontSize: '10px', opacity: .75, textTransform: 'uppercase', letterSpacing: '.06em' }}>Máquinas con rechazos</div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>{maquinas.filter((m) => m.metros > 0).length}</div>
                </div>
              </div>

              {/* Periodo en tres controles (SPEC-018). */}
              <div style={{ ...STYLES.glassCard, padding: '.9rem 1.2rem', marginBottom: '1.2rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>
                      Año
                    </label>
                    <select
                      value={anioRechazos}
                      disabled={ultimos3}
                      onChange={(e) => cambiarPeriodo(() => { setAnioRechazos(e.target.value); setMesRechazos(''); })}
                      style={{ ...STYLES.input, width: '100%', padding: '9px 12px', fontSize: '12.5px', opacity: ultimos3 ? .5 : 1 }}
                    >
                      <option value="">Todos los años</option>
                      {anios.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>
                      Mes
                    </label>
                    {/* El mes depende del año: «julio» sin año sería ambiguo
                        —¿el de 2025 o el de 2026?— y la lista volvería a ser
                        larga, que es justo lo que se quería evitar. */}
                    <select
                      value={mesRechazos}
                      disabled={ultimos3 || !anioRechazos}
                      onChange={(e) => cambiarPeriodo(() => setMesRechazos(e.target.value))}
                      title={!anioRechazos ? 'Elige primero un año' : ''}
                      style={{ ...STYLES.input, width: '100%', padding: '9px 12px', fontSize: '12.5px', opacity: (ultimos3 || !anioRechazos) ? .5 : 1 }}
                    >
                      <option value="">{anioRechazos ? 'Todo el año' : 'Elige un año primero'}</option>
                      {mesesDelAnio.map((m) => (
                        <option key={m} value={m}>{nombreDeMes(m).split(' ')[0]}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => cambiarPeriodo(() => {
                      const activar = !ultimos3;
                      setUltimos3(activar);
                      if (activar) { setAnioRechazos(''); setMesRechazos(''); }
                    })}
                    style={{
                      border: `1px solid ${ultimos3 ? '#003580' : 'rgba(0,32,96,0.18)'}`,
                      background: ultimos3 ? '#003580' : '#fff',
                      color: ultimos3 ? '#fff' : '#003580',
                      padding: '10px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    Últimos 3 meses
                  </button>
                </div>

                <div style={{ fontSize: '10.5px', color: '#5A6A80', marginTop: '8px', lineHeight: 1.45 }}>
                  {periodo
                    ? <>Viendo <b style={{ color: '#002060' }}>{
                        periodo.desde === periodo.hasta ? nombreDeMes(periodo.desde)
                          : `${nombreDeMes(periodo.desde)} a ${nombreDeMes(periodo.hasta)}`
                      }</b>. Los porcentajes son sobre lo registrado en ese periodo.</>
                    : <>Viendo <b style={{ color: '#002060' }}>todo el histórico</b>: {meses.length} meses
                        con datos, de {nombreDeMes(meses[meses.length - 1])} a {nombreDeMes(meses[0])}.</>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '14px', alignItems: 'start' }}>
                {bloques.map((b) => (
                  <div key={b.fam} style={{ ...STYLES.glassCard, padding: '1rem 1.1rem', marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', paddingBottom: '.7rem', marginBottom: '.9rem', borderBottom: '2px solid #E8EEF8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{ width: '3px', height: '16px', background: b.metros > 0 ? '#C8102E' : '#8A9AB0', borderRadius: '2px', flexShrink: 0 }}></div>
                        <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#002060', textTransform: 'uppercase', letterSpacing: '.05em' }}>{b.fam}</div>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#5A6A80', whiteSpace: 'nowrap' }}>
                        {b.metros > 0 ? `${b.metros.toLocaleString('es-MX')} m` : 'sin rechazos'}
                      </div>
                    </div>

                    {/* La cartera. Las tarjetas cerradas se enciman y solo
                        asoman su lomo; la abierta se separa y despliega. */}
                    <div style={{ position: 'relative' }}>
                      {b.suyas.map((m, i) => {
                        const abierta = maquinaAlFrente === m.id;
                        const previaAbierta = i > 0 && maquinaAlFrente === b.suyas[i - 1].id;
                        const pesada = lasDelOchenta.includes(m.id);
                        const color = pesada ? '#C8102E' : m.metros > 0 ? '#003580' : '#8A9AB0';

                        return (
                          <div
                            key={m.id}
                            onClick={() => setMaquinaAlFrente(abierta ? null : m.id)}
                            style={{
                              position: 'relative',
                              marginTop: i === 0 ? 0 : (abierta || previaAbierta) ? 8 : -14,
                              zIndex: abierta ? 20 : i + 1,
                              cursor: 'pointer',
                              borderRadius: '11px',
                              // Lados por separado y no `border` + `borderTop`:
                              // mezclar la abreviada con una de sus partes deja
                              // el estilo a medias al redibujar.
                              borderTop: `3px solid ${color}`,
                              borderRight: `1px solid ${abierta ? color : 'rgba(0,32,96,0.12)'}`,
                              borderBottom: `1px solid ${abierta ? color : 'rgba(0,32,96,0.12)'}`,
                              borderLeft: `1px solid ${abierta ? color : 'rgba(0,32,96,0.12)'}`,
                              background: '#fff',
                              boxShadow: abierta
                                ? '0 6px 18px rgba(0,32,96,.14)'
                                : '0 1px 3px rgba(0,32,96,.08)',
                              padding: abierta ? '10px 12px 12px' : '8px 12px 14px',
                              transition: 'margin-top .15s, box-shadow .15s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: abierta ? '#002060' : '#003580', minWidth: 0, textAlign: 'left' }}>
                                {m.nombre}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: pesada ? 800 : 600, color, whiteSpace: 'nowrap' }}>
                                {m.metros > 0 ? `${m.metros.toLocaleString('es-MX')} m` : '—'}
                              </span>
                            </div>

                            {abierta && (
                              <div style={{ marginTop: '9px', textAlign: 'left' }}>
                                {m.metros > 0 ? (
                                  <>
                                    <div style={{ fontSize: '10.5px', color: '#5A6A80', marginBottom: '8px' }}>
                                      <b style={{ color }}>{m.pct.toFixed(1)}%</b> de la merma de la planta
                                      {pesada && <span style={{ color: '#C8102E', fontWeight: 700 }}> · de las que explican el 80%</span>}
                                    </div>
                                    <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px' }}>
                                      Principales defectos
                                    </div>
                                    {m.defectos.map((d) => (
                                      <div key={d.nombre} style={{ marginBottom: '5px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '10.5px', marginBottom: '2px' }}>
                                          <span style={{ color: d.pct >= 30 ? '#C8102E' : '#0D1A2E', fontWeight: d.pct >= 30 ? 700 : 500 }}>{d.nombre}</span>
                                          <span style={{ color: '#5A6A80', whiteSpace: 'nowrap' }}>
                                            {d.pct}% · {d.metros.toLocaleString('es-MX')} m
                                          </span>
                                        </div>
                                        {/* La barra hace comparable de un vistazo lo que el
                                            número solo deja comparar leyendo. */}
                                        <div style={{ height: '4px', borderRadius: '2px', background: '#E8EEF8', overflow: 'hidden' }}>
                                          <div style={{ width: `${Math.min(100, d.pct)}%`, height: '100%', background: d.pct >= 30 ? '#C8102E' : '#003580' }}></div>
                                        </div>
                                      </div>
                                    ))}
                                    <div style={{ fontSize: '9px', color: '#8A9AB0', marginTop: '7px', lineHeight: 1.45 }}>
                                      Los porcentajes son sobre la merma de esta máquina, no de la planta.
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: '10.5px', color: '#8A9AB0' }}>
                                    Sin rechazos registrados en el histórico de Control de Procesos.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '11px', color: '#5A6A80', lineHeight: 1.6, marginTop: '14px', padding: '0 4px', textAlign: 'left' }}>
                En rojo las máquinas que explican el 80% de la merma <b>del periodo elegido</b>, y los
                defectos que pesan 30% o más dentro de su máquina. El perfil cambia según el mes: lo que
                más duele en el histórico no siempre es lo que más dolió el mes pasado.
                <div style={{ marginTop: '6px' }}>
                  Los datos vienen del histórico de Control de Procesos. <b>El último mes cargado es
                  {' '}{meses[0] ? nombreDeMes(meses[0]) : '—'}</b>; de ahí en adelante no hay merma
                  registrada. Sobre todo el histórico los porcentajes de planta suman 98.8%: el 1.2%
                  restante son {METROS_SIN_CRUZAR.toLocaleString('es-MX')} metros de identificadores que
                  el catálogo de esta app no tiene. Hay además {METROS_FECHA_INVALIDA.toLocaleString('es-MX')}
                  {' '}metros con un año mal capturado que cuentan en el total pero no caen en ningún mes.
                </div>
              </div>
            </div>
          );
        })()}


        {/* 1c. VISTA RANKING (SPEC-007) */}
        {vista === 'RANKING' && (() => {
          const familias = familiasConProceso(historial);
          const familiaUsada = tipoRanking === 'PROCESO' ? (familiaRanking || familias[0] || null) : null;
          const filas: FilaRanking[] = calcularRanking(historial, tipoRanking, familiaUsada);
          const conHistoria = filas.filter((f) => !f.sinHistoria);
          const sinHistoria = filas.filter((f) => f.sinHistoria);
          // Seguridad que ya falló pero aún no llega al umbral (SPEC-010).
          const seguridadAlerta = seguridadPendiente(filas);

          return (
            <div>
              <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#002060' }}>Puntos que más fallan</div>
                  <div style={{ fontSize: '11.5px', color: '#5A6A80', marginTop: '2px' }}>
                    Agrupado por punto del checklist, no por auditoría.
                  </div>
                </div>
                <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  ← Inicio
                </button>
              </div>

              <div style={{ ...STYLES.glassCard, padding: '.9rem 1.2rem', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px', textAlign: 'left' }}>
                    Tipo de auditoría
                  </label>
                  <div style={{ display: 'flex' }}>
                    {(['5S', 'PROCESO'] as const).map((t, i) => (
                      <button key={t} onClick={() => setTipoRanking(t)}
                        style={{
                          border: '1px solid rgba(0,32,96,0.18)', padding: '8px 14px', fontSize: '11.5px', fontWeight: 700,
                          fontFamily: 'inherit', cursor: 'pointer',
                          borderRadius: i === 0 ? '8px 0 0 8px' : '0 8px 8px 0', borderLeftWidth: i === 1 ? 0 : 1,
                          background: tipoRanking === t ? '#003580' : '#fff',
                          color: tipoRanking === t ? '#fff' : '#003580'
                        }}>
                        {t === '5S' ? 'Condiciones y 5S' : 'Validación de proceso'}
                      </button>
                    ))}
                  </div>
                </div>

                {tipoRanking === 'PROCESO' && (
                  <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px', textAlign: 'left' }}>
                      Familia de máquina
                    </label>
                    <select value={familiaUsada || ''} onChange={(e) => setFamiliaRanking(e.target.value)}
                      style={{ ...STYLES.input, width: '100%', padding: '8px 12px', fontSize: '12px' }}>
                      {familias.length === 0 && <option value="">Sin auditorías de proceso</option>}
                      {familias.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Por qué no es un solo tablero. */}
              <div style={{ fontSize: '11px', color: '#5A6A80', lineHeight: 1.55, marginBottom: '12px', textAlign: 'left', padding: '0 4px' }}>
                {tipoRanking === '5S'
                  ? <>El checklist de 5S es el mismo para toda la planta, así que estos porcentajes
                      son comparables entre máquinas.</>
                  : <>El checklist de proceso es <b>distinto en cada familia</b>, así que solo se compara
                      dentro de una. El «punto 4» de Pegado y el de Flexografía no son la misma pregunta,
                      y juntarlos daría un ranking sin significado.</>}
                {' '}Los dos tipos nunca se mezclan.
              </div>

              {/* Seguridad que ya falló, aunque no llegue al umbral (SPEC-010).
                  Va **antes** de la tabla: el umbral es correcto para ordenar,
                  pero aplicárselo a la seguridad la escondía en la lista gris
                  de abajo, indistinguible de un punto al 0%. */}
              {seguridadAlerta.length > 0 && (
                <div style={{
                  border: '1px solid #C8102E', borderLeft: '4px solid #C8102E', borderRadius: '10px',
                  background: '#F9E8EB', padding: '12px 14px', marginBottom: '1rem', textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                    <span style={{ background: '#C8102E', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '3px', letterSpacing: '.03em' }}>
                      SEGURIDAD
                    </span>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#C8102E' }}>
                      Ya está fallando, aunque falte historia
                    </span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#7A0B1D', lineHeight: 1.5, marginBottom: '9px' }}>
                    Con menos de {UMBRAL_REVISIONES} revisiones el porcentaje todavía no sirve para
                    ordenar, pero un punto de seguridad que ya falló no espera a tener significancia
                    estadística.
                  </div>
                  {seguridadAlerta.map((f) => (
                    <div key={f.clave} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', padding: '3px 0', borderTop: '1px solid rgba(200,16,46,.15)' }}>
                      <span style={{ fontSize: '11.5px', color: '#002060', fontWeight: 600 }}>{f.texto}</span>
                      <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#C8102E', whiteSpace: 'nowrap' }}>
                        {f.tasa}% <span style={{ fontWeight: 400, color: '#7A0B1D' }}>({f.no} de {f.total})</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {conHistoria.length === 0 && sinHistoria.length === 0 ? (
                <div style={{ ...STYLES.glassCard, padding: '28px', textAlign: 'center', color: '#5A6A80', fontSize: '12.5px' }}>
                  Todavía no hay auditorías de este tipo con respuestas.
                </div>
              ) : (
                <div style={{ ...STYLES.glassCard, padding: '0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9ff', borderBottom: '2px solid #E8EEF8' }}>
                        {['Punto del checklist', 'Falla', 'Revisiones', 'Dónde falla'].map((h, i) => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'left' : 'center', fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {conHistoria.map((f) => {
                        const d = dondeFalla(f);
                        const abierto = puntoAbierto === f.puntoId;
                        return (
                          <React.Fragment key={f.clave}>
                            <tr onClick={() => setPuntoAbierto(abierto ? null : f.puntoId)}
                              style={{ borderBottom: '1px solid rgba(0,32,96,0.06)', cursor: 'pointer', background: abierto ? '#f8f9ff' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', textAlign: 'left' }}>
                                {f.seguridad && (
                                  <span style={{ background: '#C8102E', color: '#fff', fontSize: '8.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', marginRight: '6px', letterSpacing: '.03em' }}>
                                    SEGURIDAD
                                  </span>
                                )}
                                <span style={{ fontWeight: 600, color: '#002060', lineHeight: 1.35 }}>{f.texto}</span>
                                <div style={{ fontSize: '9.5px', color: '#8A9AB0' }}>{f.seccion}</div>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  fontSize: '14px', fontWeight: 800,
                                  color: f.tasa >= 50 ? '#C8102E' : f.tasa >= 20 ? '#D4840A' : '#0F7A55'
                                }}>{f.tasa}%</span>
                                <span style={{ display: 'block', fontSize: '9.5px', color: '#8A9AB0' }}>{f.no} de {f.total}</span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', color: '#5A6A80' }}>{f.total}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                {d.patron === 'PAREJO' ? (
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#C8102E' }}>
                                    Parejo
                                    <span style={{ display: 'block', fontWeight: 400, color: '#5A6A80' }}>corregir el procedimiento</span>
                                  </span>
                                ) : d.patron === 'CONCENTRADO' ? (
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#D4840A' }}>
                                    Solo en {d.culpable}
                                    <span style={{ display: 'block', fontWeight: 400, color: '#5A6A80' }}>atender ahí</span>
                                  </span>
                                ) : (
                                  <span style={{ color: '#8A9AB0', fontSize: '10px' }}>—</span>
                                )}
                              </td>
                            </tr>
                            {abierto && (
                              <tr style={{ background: '#f8f9ff', borderBottom: '1px solid rgba(0,32,96,0.06)' }}>
                                <td colSpan={4} style={{ padding: '10px 14px', textAlign: 'left' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
                                    {[{ t: 'Por máquina', d: f.porMaquina }, { t: 'Por turno', d: f.porTurno }].map((bloque) => (
                                      <div key={bloque.t}>
                                        <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '5px' }}>{bloque.t}</div>
                                        {bloque.d.map((x) => (
                                          <div key={x.etiqueta} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', padding: '2px 0' }}>
                                            <span style={{ color: '#5A6A80' }}>{x.etiqueta}</span>
                                            <span style={{ fontWeight: 700, color: x.tasa >= 50 ? '#C8102E' : x.tasa > 0 ? '#D4840A' : '#0F7A55' }}>
                                              {x.tasa}% <span style={{ fontWeight: 400, color: '#8A9AB0' }}>({x.no}/{x.total})</span>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {sinHistoria.length > 0 && (
                    <div style={{ padding: '12px 14px', borderTop: '2px solid #E8EEF8', background: '#f8f9ff', textAlign: 'left' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#5A6A80', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>
                        Sin historia suficiente ({sinHistoria.length})
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#8A9AB0', marginBottom: '7px', lineHeight: 1.5 }}>
                        Menos de {UMBRAL_REVISIONES} revisiones. No compiten por el primer lugar porque el
                        porcentaje todavía es ruido: un punto respondido una vez y fallado daría 100%.
                      </div>
                      {sinHistoria.map((f) => (
                        <div key={f.clave} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', padding: '2px 0' }}>
                          <span style={{ color: '#5A6A80' }}>
                            {f.seguridad && <span style={{ color: '#C8102E', fontWeight: 800, marginRight: '4px' }}>·</span>}
                            {f.texto}
                          </span>
                          <span style={{ color: '#8A9AB0', whiteSpace: 'nowrap' }}>{f.no}/{f.total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontSize: '11px', color: '#5A6A80', lineHeight: 1.6, marginTop: '10px', padding: '0 4px', textAlign: 'left' }}>
                Toca un renglón para ver el desglose por máquina y por turno. Ese desglose es lo que decide
                qué hacer: si el punto falla <b>parejo</b>, el estándar está mal escrito, es irreal o nunca se
                entrenó, y lo que se corrige es el procedimiento. Si falla <b>en un solo lado</b>, se repara
                o se entrena ahí. El ranking no publica nombres de personas: el objetivo es arreglar
                procedimientos, y un tablero por nombre cambia el incentivo y degrada el dato.
              </div>
            </div>
          );
        })()}

        {/* 2. VISTA SELECCIÓN PROCESO */}
        {vista === 'MODULO_PROCESO' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Validación de Proceso y Arranque</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Selecciona el proceso y la máquina para iniciar la auditoría</div>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
            </div>

            <div style={{ ...STYLES.glassCard, maxWidth: '560px', margin: '0 auto', textAlign: 'left' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                  1. Selecciona el Proceso / Familia:
                </label>
                <select
                  value={filtroProcesoFamilia}
                  onChange={(e) => { setFiltroProcesoFamilia(e.target.value); setFiltroProcesoMaquinaId(''); }}
                  style={{ ...STYLES.input, fontSize: '14px', fontWeight: 600 }}
                >
                  <option value="">-- Elige un proceso --</option>
                  {FAMILIAS_PROCESO.map((fam) => (
                    <option key={fam} value={fam}>{fam}</option>
                  ))}
                </select>
              </div>

              {filtroProcesoFamilia && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                    2. Selecciona la Máquina:
                  </label>
                  <select
                    value={filtroProcesoMaquinaId}
                    onChange={(e) => setFiltroProcesoMaquinaId(e.target.value)}
                    style={{ ...STYLES.input, fontSize: '14px', fontWeight: 600 }}
                  >
                    <option value="">-- Elige una máquina --</option>
                    {CATALOGO.filter((m) => m.moduloProceso && m.tipo === filtroProcesoFamilia).map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                disabled={!filtroProcesoMaquinaId}
                onClick={() => {
                  const m = CATALOGO.find((maq) => maq.id === filtroProcesoMaquinaId);
                  if (m) {
                    setMaquinaSeleccionada(m);
                    setTipoAuditoriaActiva('PROCESO');
                    setVista('EVALUACION');
                  }
                }}
                style={{
                  width: '100%', padding: '12px', background: filtroProcesoMaquinaId ? '#003580' : '#E8EEF8',
                  color: filtroProcesoMaquinaId ? '#ffffff' : '#8A9AB0', border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 700, cursor: filtroProcesoMaquinaId ? 'pointer' : 'not-allowed'
                }}
              >
                Iniciar Auditoría de Proceso →
              </button>
            </div>
          </div>
        )}

        {/* 3. VISTA SELECCIÓN 5S */}
        {vista === 'MODULO_5S' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Condiciones de Equipo y 5S</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Selecciona el tipo de área/proceso y el equipo a auditar</div>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
            </div>

            <div style={{ ...STYLES.glassCard, maxWidth: '560px', margin: '0 auto', textAlign: 'left' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                  1. Selecciona el Proceso o Área:
                </label>
                <select
                  value={filtro5SFamilia}
                  onChange={(e) => { setFiltro5SFamilia(e.target.value); setFiltro5SMaquinaId(''); }}
                  style={{ ...STYLES.input, fontSize: '14px', fontWeight: 600 }}
                >
                  <option value="">-- Elige un proceso / área --</option>
                  {FAMILIAS_5S.map((fam) => (
                    <option key={fam} value={fam}>{fam}</option>
                  ))}
                </select>
              </div>

              {filtro5SFamilia && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                    2. Selecciona la Máquina o Área Auxiliar:
                  </label>
                  <select
                    value={filtro5SMaquinaId}
                    onChange={(e) => setFiltro5SMaquinaId(e.target.value)}
                    style={{ ...STYLES.input, fontSize: '14px', fontWeight: 600 }}
                  >
                    <option value="">-- Elige la máquina o área específica --</option>
                    {CATALOGO.filter((m) => m.modulo5S && m.tipo === filtro5SFamilia).map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                disabled={!filtro5SMaquinaId}
                onClick={() => {
                  const m = CATALOGO.find((maq) => maq.id === filtro5SMaquinaId);
                  if (m) {
                    setMaquinaSeleccionada(m);
                    setTipoAuditoriaActiva('5S');
                    setVista('EVALUACION');
                  }
                }}
                style={{
                  width: '100%', padding: '12px', background: filtro5SMaquinaId ? '#003580' : '#E8EEF8',
                  color: filtro5SMaquinaId ? '#ffffff' : '#8A9AB0', border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 700, cursor: filtro5SMaquinaId ? 'pointer' : 'not-allowed'
                }}
              >
                Iniciar Auditoría 5S →
              </button>
            </div>
          </div>
        )}

        {/* 4. VISTA DE EVALUACIÓN */}
        {vista === 'EVALUACION' && (
          <div>
            <div style={STYLES.glassCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                <div style={{ width: '3px', height: '18px', background: tipoAuditoriaActiva === '5S' ? '#d97706' : '#003580', borderRadius: '2px' }}></div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {tipoAuditoriaActiva === '5S' ? 'Auditoría de Condiciones de Equipo y 5S' : 'Auditoría Operativa de Proceso'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#002060' }}>{maquinaSeleccionada?.nombre}</div>
                  <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
                    Categoría: <strong>{maquinaSeleccionada?.tipo}</strong> · {itemsChecklistActivo.length} Puntos de Inspección
                  </div>
                </div>

                {itemsChecklistActivo.length > 0 && (
                  <div style={{ textAlign: 'right', background: '#E8EEF8', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,53,128,0.2)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase' }}>Cumplimiento</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: (totalNo > 0 || puntosSoloReincidentes.length > 0) ? '#C8102E' : '#0F7A55' }}>
                      {cumplimiento}%
                    </div>
                    <div style={{ fontSize: '10px', color: '#5A6A80' }}>{totalRespondidos} de {itemsChecklistActivo.length} evaluados</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '1.2rem', textAlign: 'left' }}>
                {tipoAuditoriaActiva === 'PROCESO' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Orden de Trabajo (OP):</label>
                    <input
                      type="text"
                      placeholder="Ej. OP-45920"
                      value={ordenTrabajo}
                      onChange={(e) => setOrdenTrabajo(e.target.value)}
                      style={STYLES.input}
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Auditor:</label>
                  <input
                    type="text"
                    value={auditor}
                    onChange={(e) => setAuditor(e.target.value)}
                    style={STYLES.input}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Nómina auditado:</label>
                  <input
                    type="text"
                    placeholder="Ej. 1045"
                    value={nominaAuditado}
                    onChange={(e) => setNominaAuditado(e.target.value)}
                    style={STYLES.input}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>
                    Nombre del supervisor:
                  </label>
                  <select
                    value={supervisorNomina}
                    onChange={(e) => setSupervisorNomina(e.target.value)}
                    style={{ ...STYLES.input, fontWeight: 600 }}
                  >
                    <option value="">
                      {supervisoresDisponibles.length > 0 ? '-- Selecciona el supervisor --' : '-- Sin supervisor asignado (Pendiente) --'}
                    </option>
                    {supervisoresDisponibles.map((sup) => (
                      <option key={sup.nomina} value={sup.nomina}>
                        {sup.nombre} (Nóm. {sup.nomina})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Turno:</label>
                  <select value={turno} onChange={(e) => setTurno(e.target.value)} style={STYLES.input}>
                    <option>Matutino (6:00–14:00)</option>
                    <option>Vespertino (14:00–21:30)</option>
                    <option>Nocturno (21:30–6:00)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Checklist */}
            {itemsChecklistActivo.length > 0 ? (
              <div style={STYLES.glassCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Puntos de Inspección ({tipoAuditoriaActiva})
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {itemsChecklistActivo.map((item, idx) => {
                    const resp = respuestas[item.id];
                    const esSoloReincidente = puntosSoloReincidentes.includes(item.id);
                    const showHeader = idx === 0 || itemsChecklistActivo[idx - 1].seccion !== item.seccion;

                    return (
                      <React.Fragment key={`check-item-${item.id}`}>
                        {showHeader && (
                          <div style={{ background: '#E8EEF8', color: '#002060', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', marginTop: idx === 0 ? '0' : '14px', textAlign: 'left' }}>
                            <span>{item.seccion}</span>
                          </div>
                        )}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px', borderRadius: '8px',
                          border: resp === 'NO' ? '1.5px solid #C8102E' : '1.5px solid rgba(0,32,96,0.07)',
                          background: resp === 'NO' ? '#F9E8EB' : resp === 'SI' ? '#E0F2EC' : 'rgba(255,255,255,0.85)',
                          gap: '12px', flexWrap: 'wrap'
                        }}>
                          <div style={{ flex: '1 1 300px', textAlign: 'left' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: resp === 'NO' ? '#7A0B1D' : '#0D1A2E' }}>
                              <span style={{ color: '#003580', marginRight: '6px' }}>#{item.id}</span>
                              <span>{item.queObservar}</span>
                              {esSoloReincidente && (
                                <span style={{ marginLeft: '8px', fontSize: '10px', background: '#FDE8EB', color: '#C8102E', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  ⚠️ REINCIDENTE
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
                              <strong>Verificación:</strong> <span>{item.comoVerifica}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleRespuesta(item.id, 'SI')}
                              style={{
                                padding: '6px 14px', borderRadius: '6px', border: 'none',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                background: resp === 'SI' ? '#0F7A55' : 'rgba(0,32,96,0.06)',
                                color: resp === 'SI' ? '#ffffff' : '#5A6A80'
                              }}
                            >
                              ✓ SÍ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRespuesta(item.id, 'NO')}
                              style={{
                                padding: '6px 14px', borderRadius: '6px', border: 'none',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                background: resp === 'NO' ? '#C8102E' : 'rgba(0,32,96,0.06)',
                                color: resp === 'NO' ? '#ffffff' : '#5A6A80'
                              }}
                            >
                              ✕ NO
                            </button>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ ...STYLES.glassCard, textAlign: 'left', padding: '16px 20px', background: '#f8fafc' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#002060', marginBottom: '4px' }}>
                  <span>Sin preguntas registradas para {maquinaSeleccionada?.tipo}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5 }}>
                  Configura los puntos desde el <strong>Editor de Plantillas</strong> o registra observaciones con el botón <strong>"+ Agregar Hallazgo Extra"</strong>.
                </div>
              </div>
            )}

            {/* Hallazgos y Acciones */}
            <div style={{ ...STYLES.glassCard, border: listaHallazgos.length > 0 ? '1.5px solid #C8102E' : '1px solid rgba(0,32,96,0.07)', background: listaHallazgos.length > 0 ? '#F9E8EB' : 'rgba(255,255,255,0.88)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: listaHallazgos.length > 0 ? '2px solid rgba(200,16,46,0.2)' : '2px solid #E8EEF8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '18px', background: listaHallazgos.length > 0 ? '#C8102E' : '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: listaHallazgos.length > 0 ? '#7A0B1D' : '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    <span>Hallazgos y Acciones Correctivas ({listaHallazgos.length})</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddHallazgoExtra}
                  style={{ background: '#003580', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Agregar Hallazgo Extra
                </button>
              </div>

              {listaHallazgos.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#5A6A80', textAlign: 'center', padding: '14px 10px' }}>
                  {puntosSoloReincidentes.length > 0 
                    ? `Hay ${puntosSoloReincidentes.length} punto(s) marcado(s) como Reincidente(s). Afectan la calificación pero no generan tareas duplicadas en el Gantt.`
                    : 'No hay hallazgos registrados. Si una pregunta se marca como "NO" o agregas un hallazgo extra, aparecerá aquí.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {listaHallazgos.map((h) => {
                    const itemCheck = h.puntoId ? itemsChecklistActivo.find((i) => i.id === h.puntoId) : null;
                    return (
                      <div key={`hallazgo-item-${h.id}`} style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid rgba(200,16,46,0.25)', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A0B1D' }}>
                            <span>{h.esExtra ? '⚠️ Hallazgo Extra' : `Punto #${h.puntoId}: ${itemCheck?.queObservar}`}</span>
                            {h.esReincidente && (
                              <span style={{ marginLeft: '8px', fontSize: '10px', background: '#FDE8EB', color: '#C8102E', padding: '2px 6px', borderRadius: '4px' }}>
                                (REINCIDENTE)
                              </span>
                            )}
                          </div>
                          {h.esExtra && (
                            <button type="button" onClick={() => handleRemoveHallazgoExtra(h.id)} style={{ background: 'none', border: 'none', color: '#C8102E', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                              ✕ Eliminar
                            </button>
                          )}
                        </div>

                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Descripción del Hallazgo:</label>
                          <input
                            type="text"
                            value={h.hallazgo}
                            onChange={(e) => handleHallazgoChange(h.id, 'hallazgo', e.target.value)}
                            style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Acción Correctiva Inmediata:</label>
                            <input
                              type="text"
                              value={h.accion}
                              onChange={(e) => handleHallazgoChange(h.id, 'accion', e.target.value)}
                              style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Responsable:</label>
                            <input
                              type="text"
                              value={h.responsable}
                              onChange={(e) => handleHallazgoChange(h.id, 'responsable', e.target.value)}
                              style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Fecha de Cierre:</label>
                            <input
                              type="date"
                              value={h.fechaCierre}
                              onChange={(e) => handleHallazgoChange(h.id, 'fechaCierre', e.target.value)}
                              style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px', background: '#ffffff', cursor: 'pointer' }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setVista(tipoAuditoriaActiva === '5S' ? 'MODULO_5S' : 'MODULO_PROCESO')}
                style={{ padding: '11px 20px', background: 'transparent', border: '1.5px solid rgba(0,32,96,0.12)', color: '#003580', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleGuardarEvaluacion}
                style={{
                  padding: '11px 28px',
                  background: (listaHallazgos.length === 0 && puntosSoloReincidentes.length === 0) ? '#003580' : '#C8102E',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 700, cursor: guardando ? 'not-allowed' : 'pointer'
                }}
              >
                <span>{guardando ? 'Guardando…' : 'Guardar Registro de Auditoría'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. VISTA EDITOR DE PLANTILLAS */}
        {vista === 'EDITOR_PLANTILLAS' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Editor de Plantillas y Listas de Verificación</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Configuración integral para Proceso y Condiciones 5S</div>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
            </div>

            <div style={{ ...STYLES.glassCard, padding: '16px', marginBottom: '1rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setModuloEditor('PROCESO');
                    setTipoSeleccionadoEditor(FAMILIAS_PROCESO[0] || 'Flexografía');
                    cancelarEdicionPregunta();
                  }}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    background: moduloEditor === 'PROCESO' ? '#003580' : '#E8EEF8', color: moduloEditor === 'PROCESO' ? '#ffffff' : '#003580'
                  }}
                >
                  ⚙️ Checklists de Proceso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModuloEditor('5S');
                    setTipoSeleccionadoEditor(FAMILIAS_5S[0] || 'Flexografía');
                    cancelarEdicionPregunta();
                  }}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    background: moduloEditor === '5S' ? '#003580' : '#E8EEF8', color: moduloEditor === '5S' ? '#ffffff' : '#003580'
                  }}
                >
                  🧹 Listas de verificación 5S
                </button>
              </div>

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>
                <span>Selecciona la Familia o Categoría:</span>
              </label>
              <select
                value={tipoSeleccionadoEditor}
                onChange={(e) => { setTipoSeleccionadoEditor(e.target.value); cancelarEdicionPregunta(); }}
                style={{ ...STYLES.input, maxWidth: '320px', fontWeight: 600 }}
              >
                {(moduloEditor === 'PROCESO' ? FAMILIAS_PROCESO : FAMILIAS_5S).map((fam) => (
                  <option key={`fam-opt-${fam}`} value={fam}>{fam}</option>
                ))}
              </select>
            </div>

            <div style={{ ...STYLES.glassCard, textAlign: 'left', border: editandoId !== null ? '1.5px solid #003580' : '1px solid rgba(255, 255, 255, 0.98)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                <div style={{ width: '3px', height: '18px', background: editandoId !== null ? '#16a34a' : '#003580', borderRadius: '2px' }}></div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  <span>{editandoId !== null ? `✏️ Modificar Punto #${editandoId}` : `+ Dar de Alta Nueva Pregunta`}</span>
                </div>
              </div>

              <form onSubmit={handleGuardarOEditarPregunta}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '3px' }}>Sección / Categoría:</label>
                    <input
                      type="text"
                      placeholder={moduloEditor === '5S' ? 'Ej. 1. ORDEN Y 5S' : 'Ej. A · SOLVENTE Y APORTE'}
                      value={nuevaSeccion}
                      onChange={(e) => setNuevaSeccion(e.target.value)}
                      style={STYLES.input}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '3px' }}>Qué observar en piso:</label>
                    <input
                      type="text"
                      required
                      value={nuevoQueObservar}
                      onChange={(e) => setNuevoQueObservar(e.target.value)}
                      style={STYLES.input}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '3px' }}>Cómo se verifica:</label>
                    <input
                      type="text"
                      required
                      value={nuevoComoVerifica}
                      onChange={(e) => setNuevoComoVerifica(e.target.value)}
                      style={STYLES.input}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" style={{ background: editandoId !== null ? '#0F7A55' : '#003580', color: '#ffffff', border: 'none', padding: '9px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    <span>{editandoId !== null ? '✓ Guardar Cambios' : '+ Agregar Pregunta'}</span>
                  </button>
                  {editandoId !== null && (
                    <button type="button" onClick={cancelarEdicionPregunta} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#5A6A80', padding: '9px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Cancelar Edición
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div style={{ ...STYLES.glassCard, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    <span>Puntos de Revisión ({checklistEnEdicion.length})</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={guardandoPlantilla}
                  onClick={handleGuardarPlantillaEnFirebase}
                  style={{ background: '#0F7A55', color: '#ffffff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: guardandoPlantilla ? 'not-allowed' : 'pointer' }}
                >
                  <span>{guardandoPlantilla ? 'Guardando…' : `💾 Guardar Plantilla de ${moduloEditor}`}</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {checklistEnEdicion.map((item) => (
                  <div
                    key={`edicion-item-${item.id}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px',
                      borderRadius: '8px', border: editandoId === item.id ? '1.5px solid #003580' : '1px solid rgba(0,32,96,0.07)',
                      background: editandoId === item.id ? '#E8EEF8' : '#ffffff', gap: '10px', flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: '1 1 300px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', marginBottom: '2px' }}>{item.seccion}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0D1A2E' }}>#{item.id} {item.queObservar}</div>
                      <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}><strong>Verificación:</strong> {item.comoVerifica}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => iniciarEdicionPregunta(item)} style={{ background: '#E8EEF8', color: '#002060', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                        ✏️ Editar
                      </button>
                      <button type="button" onClick={() => handleEliminarPregunta(item.id)} style={{ background: '#F9E8EB', color: '#C8102E', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                        🗑 Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* 6. VISTA HISTORIAL & GANTT */}
        {vista === 'HISTORIAL' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Histórico y Cronograma Gantt</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>
                  {esAdminTotal ? `Consolidación global (${historialPermitido.length} registros)` : `Mis Auditorías Asignadas (${historialPermitido.length} registros)`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSubVistaHistorial('AUDITORIAS')}
                  style={{
                    background: subVistaHistorial === 'AUDITORIAS' ? '#003580' : 'transparent',
                    color: subVistaHistorial === 'AUDITORIAS' ? '#ffffff' : '#003580',
                    border: '1.5px solid #003580', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <span>Auditorías ({historialPermitido.length})</span>
                </button>
                <button
                  onClick={() => setSubVistaHistorial('GANTT')}
                  style={{
                    background: subVistaHistorial === 'GANTT' ? '#003580' : 'transparent',
                    color: subVistaHistorial === 'GANTT' ? '#ffffff' : '#003580',
                    border: '1.5px solid #003580', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <span>Tabla Gantt ({hallazgosFiltradosGantt.length})</span>
                </button>
                <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#5A6A80', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Cerrar
                </button>
              </div>
            </div>

            {/* TABLA GANTT CON FILTROS RESTAURADOS */}
            {subVistaHistorial === 'GANTT' && (
              <div>
                <div style={{ ...STYLES.glassCard, padding: '16px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#002060', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Filtros de Búsqueda para Cronograma
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleExportarExcelGantt}
                        style={{
                          background: '#0F7A55', color: '#ffffff', border: 'none',
                          padding: '7px 14px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        📊 Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportarPDFGantt}
                        style={{
                          background: '#003580', color: '#ffffff', border: 'none',
                          padding: '7px 14px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        📄 Exportar PDF
                      </button>
                    </div>
                  </div>

                  {/* Resumen del tablero (SPEC-011). Solo cuenta lo abierto:
                      el tablero dejó de dibujar lo ya cerrado. */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                    {[
                      { et: 'Abiertos', v: resumenDelTablero.abiertos, c: '#003580' },
                      { et: 'Vencidos', v: resumenDelTablero.vencidos, c: '#C8102E' },
                      { et: 'Seguridad', v: resumenDelTablero.seguridad, c: '#C8102E' },
                      { et: 'Reincidentes', v: resumenDelTablero.reincidentes, c: '#D4840A' }
                    ].map((k) => (
                      <div key={k.et} style={{
                        border: `1px solid ${k.v > 0 ? k.c : 'rgba(0,32,96,0.12)'}`, borderRadius: '8px',
                        padding: '7px 10px', background: '#fff', textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '9.5px', color: '#5A6A80', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.et}</div>
                        <div style={{ fontSize: '19px', fontWeight: 800, color: k.v > 0 ? k.c : '#8A9AB0' }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#5A6A80', lineHeight: 1.5, marginBottom: '10px', textAlign: 'left' }}>
                    El tablero muestra <b>solo lo que sigue abierto</b> (SPEC-011). Lo cerrado no se borró:
                    se consulta en su auditoría y, punto por punto, con el botón «Reincide» de cada renglón.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', alignItems: 'center' }}>
                    <select value={filtroOrigenGantt} onChange={(e) => setFiltroOrigenGantt(e.target.value)} style={STYLES.input}>
                      <option value="">Todos los módulos</option>
                      <option value="PROCESO">Validación de Proceso</option>
                      <option value="5S">Condiciones y 5S</option>
                    </select>

                    <select value={filtroMaquinaGantt} onChange={(e) => setFiltroMaquinaGantt(e.target.value)} style={STYLES.input}>
                      <option value="">Todas las máquinas y áreas</option>
                      {CATALOGO.map((m) => (
                        <option key={`gantt-maq-${m.id}`} value={m.nombre}>{m.nombre}</option>
                      ))}
                    </select>

                    <select value={filtroMesGantt} onChange={(e) => setFiltroMesGantt(e.target.value)} style={STYLES.input}>
                      <option value="">Todos los meses</option>
                      <option value="01">Enero</option>
                      <option value="02">Febrero</option>
                      <option value="03">Marzo</option>
                      <option value="04">Abril</option>
                      <option value="05">Mayo</option>
                      <option value="06">Junio</option>
                      <option value="07">Julio</option>
                      <option value="08">Agosto</option>
                      <option value="09">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>

                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Día (1–31)"
                      value={filtroDiaGantt}
                      onChange={(e) => setFiltroDiaGantt(e.target.value)}
                      style={STYLES.input}
                    />

                    <select value={filtroCumplimientoGantt} onChange={(e) => setFiltroCumplimientoGantt(e.target.value)} style={STYLES.input}>
                      {/* Ya no se ofrece TERMINADO: el tablero solo muestra lo
                          abierto (SPEC-011), así que ese filtro no devolvería
                          nunca nada y se vería como una falla. */}
                      <option value="">Abiertos y vencidos</option>
                      <option value="PENDIENTE">Solo en plazo</option>
                      <option value="PENDIENTE_ATRASADO">Solo vencidos</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setFiltroOrigenGantt('');
                        setFiltroMaquinaGantt('');
                        setFiltroMesGantt('');
                        setFiltroDiaGantt('');
                        setFiltroCumplimientoGantt('');
                      }}
                      style={{
                        background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#5A6A80',
                        padding: '10px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Limpiar Filtros
                    </button>
                  </div>
                </div>

                <div style={{ ...STYLES.glassCard, padding: '16px', overflowX: 'auto' }}>
                  {hallazgosFiltradosGantt.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#5A6A80', fontSize: '13px' }}>
                      No se encontraron hallazgos registrados.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr style={{ background: '#002060', color: '#ffffff', textAlign: 'center' }}>
                          <th style={{ padding: '8px 6px', border: '1px solid #1A4D9A', width: '28px' }} rowSpan={2}>#</th>
                          <th style={{ padding: '8px 8px', border: '1px solid #1A4D9A', width: '85px' }} rowSpan={2}>Fecha</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #1A4D9A', textAlign: 'left', minWidth: '130px' }} rowSpan={2}>Máquina / Área</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #1A4D9A', textAlign: 'left', minWidth: '220px' }} rowSpan={2}>Desviación</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #1A4D9A', textAlign: 'left', minWidth: '110px' }} rowSpan={2}>Responsable</th>
                          <th style={{ padding: '8px 6px', border: '1px solid #1A4D9A', width: '70px' }} rowSpan={2}>Inicio</th>
                          <th style={{ padding: '8px 6px', border: '1px solid #1A4D9A', width: '70px' }} rowSpan={2}>Fin</th>
                          <th style={{ padding: '8px 6px', border: '1px solid #1A4D9A', width: '40px' }} rowSpan={2}>Días</th>
                          <th style={{ padding: '8px 10px', border: '1px solid #1A4D9A', minWidth: '130px' }} rowSpan={2}>Cumplimiento</th>
                          <th colSpan={7} style={{ border: '1px solid #1A4D9A', padding: '4px', background: '#003580', fontSize: '11px', fontWeight: 700 }}>
                            Semana 1 ({diasGantt[0].mesNum}/{diasGantt[0].diaNum})
                          </th>
                          <th colSpan={7} style={{ border: '1px solid #1A4D9A', padding: '4px', background: '#1A4D9A', fontSize: '11px', fontWeight: 700 }}>
                            Semana 2 ({diasGantt[7].mesNum}/{diasGantt[7].diaNum})
                          </th>
                        </tr>
                        <tr style={{ background: '#003580', color: '#ffffff', textAlign: 'center' }}>
                          {diasGantt.map((d, i) => (
                            <th key={`d-col-${i}`} style={{ padding: '4px 3px', border: '1px solid #1A4D9A', width: '22px', fontSize: '10px' }}>{d.letra}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hallazgosFiltradosGantt.map((item: any, idx: number) => {
                          const estatus: EstadoCumplimiento = item.estadoSeguimiento || 'PENDIENTE';
                          const dIni = new Date(item.fechaInicio);
                          const dFin = new Date(item.fechaFin);
                          const diffTime = Math.abs(dFin.getTime() - dIni.getTime());
                          const diasTotal = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

                          return (
                            <tr key={`gantt-row-${item.docId}_${idx}`} style={{
                              borderBottom: '1px solid #E8EEF8',
                              // El recién cerrado se atenúa: sigue a la vista
                              // para confirmarlo, pero deja de pesar (SPEC-014).
                              opacity: estatus === 'TERMINADO' ? .55 : 1,
                              background: estatus === 'TERMINADO' ? '#F4FAF7' : idx % 2 === 0 ? '#ffffff' : '#f8f9ff'
                            }}>
                              <td style={{ padding: '6px 4px', border: '1px solid #E8EEF8', textAlign: 'center', fontWeight: 700, color: '#003580' }}>{idx + 1}</td>
                              <td style={{ padding: '6px 6px', border: '1px solid #E8EEF8', textAlign: 'center' }}>{item.fechaAuditoria}</td>
                              <td style={{ padding: '6px 10px', border: '1px solid #E8EEF8', textAlign: 'left' }}>
                                <span style={{ fontWeight: 700, color: '#003580', background: '#E8EEF8', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                                  {item.maquinaNombre}
                                </span>
                              </td>
                              <td style={{ padding: '6px 10px', border: '1px solid #E8EEF8', textAlign: 'left' }}>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                  {/* Seguridad va antes que nada (SPEC-010). */}
                                  {item.seguridad && (
                                    <span style={{ background: '#C8102E', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '3px', letterSpacing: '.03em' }}>
                                      SEGURIDAD
                                    </span>
                                  )}
                                  {/* La etiqueta sola no sirve: abre la historia (SPEC-009). */}
                                  {item.reincidenciaDe && (
                                    <button
                                      onClick={() => setPuntoHistorial({ maquinaId: item.maquinaId, puntoId: item.puntoId, texto: item.textoPunto, maquinaNombre: item.maquinaNombre })}
                                      title="Ver todas las veces que este punto ha fallado en esta máquina"
                                      style={{ background: '#FDF0D8', color: '#7A4500', border: '1px solid #D4840A', fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                      REINCIDE ×{item.vecesPrevias + 1}
                                    </button>
                                  )}
                                </div>
                                <div style={{ fontWeight: 600, color: '#0D1A2E' }}>{item.hallazgo}</div>
                                <div style={{ fontSize: '10px', color: '#8A9AB0' }}>{item.accion || 'Sin acción'}</div>
                                {item.reincidenciaDe && (
                                  <div style={{ fontSize: '9.5px', color: '#7A4500', marginTop: '3px', lineHeight: 1.4 }}>
                                    Ya falló el {item.reincidenciaDe.fechaAuditoria}. Se hizo «{item.reincidenciaDe.accion}»
                                    {item.reincidenciaDe.responsable !== 'No asignado' && <>, {item.reincidenciaDe.responsable}</>}
                                    {item.reincidenciaDe.diasHastaVolver !== null && <>, y volvió {item.reincidenciaDe.diasHastaVolver} días después del cierre</>}.
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '6px 10px', border: '1px solid #E8EEF8', textAlign: 'left', color: '#5A6A80' }}>{item.responsable || 'No asignado'}</td>
                              <td style={{ padding: '6px 4px', border: '1px solid #E8EEF8', textAlign: 'center' }}>{item.fechaInicio}</td>
                              <td style={{ padding: '6px 4px', border: '1px solid #E8EEF8', textAlign: 'center' }}>{item.fechaFin}</td>
                              <td style={{ padding: '6px 4px', border: '1px solid #E8EEF8', textAlign: 'center', fontWeight: 700 }}>{diasTotal}</td>
                              <td style={{ padding: '6px 8px', border: '1px solid #E8EEF8', textAlign: 'center' }}>
                                {/* Al cerrar, el renglón ya no desaparece: se
                                    queda marcado como cerrado para confirmar el
                                    cambio y poder deshacerlo (SPEC-014). */}
                                <button
                                  onClick={() => handleToggleEstadoHallazgo(item.docId, item.hallazgoIdx, item.estadoSeguimiento)}
                                  title={estatus === 'TERMINADO'
                                    ? 'Cerrado. Toca otra vez para reabrirlo; al salir del tablero deja de mostrarse.'
                                    : 'Marcar como terminado'}
                                  style={{
                                    padding: '4px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', width: '100%',
                                    fontFamily: 'inherit',
                                    border: estatus === 'TERMINADO' ? '1px solid #0F7A55' : 'none',
                                    background: estatus === 'TERMINADO' ? '#E0F2EC' : estatus === 'PENDIENTE_ATRASADO' ? '#F9E8EB' : '#FDF0D8',
                                    color: estatus === 'TERMINADO' ? '#085041' : estatus === 'PENDIENTE_ATRASADO' ? '#7A0B1D' : '#7A4500'
                                  }}
                                >
                                  {estatus === 'TERMINADO'
                                    ? '✓ CERRADO'
                                    : estatus === 'PENDIENTE_ATRASADO' ? 'PEND. ATRASADO' : estatus}
                                </button>
                                {estatus === 'TERMINADO' && (
                                  <div style={{ fontSize: '8.5px', color: '#085041', marginTop: '3px', lineHeight: 1.3 }}>
                                    Toca para deshacer
                                  </div>
                                )}
                              </td>
                              {diasGantt.map((diaCol, dIdx) => {
                                const enRango = diaCol.iso >= item.fechaInicio && diaCol.iso <= item.fechaFin;
                                let bg = 'transparent';
                                if (enRango) {
                                  bg = estatus === 'TERMINADO' ? '#0F7A55' : estatus === 'PENDIENTE_ATRASADO' ? '#C8102E' : '#D4840A';
                                }
                                return (
                                  <td key={`celda-${idx}-${dIdx}`} style={{ border: '1px solid rgba(0,32,96,0.06)', background: bg, padding: 0, height: '24px' }}></td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* SUBVISTA AUDITORÍAS CON FILTROS Y CLICK RESTAURADO */}
            {subVistaHistorial === 'AUDITORIAS' && (
              <div>
                <div style={{ ...STYLES.glassCard, padding: '16px', marginBottom: '1rem', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Filtros de Búsqueda de Auditorías
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={filtroAudTipoRevision}
                      onChange={(e) => {
                        setFiltroAudTipoRevision(e.target.value);
                        setFiltroAudFamilia('');
                        setFiltroAudMaquinaId('');
                      }}
                      style={STYLES.input}
                    >
                      <option value="">Tipo de revisión: Todos</option>
                      <option value="PROCESO">Validación de Proceso</option>
                      <option value="5S">Condiciones y 5S</option>
                    </select>

                    <select
                      value={filtroAudFamilia}
                      onChange={(e) => {
                        setFiltroAudFamilia(e.target.value);
                        setFiltroAudMaquinaId('');
                      }}
                      style={STYLES.input}
                    >
                      <option value="">Selecciona Proceso/Familia</option>
                      {(filtroAudTipoRevision === 'PROCESO' ? FAMILIAS_PROCESO : filtroAudTipoRevision === '5S' ? FAMILIAS_5S : FAMILIAS_TODAS).map((fam) => (
                        <option key={`aud-fam-${fam}`} value={fam}>{fam}</option>
                      ))}
                    </select>

                    <select
                      value={filtroAudMaquinaId}
                      onChange={(e) => setFiltroAudMaquinaId(e.target.value)}
                      style={STYLES.input}
                    >
                      <option value="">Selecciona la Máquina/Área</option>
                      {CATALOGO.filter((m) => {
                        if (filtroAudTipoRevision === 'PROCESO' && !m.moduloProceso) return false;
                        if (filtroAudTipoRevision === '5S' && !m.modulo5S) return false;
                        if (filtroAudFamilia && m.tipo !== filtroAudFamilia) return false;
                        return true;
                      }).map((m) => (
                        <option key={`aud-maq-${m.id}`} value={m.id}>{m.nombre}</option>
                      ))}
                    </select>

                    <select
                      value={filtroAudMes}
                      onChange={(e) => setFiltroAudMes(e.target.value)}
                      style={STYLES.input}
                    >
                      <option value="">Todos los meses</option>
                      <option value="01">Enero</option>
                      <option value="02">Febrero</option>
                      <option value="03">Marzo</option>
                      <option value="04">Abril</option>
                      <option value="05">Mayo</option>
                      <option value="06">Junio</option>
                      <option value="07">Julio</option>
                      <option value="08">Agosto</option>
                      <option value="09">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setFiltroAudTipoRevision('');
                        setFiltroAudFamilia('');
                        setFiltroAudMaquinaId('');
                        setFiltroAudMes('');
                      }}
                      style={{
                        background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#5A6A80',
                        padding: '10px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Limpiar Filtros
                    </button>
                  </div>
                </div>

                {/* LISTA CON APERTURA DE MODAL HABILITADA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditoriasFiltradas.length === 0 ? (
                    <div style={{ ...STYLES.glassCard, textAlign: 'center', padding: '2.5rem', color: '#5A6A80', fontSize: '13px' }}>
                      {esAdminTotal ? 'Sin auditorías encontradas con los filtros seleccionados.' : 'No tienes auditorías registradas como supervisor auditado.'}
                    </div>
                  ) : (
                    auditoriasFiltradas.map((item) => (
                      <div
                        key={`aud-card-${item.id}`}
                        onClick={() => {
                          setAuditoriaDetalleModal(item);
                          setMostrarFormNuevoHallazgoModal(false);
                        }}
                        style={{
                          ...STYLES.glassCard,
                          marginBottom: 0,
                          padding: '14px 18px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title="Haz clic para ver el checklist y hallazgos detallados de esta auditoría"
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#0D1A2E' }}>{item.maquinaNombre}</span>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                              background: item.estadoFinal === 'APROBADO' ? '#E0F2EC' : '#F9E8EB',
                              color: item.estadoFinal === 'APROBADO' ? '#085041' : '#7A0B1D'
                            }}>
                              {item.estadoFinal === 'APROBADO' ? '✓ APROBADO' : '⚠️ CON HALLAZGOS'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#003580', background: '#E8EEF8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              {item.tipoAuditoria || 'PROCESO'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#5A6A80' }}>
                            <span>Fecha: <strong>{item.fechaAuditoria || todayStr}</strong> · {item.tipoAuditoria === '5S' ? '' : `OP: ${item.ordenTrabajo || 'S/N'} · `}Auditor: <strong>{item.auditor}</strong> · {item.turno}</span>
                          </div>
                          {(item.nominaAuditado || item.nominaSupervisor || item.nombreSupervisor) && (
                            <div style={{ fontSize: '11px', color: '#8A9AB0', marginTop: '2px' }}>
                              <span>Auditado: <strong>{item.nominaAuditado || 'N/A'}</strong> · Supervisor: <strong>{item.nombreSupervisor || item.nominaSupervisor || 'N/A'}</strong></span>
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: item.cumplimiento === 100 ? '#0F7A55' : '#C8102E' }}>
                              <span>{item.cumplimiento}%</span>
                            </div>
                            <div style={{ fontSize: '10px', color: '#8A9AB0' }}>
                              <span>{item.totalSi} SÍ / {item.totalNo} NO</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '13px', color: '#003580', fontWeight: 700 }}>🔍 Ver Check</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* BOTÓN FLOTANTE CIRCULAR EN LA ESQUINA INFERIOR IZQUIERDA (MAPA 3D) */}
      <button
        onClick={() => setModalLayout3DAbierto(true)}
        title="Abrir Layout Interactivo 3D de Planta"
        style={{
          position: 'fixed',
          bottom: '22px',
          left: '22px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #002060 0%, #003580 100%)',
          color: '#ffffff',
          border: '2px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 8px 24px rgba(0, 32, 96, 0.35), 0 2px 6px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 900,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
          <line x1="8" y1="2" x2="8" y2="18"></line>
          <line x1="16" y1="6" x2="16" y2="22"></line>
        </svg>
      </button>

      {/* MODAL DETALLE DE CHECKLIST REALIZADO */}
      {auditoriaDetalleModal && (() => {
        const plantillaActual = obtenerPlantillaAuditoriaModal(auditoriaDetalleModal);

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 32, 96, 0.45)', backdropFilter: 'blur(6px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}>
            <div style={{
              background: '#ffffff', borderRadius: '16px', maxWidth: '850px', width: '100%',
              maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              textAlign: 'left', border: '1px solid rgba(0,32,96,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E8EEF8', paddingBottom: '12px', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#002060' }}>{auditoriaDetalleModal.maquinaNombre}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#E8EEF8', color: '#003580' }}>
                      {auditoriaDetalleModal.tipoAuditoria}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                      background: auditoriaDetalleModal.estadoFinal === 'APROBADO' ? '#E0F2EC' : '#F9E8EB',
                      color: auditoriaDetalleModal.estadoFinal === 'APROBADO' ? '#085041' : '#7A0B1D'
                    }}>
                      {auditoriaDetalleModal.estadoFinal === 'APROBADO' ? '✓ APROBADO' : '⚠️ CON HALLAZGOS'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#5A6A80', marginTop: '4px' }}>
                    <span>Fecha: <strong>{auditoriaDetalleModal.fechaAuditoria}</strong> · {auditoriaDetalleModal.tipoAuditoria === 'PROCESO' ? `OP: ${auditoriaDetalleModal.ordenTrabajo || 'S/N'} · ` : ''}Auditor: <strong>{auditoriaDetalleModal.auditor}</strong> · {auditoriaDetalleModal.turno}</span>
                  </div>
                  {(auditoriaDetalleModal.nominaAuditado || auditoriaDetalleModal.nominaSupervisor || auditoriaDetalleModal.nombreSupervisor) && (
                    <div style={{ fontSize: '11px', color: '#8A9AB0', marginTop: '2px' }}>
                      <span>Auditado: <strong>{auditoriaDetalleModal.nominaAuditado || 'N/A'}</strong> · Supervisor: <strong>{auditoriaDetalleModal.nombreSupervisor || auditoriaDetalleModal.nominaSupervisor || 'N/A'}</strong></span>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: auditoriaDetalleModal.cumplimiento === 100 ? '#0F7A55' : '#C8102E' }}>
                    <span>{auditoriaDetalleModal.cumplimiento}%</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#5A6A80' }}>
                    <span>{auditoriaDetalleModal.totalSi} SÍ / {auditoriaDetalleModal.totalNo} NO</span>
                  </div>
                </div>
              </div>

              {/* Botón para abrir formulario de nueva desviación */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#002060', textTransform: 'uppercase' }}>
                  Respuestas del Checklist Registrado:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormNuevoHallazgoModal(!mostrarFormNuevoHallazgoModal);
                    setFechaCierreNuevoHallazgoModal(todayStr);
                  }}
                  style={{
                    background: '#C8102E', color: '#ffffff', border: 'none',
                    padding: '6px 14px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 6px rgba(200,16,46,0.25)'
                  }}
                >
                  {mostrarFormNuevoHallazgoModal ? '✕ Cancelar Desviación' : '+ Agregar Nueva Desviación'}
                </button>
              </div>

              {/* Formulario Dinámico de Nueva Desviación */}
              {mostrarFormNuevoHallazgoModal && (
                <div style={{ background: '#FFF4F6', border: '1.5px solid #FCA5A5', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Registrar Desviación y Acción Correctiva
                  </div>

                  <form onSubmit={handleGuardarDesviacionModal}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTipoNuevoHallazgoModal('PREESTABLECIDO');
                          setPuntoSeleccionadoModal('');
                          setDescNuevoHallazgoModal('');
                        }}
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none',
                          fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                          background: tipoNuevoHallazgoModal === 'PREESTABLECIDO' ? '#991B1B' : '#ffffff',
                          color: tipoNuevoHallazgoModal === 'PREESTABLECIDO' ? '#ffffff' : '#991B1B',
                          outline: '1px solid #FCA5A5'
                        }}
                      >
                        📋 Punto del Checklist Preestablecido
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipoNuevoHallazgoModal('EXTRA');
                          setPuntoSeleccionadoModal('');
                          setDescNuevoHallazgoModal('');
                        }}
                        style={{
                          flex: 1, padding: '6px 10px', borderRadius: '6px', border: 'none',
                          fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                          background: tipoNuevoHallazgoModal === 'EXTRA' ? '#991B1B' : '#ffffff',
                          color: tipoNuevoHallazgoModal === 'EXTRA' ? '#ffffff' : '#991B1B',
                          outline: '1px solid #FCA5A5'
                        }}
                      >
                        ⚠️ Hallazgo Extra
                      </button>
                    </div>

                    {tipoNuevoHallazgoModal === 'PREESTABLECIDO' && (
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#002060', marginBottom: '3px' }}>
                          Selecciona el Punto del Checklist a Marcar como "NO":
                        </label>
                        <select
                          value={puntoSeleccionadoModal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPuntoSeleccionadoModal(val);
                            const itemP = plantillaActual.find((i) => String(i.id) === String(val));
                            if (itemP) {
                              setDescNuevoHallazgoModal(`Desviación en: ${itemP.queObservar}`);
                            }
                          }}
                          style={{ ...STYLES.input, background: '#ffffff', fontSize: '12px' }}
                          required
                        >
                          <option value="">-- Selecciona el punto del checklist --</option>
                          {plantillaActual.map((item) => (
                            <option key={`opt-modal-p-${item.id}`} value={item.id}>
                              #{item.id} - {item.queObservar}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Solo los hallazgos fuera del checklist necesitan esta
                        casilla (SPEC-010): los que nacen de un punto se
                        clasifican solos por la sección a la que pertenece. */}
                    {tipoNuevoHallazgoModal === 'EXTRA' && (
                      <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px',
                        padding: '9px 11px', borderRadius: '8px', cursor: 'pointer',
                        border: `1px solid ${seguridadNuevoHallazgoModal ? '#C8102E' : 'rgba(0,32,96,0.12)'}`,
                        background: seguridadNuevoHallazgoModal ? '#F9E8EB' : 'transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={seguridadNuevoHallazgoModal}
                          onChange={(e) => setSeguridadNuevoHallazgoModal(e.target.checked)}
                          style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#C8102E', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '11.5px', lineHeight: 1.45, textAlign: 'left' }}>
                          <b style={{ color: seguridadNuevoHallazgoModal ? '#C8102E' : '#002060' }}>
                            Es un hallazgo de seguridad
                          </b>
                          <span style={{ display: 'block', color: '#5A6A80', fontSize: '10.5px' }}>
                            Riesgo de atrapamiento, corte, golpe, incendio o derrame; paro de emergencia,
                            rutas o equipos de emergencia obstruidos. Se atiende antes que lo demás.
                          </span>
                        </span>
                      </label>
                    )}

                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#002060', marginBottom: '3px' }}>
                        Descripción del Hallazgo / Desviación:
                      </label>
                      <input
                        type="text"
                        placeholder="Describe detalladamente el hallazgo..."
                        value={descNuevoHallazgoModal}
                        onChange={(e) => setDescNuevoHallazgoModal(e.target.value)}
                        style={{ ...STYLES.input, background: '#ffffff', fontSize: '12px' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Acción Correctiva:</label>
                        <input
                          type="text"
                          placeholder="Acción a realizar..."
                          value={accionNuevoHallazgoModal}
                          onChange={(e) => setAccionNuevoHallazgoModal(e.target.value)}
                          style={{ ...STYLES.input, background: '#ffffff', fontSize: '12px' }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Responsable:</label>
                        <input
                          type="text"
                          placeholder="Nombre responsable"
                          value={respNuevoHallazgoModal}
                          onChange={(e) => setRespNuevoHallazgoModal(e.target.value)}
                          style={{ ...STYLES.input, background: '#ffffff', fontSize: '12px' }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Fecha Compromiso:</label>
                        <input
                          type="date"
                          value={fechaCierreNuevoHallazgoModal}
                          onChange={(e) => setFechaCierreNuevoHallazgoModal(e.target.value)}
                          style={{ ...STYLES.input, background: '#ffffff', fontSize: '12px' }}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={guardandoHallazgoModal}
                      style={{
                        background: '#0F7A55', color: '#ffffff', border: 'none',
                        padding: '8px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                        cursor: guardandoHallazgoModal ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 6px rgba(15,122,85,0.3)'
                      }}
                    >
                      {guardandoHallazgoModal ? 'Guardando Desviación…' : '💾 Guardar Desviación en la Auditoría'}
                    </button>
                  </form>
                </div>
              )}

              {/* Checklist Realizado */}
              <div style={{ marginBottom: '16px' }}>
                {auditoriaDetalleModal.respuestas && Object.keys(auditoriaDetalleModal.respuestas).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(auditoriaDetalleModal.respuestas).map(([puntoId, valor]) => {
                      const snapItem = plantillaActual.find((i: any) => String(i.id) === String(puntoId));
                      const esPuntoReincidente = auditoriaDetalleModal.puntosSoloReincidentes && auditoriaDetalleModal.puntosSoloReincidentes.includes(parseInt(puntoId, 10));

                      return (
                        <div
                          key={`modal-punto-${puntoId}`}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 12px', borderRadius: '8px',
                            background: valor === 'SI' ? '#F4FBF7' : '#FEF2F2',
                            border: valor === 'SI' ? '1px solid #D1FAE5' : '1px solid #FEE2E2'
                          }}
                        >
                          <div style={{ fontSize: '12px', color: '#0D1A2E' }}>
                            <span style={{ fontWeight: 700, color: '#003580', marginRight: '6px' }}>#{puntoId}</span>
                            <span>{snapItem ? snapItem.queObservar : `Punto de Inspección #${puntoId}`}</span>
                            {esPuntoReincidente && (
                              <span style={{ marginLeft: '8px', fontSize: '10px', background: '#FDE8EB', color: '#C8102E', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                ⚠️ REINCIDENTE
                              </span>
                            )}
                          </div>
                          <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
                            background: valor === 'SI' ? '#0F7A55' : '#C8102E', color: '#ffffff'
                          }}>
                            {valor === 'SI' ? '✓ SÍ' : '✕ NO'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#5A6A80', fontStyle: 'italic' }}>
                    <span>Esta auditoría se capturó sin respuestas individuales de checklist o mediante hallazgos directos.</span>
                  </div>
                )}
              </div>

              {/* Hallazgos y Acciones Registradas */}
              {auditoriaDetalleModal.hallazgos && auditoriaDetalleModal.hallazgos.length > 0 && (
                <div style={{ marginTop: '14px', borderTop: '1px solid #E8EEF8', paddingTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A0B1D', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <span>Desviaciones y Acciones Correctivas Registradas:</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {auditoriaDetalleModal.hallazgos.map((h: any, i: number) => (
                      <div key={`modal-hallazgo-${i}`} style={{ background: '#FFF8F8', border: '1px solid #FCA5A5', padding: '10px 12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B', marginBottom: '4px' }}>
                          <span>{h.hallazgo || 'Desviación no especificada'}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px', fontSize: '11px', color: '#4B5563' }}>
                          <div><strong>Acción:</strong> <span>{h.accion || 'Sin registrar'}</span></div>
                          <div><strong>Responsable:</strong> <span>{h.responsable || 'No asignado'}</span></div>
                          <div><strong>Fecha Compromiso:</strong> <span>{h.fechaCierre || 'N/A'}</span></div>
                          <div><strong>Estatus:</strong> <span>{h.estadoSeguimiento || 'PENDIENTE'}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.2rem', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setAuditoriaDetalleModal(null)}
                  style={{ padding: '8px 20px', background: '#003580', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cerrar Detalle
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DEL LAYOUT ISOMÉTRICO 3D CON PASILLOS AMPLIOS */}
      {modalLayout3DAbierto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 32, 96, 0.65)', backdropFilter: 'blur(8px)',
          zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '18px', maxWidth: '1140px', width: '100%',
            maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(0,32,96,0.15)', overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 1.4rem', borderBottom: '1px solid #E8EEF8', background: '#F8FAFD'
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#002060', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🗺️ Layout de Planta 3D — Acondicionado y Servicios</span>
                </div>
                <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
                  Proyección isométrica con pasillos despejados. Colores pastel translúcidos (40%). Toca cualquier equipo para auditar o ver hallazgos.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#065F46', fontWeight: 700 }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(167, 243, 208, 0.6)', border: '1.5px solid #059669' }}></span>
                  100% OK
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#92400E', fontWeight: 700 }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(254, 240, 138, 0.6)', border: '1.5px solid #D97706' }}></span>
                  Pendiente
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#991B1B', fontWeight: 700 }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(254, 202, 202, 0.6)', border: '1.5px solid #DC2626' }}></span>
                  Atrasado
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#475569', fontWeight: 700 }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(226, 232, 240, 0.6)', border: '1.5px solid #64748B' }}></span>
                  Sin datos
                </div>

                <button
                  onClick={() => { setModalLayout3DAbierto(false); setDetalleElementoLayout(null); }}
                  style={{
                    background: '#E8EEF8', border: 'none', color: '#003580', width: '30px', height: '30px',
                    borderRadius: '50%', cursor: 'pointer', fontWeight: 800, fontSize: '13px', marginLeft: '6px'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* LIENZO SVG ISOMÉTRICO 3D REAL (CON CÁLCULOS TRIGONOMÉTRICOS DE 30 GRADOS) */}
            <div style={{
              flex: 1, overflow: 'auto', background: 'radial-gradient(circle at center, #F8FAFC 0%, #E2E8F0 100%)',
              padding: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}>
              <svg
                viewBox="0 0 1120 860"
                style={{ width: '100%', minWidth: '860px', height: 'auto', filter: 'drop-shadow(0 15px 30px rgba(0,32,96,0.12))' }}
              >
                <defs>
                  <pattern id="grid-piso-3d" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,32,96,0.035)" strokeWidth="1" />
                  </pattern>
                </defs>

                {/* Suelo Nave */}
                <polygon points="120,30  1040,30  1040,820  120,820" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
                <rect x="120" y="30" width="920" height="790" fill="url(#grid-piso-3d)" />

                {/* Pasillo Principal Central Rotulado Despejado */}
                <rect x="130" y="275" width="900" height="55" fill="rgba(0, 32, 96, 0.025)" rx="4" />
                <text x="580" y="308" fill="#94A3B8" fontSize="11" fontWeight="800" letterSpacing="5" textAnchor="middle">
                  PASILLO PRINCIPAL CENTRAL
                </text>

                <text x="980" y="370" fill="#94A3B8" fontSize="12" fontWeight="800" transform="rotate(90 980,370)" letterSpacing="4">
                  SALIDA DE EMERGENCIA 🚪
                </text>

                {/* Renderizado de Bloques Isométricos 3D */}
                {ELEMENTOS_LAYOUT_3D.map((elem) => {
                  const estadoColor = obtenerEstadoEquipoLayout(elem.maquinaCatalogoId);
                  const SCALE_X = 1.48;
                  const SCALE_Y = 1.0;
                  const x = 145 + (elem.gridX * SCALE_X);
                  const y = 40 + (elem.gridY * SCALE_Y);
                  const w = elem.width * SCALE_X;
                  const d = elem.depth * SCALE_Y;
                  const h = elem.height;

                  // Coordenadas axonométricas 3D
                  const pTop = `${x},${y - h} ${x + w},${y - h} ${x + w},${y + d - h} ${x},${y + d - h}`;
                  const pFront = `${x},${y + d - h} ${x + w},${y + d - h} ${x + w},${y + d} ${x},${y + d}`;
                  const pSide = `${x + w},${y - h} ${x + w + (h * 0.4)},${y - (h * 0.6)} ${x + w + (h * 0.4)},${y + d - (h * 0.6)} ${x + w},${y + d - h}`;

                  return (
                    <g
                      key={`layout-3d-${elem.id}`}
                      onClick={() => handleAbrirDetalleElementoLayout(elem)}
                      style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
                    >
                      {/* Sombra de suelo suave */}
                      <rect x={x + 3} y={y + 3} width={w} height={d} fill="rgba(0, 32, 96, 0.06)" rx="4" />

                      {/* Cara Frontal */}
                      <polygon points={pFront} fill={estadoColor.fillFront} stroke={estadoColor.stroke} strokeWidth="1.2" />

                      {/* Cara Lateral Derecha */}
                      <polygon points={pSide} fill={estadoColor.fillSide} stroke={estadoColor.stroke} strokeWidth="1.2" />

                      {/* Cara Superior (Techo) */}
                      <polygon points={pTop} fill={estadoColor.fillTop} stroke={estadoColor.stroke} strokeWidth="1.5" />

                      {/* Etiqueta Nombre */}
                      <text
                        x={x + (w / 2)}
                        y={y + (d / 2) - h - 3}
                        fill="#002060"
                        fontSize="11"
                        fontWeight="800"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {elem.label}
                      </text>

                      {/* Badge Estado */}
                      <text
                        x={x + (w / 2)}
                        y={y + (d / 2) - h + 11}
                        fill={estadoColor.badgeColor}
                        fontSize="9"
                        fontWeight="800"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {estadoColor.texto}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div style={{ padding: '0.75rem 1.4rem', background: '#FFFFFF', borderTop: '1px solid #E8EEF8', fontSize: '11px', color: '#5A6A80', textAlign: 'center' }}>
              Plano de Nave Acondicionado[cite: 1] · Calidad en ubicación REF4, REV5/REV7/REF4 retiradas[cite: 1].
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE MÁQUINA DESDE EL LAYOUT (OPCIÓN C) */}
      {detalleElementoLayout && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 32, 96, 0.45)', backdropFilter: 'blur(4px)',
          zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', maxWidth: '520px', width: '100%',
            padding: '1.6rem', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', textAlign: 'left',
            border: '1.5px solid rgba(0,32,96,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #E8EEF8', paddingBottom: '10px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#002060' }}>
                  {detalleElementoLayout.elem.label}
                </div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>
                  {detalleElementoLayout.maquina ? `Categoría: ${detalleElementoLayout.maquina.tipo}` : 'Área de Soporte'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: detalleElementoLayout.cumplimientoPromedio === 100 ? '#0F7A55' : '#DC2626' }}>
                  {detalleElementoLayout.cumplimientoPromedio}%
                </div>
                <div style={{ fontSize: '10px', color: '#5A6A80' }}>Cumplimiento prom.</div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#002060', marginBottom: '6px', textTransform: 'uppercase' }}>
                Desviaciones Pendientes ({detalleElementoLayout.hallazgosPendientes.length})
              </div>

              {detalleElementoLayout.hallazgosPendientes.length === 0 ? (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '8px', fontSize: '11.5px', color: '#166534' }}>
                  ✓ Sin hallazgos pendientes. 100% de cumplimiento.
                </div>
              ) : (
                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {detalleElementoLayout.hallazgosPendientes.map((h, i) => (
                    <div key={i} style={{ background: '#FFF5F5', border: '1px solid #FECACA', padding: '8px 10px', borderRadius: '6px', fontSize: '11px' }}>
                      <div style={{ fontWeight: 700, color: '#991B1B' }}>{h.hallazgo}</div>
                      <div style={{ color: '#4B5563', marginTop: '2px' }}>
                        <strong>Compromiso:</strong> {h.fechaCierre} · <strong>Resp:</strong> {h.responsable || 'No asignado'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detalleElementoLayout.maquina && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                {detalleElementoLayout.maquina.moduloProceso && (
                  <button
                    onClick={() => handleIniciarAuditoriaDesdeLayout('PROCESO')}
                    style={{
                      padding: '10px', background: '#003580', color: '#ffffff', border: 'none',
                      borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', textAlign: 'center'
                    }}
                  >
                    📝 Auditar Proceso
                  </button>
                )}
                {detalleElementoLayout.maquina.modulo5S && (
                  <button
                    onClick={() => handleIniciarAuditoriaDesdeLayout('5S')}
                    style={{
                      padding: '10px', background: '#0F7A55', color: '#ffffff', border: 'none',
                      borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', textAlign: 'center'
                    }}
                  >
                    🧹 Auditar 5S
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setDetalleElementoLayout(null)}
              style={{
                width: '100%', padding: '9px', background: 'transparent',
                border: '1px solid rgba(0,32,96,0.15)', color: '#5A6A80', borderRadius: '8px',
                fontSize: '11.5px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      {/* ── Historial de un punto (SPEC-009 y SPEC-011) ────────────────────
          Aquí vive lo cerrado. No se archiva ni se borra: se consulta por esta
          ventana, que es además de donde la reincidencia saca la acción que ya
          se intentó. Si algún día lo cerrado se moviera a otro lado, la
          detección de reincidencia dejaría de funcionar el mismo día. */}
      {puntoHistorial && puntoHistorial.puntoId !== undefined && (() => {
        const linea: HallazgoPlano[] = historialDePunto(
          hallazgosPlanos, puntoHistorial.maquinaId, puntoHistorial.puntoId
        );
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,60,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', zIndex: 950, overflowY: 'auto' }}
            onClick={() => setPuntoHistorial(null)}
          >
            <div style={{ ...STYLES.glassCard, width: '100%', maxWidth: '620px', marginTop: '20px', textAlign: 'left' }}
              onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#002060' }}>Historial de este punto</div>
                <button onClick={() => setPuntoHistorial(null)}
                  style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#5A6A80', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ fontSize: '11.5px', color: '#5A6A80', marginBottom: '14px', lineHeight: 1.45 }}>
                <b style={{ color: '#003580' }}>{puntoHistorial.maquinaNombre}</b> · {puntoHistorial.texto || `Punto #${puntoHistorial.puntoId}`}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {linea.map((p, i) => {
                  const cerrado = p.estadoSeguimiento === 'TERMINADO';
                  return (
                    <div key={`${p.docId}-${p.hallazgoIdx}`} style={{
                      border: `1px solid ${cerrado ? 'rgba(0,32,96,0.12)' : '#C8102E'}`,
                      borderLeft: `3px solid ${cerrado ? '#0F7A55' : '#C8102E'}`,
                      borderRadius: '8px', padding: '9px 11px',
                      background: cerrado ? '#fff' : '#F9E8EB'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <b style={{ fontSize: '11.5px', color: '#002060' }}>{p.fechaAuditoria}</b>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: cerrado ? '#085041' : '#C8102E' }}>
                          {cerrado ? (p.cerradoEn ? `Cerrado el ${p.cerradoEn}` : 'Cerrado') : 'Sigue abierto'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#0D1A2E', marginTop: '3px' }}>{p.hallazgo}</div>
                      <div style={{ fontSize: '10.5px', color: '#5A6A80', marginTop: '2px' }}>
                        Acción: {p.accion || 'Sin registrar'} · {p.responsable || 'No asignado'}
                      </div>
                      {i === 0 && p.reincidenciaDe?.diasHastaVolver !== null && p.reincidenciaDe && (
                        <div style={{ fontSize: '10.5px', color: '#7A4500', marginTop: '4px', fontWeight: 600 }}>
                          Volvió a fallar {p.reincidenciaDe.diasHastaVolver} días después del cierre anterior.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: '10.5px', color: '#5A6A80', marginTop: '12px', lineHeight: 1.5 }}>
                {linea.length > 1
                  ? <>Este punto ha fallado <b>{linea.length} veces</b> en esta máquina. Cuando un hallazgo vuelve
                      después de cerrarse, lo que falló no fue la revisión: fue la acción correctiva.</>
                  : <>Es la primera vez que este punto falla en esta máquina.</>}
              </div>
            </div>
          </div>
        );
      })()}

      <footer style={{ textAlign: 'center', padding: '1.2rem', fontSize: '11px', color: '#8A9AB0', borderTop: '1px solid rgba(0,32,96,0.07)' }}>
        Sistema de Control Operativo
      </footer>
    </div>
  );
};

export default App;
