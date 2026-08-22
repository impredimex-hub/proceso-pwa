import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

const firebaseConfig = {
apiKey: "AIzaSyC0mjRHlg4R89KUafsCGpCk75nwosuKCzs",
  authDomain: "proceso-pwa.firebaseapp.com",
  databaseURL: "https://proceso-pwa-default-rtdb.firebaseio.com",
  projectId: "proceso-pwa",
  storageBucket: "proceso-pwa.firebasestorage.app",
  messagingSenderId: "969526934633",
  appId: "1:969526934633:web:153b81a2b696863c5c76f8"
};

// Inicializar Firebase App
const app = initializeApp(firebaseConfig);

// Habilitar caché persistente offline en IndexedDB (soporte multi-pestaña)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
