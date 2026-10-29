import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import config from "./firebase-config.json";

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(config);
export const auth = getAuth(firebaseApp);
