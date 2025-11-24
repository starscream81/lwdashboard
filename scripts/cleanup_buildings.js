/**
 * One time cleanup for buildings_kv and buildings_tracking
 *
 * What it does:
 *  - Normalizes building names so they map to known group definitions
 *  - Renames instances into strict labels:
 *      non multi: "Gold Mine"
 *      multi     : "Gold Mine 1", "Gold Mine 2", ...
 *  - Enforces maxInstances by optionally deleting extra docs
 *  - Optionally syncs buildings_tracking.name to the canonical group name
 *
 * Safety:
 *  - DRY_RUN = true at the top so it only logs, not writes
 *  - Set DRY_RUN = false once you are happy with the logs
 */

const admin = require("firebase-admin");
const path = require("path");

// ------------- CONFIG ------------- //

// Service account file path relative to this script
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");

// Put the users you want to clean here
// Example: const TARGET_UIDS = ["uid_for_you", "uid_for_friend"];
const TARGET_UIDS = [
  "6FGO4OpqkdbA34amGS4Y8ZwuHWX2", // you
  "sh6Wq3vJe7cDlGimXgyTRsYPC3K3", // chambo
];

// Dry run means log only, no writes or deletes
const DRY_RUN = true;

// If true and DRY_RUN is false, delete extra building_kv docs above maxInstances
const DELETE_EXTRAS = false;

// If true, update buildings_tracking.name to the canonical group name
const UPDATE_TRACKING_NAMES = true;

// ------------- INIT ------------- //

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

const db = admin.firestore();

// ------------- BUILDING DEFINITIONS ------------- //

