// src/lib/firebaseAdmin.ts

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

console.log("service account path test");

// Adjust this path if your JSON file has a slightly different name or location
// This assumes: project-root/scripts/service-account-key.json
// and this file is at: project-root/src/lib/firebaseAdmin.ts
import serviceAccount from "../../scripts/serviceAccountKey.json";

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount as any),
      });

export const adminDb = getFirestore(adminApp);
