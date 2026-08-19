import React, { useState, useEffect } from 'react';
import { db } from './services/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

// --- CATÁLOGO DE MÁQUINAS Y ÁREAS ---
interface Maquina {
  id: string;
  nombre: string;
  tipo: string;
  moduloProceso: boolean;
  modulo5S: boolean;
}

const CATALOGO: Maquina[] = [
  // Pegadoras (Modelo activo)
  { id: 'peg-1', nombre: 'Pegadora de Etiquetas 1', tipo: 'Pegado', moduloProceso: true, modulo5S: true },
  { id: 'peg-2', nombre: 'Pegadora de Etiquetas 2', tipo: 'Pegado', moduloProceso: true, modulo5S: true },
  // Flexografía
  { id: 'flex-1', nombre: 'Flexográfica 1', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'flex-2', nombre: 'Flexográfica 2', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'flex-3', nombre: 'Flexográfica 3', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  { id: 'flex-4', nombre: 'Flexográfica 4', tipo: 'Flexografía', moduloProceso: true, modulo5S: true },
  // Rotograbado
  { id: 'roto-1', nombre: 'Rotograbado 1', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'roto-2', nombre: 'Rotograbado 2', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  { id: 'roto-3', nombre: 'Rotograbado 3', tipo: 'Rotograbado', moduloProceso: true, modulo5S: true },
  // Impresión y acabados
  { id: 'dig-1', nombre: 'Impresora Digital', tipo: 'Digital', moduloProceso: true, modulo5S: true },
  { id: 'lam-1', nombre: 'Laminadora', tipo: 'Laminado', moduloProceso: true, modulo5S: true },
  { id: 'dep-imp', nombre: 'Depuradora de Impresión', tipo: 'Depuración', moduloProceso: true, modulo5S: true },
  { id: 'suaj-1', nombre: 'Suajadora', tipo: 'Suajado', moduloProceso: true, modulo5S: true },
  // Refilado y revisión
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
  // Corte
  { id: 'cort-1', nombre: 'Cortadora 1', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'cort-2', nombre: 'Cortadora 2', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  { id: 'cort-3', nombre: 'Cortadora 3', tipo: 'Corte', moduloProceso: true, modulo5S: true },
  // Áreas Auxiliares / 5S
  { id: 'area-tintas', nombre: 'Área de Tintas', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-banos', nombre: 'Baños de Producción', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-mp', nombre: 'Almacén Materia Prima', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-pt', nombre: 'Almacén Producto Terminado', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-mant', nombre: 'Taller Mantenimiento', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-prep', nombre: 'Área Pre-prensa', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true },
  { id: 'area-cal', nombre: 'Laboratorio Calidad', tipo: 'Área Auxiliar', moduloProceso: false, modulo5S: true }
];

// --- PLANTILLA OFICIAL DE PEGADORAS (16 PUNTOS) ---
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
  puntoId: number;
  hallazgo: string;
  accion: string;
  responsable: string;
  fecha: string;
}

export const App: React.FC = () => {
  // Navegación
  const [vista, setVista] = useState<'LAUNCHER' | 'MODULO_PROCESO' | 'MODULO_5S' | 'EVALUACION_PEGADO' | 'HISTORIAL'>('LAUNCHER');
  const [maquinaSeleccionada, setMaquinaSeleccionada] = useState<Maquina | null>(null);

  // Formulario Evaluación
  const [ordenTrabajo, setOrdenTrabajo] = useState('');
  const [auditor, setAuditor] = useState('');
  const [turno, setTurno] = useState('1');
  const [respuestas, setRespuestas] = useState<Record<number, 'SI' | 'NO' | null>>({});
  const [hallazgos, setHallazgos] = useState<Record<number, Hallazgo>>({});
  const [guardando, setGuardando] = useState(false);

  // Historial Firebase
  const [historial, setHistorial] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'evaluaciones_proceso'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setHistorial(docs);
    }, (error) => {
      console.warn('Error al cargar historial:', error);
    });
    return () => unsub();
  }, []);

  const handleRespuesta = (puntoId: number, valor: 'SI' | 'NO') => {
    setRespuestas((prev) => ({ ...prev, [puntoId]: valor }));
    if (valor === 'NO' && !hallazgos[puntoId]) {
      const item = CHECKLIST_PEGADO.find((i) => i.id === puntoId);
      setHallazgos((prev) => ({
        ...prev,
        [puntoId]: {
          puntoId,
          hallazgo: `Desviación en: ${item?.queObservar || ''}`,
          accion: '',
          responsable: '',
          fecha: new Date().toISOString().split('T')[0]
        }
      }));
    } else if (valor === 'SI') {
      setHallazgos((prev) => {
        const copy = { ...prev };
        delete copy[puntoId];
        return copy;
      });
    }
  };

  const handleHallazgoChange = (puntoId: number, campo: keyof Hallazgo, valor: string) => {
    setHallazgos((prev) => ({
      ...prev,
      [puntoId]: { ...prev[puntoId], [campo]: valor }
    }));
  };

  const totalRespondidos = Object.values(respuestas).filter((v) => v !== null).length;
  const totalSi = Object.values(respuestas).filter((v) => v === 'SI').length;
  const totalNo = Object.values(respuestas).filter((v) => v === 'NO').length;
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
        respuestas,
        hallazgos: Object.values(hallazgos),
        estadoFinal: totalNo === 0 ? 'APROBADO' : 'CON_HALLAZGOS',
        createdAt: serverTimestamp()
      });

      alert('¡Evaluación guardada exitosamente en la nube!');
      // Resetear estado
      setRespuestas({});
      setHallazgos({});
      setOrdenTrabajo('');
      setAuditor('');
      setVista('LAUNCHER');
    } catch (error) {
      console.error('Error al guardar evaluación:', error);
      alert('Error al guardar la evaluación.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b', paddingBottom: '50px' }}>
      
      {/* BARRA SUPERIOR ESTILO ODOO */}
      <header style={{ backgroundColor: '#1e293b', color: '#ffffff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setVista('LAUNCHER')}>
          <div style={{ backgroundColor: '#0284c7', width: '34px', height: '34px', borderRadius: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '6px', gap: '2px' }}>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
            <span style={{ background: '#fff', borderRadius: '1px' }}></span>
          </div>
          <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '0.5px' }}>IMPREDIMEX OPS</span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {vista !== 'LAUNCHER' && (
            <button onClick={() => setVista('LAUNCHER')} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              ← Tablero Principal
            </button>
          )}
          <button onClick={() => setVista('HISTORIAL')} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Historial ({historial.length})
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 16px' }}>

        {/* 1. VISTA LAUNCHER / TABLERO PRINCIPAL ODOO */}
        {vista === 'LAUNCHER' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px', color: '#0f172a' }}>Sistema de Gestión y Control Operativo</h1>
              <p style={{ color: '#64748b', margin: 0 }}>Selecciona un módulo de trabajo para iniciar las validaciones</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              
              {/* Tarjeta 1: Proceso */}
              <div
                onClick={() => setVista('MODULO_PROCESO')}
                style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'transform 0.2s', textAlign: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ width: '64px', height: '64px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px', fontWeight: 800 }}>
                  ⚙️
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>Validación de Proceso</h3>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Arranque, parámetros técnicos, solventes, control de manga y liberación de tiro.
                </p>
                <span style={{ display: 'inline-block', backgroundColor: '#f0fdf4', color: '#166534', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px' }}>
                  26 Máquinas Operativas
                </span>
              </div>

              {/* Tarjeta 2: 5S y Condiciones */}
              <div
                onClick={() => setVista('MODULO_5S')}
                style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'transform 0.2s', textAlign: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ width: '64px', height: '64px', backgroundColor: '#fef3c7', color: '#d97706', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px', fontWeight: 800 }}>
                  🧹
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>Condiciones y 5S</h3>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Auditoría de área limpia, estantes correctos, despeje de línea y orden general.
                </p>
                <span style={{ display: 'inline-block', backgroundColor: '#f8fafc', color: '#475569', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  33 Puntos de Control
                </span>
              </div>

              {/* Tarjeta 3: Resumen */}
              <div
                onClick={() => setVista('HISTORIAL')}
                style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'transform 0.2s', textAlign: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ width: '64px', height: '64px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px', fontWeight: 800 }}>
                  📊
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>Historial & Auditorías</h3>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Consulta de auditorías realizadas, % de cumplimiento y seguimiento de hallazgos.
                </p>
                <span style={{ display: 'inline-block', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px' }}>
                  {historial.length} Auditorías en la Nube
                </span>
              </div>

            </div>
          </div>
        )}

        {/* 2. VISTA SELECCIÓN DE MÁQUINAS (PROCESO) */}
        {vista === 'MODULO_PROCESO' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>Validación de Proceso</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Selecciona el equipo para aplicar el checklist de liberación</p>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                Volver
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {CATALOGO.filter((m) => m.moduloProceso).map((maq) => {
                const esPegadora = maq.tipo === 'Pegado';
                return (
                  <div
                    key={maq.id}
                    onClick={() => {
                      setMaquinaSeleccionada(maq);
                      if (esPegadora) {
                        setVista('EVALUACION_PEGADO');
                      } else {
                        alert(`El checklist para ${maq.nombre} se integrará a continuación.`);
                      }
                    }}
                    style={{
                      backgroundColor: '#ffffff',
                      border: esPegadora ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: esPegadora ? '#0284c7' : '#64748b', backgroundColor: esPegadora ? '#e0f2fe' : '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                        {maq.tipo}
                      </span>
                      {esPegadora && <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Activo</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{maq.nombre}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                      {esPegadora ? 'Checklist de 16 Puntos Disponible →' : 'Pendiente de plantilla'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. VISTA SELECCIÓN DE ÁREAS (5S Y CONDICIONES) */}
        {vista === 'MODULO_5S' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>Condiciones de Equipo y 5S</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Auditoría de orden, limpieza y despeje por máquina o área</p>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                Volver
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {CATALOGO.filter((m) => m.modulo5S).map((item) => (
                <div
                  key={item.id}
                  onClick={() => alert(`Módulo 5S para: ${item.nombre} configurándose.`)}
                  style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                    {item.tipo}
                  </span>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginTop: '8px' }}>{item.nombre}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Auditar 5S →</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. VISTA DE EVALUACIÓN OFICIAL DE PEGADO */}
        {vista === 'EVALUACION_PEGADO' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            
            {/* Header Evaluación */}
            <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ backgroundColor: '#0284c7', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  Auditoría de Proceso
                </span>
                <h2 style={{ margin: '8px 0 2px', fontSize: '22px', fontWeight: 800 }}>{maquinaSeleccionada?.nombre}</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Plan de Auditoría Técnica de Pegado (F1-PR-PA-03)</p>
              </div>

              {/* Indicador de cumplimiento */}
              <div style={{ textAlign: 'right', backgroundColor: '#f8fafc', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Cumplimiento</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: totalNo > 0 ? '#dc2626' : '#16a34a' }}>
                  {cumplimiento}%
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{totalRespondidos} de 16 evaluados</div>
              </div>
            </div>

            {/* Datos del Turno / Orden */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Orden de Trabajo (OT / Pedido):</label>
                <input
                  type="text"
                  placeholder="Ej. OP-45920"
                  value={ordenTrabajo}
                  onChange={(e) => setOrdenTrabajo(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Auditor / Supervisor:</label>
                <input
                  type="text"
                  placeholder="Nombre de quien audita"
                  value={auditor}
                  onChange={(e) => setAuditor(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Turno:</label>
                <select
                  value={turno}
                  onChange={(e) => setTurno(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: '#fff' }}
                >
                  <option value="1">Turno 1 (Matutino)</option>
                  <option value="2">Turno 2 (Vespertino)</option>
                  <option value="3">Turno 3 (Nocturno)</option>
                </select>
              </div>
            </div>

            {/* Checklist de 16 Puntos */}
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Puntos de Inspección</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
              {CHECKLIST_PEGADO.map((item, idx) => {
                const resp = respuestas[item.id];
                const showHeader = idx === 0 || CHECKLIST_PEGADO[idx - 1].seccion !== item.seccion;

                return (
                  <React.Fragment key={item.id}>
                    {showHeader && (
                      <div style={{ backgroundColor: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', color: '#1e293b', marginTop: idx === 0 ? '0' : '14px' }}>
                        {item.seccion}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', border: resp === 'NO' ? '1px solid #fca5a5' : '1px solid #e2e8f0', backgroundColor: resp === 'NO' ? '#fef2f2' : '#ffffff', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 300px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                          <span style={{ color: '#0284c7', marginRight: '6px' }}>#{item.id}</span>
                          {item.queObservar}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          🔍 <strong>Verificación:</strong> {item.comoVerifica}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleRespuesta(item.id, 'SI')}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            backgroundColor: resp === 'SI' ? '#16a34a' : '#f1f5f9',
                            color: resp === 'SI' ? '#ffffff' : '#475569'
                          }}
                        >
                          ✓ SÍ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespuesta(item.id, 'NO')}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            backgroundColor: resp === 'NO' ? '#dc2626' : '#f1f5f9',
                            color: resp === 'NO' ? '#ffffff' : '#475569'
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

            {/* SECCIÓN HALLAZGOS Y ACCIONES (Obligatorio si hay "NO") */}
            {totalNo > 0 && (
              <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
                <h3 style={{ margin: '0 0 6px', color: '#9f1239', fontSize: '16px', fontWeight: 800 }}>
                  ⚠️ Hallazgos y Acciones Correctivas ({totalNo})
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#881337' }}>
                  Es obligatorio documentar la acción correctiva inmediata para cada desviación marcada.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {Object.values(hallazgos).map((h) => (
                    <div key={h.puntoId} style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #f43f5e' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#9f1239', marginBottom: '8px' }}>
                        Punto #{h.puntoId}: {CHECKLIST_PEGADO.find((i) => i.id === h.puntoId)?.queObservar}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Acción Correctiva Inmediata:</label>
                          <input
                            type="text"
                            placeholder="Ej. Se ajustó manómetro a 0.55 MPa"
                            value={h.accion}
                            onChange={(e) => handleHallazgoChange(h.puntoId, 'accion', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Responsable:</label>
                          <input
                            type="text"
                            placeholder="Operador / Supervisor"
                            value={h.responsable}
                            onChange={(e) => handleHallazgoChange(h.puntoId, 'responsable', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón Final */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setVista('MODULO_PROCESO')}
                style={{ padding: '12px 20px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleGuardarEvaluacion}
                style={{
                  padding: '12px 28px',
                  backgroundColor: totalNo === 0 ? '#16a34a' : '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: guardando ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {guardando ? 'Guardando en Firebase...' : 'Finalizar y Guardar Auditoría'}
              </button>
            </div>

          </div>
        )}

        {/* 5. VISTA HISTORIAL */}
        {vista === 'HISTORIAL' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>Historial de Auditorías</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Registros guardados en Firestore en tiempo real</p>
              </div>
              <button onClick={() => setVista('LAUNCHER')} style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                Volver
              </button>
            </div>

            {historial.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                No hay evaluaciones registradas aún.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {historial.map((item) => (
                  <div key={item.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>{item.maquinaNombre}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: item.estadoFinal === 'APROBADO' ? '#dcfce7' : '#fee2e2', color: item.estadoFinal === 'APROBADO' ? '#166534' : '#991b1b' }}>
                          {item.estadoFinal === 'APROBADO' ? '✓ APROBADO' : '⚠️ CON HALLAZGOS'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569' }}>
                        OT: <strong>{item.ordenTrabajo || 'S/N'}</strong> · Auditor: <strong>{item.auditor}</strong> · Turno: {item.turno}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: item.cumplimiento === 100 ? '#16a34a' : '#ea580c' }}>
                        {item.cumplimiento}%
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {item.totalSi} SÍ / {item.totalNo} NO
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
