// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBSP0tG1M7GP82TRw5zG3livqbJxKbSnTc",
  authDomain: "last-war-survival-tracker.firebaseapp.com",
  projectId: "last-war-survival-tracker",
  storageBucket: "last-war-survival-tracker.firebasestorage.app",
  messagingSenderId: "758472296619",
  appId: "1:758472296619:web:9287a8eeb3307c0fbc0fee",
  measurementId: "G-M23DGV8VH1"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
