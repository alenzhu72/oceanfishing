const path = require("path");
const fs = require("fs");
const express = require("express");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYyyyMmDdUTC(date) {
  const yyyy = date.getUTCFullYear();
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  return `${yyyy}-${mm}-${dd}`;
}

function isYyyyMmDd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseYyyyMmDdUTC(s) {
  if (!isYyyyMmDd(s)) {
    throw new Error("invalid_date_format");
  }
  const [yyyy, mm, dd] = s.split("-").map((x) => Number(x));
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(d.getTime())) {
    throw new Error("invalid_date_value");
  }
  return d;
}

function addDaysUTC(date, days) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addYearsUTC(date, years) {
  const yyyy = date.getUTCFullYear() + years;
  const mm = date.getUTCMonth();
  const dd = date.getUTCDate();
  const d = new Date(Date.UTC(yyyy, mm, dd));
  if (d.getUTCMonth() !== mm) {
    return new Date(Date.UTC(yyyy, mm + 1, 0));
  }
  return d;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function moonPhaseFraction(dateUTC) {
  const t = Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate(), 0, 0, 0);
  const referenceNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMonthDays = 29.530588853;
  const daysSince = (t - referenceNewMoon) / (1000 * 60 * 60 * 24);
  let phase = daysSince / synodicMonthDays;
  phase = phase - Math.floor(phase);
  return phase;
}

function springNeapIndex(phase) {
  const v = (1 + Math.cos(4 * Math.PI * phase)) / 2;
  return clamp01(v);
}

function estimateTideRangeM(dateUTC) {
  const idx = springNeapIndex(moonPhaseFraction(dateUTC));
  return Number((0.8 + idx * 2.4).toFixed(2));
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

function scoreCurve(x, min, optMin, optMax, max) {
  if (x <= min || x >= max) return 0;
  if (x >= optMin && x <= optMax) return 1;
  if (x < optMin) return clamp01((x - min) / (optMin - min));
  return clamp01((max - x) / (max - optMax));
}

function circularMeanDeg(values) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const v of values) {
    const deg = Number(v);
    if (!Number.isFinite(deg)) continue;
    const rad = (deg * Math.PI) / 180;
    sx += Math.cos(rad);
    sy += Math.sin(rad);
    n += 1;
  }
  if (n === 0) return 0;
  let rad = Math.atan2(sy / n, sx / n);
  if (rad < 0) rad += 2 * Math.PI;
  return Math.round((rad * 180) / Math.PI);
}

function aggregateOpenMeteoHourly(hourly) {
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  const wave = Array.isArray(hourly?.wave_height) ? hourly.wave_height : [];
  const sst = Array.isArray(hourly?.sea_surface_temperature) ? hourly.sea_surface_temperature : [];
  const curV = Array.isArray(hourly?.ocean_current_velocity) ? hourly.ocean_current_velocity : [];
  const curD = Array.isArray(hourly?.ocean_current_direction) ? hourly.ocean_current_direction : [];
  const seaLevel = Array.isArray(hourly?.sea_level_height_msl) ? hourly.sea_level_height_msl : [];

  const byDate = new Map();
  for (let i = 0; i < times.length; i++) {
    const t = String(times[i] || "");
    const date = t.slice(0, 10);
    if (!isYyyyMmDd(date)) continue;
    const bucket = byDate.get(date) || {
      wave: [],
      sst: [],
      curV: [],
      curD: [],
      seaLevel: []
    };

    const w = Number(wave[i]);
    if (Number.isFinite(w)) bucket.wave.push(w);
    const s = Number(sst[i]);
    if (Number.isFinite(s)) bucket.sst.push(s);
    const v = Number(curV[i]);
    if (Number.isFinite(v)) bucket.curV.push(v);
    const d = Number(curD[i]);
    if (Number.isFinite(d)) bucket.curD.push(d);
    const sl = Number(seaLevel[i]);
    if (Number.isFinite(sl)) bucket.seaLevel.push(sl);

    byDate.set(date, bucket);
  }

  const out = new Map();
  for (const [date, b] of byDate.entries()) {
    const waveMax = b.wave.length ? Math.max(...b.wave) : null;
    const sstMean = b.sst.length ? b.sst.reduce((a, x) => a + x, 0) / b.sst.length : null;
    const curMean = b.curV.length ? b.curV.reduce((a, x) => a + x, 0) / b.curV.length : null;
    const curMax = b.curV.length ? Math.max(...b.curV) : null;
    const curDir = b.curD.length ? circularMeanDeg(b.curD) : null;
    const tideRange =
      b.seaLevel.length ? Math.max(...b.seaLevel) - Math.min(...b.seaLevel) : null;

    out.set(date, {
      tide: {
        rangeM: tideRange !== null ? Number(tideRange.toFixed(2)) : null
      },
      current: {
        meanKnots: curMean !== null ? Number(curMean.toFixed(2)) : null,
        maxKnots: curMax !== null ? Number(curMax.toFixed(2)) : null,
        dominantDirDeg: curDir
      },
      meteo: {
        waveM: waveMax !== null ? Number(waveMax.toFixed(2)) : null
      },
      ocean: {
        surfaceTempC: sstMean !== null ? Number(sstMean.toFixed(1)) : null
      }
    });
  }

  return out;
}

