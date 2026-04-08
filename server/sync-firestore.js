const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isYyyyMmDd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toDocId(areaId, yyyyMmDd) {
  const compact = yyyyMmDd.replaceAll("-", "");
  return `${areaId}_${compact}`;
}

function readLocalStore() {
  const dailyStatsPath = path.join(__dirname, "data", "dailyStats.json");
  const raw = fs.readFileSync(dailyStatsPath, "utf8");
  const json = JSON.parse(raw);
  if (!json || typeof json !== "object") throw new Error("invalid_store_json");
  if (!Array.isArray(json.dailyStats)) throw new Error("invalid_store_dailyStats");
  if (!json.areas || typeof json.areas !== "object") throw new Error("invalid_store_areas");
  return json;
}

async function upsertAreas(db, areas) {
  const entries = Object.values(areas || {});
  for (const a of entries) {
    if (!a || !a.areaId) continue;
    await db.collection("areas").doc(String(a.areaId)).set(
      {
        ...a,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }
  return entries.length;
}

async function upsertDailyStats(db, dailyStats) {
  const normalized = dailyStats
    .filter((x) => x && x.areaId && isYyyyMmDd(x.date))
    .map((x) => ({
      ...x,
      areaId: String(x.areaId),
      date: String(x.date),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }));

  const batches = chunk(normalized, 450);
  let written = 0;

  for (const part of batches) {
    const batch = db.batch();
    for (const doc of part) {
      const ref = db.collection("dailyStats").doc(toDocId(doc.areaId, doc.date));
      batch.set(ref, doc, { merge: true });
    }
    await batch.commit();
    written += part.length;
  }

  return written;
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("missing_env_GOOGLE_APPLICATION_CREDENTIALS");
  }

  const store = readLocalStore();

  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });

  const db = admin.firestore();

  const areaCount = await upsertAreas(db, store.areas);
  const written = await upsertDailyStats(db, store.dailyStats);

  console.log(JSON.stringify({ ok: true, areas: areaCount, dailyStats: written }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

