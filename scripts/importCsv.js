// importCsv.js
// One-off importer to move your CSV data into Firestore.
// Safe to run multiple times; it uses deterministic IDs and merge writes.

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const admin = require("firebase-admin");

// 1. Initialize Firebase Admin with your service account
const serviceAccount = require("./service-account-key.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Map from old Supabase owner_id -> new Firebase UID.
// For now you can leave this empty; later we will fill it with real mappings like:
// "SUPABASE_OWNER_ID": "6FGO4OpqkdbA34amGS4Y8ZwuHWX2",
const UID_MAP = {};

// Helper to load a CSV file
function loadCsv(filename) {
  const filePath = path.join(__dirname, "data", filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found, skipping: ${filename}`);
    return [];
  }
  const content = fs.readFileSync(filePath);
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  console.log(`Loaded ${records.length} rows from ${filename}`);
  return records;
}

// Helper to resolve UID for a row (Supabase owner_id / user_id -> Firebase UID)
function uidFromRow(row) {
  const raw =
    row.owner_id ||
    row.user_id ||
    row.userId ||
    row.uid ||
    row.player_id;

  if (!raw) return null;

  return UID_MAP[raw] || raw;
}

// Helper to safely parse a date string from CSV.
// Returns a real Date, or null if invalid.
function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

// Batch helper
async function runBatches(items, handler, batchSize = 400) {
  let batch = db.batch();
  let countInBatch = 0;
  let total = 0;

  for (const item of items) {
    await handler(item, batch);
    countInBatch++;
    total++;

    if (countInBatch >= batchSize) {
      await batch.commit();
      console.log(`Committed batch of ${countInBatch} writes (total ${total})`);
      batch = db.batch();
      countInBatch = 0;
    }
  }
  if (countInBatch > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${countInBatch} writes (total ${total})`);
  }
}

// 4. Import functions for each CSV

async function importProfiles() {
  const rows = loadCsv("profiles_rows.csv");
  await runBatches(rows, async (row, batch) => {
    // profiles might not have owner_id, so fall back to row.id
    const uid = uidFromRow(row) || row.id;
    if (!uid) return;

    const ref = db.collection("profiles").doc(uid);
    batch.set(
      ref,
      {
        displayName: row.display_name || row.displayname || row.name || null,
        avatarUrl: row.avatar_url || null,
        rawOwnerId: row.owner_id || row.user_id || null,
        updatedAt:
          safeDate(row.updated_at) ||
          admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function importBuildingsKv() {
  const rows = loadCsv("buildings_kv_rows.csv");
  await runBatches(rows, async (row, batch) => {
    const uid = uidFromRow(row);
    const key = row.key;
    if (!uid || !key) return;

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("buildings_kv")
      .doc(key);

    batch.set(
      ref,
      {
        value: row.value ?? null,
        isPublic: row.is_public === "true" || row.is_public === "1",
        rawOwnerId: row.owner_id || row.user_id || null,
        updatedAt:
          safeDate(row.updated_at) ||
          admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function importBuildingsTracking() {
  const rows = loadCsv("buildings_tracking_rows.csv");
  await runBatches(rows, async (row, batch) => {
    const uid = uidFromRow(row);
    const trackId = row.id;
    if (!uid || !trackId) return;

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("buildings_tracking")
      .doc(trackId);

    batch.set(
      ref,
      {
        name: row.name || null,
        upgrading: row.upgrading === "true" || row.upgrading === "1",
        next: safeDate(row.next),
        isPublic: row.is_public === "true" || row.is_public === "1",
        ownerId: row.owner_id || null,
        orderIndex: row.order_index ? Number(row.order_index) : null,
        rawOwnerId: row.owner_id || row.user_id || null,
        updatedAt:
          safeDate(row.updated_at) ||
          admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function importResearchCatalog() {
  const fs = require("fs");
  const path = require("path");

  const filePath = path.join(
    __dirname,
    "..",
    "data",
    "research_catalog_rows.csv"
  );
  console.log("Looking for file at:", filePath);

  if (!fs.existsSync(filePath)) {
    console.error("FILE DOES NOT EXIST AT PATH ABOVE!");
    process.exit(1);
  }

  const rows = loadCsv(filePath);

  await runBatches(rows, async (row, batch) => {
    const name = row.name;
    const category = row.category;
    if (!name || !category) return;

    const maxLevel = row.max_level ? Number(row.max_level) : null;
    const orderIndex = row.order_index ? Number(row.order_index) : null;

    const ref = db.collection("research_catalog").doc(name);

    batch.set(
      ref,
      {
        name,
        category,
        maxLevel: maxLevel != null ? maxLevel : 0,
        orderIndex: orderIndex != null ? orderIndex : null,
      },
      { merge: true }
    );
  });
}

async function importHeroCatalog() {
  const rows = loadCsv("hero_catalog_rows.csv");
  await runBatches(rows, async (row, batch) => {
    const id = row.name || row.slug || row.id;
    if (!id) return;

    const ref = db.collection("hero_catalog").doc(id);
    batch.set(ref, row, { merge: true });
  });
}

async function importUserResearch() {
  const rows = loadCsv("user_research_rows.csv");
  await runBatches(rows, async (row, batch) => {
    const uid = uidFromRow(row);
    const name = row.name;
    if (!uid || !name) return;

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("user_research")
      .doc(name);

    batch.set(
      ref,
      {
        level: row.level ? Number(row.level) : 0,
        tracked: row.tracked === "true" || row.tracked === "1",
        priority: row.priority ? Number(row.priority) : null,
        rawOwnerId: row.owner_id || row.user_id || null,
        updatedAt:
          safeDate(row.updated_at) ||
          admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function importResearchTracking() {
  const rows = loadCsv("research_tracking_rows.csv");
  await runBatches(rows, async (row, batch) => {
    const uid = uidFromRow(row);
    const trackId = row.id;
    if (!uid || !trackId) return;

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("research_tracking")
      .doc(trackId);

    batch.set(
      ref,
      {
        category: row.category || null,
        name: row.name || null,
        tracked: row.tracked === "true" || row.tracked === "1",
        priority: row.priority ? Number(row.priority) : null,
        orderIndex: row.order_index ? Number(row.order_index) : null,
        matchKey: row.match_key || null,
        isPublic: row.is_public === "true" || row.is_public === "1",
        rawOwnerId: row.owner_id || row.user_id || null,
        updatedAt:
          safeDate(row.updated_at) ||
          admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function importHeroes() {
  const rows = loadCsv("heroes_rows.csv");
  await runBatches(rows, async (row, batch) => {
    const uid = uidFromRow(row);
    if (!uid) return;

    const heroId = row.name || row.hero_name || row.id;
    if (!heroId) return;

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("heroes")
      .doc(heroId);

    batch.set(
      ref,
      {
        ...row,
        rawOwnerId: row.owner_id || row.user_id || null,
        updatedAt:
          safeDate(row.updated_at) ||
          admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

// 5. Main orchestrator
async function main() {
  try {
    console.log("Starting CSV import...");

    await importProfiles();
    await importResearchCatalog();
    await importHeroCatalog();
    await importBuildingsKv();
    await importBuildingsTracking();
    await importUserResearch();
    await importResearchTracking();
    await importHeroes();

    console.log("All imports complete.");
  } catch (err) {
    console.error("Import failed:", err);
  }
}

main().then(() => {
  console.log("Done.");
  process.exit(0);
});
