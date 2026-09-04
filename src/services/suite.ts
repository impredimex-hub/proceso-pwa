// Conexión al proyecto Impredimex-suite.
//
// Esta app habla con DOS proyectos de Firebase a la vez:
//   - proceso-pwa      (services/firebase.ts) → sus evaluaciones, plantillas y checklists
//   - impredimex-suite (este archivo)         → el login y la lista de personal
//
// Por eso la app se inicializa con un nombre ('suite'). Sin ese nombre las dos
// configuraciones se pisarían entre sí.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

const suiteConfig = {
  apiKey: 'AIzaSyBAfEAWPYCdt_7kN1uHqTmPiRHIn6BgOyo',
  authDomain: 'impredimex-suite.firebaseapp.com',
  projectId: 'impredimex-suite',
  storageBucket: 'impredimex-suite.firebasestorage.app',
  messagingSenderId: '272151508788',
  appId: '1:272151508788:web:df68c90faa8cc1996cd761',
};

const suiteApp = getApps().some((a) => a.name === 'suite')
  ? getApp('suite')
  : initializeApp(suiteConfig, 'suite');

export const suiteDb = getFirestore(suiteApp);
export const suiteAuth = getAuth(suiteApp);

/** Identificador de esta app dentro del campo `apps` de cada colaborador. */
export const APP_ID = 'procesos';

/** Dominio interno. No existe de verdad: solo sirve para armar un identificador único. */
const DOMINIO = '@impredimex.local';

export interface Colaborador {
  noNomina: string;
  nombreCompleto: string;
  departamento: string;
  puesto: string;
  estatus: string;
  apps: string[];
  /** Papel de la persona dentro de cada app: { epp: 'ADMIN', procesos: 'SUPERVISOR' } */
  roles?: Record<string, string>;
  rol?: string;   // heredado de la carga inicial; sustituido por `roles`
}

export const nominaACorreo = (nomina: string) => `${nomina.trim()}${DOMINIO}`;

export const nominaDeUsuario = (user: User | null) =>
  user?.email ? user.email.split('@')[0] : null;

export const entrar = (nomina: string, clave: string) =>
  signInWithEmailAndPassword(suiteAuth, nominaACorreo(nomina), clave);

export const salir = () => signOut(suiteAuth);

export const alCambiarSesion = (cb: (user: User | null) => void) =>
  onAuthStateChanged(suiteAuth, cb);

/** Trae el documento de una persona. Devuelve null si no existe. */
export async function traerColaborador(nomina: string): Promise<Colaborador | null> {
  const snap = await getDoc(doc(suiteDb, 'colaboradores', nomina));
  return snap.exists() ? ({ noNomina: snap.id, ...snap.data() } as Colaborador) : null;
}

/** Trae a todos los que tienen acceso a esta app y están activos. */
export async function traerUsuariosDeLaApp(): Promise<Colaborador[]> {
  const q = query(
    collection(suiteDb, 'colaboradores'),
    where('apps', 'array-contains', APP_ID),
    where('estatus', '==', 'ACTIVO'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ noNomina: d.id, ...d.data() }) as Colaborador)
    .sort((a, b) => Number(a.noNomina) - Number(b.noNomina));
}

/** Traduce el error técnico de Firebase a algo que un supervisor entienda. */
export function mensajeDeError(codigo: string): string {
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Nómina o clave incorrecta.';
    case 'auth/invalid-email':
      return 'Ese número de nómina no tiene un formato válido.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espera unos minutos.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu red e inténtalo otra vez.';
    default:
      return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
}
