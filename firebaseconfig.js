
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBZeQN1FRZMp-XalbJYAmCqJmeHqG9oU3k",
  authDomain: "queuegoo.firebaseapp.com",
  projectId: "queuegoo",
  storageBucket: "queuegoo.firebasestorage.app",
  messagingSenderId: "38327156962",
  appId: "1:38327156962:web:190958a36856a3ca4cdebb",
  measurementId: "G-N7EJ26ZWRZ"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