async function fetchOpenMeteoDailyMap({ lat, lon, startDate, endDate }) {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "hourly",
    [
      "wave_height",
      "sea_surface_temperature",
      "ocean_current_velocity",
      "ocean_current_direction",
      "sea_level_height_msl"
    ].join(",")
  );
  url.searchParams.set("velocity_unit", "kn");
  url.searchParams.set("timezone", "Asia/Kuala_Lumpur");
  url.searchParams.set("cell_selection", "sea");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`open_meteo_http_${res.status}`);
  }
  const json = await res.json();
  if (json?.error) {
    throw new Error(String(json?.reason || "open_meteo_error"));
  }
  return aggregateOpenMeteoHourly(json.hourly || {});
}

function* dateRangeChunks(startUTC, endUTC, maxDaysPerChunk) {
  let cur = new Date(startUTC);
  while (cur.getTime() <= endUTC.getTime()) {
    const chunkStart = new Date(cur);
    const chunkEnd = addDaysUTC(chunkStart, maxDaysPerChunk - 1);
    const finalEnd = chunkEnd.getTime() > endUTC.getTime() ? endUTC : chunkEnd;
    yield { start: toYyyyMmDdUTC(chunkStart), end: toYyyyMmDdUTC(finalEnd) };
    cur = addDaysUTC(finalEnd, 1);
  }
}

function findClimatologyRefDateUTC(dateUTC, maxAvailableUTC, minAvailableUTC) {
  let ref = new Date(dateUTC);
  for (let yearsBack = 1; yearsBack <= 20; yearsBack++) {
    ref = addYearsUTC(dateUTC, -yearsBack);
    if (ref.getTime() < minAvailableUTC.getTime()) return null;
    if (ref.getTime() <= maxAvailableUTC.getTime()) {
      return { refDateUTC: ref, yearsBack };
    }
  }
  return null;
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

function sortByDateDesc(a, b) {
  return String(b.date).localeCompare(String(a.date));
}

function filterByRange(items, start, end) {
  let out = items;
  if (start) out = out.filter((x) => x.date >= start);
  if (end) out = out.filter((x) => x.date <= end);
  return out;
}

const app = express();
app.use(express.json({ limit: "1mb" }));

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const dataDir = path.join(projectRoot, "server", "data");
const dailyStatsPath = path.join(dataDir, "dailyStats.json");

function loadStore() {
  try {
    const raw = fs.readFileSync(dailyStatsPath, "utf8");
    const json = JSON.parse(raw);
    if (!json || typeof json !== "object") return { areas: {}, dailyStats: [] };
    if (!Array.isArray(json.dailyStats)) json.dailyStats = [];
    if (!json.areas || typeof json.areas !== "object") json.areas = {};
    return json;
  } catch {
    return { areas: {}, dailyStats: [] };
  }
}

function saveStore(store) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dailyStatsPath, JSON.stringify(store, null, 2), "utf8");
}

