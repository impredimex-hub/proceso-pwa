/**
 * El compromiso del auditado sobre un hallazgo: qué va a hacer y para cuándo
 * (SPEC-034 y SPEC-035).
 *
 * Lo pone el auditado una sola vez, acción y fecha juntas; ya fijado, solo un
 * administrador lo cambia. Vive fuera de App para que lo que se está
 * escribiendo no se pierda cuando la pantalla se vuelve a pintar.
 */
import React, { useState } from 'react';

interface Props {
  accion: string;
  fechaCierre: string;
  fijada: boolean;
  quienFijo: string;
  vencido: boolean;
  diasVencido: number;
  editable: boolean;
  esAdmin: boolean;
  hoy: string;
  onFijar: (accion: string, fecha: string) => void;
}

const CeldaCompromiso: React.FC<Props> = ({ accion, fechaCierre, fijada, quienFijo, vencido, diasVencido, editable, esAdmin, hoy, onFijar }) => {
  const [texto, setTexto] = useState(accion || '');
  const [fecha, setFecha] = useState(fechaCierre || '');
  const [abierto, setAbierto] = useState(false);

  const colorFecha = vencido ? '#C8102E' : '#7A4500';
  const resumen = (
    <div style={{ minWidth: 0 }}>
      <div title={accion} style={{
        fontSize: '11px', color: accion ? '#0D1A2E' : '#8A9AB0', lineHeight: 1.35,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {accion || (fijada ? 'Sin acción registrada' : 'Pendiente: la pone el auditado')}
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', flexWrap: 'wrap', marginTop: '2px' }}>
        <span style={{ fontWeight: 700, fontSize: '11px', color: colorFecha }}>{fechaCierre || '—'}</span>
        {vencido && <span style={{ fontSize: '9px', color: '#C8102E', fontWeight: 700 }}>{diasVencido} días tarde</span>}
        {fijada && <span style={{ fontSize: '9px', color: '#8A9AB0' }} title={quienFijo ? `Fijado por ${quienFijo}` : ''}>🔒 {quienFijo ? quienFijo.split(' ')[0] : ''}</span>}
      </div>
    </div>
  );

  if (!editable) return resumen;

  // Cerrado mientras no se edita: así cada renglón ocupa dos líneas y el Gantt
  // no se amontona. Solo se despliega el que se está llenando.
  if (!abierto) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {resumen}
        <button type="button" onClick={() => setAbierto(true)}
          style={{ flexShrink: 0, fontSize: '9.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', cursor: 'pointer',
            border: fijada ? '1px solid #003580' : 'none', background: fijada ? '#fff' : '#D4840A', color: fijada ? '#003580' : '#fff' }}>
          {fijada ? 'Cambiar' : 'Registrar'}
        </button>
      </div>
    );
  }

  const listo = texto.trim() && fecha;
  const guardar = () => {
    if (!listo) { alert('Escribe la acción correctiva y elige la fecha compromiso.'); return; }
    const msg = esAdmin
      ? `¿Guardar la acción y la fecha ${fecha}?`
      : `¿Comprometerte a «${texto.trim()}» para el ${fecha}?\n\nUna vez registrado, solo un administrador puede cambiarlo.`;
    if (window.confirm(msg)) { onFijar(texto.trim(), fecha); setAbierto(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', background: '#FFF8EC', border: '1px solid #F2C27A', borderRadius: '8px', padding: '7px' }}>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={300}
        placeholder="¿Qué vas a hacer para corregirlo?" aria-label="Acción correctiva"
        style={{ fontSize: '11px', padding: '5px 7px', border: '1px solid rgba(0,32,96,0.2)', borderRadius: '5px', resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={fecha} min={esAdmin ? undefined : hoy} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha compromiso"
          style={{ fontSize: '11px', padding: '3px 5px', border: '1px solid rgba(0,32,96,0.2)', borderRadius: '5px' }} />
        <button type="button" onClick={guardar}
          style={{ fontSize: '10px', fontWeight: 800, padding: '4px 9px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: '#003580', color: '#fff', opacity: listo ? 1 : 0.45 }}>
          Guardar
        </button>
        <button type="button" onClick={() => { setAbierto(false); setTexto(accion || ''); setFecha(fechaCierre || ''); }}
          style={{ fontSize: '10px', fontWeight: 600, padding: '4px 7px', borderRadius: '4px', border: '1px solid rgba(0,32,96,0.15)', background: '#fff', color: '#5A6A80', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default CeldaCompromiso;
