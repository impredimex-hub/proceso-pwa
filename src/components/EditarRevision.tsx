/**
 * Corregir los datos de una revisión ya guardada (SPEC-032). Solo
 * administradores.
 *
 * Sirve para errores de captura como elegir al supervisor equivocado. Se
 * corrigen auditor, supervisor, auditado, turno y, en Proceso, la orden de
 * trabajo. Las respuestas y los hallazgos no se tocan aquí: cambiarlos
 * alteraría el cumplimiento y la historia de cada punto.
 *
 * Cada corrección queda anotada en `ediciones` con quién, cuándo y qué cambió.
 */
import React, { useState } from 'react';
import { arrayUnion, doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Persona { nomina: string; nombre: string }

interface Props {
  auditoria: any;
  /** Otras máquinas guardadas en la misma revisión por área (SPEC-027). */
  hermanas: any[];
  usuarios: Persona[];
  /** Los responsables de esa máquina; se listan primero. */
  sugeridos: Persona[];
  editor: { nomina: string; nombre: string };
  onGuardado: (cambios: Record<string, string>) => void;
}

const TURNOS = ['Matutino (6:00–14:00)', 'Vespertino (14:00–21:30)', 'Nocturno (21:30–6:00)'];
const INPUT: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid rgba(0, 32, 96, 0.15)', borderRadius: '8px',
  background: '#fff', color: '#0D1A2E', fontSize: '12.5px', width: '100%', boxSizing: 'border-box'
};
const ETQ: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#5A6A80', marginBottom: '3px' };

