/**
 * La fecha compromiso de un hallazgo (SPEC-034).
 *
 * La pone el auditado una sola vez; ya fijada, solo un administrador la
 * cambia. Vive fuera de App para que la fecha que se está eligiendo no se
 * pierda cuando la pantalla se vuelve a pintar.
 */
import React, { useState } from 'react';

interface Props {
  fechaCierre: string;
  fijada: boolean;
  quienFijo: string;
  vencido: boolean;
  diasVencido: number;
  editable: boolean;
  esAdmin: boolean;
  hoy: string;
  onFijar: (fecha: string) => void;
}

const CeldaCompromiso: React.FC<Props> = ({ fechaCierre, fijada, quienFijo, vencido, diasVencido, editable, esAdmin, hoy, onFijar }) => {
  const [fecha, setFecha] = useState(fechaCierre || '');

  if (!editable) {
    return (
      <>
        <span title={quienFijo ? `Fijada por ${quienFijo}` : ''} style={{ fontWeight: 700, color: vencido ? '#C8102E' : '#7A4500' }}>
          {fechaCierre || '—'}
        </span>
        {!fechaCierre && <div style={{ fontSize: '9px', color: '#8A9AB0' }}>La pone el auditado</div>}
        {vencido && <div style={{ fontSize: '9px', color: '#C8102E', fontWeight: 700 }}>{diasVencido} días tarde</div>}
        {fijada && <div style={{ fontSize: '9px', color: '#8A9AB0' }} title={quienFijo ? `Fijada por ${quienFijo}` : ''}>🔒 fijada</div>}
      </>
    );
  }

  const sinCambio = !fecha || (fijada && fecha === fechaCierre);
  const fijar = () => {
    if (!fecha) return;
    const msg = esAdmin
      ? `¿Poner ${fecha} como fecha compromiso?`
      : `¿Fijar ${fecha} como fecha compromiso?\n\nUna vez fijada, solo un administrador puede cambiarla.`;
    if (window.confirm(msg)) onFijar(fecha);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
      <input type="date" value={fecha} min={esAdmin ? undefined : hoy}
        onChange={(e) => setFecha(e.target.value)} aria-label="Fecha compromiso"
        style={{ fontSize: '11px', padding: '3px 5px', border: '1px solid ' + (fijada ? 'rgba(0,32,96,0.2)' : '#D4840A'), borderRadius: '5px' }} />
      <button type="button" onClick={fijar} disabled={sinCambio}
        style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: sinCambio ? 'default' : 'pointer',
          background: '#003580', color: '#fff', opacity: sinCambio ? 0.4 : 1 }}>
        {fijada ? 'Cambiar' : 'Fijar'}
      </button>
      {fijada && <div style={{ fontSize: '9px', color: '#8A9AB0' }} title={quienFijo ? `Fijada por ${quienFijo}` : ''}>🔒 {quienFijo ? quienFijo.split(' ')[0] : 'fijada'}</div>}
      {vencido && <div style={{ fontSize: '9px', color: '#C8102E', fontWeight: 700 }}>{diasVencido} días tarde</div>}
    </div>
  );
};

export default CeldaCompromiso;
