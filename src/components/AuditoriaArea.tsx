/**
 * Auditoría de Condiciones de Equipo y 5S por área (SPEC-027).
 *
 * Antes había que levantar un formulario por máquina: en Revisión, cinco
 * vueltas al mismo checklist. Ahora se elige el área y aparece un solo
 * formulario; a la derecha de cada punto va cada máquina del área con su lista
 * Sí / No.
 *
 * **La trazabilidad por máquina no cambia.** Al guardar se escribe un documento
 * por máquina, con la misma forma de siempre, así que cobertura, ranking,
 * reincidencia, comportamiento, Gantt y el paso de OT siguen leyendo lo mismo.
 * Los documentos de una misma revisión comparten `grupoArea`.
 */
import React, { useMemo, useState } from 'react';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

/* Formas mínimas que se usan aquí; App.tsx tiene las completas. */
export interface MaquinaArea {
  id: string;
  nombre: string;
  tipo: string;
  nombreManto?: string;
  naves?: string[];
}
export interface PuntoChecklist {
  id: number;
  seccion: string;
  queObservar: string;
  comoVerifica: string;
}
export interface PersonaArea {
  nomina: string;
  nombre: string;
}
/** Lo que el paso de OT de la SPEC-021 necesita por máquina. */
export interface ContextoOT {
  clave: string; equipo: string; naves: string[]; nombre: string;
  tipo: 'PROCESO' | '5S'; fecha: string; auditor: string; hallazgos: string[];
}

type Resp = 'SI' | 'NO';

interface HallazgoArea {
  id: string;
  maquinaId: string;
  puntoId?: number;
  esExtra?: boolean;
  esSeguridad?: boolean;
  esReincidente?: boolean;
  hallazgo: string;
  accion: string;
  responsable: string;
  fechaCierre: string;
  estadoSeguimiento?: 'PENDIENTE';
}

interface Props {
  familia: string;
  maquinas: MaquinaArea[];
  /** Si viene, solo esas máquinas arrancan marcadas (desde el layout 3D). */
  marcadasInicial?: string[];
  items: PuntoChecklist[];
  historial: any[];
  usuario: { nomina: string; nombre: string } | null;
  supervisoresDe: (m: MaquinaArea) => PersonaArea[];
  onCancelar: () => void;
  onGuardado: (contextosOT: ContextoOT[]) => void;
}

const ESTILO_INPUT: React.CSSProperties = {
  padding: '10px 14px', border: '1px solid rgba(0, 32, 96, 0.12)', borderRadius: '8px',
  background: 'rgba(255, 255, 255, 0.85)', color: '#0D1A2E', fontSize: '13px',
  width: '100%', boxSizing: 'border-box', outline: 'none'
};
const TARJETA: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.88)', borderRadius: '16px',
  border: '1px solid rgba(255, 255, 255, 0.98)', outline: '0.5px solid rgba(0, 32, 96, 0.06)',
  boxShadow: '0 0 0 0.5px rgba(0,32,96,.06), 0 2px 8px rgba(0,32,96,.06), 0 8px 24px rgba(0,32,96,.08)',
  padding: '1.4rem', marginBottom: '1rem'
};
const ETIQUETA: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#5A6A80', marginBottom: '4px' };

/** «REV1 (Revisadora 1)» → «REV1». Las áreas sin paréntesis quedan igual. */
export const etiquetaCorta = (m: MaquinaArea) => {
  const i = m.nombre.indexOf(' (');
  return i > 0 ? m.nombre.slice(0, i) : m.nombre;
};

