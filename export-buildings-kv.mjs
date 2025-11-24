import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---- Load service account key manually (works everywhere) ----
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);

// ---- Initialize Admin SDK ----
initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

// ---- Firestore ----
const db = getFirestore();

// ---- SET YOUR UID HERE ----
const UID = "6FGO4OpqkdbA34amGS4Y8ZwuHWX2";

async function exportBuildingsKvForUser(uid) {
  const colRef = db.collection("users").doc(uid).collection("buildings_kv");
  const snap = await colRef.get();

  const docs = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const outPath = `./buildings_kv_${uid}.json`;
  fs.writeFileSync(outPath, JSON.stringify(docs, null, 2), "utf8");

  console.log(`Exported ${docs.length} docs → ${outPath}`);
}

exportBuildingsKvForUser(UID).catch((err) => {
  console.error("Export failed:", err);
});
