import React, { useState, useEffect } from 'react';
import { db } from './services/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';

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
    padding: '8px 12px',
    border: '1px solid rgba(0, 32, 96, 0.12)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.85)',
    color: '#0D1A2E',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  }
};

// --- CATÁLOGO DE MÁQUINAS Y ÁREAS ---
interface Maquina {
  id: string;
  nombre: string;
  tipo: string;
  moduloProceso: boolean;
  modulo5S: boolean;
}

const CATALOGO: Maquina[] = [
  { id: 'peg-1', nombre: 'Pegadora de Etiquetas 1', tipo: 'Pegado', moduloProceso: true, modulo5S: true },
  { id: 'peg-2', nombre: 'Pegadora de Etiquetas 2', tipo: 'Pegado', moduloProceso: true, modulo5S: true },
  { id: 'flex-1', nombre: 'Flexográfica 1', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'flex-2', nombre: 'Flexográfica 2', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'flex-3', nombre: 'Flexográfica 3', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'flex-4', nombre: 'Flexográfica 4', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'roto-1', nombre: 'Rotograbado 1', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'roto-2', nombre: 'Rotograbado 2', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'roto-3', nombre: 'Rotograbado 3', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'dig-1', nombre: 'Impresora Digital', tipo: 'Digital', moduloProceso: true, modulo5S: true },
  { id: 'lam-1', nombre: 'Laminadora', tipo: 'Laminado', moduloProceso: true, modulo5S: true },
  { id: 'dep-imp', nombre: 'Depuradora de Impresión', tipo: 'Depuración', moduloProceso: true, modulo5S: true },
  { id: 'suaj-1', nombre: 'Suajadora', tipo: 'Suajado', moduloProceso: true, modulo5S: true },
  { id: 'ref-1', nombre: 'Refiladora 1', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  { id: 'ref-2', nombre: 'Refiladora 2', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  { id: 'ref-3', nombre: 'Refiladora 3', tipo: 'Refilado', moduloProceso: true, modulo5S: true },
  { id: 'rev-1', nombre: 'Revisadora 1', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'rev-2', nombre: 'Revisadora 2', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'rev-3', nombre: 'Revisadora 3', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'rev-4', nombre: 'Revisadora 4', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'rev-5', nombre: 'Revisadora 5', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'rev-6', nombre: 'Revisadora 6', tipo: 'Revisión', moduloProceso: true, modulo5S: true },
  { id: 'dep-etq', nombre: 'Depuradora de Etiquetas', tipo: 'Depuración', moduloProceso: true, modulo5S: true },
  { id: 'cort-1', nombre: 'Cortadora 1', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'cort-2', nombre: 'Cortadora 2', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'cort-3', nombre: 'Cortadora 3', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'area-tintas', nombre: 'Área de Tintas', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-banos', nombre: 'Baños de Producción', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-mp', nombre: 'Almacén Materia Prima', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-pt', nombre: 'Almacén Producto Terminado', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-mant', nombre: 'Taller Mantenimiento', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-prep', nombre: 'Área Pre-prensa', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-cal', nombre: 'Laboratorio Calidad', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true }
];

interface ItemChecklist {
  id: number;
  seccion: string;
  queObservar: string;
  comoVerifica: string;
}

const CHECKLIST_PEGADO: ItemChecklist[] = [
  { id: 1, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'El solvente montado corresponde al sustrato del pedido', comoVerifica: 'Comparar etiqueta del bote vs. sustrato de la ficha; lote anotado en reporte' },
  { id: 2, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'El operador realizó y registró la prueba de aporte', comoVerifica: 'Pedir el cálculo: mL ÷ velocidad = 0.015' },
  { id: 3, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'La aguja fue calibrada en el arranque / tras romperse el material', comoVerifica: 'Preguntar cuándo la calibró; chorro recto y continuo' },
  { id: 4, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'Presión de aire del tanque de adhesivo en rango', comoVerifica: 'Manómetro entre 0.51 y 0.65 MPa' },
  { id: 5, seccion: 'A · SOLVENTE Y APORTE (raíz del sellado abierto)', queObservar: 'Velocidades de activar/desactivar solvente configuradas', comoVerifica: 'Activar = trabajo −100 · Desactivar = programada −50' },
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

interface Hallazgo {
  id: string;
  puntoId?: number;
  esExtra?: boolean;
  hallazgo: string;
  accion: string;
  responsable: string;
  fechaCierre: string;
  estadoSeguimiento?: 'PENDIENTE' | 'EN_PROCESO' | 'CERRADO';
}

export const App: React.FC = () => {
  const [vista, setVista] = useState<'LAUNCHER' | 'MODULO_PROCESO' | 'MODULO_5S' | 'EVALUACION_PEGADO' | 'HISTORIAL'>('LAUNCHER');
  const [subVistaHistorial, setSubVistaHistorial] = useState<'AUDITORIAS' | 'GANTT'>('GANTT');
  const [maquinaSeleccionada, setMaquinaSeleccionada] = useState<Maquina | null>(null);

  const [ordenTrabajo, setOrdenTrabajo] = useState('');
  const [auditor, setAuditor] = useState('');
  const [turno, setTurno] = useState('Matutino (6:00–14:00)');
  const [respuestas, setRespuestas] = useState<Record<number, 'SI' | 'NO' | null>>({});
  const [hallazgos, setHallazgos] = useState<Record<string, Hallazgo>>({});
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const q = query(collection(db, 'evaluaciones_proceso'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setHistorial(docs);
    });
    return () => unsub();
  }, []);

  const handleRespuesta = (puntoId: number, valor: 'SI' | 'NO') => {
    setRespuestas((prev) => ({ ...prev, [puntoId]: valor }));
    const key = `punto_${puntoId}`;

    if (valor === 'NO' && !hallazgos[key]) {
      const item = CHECKLIST_PEGADO.find((i) => i.id === puntoId);
      setHallazgos((prev) => ({
        ...prev,
        [key]: {
          id: key,
          puntoId,
          esExtra: false,
          hallazgo: `Desviación en: ${item?.queObservar || ''}`,
          accion: '',
          responsable: '',
          fechaCierre: todayStr,
          estadoSeguimiento: 'PENDIENTE'
        }
      }));
    } else if (valor === 'SI' && hallazgos[key]) {
      setHallazgos((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleAddHallazgoExtra = () => {
    const extraId = `extra_${Date.now()}`;
    setHallazgos((prev) => ({
      ...prev,
      [extraId]: {
        id: extraId,
        esExtra: true,
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
    setHallazgos((prev) => ({
      ...prev,
      [key]: { ...prev[key], [campo]: valor }
    }));
  };

  const totalRespondidos = Object.values(respuestas).filter((v) => v !== null).length;
  const totalSi = Object.values(respuestas).filter((v) => v === 'SI').length;
  const totalNo = Object.values(respuestas).filter((v) => v === 'NO').length;
  const listaHallazgos = Object.values(hallazgos);
  const cumplimiento = totalRespondidos > 0 ? Math.round((totalSi / CHECKLIST_PEGADO.length) * 100) : 0;

  const handleGuardarEvaluacion = async () => {
    if (!auditor.trim() || !ordenTrabajo.trim()) {
      alert('Por favor ingrese la Orden de Trabajo y el Nombre del Auditor.');
      return;
    }
    if (totalRespondidos < CHECKLIST_PEGADO.length) {
      alert(`Faltan responder ${CHECKLIST_PEGADO.length - totalRespondidos} puntos del checklist.`);
      return;
    }

    setGuardando(true);
    try {
      await addDoc(collection(db, 'evaluaciones_proceso'), {
        maquinaId: maquinaSeleccionada?.id,
        maquinaNombre: maquinaSeleccionada?.nombre,
        tipoMaquina: maquinaSeleccionada?.tipo,
        ordenTrabajo: ordenTrabajo.trim(),
        auditor: auditor.trim(),
        turno,
        cumplimiento,
        totalSi,
        totalNo,
        fechaAuditoria: todayStr,
        respuestas,
        hallazgos: listaHallazgos,
        estadoFinal: listaHallazgos.length === 0 ? 'APROBADO' : 'CON_HALLAZGOS',
        createdAt: serverTimestamp()
      });

      alert('✅ Evaluación guardada y sincronizada correctamente.');
      setRespuestas({});
      setHallazgos({});
      setOrdenTrabajo('');
      setAuditor('');
      setVista('LAUNCHER');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar en Firebase.');
    } finally {
      setGuardando(false);
    }
  };

  // Actualizar estado de seguimiento de un hallazgo desde el Gantt
  const handleToggleEstadoHallazgo = async (docId: string, hallazgoIdx: number, estadoActual?: string) => {
    try {
      const docEncontrado = historial.find((h) => h.id === docId);
      if (!docEncontrado || !docEncontrado.hallazgos) return;

      const nuevosHallazgos = [...docEncontrado.hallazgos];
      const siguienteEstado =
        estadoActual === 'PENDIENTE' || !estadoActual ? 'EN_PROCESO' :
        estadoActual === 'EN_PROCESO' ? 'CERRADO' : 'PENDIENTE';

      nuevosHallazgos[hallazgoIdx] = {
        ...nuevosHallazgos[hallazgoIdx],
        estadoSeguimiento: siguienteEstado
      };

      const docRef = doc(db, 'evaluaciones_proceso', docId);
      await updateDoc(docRef, { hallazgos: nuevosHallazgos });
    } catch (error) {
      console.error('Error al actualizar estado en Gantt:', error);
    }
  };

  // Obtener lista plana unificada de hallazgos para el Gantt
  const hallazgosUnificados = historial.flatMap((auditoria) => {
    if (!auditoria.hallazgos || !Array.isArray(auditoria.hallazgos)) return [];
    return auditoria.hallazgos.map((h: Hallazgo, idx: number) => ({
      ...h,
      docId: auditoria.id,
      hallazgoIdx: idx,
      maquinaNombre: auditoria.maquinaNombre,
      ordenTrabajo: auditoria.ordenTrabajo,
      auditor: auditoria.auditor,
      fechaAuditoria: auditoria.fechaAuditoria || todayStr,
    }));
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#0D1A2E' }}>
      
      {/* HEADER GLASS */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid rgba(0,32,96,0.08)',
        boxShadow: '0 2px 8px rgba(0,32,96,0.05)', position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => setVista('LAUNCHER')}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', letterSpacing: '.02em' }}>IMPREDIMEX</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#003580', marginTop: '1px', letterSpacing: '.01em' }}>Control de Proceso y 5S</div>
            <div style={{ fontSize: '10px', color: '#8A9AB0', marginTop: '1px' }}>Sistema de Operaciones · Verificación de Línea</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {vista !== 'LAUNCHER' && (
            <button onClick={() => setVista('LAUNCHER')} style={{
              background: 'transparent', border: '1.5px solid rgba(0,32,96,0.12)', color: '#003580',
              padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600
            }}>
              ← Tablero
            </button>
          )}
          <button onClick={() => { setVista('HISTORIAL'); setSubVistaHistorial('GANTT'); }} style={{
            background: '#003580', color: '#ffffff', border: 'none',
            padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, letterSpacing: '.02em'
          }}>
            Histórico & Gantt ({hallazgosUnificados.length})
          </button>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main style={{ maxWidth: '1060px', margin: '0 auto', padding: '1.2rem 1rem 3rem' }}>

        {/* 1. VISTA LAUNCHER */}
        {vista === 'LAUNCHER' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={STYLES.metricCard}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Total Auditorías</div>
                <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>{historial.length}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Registros globales</div>
              </div>
              <div style={STYLES.metricCard}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Hallazgos Totales</div>
                <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>{hallazgosUnificados.length}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>En plan de acción</div>
              </div>
              <div style={STYLES.metricCard}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Acciones Pendientes</div>
                <div style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>
                  {hallazgosUnificados.filter((h) => h.estadoSeguimiento !== 'CERRADO').length}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Por cerrar</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              
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
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Módulo de Calidad</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Condiciones y 5S</div>
                <p style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5, margin: '0 0 14px' }}>
                  Auditoría de área limpia, estantes correctos, despeje de línea y orden de herramentales.
                </p>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#003580', background: '#E8EEF8', padding: '3px 9px', borderRadius: '5px' }}>
                  33 Áreas y Máquinas
                </span>
              </div>

            </div>
          </div>
        )}

        {/* 2. VISTA SELECCIÓN PROCESO */}
        {vista === 'MODULO_PROCESO' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#002060' }}>Validación de Proceso y Arranque</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Selecciona el equipo para aplicar el checklist de liberación</div>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
              {CATALOGO.filter((m) => m.moduloProceso).map((maq) => {
                const esPegadora = maq.tipo === 'Pegado';
                return (
                  <div
                    key={maq.id}
                    onClick={() => {
                      setMaquinaSeleccionada(maq);
                      if (esPegadora) setVista('EVALUACION_PEGADO');
                      else alert(`Checklist para ${maq.nombre} se integrará a continuación.`);
                    }}
                    style={{
                      ...STYLES.glassCard,
                      marginBottom: 0,
                      padding: '14px',
                      cursor: 'pointer',
                      border: esPegadora ? '1.5px solid #003580' : '1px solid rgba(0,32,96,0.07)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#003580', background: '#E8EEF8', padding: '2px 8px', borderRadius: '10px' }}>
                        {maq.tipo}
                      </span>
                      {esPegadora && <span style={{ fontSize: '10px', fontWeight: 700, color: '#0F7A55', background: '#E0F2EC', padding: '2px 6px', borderRadius: '4px' }}>Plantilla Lista</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#0D1A2E', textAlign: 'left' }}>{maq.nombre}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. VISTA SELECCIÓN 5S */}
        {vista === 'MODULO_5S' && (
          <div>
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#002060' }}>Condiciones de Equipo y 5S</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Auditoría de orden, despeje y limpieza general</div>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
              {CATALOGO.filter((m) => m.modulo5S).map((item) => (
                <div
                  key={item.id}
                  onClick={() => alert(`Módulo 5S para ${item.nombre} configurándose.`)}
                  style={{ ...STYLES.glassCard, marginBottom: 0, padding: '14px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#5A6A80', background: '#EEF0F3', padding: '2px 8px', borderRadius: '10px' }}>
                    {item.tipo}
                  </span>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0D1A2E', marginTop: '6px', textAlign: 'left' }}>{item.nombre}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. VISTA EVALUACIÓN OFICIAL DE PEGADO */}
        {vista === 'EVALUACION_PEGADO' && (
          <div>
            <div style={STYLES.glassCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Plan de Auditoría Técnica de Pegado</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#002060' }}>{maquinaSeleccionada?.nombre}</div>
                  <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>Formato F1-PR-PA-03 · 16 Puntos Críticos</div>
                </div>
                <div style={{ textAlign: 'right', background: '#E8EEF8', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,53,128,0.2)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase' }}>Cumplimiento</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: totalNo > 0 ? '#C8102E' : '#0F7A55' }}>
                    {cumplimiento}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#5A6A80' }}>{totalRespondidos} de 16 evaluados</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '1.2rem', textAlign: 'left' }}>
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
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' }}>Auditor / Supervisor:</label>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={auditor}
                    onChange={(e) => setAuditor(e.target.value)}
                    style={STYLES.input}
                  />
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
            <div style={STYLES.glassCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
                <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>Puntos de Inspección en Piso</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CHECKLIST_PEGADO.map((item, idx) => {
                  const resp = respuestas[item.id];
                  const showHeader = idx === 0 || CHECKLIST_PEGADO[idx - 1].seccion !== item.seccion;

                  return (
                    <React.Fragment key={item.id}>
                      {showHeader && (
                        <div style={{ background: '#E8EEF8', color: '#002060', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', marginTop: idx === 0 ? '0' : '14px', textAlign: 'left' }}>
                          {item.seccion}
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
                            {item.queObservar}
                          </div>
                          <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
                            <strong>Verificación:</strong> {item.comoVerifica}
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

            {/* SECCIÓN HALLAZGOS */}
            <div style={{ ...STYLES.glassCard, border: listaHallazgos.length > 0 ? '1.5px solid #C8102E' : '1px solid rgba(0,32,96,0.07)', background: listaHallazgos.length > 0 ? '#F9E8EB' : 'rgba(255,255,255,0.88)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: listaHallazgos.length > 0 ? '2px solid rgba(200,16,46,0.2)' : '2px solid #E8EEF8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '18px', background: listaHallazgos.length > 0 ? '#C8102E' : '#003580', borderRadius: '2px' }}></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: listaHallazgos.length > 0 ? '#7A0B1D' : '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Hallazgos y Acciones Correctivas ({listaHallazgos.length})
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddHallazgoExtra}
                  style={{
                    background: '#003580', color: '#ffffff', border: 'none',
                    padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + Agregar Hallazgo Extra
                </button>
              </div>

              {listaHallazgos.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#5A6A80', textAlign: 'center', padding: '12px' }}>
                  No hay hallazgos registrados. Si una pregunta se marca como "NO" o agregas un hallazgo extra, aparecerá aquí.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {listaHallazgos.map((h) => {
                    const itemCheck = h.puntoId ? CHECKLIST_PEGADO.find((i) => i.id === h.puntoId) : null;
                    return (
                      <div key={h.id} style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid rgba(200,16,46,0.25)', textAlign: 'left' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A0B1D' }}>
                            {h.esExtra ? (
                              '⚠️ Hallazgo Extra / Fuera de Checklist'
                            ) : (
                              `Punto #${h.puntoId}: ${itemCheck?.queObservar}`
                            )}
                          </div>
                          {h.esExtra && (
                            <button
                              type="button"
                              onClick={() => handleRemoveHallazgoExtra(h.id)}
                              style={{ background: 'none', border: 'none', color: '#C8102E', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              ✕ Eliminar
                            </button>
                          )}
                        </div>

                        {h.esExtra && (
                          <div style={{ marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Descripción del Hallazgo:</label>
                            <input
                              type="text"
                              placeholder="Describe la desviación observada..."
                              value={h.hallazgo}
                              onChange={(e) => handleHallazgoChange(h.id, 'hallazgo', e.target.value)}
                              style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                            />
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Acción Correctiva Inmediata:</label>
                            <input
                              type="text"
                              placeholder="Acción realizada..."
                              value={h.accion}
                              onChange={(e) => handleHallazgoChange(h.id, 'accion', e.target.value)}
                              style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>Responsable:</label>
                            <input
                              type="text"
                              placeholder="Nombre del responsable"
                              value={h.responsable}
                              onChange={(e) => handleHallazgoChange(h.id, 'responsable', e.target.value)}
                              style={{ ...STYLES.input, fontSize: '12px', padding: '6px 10px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '2px' }}>
                              Fecha de Cierre:
                            </label>
                            <input
                              type="date"
                              value={h.fechaCierre}
                              readOnly={!h.esExtra}
                              onChange={(e) => handleHallazgoChange(h.id, 'fechaCierre', e.target.value)}
                              style={{
                                ...STYLES.input,
                                fontSize: '12px',
                                padding: '6px 10px',
                                background: !h.esExtra ? '#f1f5f9' : '#ffffff',
                                cursor: !h.esExtra ? 'not-allowed' : 'auto'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setVista('MODULO_PROCESO')}
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
                  background: listaHallazgos.length === 0 ? '#003580' : '#C8102E',
                  color: '#ffffff', border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 700, letterSpacing: '.02em',
                  cursor: guardando ? 'not-allowed' : 'pointer',
                  boxShadow: '0 3px 10px rgba(0,53,128,0.35)'
                }}
              >
                {guardando ? 'Guardando en Firebase…' : 'Guardar Registro de Auditoría'}
              </button>
            </div>
          </div>
        )}

        {/* 5. VISTA HISTORIAL & GANTT UNIFICADO */}
        {vista === 'HISTORIAL' && (
          <div>
            {/* Encabezado y Selector de Subvistas */}
            <div style={{ ...STYLES.glassCard, padding: '1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Histórico Operativo y Plan de Acción</div>
                <div style={{ fontSize: '11px', color: '#5A6A80' }}>Consolidación de auditorías y seguimiento de implementación</div>
              </div>

              {/* Botones de Pestaña Historial */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setSubVistaHistorial('GANTT')}
                  style={{
                    background: subVistaHistorial === 'GANTT' ? '#003580' : 'transparent',
                    color: subVistaHistorial === 'GANTT' ? '#ffffff' : '#003580',
                    border: '1.5px solid #003580', padding: '6px 14px', borderRadius: '6px',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Plan de Acción / Gantt ({hallazgosUnificados.length})
                </button>
                <button
                  onClick={() => setSubVistaHistorial('AUDITORIAS')}
                  style={{
                    background: subVistaHistorial === 'AUDITORIAS' ? '#003580' : 'transparent',
                    color: subVistaHistorial === 'AUDITORIAS' ? '#ffffff' : '#003580',
                    border: '1.5px solid #003580', padding: '6px 14px', borderRadius: '6px',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Auditorías ({historial.length})
                </button>
                <button onClick={() => setVista('LAUNCHER')} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#5A6A80', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Cerrar
                </button>
              </div>
            </div>

            {/* A. SUBVISTA GANTT / PLAN DE ACCIÓN */}
            {subVistaHistorial === 'GANTT' && (
              <div>
                {hallazgosUnificados.length === 0 ? (
                  <div style={{ ...STYLES.glassCard, textAlign: 'center', padding: '2.5rem', color: '#5A6A80', fontSize: '13px' }}>
                    No hay hallazgos registrados. Todo el proceso se encuentra en 100% de cumplimiento.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {hallazgosUnificados.map((item, idx) => {
                      const estatus = item.estadoSeguimiento || 'PENDIENTE';
                      return (
                        <div key={`${item.docId}_${idx}`} style={{ ...STYLES.glassCard, marginBottom: 0, padding: '14px 18px', textAlign: 'left' }}>
                          
                          {/* Fila superior: Máquina, OP y Botón de Estado interactivo */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#003580', background: '#E8EEF8', padding: '3px 8px', borderRadius: '6px' }}>
                                {item.maquinaNombre}
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#5A6A80' }}>
                                OP: <strong>{item.ordenTrabajo || 'S/N'}</strong>
                              </span>
                            </div>

                            {/* Botón de cambio de estado de seguimiento */}
                            <button
                              onClick={() => handleToggleEstadoHallazgo(item.docId, item.hallazgoIdx, item.estadoSeguimiento)}
                              style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background:
                                  estatus === 'CERRADO' ? '#E0F2EC' :
                                  estatus === 'EN_PROCESO' ? '#E8EEF8' : '#FDF0D8',
                                color:
                                  estatus === 'CERRADO' ? '#085041' :
                                  estatus === 'EN_PROCESO' ? '#002060' : '#7A4500'
                              }}
                              title="Haz clic para cambiar estado (PENDIENTE → EN PROCESO → CERRADO)"
                            >
                              ● {estatus.replace('_', ' ')}
                            </button>
                          </div>

                          {/* Descripción y Acción Correctiva */}
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0D1A2E', marginBottom: '4px' }}>
                            {item.hallazgo}
                          </div>
                          <div style={{ fontSize: '12px', color: '#5A6A80', marginBottom: '10px' }}>
                            <strong>Acción / Seguimiento:</strong> {item.accion || 'Sin acción documentada'} · <strong>Resp:</strong> {item.responsable || 'No asignado'}
                          </div>

                          {/* Barra Visual tipo Gantt */}
                          <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '8px 12px', border: '1px solid rgba(0,32,96,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8A9AB0', marginBottom: '4px', fontWeight: 600 }}>
                              <span>Detección: {item.fechaAuditoria}</span>
                              <span>Compromiso / Cierre: {item.fechaCierre}</span>
                            </div>
                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  borderRadius: '4px',
                                  width: estatus === 'CERRADO' ? '100%' : estatus === 'EN_PROCESO' ? '60%' : '20%',
                                  background:
                                    estatus === 'CERRADO' ? '#0F7A55' :
                                    estatus === 'EN_PROCESO' ? '#003580' : '#D4840A'
                                }}
                              ></div>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* B. SUBVISTA AUDITORÍAS GENERALES */}
            {subVistaHistorial === 'AUDITORIAS' && (
              <div>
                {historial.length === 0 ? (
                  <div style={{ ...STYLES.glassCard, textAlign: 'center', padding: '2.5rem', color: '#5A6A80', fontSize: '13px' }}>
                    Sin auditorías guardadas aún.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {historial.map((item) => (
                      <div key={item.id} style={{ ...STYLES.glassCard, marginBottom: 0, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
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
                          </div>
                          <div style={{ fontSize: '12px', color: '#5A6A80' }}>
                            OP: <strong>{item.ordenTrabajo || 'S/N'}</strong> · Auditor: <strong>{item.auditor}</strong> · {item.turno}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: item.cumplimiento === 100 ? '#0F7A55' : '#C8102E' }}>
                            {item.cumplimiento}%
                          </div>
                          <div style={{ fontSize: '10px', color: '#8A9AB0' }}>
                            {item.totalSi} SÍ / {item.totalNo} NO · {item.hallazgos?.length || 0} Hallazgos
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer style={{ textAlign: 'center', padding: '1.2rem', fontSize: '11px', color: '#8A9AB0', borderTop: '1px solid rgba(0,32,96,0.07)' }}>
        <strong style={{ color: '#003580' }}>IMPREDIMEX</strong> — Impresión y Diseño de México S.A. de C.V. &nbsp;·&nbsp; Sistema de Control Operativo &nbsp;·&nbsp; Planta Industrial[cite: 2]
      </footer>
    </div>
  );
};

export default App;