const BUILDING_GROUP_DEFS = [
  { key: "Aircraft Center", displayName: "Aircraft Center" },
  { key: "Alert Tower", displayName: "Alert Tower" },
  { key: "Alliance Center", displayName: "Alliance Center" },
  {
    key: "Barracks",
    displayName: "Barracks",
    multiInstance: true,
    maxInstances: 4,
  },
  { key: "Builder's Hut", displayName: "Builder's Hut" },
  { key: "Chip Lab", displayName: "Chip Lab" },
  { key: "Coin Vault", displayName: "Coin Vault" },
  { key: "Component Factory", displayName: "Component Factory" },
  {
    key: "Drill Ground",
    displayName: "Drill Ground",
    multiInstance: true,
    maxInstances: 4,
  },
  {
    key: "Drone Parts Workshop",
    displayName: "Drone Parts Workshop",
  },
  { key: "Emergency Center", displayName: "Emergency Center" },
  {
    key: "Farmland",
    displayName: "Farmland",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Food Warehouse", displayName: "Food Warehouse" },
  { key: "Gear Factory", displayName: "Gear Factory" },
  {
    key: "Gold Mine",
    displayName: "Gold Mine",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "HQ", displayName: "HQ" },
  {
    key: "Hospital",
    displayName: "Hospital",
    multiInstance: true,
    maxInstances: 4,
  },
  {
    key: "Iron Mine",
    displayName: "Iron Mine",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Iron Warehouse", displayName: "Iron Warehouse" },
  {
    key: "Material Workshop",
    displayName: "Material Workshop",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Missile Center", displayName: "Missile Center" },
  {
    key: "Oil Well",
    displayName: "Oil Well",
    multiInstance: true,
    maxInstances: 5,
  },
  {
    key: "Recon Plane",
    displayName: "Recon Plane",
    multiInstance: true,
    maxInstances: 3,
  },
  {
    key: "Smelter",
    displayName: "Smelter",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Tank Center", displayName: "Tank Center" },
  { key: "Tavern", displayName: "Tavern" },
  {
    key: "Tech Center",
    displayName: "Tech Center",
    multiInstance: true,
    maxInstances: 3,
  },
  {
    key: "Technical Institute",
    displayName: "Technical Institute",
  },
  {
    key: "Training Base",
    displayName: "Training Base",
    multiInstance: true,
    maxInstances: 5,
  },
  { key: "Wall", displayName: "Wall" },
];

// ------------- NORMALIZATION HELPERS ------------- //

function normalizeIdentifier(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveGroupName(rawName) {
  const trimmed = String(rawName || "").trim();
  if (!trimmed) {
    return "";
  }

  const normalized = normalizeIdentifier(trimmed);

  for (const def of BUILDING_GROUP_DEFS) {
    const defNorm = normalizeIdentifier(def.key);

    if (normalized === defNorm) {
      return def.key;
    }

    if (normalized.startsWith(defNorm + " ") || normalized.startsWith(defNorm)) {
      return def.key;
    }
  }

  const match = trimmed.match(/^(.*?)(?:\s+(\d+))$/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return trimmed;
}

function getDefForGroup(groupKey) {
  return BUILDING_GROUP_DEFS.find((d) => d.key === groupKey) || null;
}

// ------------- CLEANUP LOGIC ------------- //

async function cleanupUser(uid) {
  console.log(`\n=== Cleaning user ${uid} ===`);

  const kvRef = db.collection("users").doc(uid).collection("buildings_kv");
  const trackingRef = db
    .collection("users")
    .doc(uid)
    .collection("buildings_tracking");

  const [kvSnap, trackingSnap] = await Promise.all([
    kvRef.get(),
    trackingRef.get(),
  ]);

  if (kvSnap.empty) {
    console.log("No buildings_kv docs for this user, skipping.");
    return;
  }

  const trackingById = new Map();
  trackingSnap.forEach((doc) => {
    trackingById.set(doc.id, { id: doc.id, ...doc.data() });
  });

  const groups = new Map();

  kvSnap.forEach((doc) => {
  const id = doc.id;
  const data = doc.data() || {};
  const rawName = data.name || id;
  const groupKey = resolveGroupName(rawName);

  // DEBUG: log anything that looks like Tavern
  if (String(rawName).toLowerCase().includes("tavern")) {
      console.log(
      `  [debug] Tavern-ish doc for user ${uid}: id=${id}, rawName="${rawName}", groupKey="${groupKey}"`
      );
}

  if (!groupKey) {
      console.log(
      `  [warn] Doc ${id} has empty or invalid name: "${rawName}", leaving as is`
      );
      return;
}

  if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
}
  groups.get(groupKey).push({
      id,
      data,
      rawName,
      groupKey,
  });
  });

  console.log(`Found ${groups.size} building groups for this user.`);

  for (const [groupKey, docs] of groups.entries()) {
    const def = getDefForGroup(groupKey);
    const defLabel = def ? def.displayName : groupKey;
    const multiInstance = def ? !!def.multiInstance : docs.length > 1;
    const maxInstances = def && typeof def.maxInstances === "number"
      ? def.maxInstances
      : null;

    console.log(
      `\nGroup "${groupKey}" (label "${defLabel}"), instances: ${docs.length}, multi: ${multiInstance}, max: ${maxInstances}`
    );

    docs.sort((a, b) => a.id.localeCompare(b.id));

    const keep = [];
    const extras = [];

    if (maxInstances != null && docs.length > maxInstances) {
      for (let i = 0; i < docs.length; i++) {
        if (i < maxInstances) {
          keep.push(docs[i]);
        } else {
          extras.push(docs[i]);
        }
      }
    } else {
      keep.push(...docs);
    }

    console.log(
      `  Will keep ${keep.length} instance(s)` +
        (extras.length ? `, extra above max: ${extras.length}` : "")
    );

    const writes = [];

    keep.forEach((item, index) => {
      const baseName = defLabel;
      let newName;

      if (!multiInstance) {
        newName = baseName;
      } else {
        newName = `${baseName} ${index + 1}`;
      }

      if (item.data.name !== newName) {
        console.log(
          `    Rename ${item.id}: "${item.data.name}" -> "${newName}"`
        );
        if (!DRY_RUN) {
          const ref = kvRef.doc(item.id);
          writes.push(ref.update({ name: newName }));
        }
      }

      if (UPDATE_TRACKING_NAMES) {
        const tracking = trackingById.get(item.id);
        if (tracking && tracking.name !== baseName) {
          console.log(
            `    Update tracking ${item.id}: name "${tracking.name}" -> "${baseName}"`
          );
          if (!DRY_RUN) {
            const tRef = trackingRef.doc(item.id);
            writes.push(tRef.set({ name: baseName }, { merge: true }));
          }
        }
      }
    });

    extras.forEach((item) => {
      console.log(
        `    Extra above max: ${item.id} name="${item.data.name}", level=${item.data.level}`
      );
      if (!DRY_RUN && DELETE_EXTRAS) {
        const kvDocRef = kvRef.doc(item.id);
        writes.push(kvDocRef.delete());

        const tRef = trackingRef.doc(item.id);
        const tracking = trackingById.get(item.id);
        if (tracking) {
          writes.push(tRef.delete());
        }
      }
    });

    if (!DRY_RUN && writes.length > 0) {
      await Promise.all(writes);
    }
  }

  console.log(`\nFinished user ${uid}.`);
}

// ------------- MAIN ------------- //

(async function main() {
  try {
    if (!Array.isArray(TARGET_UIDS) || TARGET_UIDS.length === 0) {
      console.error(
        "Please fill TARGET_UIDS at the top of this script with the user ids you want to clean."
      );
      process.exit(1);
    }

    console.log(
      `Starting cleanup. DRY_RUN=${DRY_RUN}, DELETE_EXTRAS=${DELETE_EXTRAS}, UPDATE_TRACKING_NAMES=${UPDATE_TRACKING_NAMES}`
    );

    for (const uid of TARGET_UIDS) {
      await cleanupUser(uid);
    }

    console.log("\nAll done.");
    process.exit(0);
  } catch (err) {
    console.error("Error during cleanup:", err);
    process.exit(1);
  }
})();
