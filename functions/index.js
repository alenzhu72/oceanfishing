const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();

const db = admin.firestore();

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYyyyMmDdUTC(date) {
  const yyyy = date.getUTCFullYear();
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  return `${yyyy}-${mm}-${dd}`;
}

function toDocId(areaId, date) {
  const yyyy = date.getUTCFullYear();
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  return `${areaId}_${yyyy}${mm}${dd}`;
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function scoreCurve(x, min, optMin, optMax, max) {
  if (x <= min || x >= max) return 0;
  if (x >= optMin && x <= optMax) return 1;
  if (x < optMin) return clamp01((x - min) / (optMin - min));
  return clamp01((max - x) / (max - optMax));
}

function computeScores(metrics) {
  const tide = metrics.tide.rangeM;
  const cur = metrics.current.meanKnots;
  const wave = metrics.meteo.waveM;
  const temp = metrics.ocean.surfaceTempC;

  const tideScore = scoreCurve(tide, 0.6, 1.4, 2.8, 4.2);
  const curScore = scoreCurve(cur, 0.15, 0.6, 1.25, 2.2);
  const waveScore = scoreCurve(wave, 0.0, 0.35, 1.4, 2.8);
  const tempPelagic = scoreCurve(temp, 24.5, 26.3, 29.2, 31.0);
  const tempReef = scoreCurve(temp, 24.0, 26.0, 30.0, 31.5);

  const mackerel = 100 * (0.32 * tideScore + 0.38 * curScore + 0.2 * waveScore + 0.1 * tempPelagic);
  const mahi = 100 * (0.18 * tideScore + 0.35 * curScore + 0.22 * waveScore + 0.25 * tempPelagic);
  const grouper = 100 * (0.4 * tideScore + 0.25 * curScore + 0.15 * waveScore + 0.2 * tempReef);
  const snapper = 100 * (0.42 * tideScore + 0.22 * curScore + 0.16 * waveScore + 0.2 * tempReef);

  const bySpecies = {
    mackerel: Math.round(mackerel),
    mahi: Math.round(mahi),
    grouper: Math.round(grouper),
    snapper: Math.round(snapper)
  };

  const overall = Math.round((bySpecies.mackerel + bySpecies.mahi + bySpecies.grouper + bySpecies.snapper) / 4);
  return { overall, bySpecies };
}

function computeMockDailyMetrics(areaId, date) {
  const dayKey = `${areaId}_${toYyyyMmDdUTC(date)}`;
  const seed = xmur3(dayKey)();
  const rnd = mulberry32(seed);

  const tideRangeM = Number((0.9 + rnd() * 2.7).toFixed(2));
  const currentMeanKnots = Number((0.25 + rnd() * 1.4).toFixed(2));
  const currentMaxKnots = Number((currentMeanKnots + 0.2 + rnd() * 0.9).toFixed(2));
  const dominantDirDeg = Math.round(rnd() * 359);
  const waveM = Number((0.25 + rnd() * 2.4).toFixed(2));
  const windKts = Math.round(3 + rnd() * 20);
  const surfaceTempC = Number((26.0 + rnd() * 4.1).toFixed(1));

  return {
    tide: {
      rangeM: tideRangeM
    },
    current: {
      meanKnots: currentMeanKnots,
      maxKnots: currentMaxKnots,
      dominantDirDeg
    },
    meteo: {
      windKts,
      waveM
    },
    ocean: {
      surfaceTempC
    }
  };
}

async function ensureDefaultArea(areaId) {
  const ref = db.collection("areas").doc(areaId);
  const snap = await ref.get();
  if (snap.exists) return;

  await ref.set({
    areaId,
    name: "Tioman 4h",
    center: { lat: 2.7902, lon: 104.1698 },
    assumedSpeedKts: 20,
    assumedHours: 4,
    assumedRadiusKm: 148,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function seedRange({ areaId, endDateUTC, days }) {
  await ensureDefaultArea(areaId);

  const writes = [];
  const end = new Date(Date.UTC(endDateUTC.getUTCFullYear(), endDateUTC.getUTCMonth(), endDateUTC.getUTCDate()));

  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);

    const metrics = computeMockDailyMetrics(areaId, d);
    const scores = computeScores(metrics);
    const docId = toDocId(areaId, d);

    const doc = {
      areaId,
      date: toYyyyMmDdUTC(d),
      scoreOverall: scores.overall,
      scoreBySpecies: scores.bySpecies,
      ...metrics,
      source: {
        kind: "mock",
        version: 1
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    writes.push(db.collection("dailyStats").doc(docId).set(doc, { merge: true }));
    if (writes.length >= 400) {
      await Promise.all(writes.splice(0, writes.length));
    }
  }

  if (writes.length) {
    await Promise.all(writes);
  }
}

exports.seedDailyStats = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }

    const isEmulator = Boolean(process.env.FUNCTIONS_EMULATOR);
    const seedKey = process.env.SEED_KEY;
    const headerKey = req.get("x-seed-key") || "";

    if (!isEmulator) {
      if (!seedKey) {
        res.status(403).json({ error: "seed_disabled" });
        return;
      }
      if (headerKey !== seedKey) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
    }

    const areaId = String(req.query.areaId || "tioman_4h");
    const days = Math.max(1, Math.min(366, Number(req.query.days || 365)));
    const endDateUTC = new Date();

    await seedRange({ areaId, endDateUTC, days });

    res.json({ ok: true, areaId, days });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

exports.getDailyStats = onRequest({ cors: true }, async (req, res) => {
  try {
    const areaId = String(req.query.areaId || "tioman_4h");
    const limit = Math.max(1, Math.min(60, Number(req.query.limit || 30)));
    const start = req.query.start ? String(req.query.start) : null;
    const end = req.query.end ? String(req.query.end) : null;

    let q = db.collection("dailyStats").where("areaId", "==", areaId);
    if (start) q = q.where("date", ">=", start);
    if (end) q = q.where("date", "<=", end);
    q = q.orderBy("date", "desc").limit(limit);

    const snap = await q.get();
    res.json({
      areaId,
      count: snap.size,
      items: snap.docs.map((d) => d.data())
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

exports.dailyAutoSeed = onSchedule(
  { schedule: "every day 02:10", timeZone: "Asia/Kuala_Lumpur" },
  async () => {
    const areaId = "tioman_4h";
    const endDateUTC = new Date();
    await seedRange({ areaId, endDateUTC, days: 3 });
  }
);
