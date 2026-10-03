import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { refrescarCatalogo } from './services/catalogo'

// SPEC-020: se le pregunta a Mantenimiento si el catálogo cambió. Va aquí, al
// margen del render, porque nadie lo espera: la app ya arrancó con el catálogo
// que tenía guardado y lo que se baje entra en la próxima apertura.
//
// Si falla, se anota en la consola y no pasa nada más. No hay pantalla que
// avisar ni estado que reintentar: el usuario sigue con la lista de ayer.
refrescarCatalogo().then((r) => {
  if (r.estado === 'actualizado') console.info('[catálogo] ' + r.total + ' registros desde Mantenimiento');
  else if (r.estado !== 'sin-cambios') console.warn('[catálogo] ' + r.estado + ': ' + (r.motivo || ''));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