function getDefaultArea(areaId) {
  const id = String(areaId || "tioman_4h");
  if (id === "singapore_4h") {
    return {
      areaId: id,
      name: "Singapore 4h",
      center: { lat: 1.3521, lon: 103.8198 },
      assumedSpeedKts: 20,
      assumedHours: 4,
      assumedRadiusKm: 148
    };
  }
  if (id === "bali_4h") {
    return {
      areaId: id,
      name: "Bali 4h",
      center: { lat: -8.4095, lon: 115.1889 },
      assumedSpeedKts: 20,
      assumedHours: 4,
      assumedRadiusKm: 148
    };
  }
  if (id === "maldives_4h") {
    return {
      areaId: id,
      name: "Maldives 4h",
      center: { lat: 4.1755, lon: 73.5093 },
      assumedSpeedKts: 20,
      assumedHours: 4,
      assumedRadiusKm: 148
    };
  }
  return {
    areaId: "tioman_4h",
    name: "Tioman 4h",
    center: { lat: 2.7902, lon: 104.1698 },
    assumedSpeedKts: 20,
    assumedHours: 4,
    assumedRadiusKm: 148
  };
}

app.post("/api/seed", async (req, res) => {
  const areaId = String(req.query.areaId || "tioman_4h");
  const startStr = req.query.start ? String(req.query.start) : null;
  const endStr = req.query.end ? String(req.query.end) : null;
  const daysParam = req.query.days ? Number(req.query.days) : null;
  const source = String(req.query.source || "mock");

  const store = loadStore();
  const defaults = getDefaultArea(areaId);
  store.areas[areaId] = store.areas[areaId] || defaults;
  store.areas[areaId] = { ...defaults, ...store.areas[areaId] };

  const now = new Date();
  const endUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const existing = new Map(store.dailyStats.filter((x) => x.areaId === areaId).map((x) => [x.date, x]));

  let startUTC = null;
  let finalEndUTC = null;
  let maxDays = 5000;
  let produced = 0;

  try {
    if (startStr || endStr) {
      startUTC = startStr ? parseYyyyMmDdUTC(startStr) : endUTC;
      finalEndUTC = endStr ? parseYyyyMmDdUTC(endStr) : startUTC;
      if (startUTC.getTime() > finalEndUTC.getTime()) {
        res.status(400).json({ error: "start_after_end" });
        return;
      }
    } else {
      const days = Math.max(1, Math.min(366, Number(daysParam || 365)));
      startUTC = new Date(endUTC);
      startUTC.setUTCDate(endUTC.getUTCDate() - (days - 1));
      finalEndUTC = endUTC;
    }

    const center = store.areas[areaId]?.center || defaults.center;
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const maxForecastUTC = addDaysUTC(todayUTC, 16);
    const minRealtimeUTC = parseYyyyMmDdUTC("2022-01-01");

    const openMeteoMaps = [];
    if (source === "real") {
      const realStart = startUTC.getTime() < minRealtimeUTC.getTime() ? minRealtimeUTC : startUTC;
      const realEnd = finalEndUTC.getTime() > maxForecastUTC.getTime() ? maxForecastUTC : finalEndUTC;
      if (realStart.getTime() <= realEnd.getTime()) {
        for (const ch of dateRangeChunks(realStart, realEnd, 31)) {
          openMeteoMaps.push(
            await fetchOpenMeteoDailyMap({ lat: center.lat, lon: center.lon, startDate: ch.start, endDate: ch.end })
          );
        }
      }

      const futureStartUTC = startUTC.getTime() > maxForecastUTC.getTime() ? startUTC : addDaysUTC(maxForecastUTC, 1);
      if (futureStartUTC.getTime() <= finalEndUTC.getTime()) {
        let minRef = null;
        let maxRef = null;
        const cursor = new Date(futureStartUTC);
        while (cursor.getTime() <= finalEndUTC.getTime()) {
          const ref = findClimatologyRefDateUTC(cursor, maxForecastUTC, minRealtimeUTC);
          if (ref) {
            if (!minRef || ref.refDateUTC.getTime() < minRef.getTime()) minRef = ref.refDateUTC;
            if (!maxRef || ref.refDateUTC.getTime() > maxRef.getTime()) maxRef = ref.refDateUTC;
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        if (minRef && maxRef && minRef.getTime() <= maxRef.getTime()) {
          for (const ch of dateRangeChunks(minRef, maxRef, 31)) {
            openMeteoMaps.push(
              await fetchOpenMeteoDailyMap({ lat: center.lat, lon: center.lon, startDate: ch.start, endDate: ch.end })
            );
          }
        }
      }
    }

    const openMeteoByDate = new Map();
    for (const m of openMeteoMaps) {
      for (const [date, v] of m.entries()) openMeteoByDate.set(date, v);
    }

    const cursor = new Date(startUTC);
    while (cursor.getTime() <= finalEndUTC.getTime()) {
      const date = toYyyyMmDdUTC(cursor);
      let metrics = null;
      let kind = "mock";
      let refDate = null;
      let yearsBack = null;

      if (source === "real") {
        let fromApi = openMeteoByDate.get(date) || null;
        if (!fromApi && cursor.getTime() > maxForecastUTC.getTime()) {
          const ref = findClimatologyRefDateUTC(cursor, maxForecastUTC, minRealtimeUTC);
          if (ref) {
            refDate = toYyyyMmDdUTC(ref.refDateUTC);
            yearsBack = ref.yearsBack;
            fromApi = openMeteoByDate.get(refDate) || null;
          }
        }

        if (fromApi) {
          metrics = {
            tide: {
              rangeM: fromApi.tide.rangeM !== null ? fromApi.tide.rangeM : estimateTideRangeM(cursor)
            },
            current: fromApi.current,
            meteo: fromApi.meteo,
            ocean: fromApi.ocean
          };
          kind = refDate ? "open_meteo_climatology" : "open_meteo";
        } else {
          metrics = {
            tide: { rangeM: estimateTideRangeM(cursor) },
            current: { meanKnots: null, maxKnots: null, dominantDirDeg: null },
            meteo: { waveM: null, windKts: null },
            ocean: { surfaceTempC: null }
          };
          kind = "tide_only";
        }
      } else {
        metrics = computeMockDailyMetrics(areaId, cursor);
        kind = "mock";
      }

      const scores = computeScores(metrics);

      existing.set(date, {
        areaId,
        date,
        scoreOverall: scores.overall,
        scoreBySpecies: scores.bySpecies,
        ...metrics,
        source: { kind, version: 1, refDate, yearsBack },
        updatedAt: new Date().toISOString()
      });

      produced += 1;
      if (produced > maxDays) {
        res.status(400).json({ error: "range_too_large" });
        return;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
    return;
  }

  store.dailyStats = store.dailyStats.filter((x) => x.areaId !== areaId).concat([...existing.values()]);
  saveStore(store);

  res.json({
    ok: true,
    areaId,
    start: toYyyyMmDdUTC(startUTC),
    end: toYyyyMmDdUTC(finalEndUTC),
    days: produced
  });
});

app.get("/api/daily", (req, res) => {
  const areaId = String(req.query.areaId || "tioman_4h");
  const limit = Math.max(1, Math.min(5000, Number(req.query.limit || 30)));
  const start = req.query.start ? String(req.query.start) : null;
  const end = req.query.end ? String(req.query.end) : null;

  const store = loadStore();
  const items = filterByRange(
    store.dailyStats.filter((x) => x.areaId === areaId).sort(sortByDateDesc),
    start,
    end
  ).slice(0, limit);

  res.json({ areaId, count: items.length, items });
});

app.use(express.static(publicDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.PORT || 5173);
app.listen(port, "0.0.0.0", () => {
  console.log(`local server running: http://localhost:${port}`);
});
