import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Original DB (chafe-ai) for Rooms
const configRooms = {
  apiKey: "AIzaSyCqCDgsPCEveFtk0zNJhKThLMgZkFJOF9s",
  authDomain: "chafe-ai.firebaseapp.com",
  projectId: "chafe-ai",
  storageBucket: "chafe-ai.firebasestorage.app",
  messagingSenderId: "26484866185",
  appId: "1:26484866185:web:e0122147b758f758e15a58",
  measurementId: "G-9Z7BCEB950"
};

// New DB (chafe-2026) for Motos
const configMotos = {
  apiKey: "AIzaSyCTeiJTMlOMh9N_7uzVh9DN1xZvSK5Ja2c",
  authDomain: "chafe-2026.firebaseapp.com",
  projectId: "chafe-2026",
  storageBucket: "chafe-2026.firebasestorage.app",
  messagingSenderId: "222708339754",
  appId: "1:222708339754:web:6f4f23c49aaeeae5935f53"
};

const appRooms = !getApps().length ? initializeApp(configRooms) : getApp();
const appMotos = getApps().find(a => a.name === "motosApp") || initializeApp(configMotos, "motosApp");

export const dbRooms = getFirestore(appRooms);
export const dbMotos = getFirestore(appMotos);
