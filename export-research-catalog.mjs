import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---- Load service account key (same file you used before) ----
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

async function exportResearchCatalog() {
  // Adjust collection name here if yours is slightly different
  const colRef = db.collection("research_catalog");
  const snap = await colRef.get();

  const docs = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const outPath = "./research_catalog_export.json";
  fs.writeFileSync(outPath, JSON.stringify(docs, null, 2), "utf8");

  console.log(`Exported ${docs.length} docs → ${outPath}`);
}

exportResearchCatalog().catch((err) => {
  console.error("Export failed:", err);
});