/** Fecha local; `toISOString` daría la de UTC, que en la noche ya es mañana. */
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const AuditoriaArea: React.FC<Props> = ({
  familia, maquinas, marcadasInicial, items, historial, usuario, supervisoresDe, onCancelar, onGuardado
}) => {
  const [marcadas, setMarcadas] = useState<string[]>(
    marcadasInicial && marcadasInicial.length ? marcadasInicial : maquinas.map((m) => m.id)
  );
  const [auditor, setAuditor] = useState(usuario?.nombre || '');
  const [nominaAuditado, setNominaAuditado] = useState('');
  const [supervisorNomina, setSupervisorNomina] = useState('');
  const [turno, setTurno] = useState('Matutino (6:00–14:00)');
  /** maquinaId → puntoId → respuesta */
  const [resp, setResp] = useState<Record<string, Record<number, Resp>>>({});
  /** maquinaId → puntos que siguen abiertos de antes (SPEC-022) */
  const [soloReinc, setSoloReinc] = useState<Record<string, number[]>>({});
  const [hallazgos, setHallazgos] = useState<Record<string, HallazgoArea>>({});
  const [reinc, setReinc] = useState<{ maq: MaquinaArea; item: PuntoChecklist; previos: any[] } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const activas = maquinas.filter((m) => marcadas.includes(m.id));
  const fecha = hoy();

  // Supervisores de cualquiera de las máquinas del área, sin repetir.
  const supervisores = useMemo(() => {
    const vistos = new Map<string, PersonaArea>();
    activas.forEach((m) => supervisoresDe(m).forEach((s) => vistos.set(s.nomina, s)));
    return Array.from(vistos.values());
  }, [activas.map((m) => m.id).join(','), supervisoresDe]);

  const llave = (maqId: string, puntoId: number) => `${maqId}|punto_${puntoId}`;

  const quitarHallazgo = (k: string) =>
    setHallazgos((prev) => { if (!prev[k]) return prev; const c = { ...prev }; delete c[k]; return c; });

  const crearHallazgo = (maq: MaquinaArea, item: PuntoChecklist, reincidente: boolean) =>
    setHallazgos((prev) => ({
      ...prev,
      [llave(maq.id, item.id)]: {
        id: `punto_${item.id}`, maquinaId: maq.id, puntoId: item.id, esExtra: false,
        esReincidente: reincidente,
        hallazgo: `${reincidente ? '(Reincidente) ' : ''}Desviación en: ${item.queObservar}`,
        accion: '', responsable: '', fechaCierre: fecha, estadoSeguimiento: 'PENDIENTE'
      }
    }));

  const sacarDeReinc = (maqId: string, puntoId: number) =>
    setSoloReinc((prev) => ({ ...prev, [maqId]: (prev[maqId] || []).filter((x) => x !== puntoId) }));

  const responder = (maq: MaquinaArea, item: PuntoChecklist, valor: Resp | '') => {
    setResp((prev) => {
      const deMaq = { ...prev[maq.id] };
      if (valor) deMaq[item.id] = valor; else delete deMaq[item.id];
      return { ...prev, [maq.id]: deMaq };
    });
    const k = llave(maq.id, item.id);
    if (valor !== 'NO') { quitarHallazgo(k); sacarDeReinc(maq.id, item.id); return; }
    if (hallazgos[k] || (soloReinc[maq.id] || []).includes(item.id)) return;

    // SPEC-022: si el punto ya falló antes en esta máquina, se pregunta si es
    // lo mismo que sigue abierto o una desviación nueva.
    const previos: any[] = [];
    historial.forEach((aud) => {
      const esSuya = aud.maquinaId ? aud.maquinaId === maq.id : aud.maquinaNombre === maq.nombre;
      if (!esSuya || !Array.isArray(aud.hallazgos)) return;
      aud.hallazgos.forEach((h: any) => {
        if (h.puntoId === item.id) previos.push({ ...h, fechaAuditoria: aud.fechaAuditoria || 'Fecha no registrada', auditor: aud.auditor });
      });
    });
    if (previos.length) setReinc({ maq, item, previos });
    else crearHallazgo(maq, item, false);
  };

  const confirmarReinc = (esNueva: boolean) => {
    if (!reinc) return;
    const { maq, item } = reinc;
    if (esNueva) { crearHallazgo(maq, item, true); sacarDeReinc(maq.id, item.id); }
    else {
      quitarHallazgo(llave(maq.id, item.id));
      setSoloReinc((prev) => ({ ...prev, [maq.id]: Array.from(new Set([...(prev[maq.id] || []), item.id])) }));
    }
    setReinc(null);
  };

  const agregarExtra = () => {
    const id = `extra_${Date.now()}`;
    setHallazgos((prev) => ({
      ...prev,
      [id]: { id, maquinaId: activas[0]?.id || '', esExtra: true, esReincidente: false,
        hallazgo: '', accion: '', responsable: '', fechaCierre: fecha, estadoSeguimiento: 'PENDIENTE' }
    }));
  };

  const cambiarHallazgo = (k: string, campo: keyof HallazgoArea, valor: string) =>
    setHallazgos((prev) => ({ ...prev, [k]: { ...prev[k], [campo]: valor } }));

  const alternarMaquina = (id: string) =>
    setMarcadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const cuentaDe = (maqId: string) => {
    const r = resp[maqId] || {};
    const respondidos = items.filter((i) => r[i.id]).length;
    const si = items.filter((i) => r[i.id] === 'SI').length;
    const no = items.filter((i) => r[i.id] === 'NO').length;
    return { respondidos, si, no, cumplimiento: items.length ? Math.round((si / items.length) * 100) : 0 };
  };

  // Solo cuentan los hallazgos de máquinas que siguen en la revisión.
  const listaHallazgos = Object.entries(hallazgos).filter(([, h]) => marcadas.includes(h.maquinaId));

  const guardar = async () => {
    if (!activas.length) { alert('Marca al menos una máquina para revisar.'); return; }
    if (!auditor.trim()) { alert('Por favor ingrese el Nombre del Auditor.'); return; }
    if (supervisores.length > 0 && !supervisorNomina) { alert('Por favor selecciona el Nombre del Supervisor de la lista.'); return; }
    // SPEC-024: sin supervisor ni auditado, los hallazgos no tendrían dueño.
    if (supervisores.length === 0 && !nominaAuditado.trim()) {
      alert('Estas máquinas no tienen supervisores asignados, así que hace falta la nómina del auditado. Sin ella, los hallazgos no le aparecerían a nadie para cerrarlos.');
      return;
    }
    const faltan = activas
      .map((m) => ({ m, f: items.length - cuentaDe(m.id).respondidos }))
      .filter((x) => x.f > 0);
    if (faltan.length) {
      alert('Faltan puntos por contestar:\n\n' + faltan.map((x) => `${etiquetaCorta(x.m)}: ${x.f}`).join('\n')
        + '\n\nSi una máquina no se revisó, desmárcala arriba.');
      return;
    }
    if (listaHallazgos.some(([, h]) => h.esExtra && !h.hallazgo.trim())) {
      alert('Describe los hallazgos extra o elimínalos.'); return;
    }

    const sup = supervisores.find((s) => s.nomina === supervisorNomina);
    const grupoId = `area_${Date.now()}`;
    const contextos: ContextoOT[] = [];

    setGuardando(true);
    try {
      const lote = writeBatch(db);
      activas.forEach((m) => {
        const c = cuentaDe(m.id);
        const suyos = listaHallazgos.filter(([, h]) => h.maquinaId === m.id)
          .map(([, h]) => { const { maquinaId: _m, ...resto } = h; return resto; });
        const reincM = soloReinc[m.id] || [];
        lote.set(doc(collection(db, 'evaluaciones_proceso')), {
          tipoAuditoria: '5S',
          maquinaId: m.id,
          maquinaNombre: m.nombre,
          tipoMaquina: m.tipo,
          ordenTrabajo: 'N/A 5S',
          auditor: auditor.trim(),
          nominaAuditor: usuario?.nomina || '',
          nominaAuditado: nominaAuditado.trim(),
          nominaSupervisor: supervisorNomina || 'N/A',
          nombreSupervisor: sup ? sup.nombre : (supervisorNomina || 'N/A'),
          turno,
          cumplimiento: c.cumplimiento,
          totalSi: c.si,
          totalNo: c.no,
          fechaAuditoria: fecha,
          respuestas: resp[m.id] || {},
          puntosSoloReincidentes: reincM,
          hallazgos: suyos,
          itemsSnapshot: items,
          estadoFinal: c.no === 0 ? 'APROBADO' : 'CON_HALLAZGOS',
          // De qué revisión de área salió (SPEC-027).
          grupoArea: { id: grupoId, familia, maquinas: activas.map((x) => x.id) },
          createdAt: serverTimestamp()
        });

        const textosReinc = reincM
          .map((pid) => items.find((i) => i.id === pid))
          .filter(Boolean)
          .map((i) => `Sigue abierto: ${(i as PuntoChecklist).queObservar}`);
        const textos = suyos.map((h) => String(h.hallazgo || '').trim()).filter(Boolean).concat(textosReinc);
        if (textos.length && m.tipo !== 'Área Auxiliar' && m.nombreManto) {
          contextos.push({
            clave: m.id, equipo: m.nombreManto, naves: m.naves || [], nombre: m.nombre,
            tipo: '5S', fecha, auditor: auditor.trim(), hallazgos: textos
          });
        }
      });
      await lote.commit();
      onGuardado(contextos);
    } catch (e) {
      console.error('Error:', e);
      alert('Error al guardar en Firebase. No se guardó ninguna máquina; inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  /* ── Pantalla ── */

  const totalPuntos = items.length * activas.length;
  const totalResp = activas.reduce((s, m) => s + cuentaDe(m.id).respondidos, 0);

  return (
    <div>
      <div style={TARJETA}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
          <div style={{ width: '3px', height: '18px', background: '#d97706', borderRadius: '2px' }}></div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Auditoría de Condiciones de Equipo y 5S
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#002060' }}>{familia}</div>
            <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
              {activas.length} de {maquinas.length} {familia === 'Área Auxiliar' ? 'áreas' : 'máquinas'} · {items.length} puntos de inspección
            </div>
          </div>
          {totalPuntos > 0 && (
            <div style={{ textAlign: 'right', background: '#E8EEF8', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,53,128,0.2)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#003580', textTransform: 'uppercase' }}>Avance</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#002060' }}>{Math.round((totalResp / totalPuntos) * 100)}%</div>
              <div style={{ fontSize: '10px', color: '#5A6A80' }}>{totalResp} de {totalPuntos} respuestas</div>
            </div>
          )}
        </div>

        {/* Qué máquinas entran en esta revisión */}
        <div style={{ marginTop: '1rem', textAlign: 'left' }}>
          <div style={ETIQUETA}>{familia === 'Área Auxiliar' ? 'Áreas' : 'Máquinas'} que revisas (desmarca las que no):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {maquinas.map((m) => {
              const on = marcadas.includes(m.id);
              const c = cuentaDe(m.id);
              return (
                <button key={m.id} type="button" onClick={() => alternarMaquina(m.id)} title={m.nombre}
                  style={{
                    padding: '6px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    border: on ? '1.5px solid #003580' : '1.5px dashed rgba(0,32,96,0.25)',
                    background: on ? '#E8EEF8' : 'transparent', color: on ? '#002060' : '#8A9AB0',
                    textDecoration: on ? 'none' : 'line-through'
                  }}>
                  {on ? '✓ ' : ''}{etiquetaCorta(m)}
                  {on && items.length > 0 && (
                    <span style={{ fontWeight: 500, color: c.no ? '#C8102E' : '#5A6A80', marginLeft: '5px' }}>
                      {c.respondidos}/{items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '1.2rem', textAlign: 'left' }}>
          <div>
            <label style={ETIQUETA}>Auditor:</label>
            <input type="text" value={auditor} onChange={(e) => setAuditor(e.target.value)} style={ESTILO_INPUT} />
          </div>
          <div>
            <label style={ETIQUETA}>Nómina auditado:</label>
            <input type="text" placeholder="Ej. 1045" value={nominaAuditado} onChange={(e) => setNominaAuditado(e.target.value)} style={ESTILO_INPUT} />
          </div>
          <div>
            <label style={ETIQUETA}>Nombre del supervisor:</label>
            <select value={supervisorNomina} onChange={(e) => setSupervisorNomina(e.target.value)} style={{ ...ESTILO_INPUT, fontWeight: 600 }}>
              <option value="">{supervisores.length > 0 ? '-- Selecciona el supervisor --' : '-- Sin supervisor asignado (Pendiente) --'}</option>
              {supervisores.map((s) => <option key={s.nomina} value={s.nomina}>{s.nombre} (Nóm. {s.nomina})</option>)}
            </select>
          </div>
          <div>
            <label style={ETIQUETA}>Turno:</label>
            <select value={turno} onChange={(e) => setTurno(e.target.value)} style={ESTILO_INPUT}>
              <option>Matutino (6:00–14:00)</option>
              <option>Vespertino (14:00–21:30)</option>
              <option>Nocturno (21:30–6:00)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Checklist: cada punto con una lista Sí / No por máquina */}
      {items.length > 0 ? (
        <div style={TARJETA}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
            <div style={{ width: '3px', height: '18px', background: '#003580', borderRadius: '2px' }}></div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Puntos de inspección
            </div>
          </div>

          {activas.length === 0 ? (
            <div style={{ fontSize: '12.5px', color: '#5A6A80', padding: '10px 0' }}>Marca al menos una máquina arriba.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((item, idx) => {
                const hayNo = activas.some((m) => resp[m.id]?.[item.id] === 'NO');
                const todos = activas.every((m) => resp[m.id]?.[item.id]);
                const encabezado = idx === 0 || items[idx - 1].seccion !== item.seccion;
                return (
                  <React.Fragment key={item.id}>
                    {encabezado && (
                      <div style={{ background: '#E8EEF8', color: '#002060', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '.04em', marginTop: idx === 0 ? 0 : '14px', textAlign: 'left' }}>
                        {item.seccion}
                      </div>
                    )}
                    <div data-punto={item.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                      padding: '10px 14px', borderRadius: '8px',
                      border: hayNo ? '1.5px solid #C8102E' : '1.5px solid rgba(0,32,96,0.07)',
                      background: hayNo ? '#FDF3F5' : todos ? '#F1FAF6' : 'rgba(255,255,255,0.85)'
                    }}>
                      <div style={{ flex: '1 1 260px', textAlign: 'left', minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0D1A2E' }}>
                          {/* SPEC-025: la posición en la lista, no el identificador. */}
                          <span style={{ color: '#003580', marginRight: '6px' }}>#{idx + 1}</span>{item.queObservar}
                        </div>
                        <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
                          <strong>Verificación:</strong> {item.comoVerifica}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end', flex: '0 1 auto' }}>
                        {activas.map((m) => {
                          const v = resp[m.id]?.[item.id] || '';
                          const abierto = (soloReinc[m.id] || []).includes(item.id);
                          return (
                            <label key={m.id} title={m.nombre} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '74px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#5A6A80', whiteSpace: 'nowrap' }}>
                                {etiquetaCorta(m)}{abierto ? ' ⚠️' : ''}
                              </span>
                              <select
                                aria-label={`${etiquetaCorta(m)} · punto ${idx + 1}`}
                                value={v}
                                onChange={(e) => responder(m, item, e.target.value as Resp | '')}
                                style={{
                                  width: '74px', padding: '5px 4px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                                  cursor: 'pointer', outline: 'none',
                                  border: v === 'NO' ? '1.5px solid #C8102E' : v === 'SI' ? '1.5px solid #0F7A55' : '1px solid rgba(0,32,96,0.18)',
                                  background: v === 'NO' ? '#C8102E' : v === 'SI' ? '#0F7A55' : '#fff',
                                  color: v ? '#fff' : '#5A6A80'
                                }}>
                                <option value="">—</option>
                                <option value="SI">Sí</option>
                                <option value="NO">No</option>
                              </select>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...TARJETA, textAlign: 'left', padding: '16px 20px', background: '#f8fafc' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#002060', marginBottom: '4px' }}>Sin preguntas registradas para {familia}</div>
          <div style={{ fontSize: '12px', color: '#5A6A80', lineHeight: 1.5 }}>
            Configura los puntos desde el <strong>Editor de Plantillas</strong> o registra observaciones con <strong>"+ Agregar Hallazgo Extra"</strong>.
          </div>
        </div>
      )}

      {/* Hallazgos, cada uno con su máquina */}
      <div style={{ ...TARJETA, border: listaHallazgos.length ? '1.5px solid #C8102E' : TARJETA.border, background: listaHallazgos.length ? '#F9E8EB' : TARJETA.background }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '.75rem', borderBottom: '2px solid #E8EEF8' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: listaHallazgos.length ? '#7A0B1D' : '#003580', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Hallazgos y Acciones Correctivas ({listaHallazgos.length})
          </div>
          <button type="button" onClick={agregarExtra} disabled={!activas.length}
            style={{ background: '#003580', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            + Agregar Hallazgo Extra
          </button>
        </div>

        {listaHallazgos.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#5A6A80', textAlign: 'center', padding: '14px 10px' }}>
            No hay hallazgos registrados. Si en una máquina eliges «No» o agregas un hallazgo extra, aparecerá aquí.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {listaHallazgos.map(([k, h]) => {
              const m = maquinas.find((x) => x.id === h.maquinaId);
              const pos = h.puntoId ? items.findIndex((i) => i.id === h.puntoId) + 1 : 0;
              const it = h.puntoId ? items.find((i) => i.id === h.puntoId) : null;
              return (
                <div key={k} style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid rgba(200,16,46,0.25)', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#7A0B1D' }}>
                      {h.esExtra ? (
                        <span>⚠️ Hallazgo extra en{' '}
                          <select value={h.maquinaId} onChange={(e) => cambiarHallazgo(k, 'maquinaId', e.target.value)}
                            style={{ fontSize: '12px', fontWeight: 700, padding: '2px 4px', borderRadius: '5px', border: '1px solid rgba(200,16,46,0.35)' }}>
                            {activas.map((x) => <option key={x.id} value={x.id}>{etiquetaCorta(x)}</option>)}
                          </select>
                        </span>
                      ) : (
                        <span>{m ? etiquetaCorta(m) : h.maquinaId} · Punto #{pos}: {it?.queObservar}</span>
                      )}
                      {h.esReincidente && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#FDE8EB', color: '#C8102E', padding: '2px 6px', borderRadius: '4px' }}>(REINCIDENTE)</span>}
                    </div>
                    {h.esExtra && (
                      <button type="button" onClick={() => quitarHallazgo(k)} style={{ background: 'none', border: 'none', color: '#C8102E', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>✕ Eliminar</button>
                    )}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ ...ETIQUETA, fontSize: '11px' }}>Descripción del Hallazgo:</label>
                    <input type="text" value={h.hallazgo} onChange={(e) => cambiarHallazgo(k, 'hallazgo', e.target.value)} style={{ ...ESTILO_INPUT, fontSize: '12px', padding: '6px 10px' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                    <div>
                      <label style={{ ...ETIQUETA, fontSize: '11px' }}>Acción Correctiva Inmediata:</label>
                      <input type="text" value={h.accion} onChange={(e) => cambiarHallazgo(k, 'accion', e.target.value)} style={{ ...ESTILO_INPUT, fontSize: '12px', padding: '6px 10px' }} />
                    </div>
                    <div>
                      <label style={{ ...ETIQUETA, fontSize: '11px' }}>Responsable:</label>
                      <input type="text" value={h.responsable} onChange={(e) => cambiarHallazgo(k, 'responsable', e.target.value)} style={{ ...ESTILO_INPUT, fontSize: '12px', padding: '6px 10px' }} />
                    </div>
                    <div>
                      <label style={{ ...ETIQUETA, fontSize: '11px' }}>Fecha de Cierre:</label>
                      <input type="date" value={h.fechaCierre} onChange={(e) => cambiarHallazgo(k, 'fechaCierre', e.target.value)} style={{ ...ESTILO_INPUT, fontSize: '12px', padding: '6px 10px', background: '#fff' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancelar}
          style={{ padding: '11px 20px', background: 'transparent', border: '1.5px solid rgba(0,32,96,0.12)', color: '#003580', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button type="button" disabled={guardando} onClick={guardar}
          style={{ padding: '11px 28px', background: listaHallazgos.length ? '#C8102E' : '#003580', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: guardando ? 'not-allowed' : 'pointer' }}>
          {guardando ? 'Guardando…' : `Guardar revisión (${activas.length} ${activas.length === 1 ? 'registro' : 'registros'})`}
        </button>
      </div>

      {/* SPEC-022 por máquina: el punto ya había fallado en esa máquina */}
      {reinc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 32, 96, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
          <div style={{ background: '#fff', borderRadius: '18px', maxWidth: '540px', width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)' }}>
            <div style={{ padding: '1rem 1.3rem', borderBottom: '1px solid #E8EEF8', background: '#FFF7ED' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#9A3412' }}>Este punto ya había fallado</div>
              <div style={{ fontSize: '11.5px', color: '#9A3412', marginTop: '2px' }}>
                {reinc.maq.nombre} · {reinc.previos.length} vez{reinc.previos.length === 1 ? '' : 'es'} antes
              </div>
            </div>
            <div style={{ padding: '1.1rem 1.3rem', overflowY: 'auto', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1F2937', marginBottom: '8px' }}>{reinc.item.queObservar}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5A6A80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Lo que se levantó antes</div>
              <div style={{ marginBottom: '16px' }}>
                {reinc.previos.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} style={{ border: '1px solid #E8EEF8', borderLeft: '3px solid #FDBA74', borderRadius: '8px', padding: '8px 11px', marginBottom: '6px', background: '#FCFDFE' }}>
                    <div style={{ fontSize: '12px', color: '#1F2937', lineHeight: 1.4 }}>{p.hallazgo}</div>
                    <div style={{ fontSize: '11px', color: '#8A97A8', marginTop: '3px' }}>
                      {p.fechaAuditoria}{p.auditor ? ' · ' + p.auditor : ''}{p.estadoSeguimiento ? ' · ' + p.estadoSeguimiento : ''}
                    </div>
                  </div>
                ))}
                {reinc.previos.length > 5 && <div style={{ fontSize: '11.5px', color: '#8A97A8' }}>y {reinc.previos.length - 5} más</div>}
              </div>
              <div style={{ fontSize: '13px', color: '#1F2937', lineHeight: 1.5, marginBottom: '14px' }}>
                ¿Lo que estás viendo ahora es una desviación nueva, o es la misma que sigue sin resolverse?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => confirmarReinc(true)} style={{ width: '100%', padding: '11px 14px', border: 'none', borderRadius: '8px', background: '#C8102E', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                  Es una desviación nueva
                  <div style={{ fontSize: '11.5px', fontWeight: 400, opacity: 0.9, marginTop: '2px' }}>Se levanta un hallazgo marcado como reincidente</div>
                </button>
                <button onClick={() => confirmarReinc(false)} style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', background: '#fff', color: '#1F2937', border: '1px solid #D5DCE6', fontSize: '13px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                  Es la misma, sigue abierta
                  <div style={{ fontSize: '11.5px', fontWeight: 400, color: '#5A6A80', marginTop: '2px' }}>No se duplica el hallazgo; el punto queda marcado como pendiente de antes</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditoriaArea;
