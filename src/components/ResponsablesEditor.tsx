/**
 * Responsables por máquina o área (SPEC-031). Solo administradores.
 *
 * Los responsables son quienes aparecen en «Nombre del supervisor» al auditar
 * y a quienes les llegan los hallazgos en Comportamiento. Cada cambio se guarda
 * al momento en `configuracion/responsables`.
 */
import React, { useMemo, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Maq { id: string; nombre: string; tipo: string; moduloProceso: boolean; modulo5S: boolean; esZona?: boolean }
interface Persona { nomina: string; nombre: string; puesto?: string }

interface Props {
  catalogo: Maq[];
  usuarios: Persona[];
  responsablesDe: (m: Maq) => string[];
  editor: { nomina: string; nombre: string };
  onVolver: () => void;
}

const INPUT: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid rgba(0, 32, 96, 0.15)', borderRadius: '8px',
  background: '#fff', color: '#0D1A2E', fontSize: '12.5px', boxSizing: 'border-box', width: '100%'
};
const TARJETA: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.92)', borderRadius: '16px', border: '1px solid rgba(0,32,96,0.06)',
  boxShadow: '0 2px 8px rgba(0,32,96,.06), 0 8px 24px rgba(0,32,96,.08)', padding: '1.2rem', marginBottom: '1rem', textAlign: 'left'
};

const ResponsablesEditor: React.FC<Props> = ({ catalogo, usuarios, responsablesDe, editor, onVolver }) => {
  const familias = useMemo(() => Array.from(new Set(catalogo.map((m) => m.tipo))).sort((a, b) => a.localeCompare(b)), [catalogo]);
  const [familia, setFamilia] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  const gente = useMemo(() => [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre)), [usuarios]);
  const nombreDe = (n: string) => gente.find((u) => u.nomina === n)?.nombre || `Nómina ${n}`;
  const maquinas = catalogo.filter((m) => m.tipo === familia);
  const sinResponsable = catalogo.filter((m) => responsablesDe(m).length === 0);

  const guardar = async (cambios: Record<string, string[]>) => {
    setGuardando(Object.keys(cambios).join(','));
    setAviso('');
    try {
      await setDoc(doc(db, 'configuracion', 'responsables'), {
        porMaquina: cambios,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: editor.nomina
      }, { merge: true });
      setAviso('✓ Guardado');
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(null);
    }
  };

  const agregar = (m: Maq, nomina: string) => {
    if (!nomina) return;
    const actual = responsablesDe(m);
    if (actual.includes(nomina)) return;
    guardar({ [m.id]: [...actual, nomina] });
  };
  const quitar = (m: Maq, nomina: string) =>
    guardar({ [m.id]: responsablesDe(m).filter((x) => x !== nomina) });
  const agregarATodas = (nomina: string) => {
    if (!nomina) return;
    const cambios: Record<string, string[]> = {};
    maquinas.forEach((m) => {
      const actual = responsablesDe(m);
      if (!actual.includes(nomina)) cambios[m.id] = [...actual, nomina];
    });
    if (Object.keys(cambios).length) guardar(cambios);
  };

  return (
    <div>
      <div style={{ ...TARJETA, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#002060' }}>Responsables por máquina o área</div>
          <div style={{ fontSize: '11px', color: '#5A6A80', marginTop: '2px' }}>
            Aparecen como supervisor al auditar y reciben sus hallazgos en Comportamiento. Cada cambio se guarda al momento.
          </div>
        </div>
        <button onClick={onVolver} style={{ background: 'transparent', border: '1px solid rgba(0,32,96,0.12)', color: '#003580', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          Volver
        </button>
      </div>

      <div style={TARJETA}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#002060', marginBottom: '6px' }}>Proceso o área:</label>
        <select value={familia} onChange={(e) => { setFamilia(e.target.value); setAviso(''); }} style={{ ...INPUT, fontSize: '14px', fontWeight: 600, maxWidth: '420px' }}>
          <option value="">-- Elige --</option>
          {familias.map((f) => {
            const faltan = catalogo.filter((m) => m.tipo === f && responsablesDe(m).length === 0).length;
            return <option key={f} value={f}>{f}{faltan ? `  (${faltan} sin responsable)` : ''}</option>;
          })}
        </select>
        {!familia && sinResponsable.length > 0 && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#9A3412', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: '8px', padding: '8px 11px' }}>
            Sin responsable: {sinResponsable.map((m) => m.nombre).join(', ')}.
          </div>
        )}
        <div style={{ fontSize: '11px', color: '#8A9AB0', marginTop: '8px' }}>
          Solo aparecen personas con acceso a esta app. Si falta alguien, dale acceso a «procesos» en la llave del Directorio de RRHH.
        </div>
      </div>

      {familia && (
        <div style={TARJETA}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #E8EEF8' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#003580', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {familia} · {maquinas.length} {maquinas.every((m) => m.esZona) ? 'área(s)' : 'máquina(s)'}
              {aviso && <span style={{ marginLeft: '10px', color: '#0F7A55', textTransform: 'none', letterSpacing: 0 }}>{aviso}</span>}
            </div>
            {maquinas.length > 1 && (
              <select value="" onChange={(e) => agregarATodas(e.target.value)} disabled={!!guardando} style={{ ...INPUT, width: 'auto', maxWidth: '100%' }}>
                <option value="">+ Agregar a todas…</option>
                {gente.map((u) => <option key={u.nomina} value={u.nomina}>{u.nombre} · {u.nomina}</option>)}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {maquinas.map((m) => {
              const lista = responsablesDe(m);
              return (
                <div key={m.id} data-maquina={m.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', border: '1px solid rgba(0,32,96,0.08)', borderRadius: '10px', background: lista.length ? '#fff' : '#FFFBF5' }}>
                  <div style={{ flex: '0 1 220px', minWidth: 0, fontWeight: 700, color: '#002060', fontSize: '12.5px' }}>{m.nombre}</div>
                  <div style={{ flex: '1 1 260px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    {lista.length === 0 && <span style={{ fontSize: '11.5px', color: '#9A3412' }}>Sin responsable</span>}
                    {lista.map((n) => (
                      <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E8EEF8', color: '#002060', borderRadius: '14px', padding: '4px 6px 4px 10px', fontSize: '11.5px', fontWeight: 600 }}>
                        {nombreDe(n)}
                        <button type="button" title="Quitar" onClick={() => quitar(m, n)} disabled={!!guardando}
                          style={{ border: 'none', background: 'rgba(0,32,96,0.12)', color: '#002060', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', lineHeight: '18px', padding: 0, cursor: 'pointer' }}>✕</button>
                      </span>
                    ))}
                    <select value="" onChange={(e) => agregar(m, e.target.value)} disabled={!!guardando}
                      aria-label={`Agregar responsable a ${m.nombre}`}
                      style={{ ...INPUT, width: 'auto', maxWidth: '100%', padding: '5px 8px', fontSize: '11.5px' }}>
                      <option value="">+ Agregar</option>
                      {gente.filter((u) => !lista.includes(u.nomina)).map((u) => <option key={u.nomina} value={u.nomina}>{u.nombre} · {u.nomina}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsablesEditor;
