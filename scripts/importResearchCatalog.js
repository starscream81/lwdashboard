// scripts/importResearchCatalog.js

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const admin = require("firebase-admin");

// 1. Load service account key from the same folder as this script
//    Make sure you have scripts/service-account-key.json present.
const serviceAccount = require("./service-account-key.json");

// 2. Init Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// 3. Small helper to slugify strings for doc ids
function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// 4. Load CSV from ../data/research_catalog_rows.csv
function loadCatalogCsv() {
  const csvPath = path.join(
    __dirname,
    "..",
    "data",
    "research_catalog_rows.csv"
  );

  console.log("Looking for CSV at:", csvPath);

  if (!fs.existsSync(csvPath)) {
    console.error("ERROR: CSV file not found:", csvPath);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath);
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Loaded ${records.length} rows from research_catalog_rows.csv`);
  return records;
}

// 5. Import into Firestore: collection "research_catalog"
async function importResearchCatalog() {
  const rows = loadCatalogCsv();

  let batch = db.batch();
  let batchCount = 0;
  let writeCount = 0;

  for (const row of rows) {
    const name = (row.name || "").trim();
    const category = (row.category || "").trim();

    if (!name || !category) {
      continue;
    }

    const maxLevelRaw = (row.max_level || "").trim();
    const orderIndexRaw = (row.order_index || "").trim();

    const maxLevel =
      maxLevelRaw && maxLevelRaw !== "" ? Number(maxLevelRaw) : 0;
    const orderIndex =
      orderIndexRaw && orderIndexRaw !== "" ? Number(orderIndexRaw) : null;

    // Stable doc id based on category + name
    const docId = `${slugify(category)}__${slugify(name)}`;

    const ref = db.collection("research_catalog").doc(docId);

    batch.set(ref, {
      name,
      category,
      maxLevel: isNaN(maxLevel) ? 0 : maxLevel,
      orderIndex: isNaN(orderIndex) ? null : orderIndex,
    });

    batchCount += 1;
    writeCount += 1;

    // Commit every 400 writes to avoid batch size limits
    if (batchCount >= 400) {
      await batch.commit();
      console.log(`Committed batch of ${batchCount} docs...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} docs...`);
  }

  console.log(`Import complete. Wrote ${writeCount} research_catalog docs.`);
}

// 6. Run
importResearchCatalog()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
