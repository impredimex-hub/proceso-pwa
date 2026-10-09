/**
 * Conexión a la base de Mantenimiento (SPEC-026).
 *
 * Esta app lee el catálogo de máquinas de Mantenimiento y levanta OT en su
 * base. Hasta ahora entraba con una sesión anónima, y esa sesión no decía
 * quién era la persona: las reglas de aquella base solo podían preguntar «¿hay
 * sesión?», y cualquiera con la configuración pública del proyecto la tenía.
 *
 * Ahora se pide una credencial al servicio `mantoapp-push` (Cloudflare). El
 * servicio comprueba la sesión de la suite, revisa en `colaboradores` que la
 * persona esté ACTIVA y tenga `procesos` en `apps`, y devuelve una credencial
 * de la base de Mantenimiento que lleva su nómina y `app: 'procesos'`.
 *
 * Con esa credencial las reglas de Mantenimiento dejan a esta app justo lo que
 * necesita y nada más:
 *
 *   - leer `catalogoVer`, `maquinas`, `zonas`, `abiertasPorMaquina`,
 *     `notificarA`, `urlApp` y `folioSig`;
 *   - apartar folio en `folioSig`;
 *   - **crear** una OT de auditoría a su propio nombre y su entrada en el
 *     índice. No puede modificar ni borrar OT existentes.
 *
 * Las mismas reglas no le dejan leer el resto de la base (OT completas,
 * personal, turnos), que antes cualquier sesión anónima podía descargar.
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { suiteAuth, nominaDeUsuario, APP_ID } from './suite';

/** Proyecto de la app de Mantenimiento. */
const CONFIG_MANTO = {
  apiKey: 'AIzaSyB6ZjPeh9bwY5d2M-ZpxIbEW3ZsLzhAz0M',
  authDomain: 'impredimex-mantoapp.firebaseapp.com',
  databaseURL: 'https://impredimex-mantoapp-default-rtdb.firebaseio.com',
  projectId: 'impredimex-mantoapp',
  storageBucket: 'impredimex-mantoapp.firebasestorage.app',
  messagingSenderId: '294064610592',
  appId: '1:294064610592:web:6a352dbf44ec6749898b45'
};

const NOMBRE_APP = 'manto';

/** El servicio que entrega la credencial y envía los avisos push. */
export const SERVICIO_MANTO = 'https://mantoapp-push.victormorenogarcia05.workers.dev/';

/**
 * Una credencial se renueva al pasar este tiempo. Las reglas la rechazan a
 * los 7 días; renovarla mucho antes hace que un cambio en RRHH (baja, quitar
 * el acceso) se note en la siguiente apertura y no una semana después.
 */
const RENOVAR_TRAS_MS = 12 * 60 * 60 * 1000;

const app = () =>
  getApps().some((a) => a.name === NOMBRE_APP)
    ? getApp(NOMBRE_APP)
    : initializeApp(CONFIG_MANTO, NOMBRE_APP);

/** Solo una petición de credencial a la vez, aunque la pidan dos pantallas. */
let enCurso: Promise<void> | null = null;

/** Mientras la persona no cambie, la credencial vigente sirve. */
const credencialVigente = async (nomina: string): Promise<boolean> => {
  const u = getAuth(app()).currentUser;
  if (!u || u.isAnonymous || u.uid !== 'n' + nomina) return false;
  try {
    const r = await u.getIdTokenResult();
    const emitida = Number(r.claims.emitida) * 1000;
    return r.claims.app === APP_ID && Number.isFinite(emitida) && Date.now() - emitida < RENOVAR_TRAS_MS;
  } catch {
    return false;
  }
};

const pedirCredencial = async (): Promise<void> => {
  const usuario = suiteAuth.currentUser;
  if (!usuario) throw new Error('no hay sesión de la suite');
  const nomina = nominaDeUsuario(usuario) || '';
  if (await credencialVigente(nomina)) return;

  const idToken = await usuario.getIdToken();
  let r: Response;
  try {
    r = await fetch(SERVICIO_MANTO + 'credencial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, app: APP_ID })
    });
  } catch (e) {
    throw new Error('no se pudo contactar el servicio de credenciales: ' +
      (e instanceof Error ? e.message : 'sin respuesta'));
  }
  let datos: { token?: string; error?: string } = {};
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok || !datos.token) {
    throw new Error(datos.error || `el servicio de credenciales respondió ${r.status}`);
  }
  await signInWithCustomToken(getAuth(app()), datos.token);
};

/**
 * La base de Mantenimiento, con la credencial de quien tiene la sesión de la
 * suite. Lanza si no hay sesión o si el servicio la niega.
 */
export const conectarManto = async (): Promise<Database> => {
  if (!enCurso) enCurso = pedirCredencial().finally(() => { enCurso = null; });
  await enCurso;
  return getDatabase(app());
};

/**
 * Cabecera para el servicio de avisos: demuestra quién manda el push. Sin
 * ella el servicio lo rechaza.
 */
export const cabeceraDeSesion = async (): Promise<Record<string, string>> => {
  const u = suiteAuth.currentUser;
  if (!u) return {};
  try {
    return { Authorization: 'Bearer ' + (await u.getIdToken()) };
  } catch {
    return {};
  }
};

// Al cerrar la sesión de la suite se cierra también la de Mantenimiento, para
// que la siguiente persona en el mismo equipo no herede la credencial.
onAuthStateChanged(suiteAuth, (u) => {
  if (!u) signOut(getAuth(app())).catch(() => { /* ya estaba cerrada */ });
});
