import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC0mjRHlg4R89KUafsCGpCk75nwosuKCzs",
  authDomain: "proceso-pwa.firebaseapp.com",
  databaseURL: "https://proceso-pwa-default-rtdb.firebaseio.com",
  projectId: "proceso-pwa",
  storageBucket: "proceso-pwa.firebasestorage.app",
  messagingSenderId: "969526934633",
  appId: "1:969526934633:web:153b81a2b696863c5c76f8"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