const EditarRevision: React.FC<Props> = ({ auditoria: a, hermanas, usuarios, sugeridos, editor, onGuardado }) => {
  const [abierto, setAbierto] = useState(false);
  const [nominaAuditor, setNominaAuditor] = useState<string>(String(a.nominaAuditor || ''));
  const [supervisor, setSupervisor] = useState<string>(a.nominaSupervisor && a.nominaSupervisor !== 'N/A' ? String(a.nominaSupervisor) : '');
  const [auditado, setAuditado] = useState<string>(String(a.nominaAuditado || ''));
  const [turno, setTurno] = useState<string>(a.turno || TURNOS[0]);
  const [op, setOp] = useState<string>(a.ordenTrabajo || '');
  const [todas, setTodas] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const gente = [...usuarios].sort((x, y) => x.nombre.localeCompare(y.nombre));
  const otros = gente.filter((u) => !sugeridos.some((s) => s.nomina === u.nomina));
  const nombreDe = (n: string) => gente.find((u) => u.nomina === n)?.nombre || '';

  const guardar = async () => {
    const cambios: Record<string, string> = {};
    const antes: Record<string, string> = {};
    const poner = (campo: string, nuevo: string, viejo: string) => {
      if (nuevo !== viejo) { cambios[campo] = nuevo; antes[campo] = viejo; }
    };
    if (nominaAuditor && nominaAuditor !== String(a.nominaAuditor || '')) {
      poner('nominaAuditor', nominaAuditor, String(a.nominaAuditor || ''));
      poner('auditor', nombreDe(nominaAuditor) || a.auditor, String(a.auditor || ''));
    }
    if (supervisor !== (a.nominaSupervisor === 'N/A' ? '' : String(a.nominaSupervisor || ''))) {
      poner('nominaSupervisor', supervisor || 'N/A', String(a.nominaSupervisor || ''));
      poner('nombreSupervisor', supervisor ? nombreDe(supervisor) || supervisor : 'N/A', String(a.nombreSupervisor || ''));
    }
    poner('nominaAuditado', auditado.trim(), String(a.nominaAuditado || ''));
    poner('turno', turno, String(a.turno || ''));
    if (a.tipoAuditoria === 'PROCESO') poner('ordenTrabajo', op.trim(), String(a.ordenTrabajo || ''));

    if (!Object.keys(cambios).length) { setAbierto(false); return; }
    if (!supervisor && !auditado.trim()) {
      alert('Hace falta el supervisor o la nómina del auditado: sin ninguno, los hallazgos no le aparecerían a nadie.');
      return;
    }

    // En las demás máquinas de la misma revisión solo se replican los campos
    // comunes; la orden de trabajo es propia de cada una.
    const comunes = Object.fromEntries(Object.entries(cambios).filter(([k]) => k !== 'ordenTrabajo'));
    const destino = todas && hermanas.length && Object.keys(comunes).length ? hermanas : [];

    setGuardando(true);
    try {
      const lote = writeBatch(db);
      const nota = (c: Record<string, string>, x: any) => ({
        fecha: new Date().toISOString(), porNomina: editor.nomina, porNombre: editor.nombre,
        cambios: c, antes: Object.fromEntries(Object.keys(c).map((k) => [k, String(x[k] ?? '')]))
      });
      lote.update(doc(db, 'evaluaciones_proceso', a.id), { ...cambios, ediciones: arrayUnion(nota(cambios, a)) });
      destino.forEach((h) => {
        lote.update(doc(db, 'evaluaciones_proceso', h.id), { ...comunes, ediciones: arrayUnion(nota(comunes, h)) });
      });
      await lote.commit();
      setAbierto(false);
      onGuardado(cambios);
      alert(`✅ Revisión corregida${destino.length ? ` (y ${destino.length} máquina${destino.length === 1 ? '' : 's'} más de la misma revisión)` : ''}.`);
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar la corrección. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const ediciones: any[] = Array.isArray(a.ediciones) ? a.ediciones : [];

  return (
    <div style={{ marginBottom: '14px' }}>
      {!abierto ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#8A9AB0' }}>
            {ediciones.length > 0 && `Corregida ${ediciones.length} vez${ediciones.length === 1 ? '' : 'es'} · última por ${ediciones[ediciones.length - 1].porNombre || ediciones[ediciones.length - 1].porNomina}`}
          </span>
          <button type="button" onClick={() => setAbierto(true)}
            style={{ background: '#fff', color: '#003580', border: '1.5px solid #003580', padding: '6px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}>
            ✏️ Corregir datos de la revisión
          </button>
        </div>
      ) : (
        <div style={{ background: '#F8FAFD', border: '1.5px solid #003580', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#002060', marginBottom: '10px' }}>
            Corregir datos de la revisión <span style={{ fontWeight: 500, color: '#5A6A80' }}>· solo administradores</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
            <div>
              <label style={ETQ}>Supervisor:</label>
              <select value={supervisor} onChange={(e) => setSupervisor(e.target.value)} style={{ ...INPUT, fontWeight: 600 }}>
                <option value="">— Sin supervisor —</option>
                {sugeridos.length > 0 && (
                  <optgroup label="Responsables de esta máquina">
                    {sugeridos.map((u) => <option key={u.nomina} value={u.nomina}>{u.nombre} (Nóm. {u.nomina})</option>)}
                  </optgroup>
                )}
                <optgroup label="Todas las personas">
                  {otros.map((u) => <option key={u.nomina} value={u.nomina}>{u.nombre} (Nóm. {u.nomina})</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label style={ETQ}>Auditor:</label>
              <select value={nominaAuditor} onChange={(e) => setNominaAuditor(e.target.value)} style={INPUT}>
                {!a.nominaAuditor && <option value="">{a.auditor || '—'} (sin nómina)</option>}
                {gente.map((u) => <option key={u.nomina} value={u.nomina}>{u.nombre} (Nóm. {u.nomina})</option>)}
              </select>
            </div>
            <div>
              <label style={ETQ}>Nómina auditado:</label>
              <input type="text" value={auditado} onChange={(e) => setAuditado(e.target.value)} style={INPUT} />
            </div>
            <div>
              <label style={ETQ}>Turno:</label>
              <select value={turno} onChange={(e) => setTurno(e.target.value)} style={INPUT}>
                {(TURNOS.includes(turno) ? TURNOS : [turno, ...TURNOS]).map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            {a.tipoAuditoria === 'PROCESO' && (
              <div>
                <label style={ETQ}>Orden de trabajo (OP):</label>
                <input type="text" value={op} onChange={(e) => setOp(e.target.value)} style={INPUT} />
              </div>
            )}
          </div>

          {hermanas.length > 0 && (
            <label style={{ display: 'flex', gap: '7px', alignItems: 'center', marginTop: '10px', fontSize: '12px', color: '#002060', cursor: 'pointer' }}>
              <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
              Aplicar también a las otras {hermanas.length} máquina{hermanas.length === 1 ? '' : 's'} de esta revisión ({hermanas.map((h) => String(h.maquinaNombre || '').split(' (')[0]).join(', ')})
            </label>
          )}

          <div style={{ fontSize: '11px', color: '#8A9AB0', marginTop: '8px' }}>
            Las respuestas y los hallazgos no se modifican. La corrección queda registrada con tu nombre.
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="button" onClick={() => setAbierto(false)} disabled={guardando}
              style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.15)', color: '#5A6A80', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando}
              style={{ background: '#003580', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: guardando ? 'not-allowed' : 'pointer' }}>
              {guardando ? 'Guardando…' : 'Guardar corrección'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditarRevision;
