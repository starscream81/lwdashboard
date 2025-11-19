// src/lib/firebaseAdmin.ts

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import serviceAccount from "../../scripts/serviceAccountKey.json";

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount as any),
        databaseURL: "https://last-war-survival-tracker.firebaseio.com",
      });

// IMPORTANT: specify databaseId "(default)"
export const adminDb = getFirestore(adminApp, "(default)");

console.log("service account path test");
console.log("service account project", adminApp.options.projectId);
