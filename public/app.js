// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBOf_vu4akfOp7xDsAK5a6l2yxAd5bKzAo",
  authDomain: "tiomanfishing-2ecc1.firebaseapp.com",
  projectId: "tiomanfishing-2ecc1",
  storageBucket: "tiomanfishing-2ecc1.firebasestorage.app",
  messagingSenderId: "1037614029894",
  appId: "1:1037614029894:web:f25ca492dc09ed55dc7e47",
  measurementId: "G-RSRH751N7J"
};

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const detailTitleEl = document.getElementById("detailTitle");
const refreshBtn = document.getElementById("refreshBtn");
const seedBtn = document.getElementById("seedBtn");
const areaSelect = document.getElementById("areaSelect");
const bottomModeToggle = document.getElementById("bottomModeToggle");
const tideRangeSelect = document.getElementById("tideRangeSelect");
const tideListEl = document.getElementById("tideList");
const TIDE_END_YYYY_MM_DD = "2027-12-31";
const MAX_FETCH_DAYS = 2500;

const i18n = {
  zh: {
    title: "OceanFishing（刁曼岛）MVP",
    subtitle: "按鱼种推荐 + 近 30 天游钓鱼榜单",
    firebaseLabel: "Firebase 配置",
    firebaseHint: "把 public/app.js 里的 firebaseConfig 换成你的项目配置",
    areaLabel: "区域",
    langLabel: "语言",
    refresh: "刷新",
    seed: "本地填充 365 天",
    modeLabel: "作钓模式",
    modeText: "底钓模式（30–100m）",
    modeBottom: "底钓",
    modeDefault: "默认",
    tideLabel: "潮汐日历",
    tideType: "潮型",
    noteLabel: "说明",
    tideHint: "右侧蓝色为潮汐强度，不是鱼分",
    tideOpt30: "未来 30 天",
    tideOpt90: "未来 90 天",
    tideOpt180: "未来 6 个月",
    tideOptTo2027: "到 2027-12-31",
    listTitle: "近 30 天游钓鱼榜单",
    listHint: "右侧为综合鱼分 / 100",
    detail: "详情",
    pickDay: "请选择一天",
    loading: "加载中...",
    noData: "暂无数据",
    noDataLocal: "暂无数据：先点“本地填充 365 天”生成样例数据",
    loadFailed: "加载失败",
    seeding: "正在填充数据...",
    seedDone: "填充完成",
    seedFailed: (m) => `填充失败：${m}`,
    startFailed: (m) => `启动失败：${m}`,
    seedOnlyLocal: "仅本地可用",
    missingFirebase: "未配置 Firebase（请先在 public/app.js 填写 firebaseConfig）",
    missingFirebaseHint: "配置完成后点击“刷新”加载 Firestore 数据",
    tideStrength: (p) => `潮汐${p}%`,
    spring: "大潮窗口",
    neap: "小潮",
    mid: "中潮",
    moon: "月相",
    moonNew: "新月",
    moonWaxingCrescent: "娥眉月",
    moonFirstQuarter: "上弦",
    moonWaxingGibbous: "盈凸月",
    moonFull: "满月",
    moonWaningGibbous: "亏凸月",
    moonLastQuarter: "下弦",
    moonWaningCrescent: "残月",
    predict: (y) => `预测:${y ? `${y}年前同期` : "同期"}`,
    tideRange: "潮差m",
    currentKn: "流kn",
    waveM: "浪m",
    tempC: "温℃",
    grouper: "石斑",
    snapper: "红鲷",
    localStatus: "本地模式：Node.js API",
    connected: (p) => `已连接：${p}`
  },
  en: {
    title: "OceanFishing (Tioman) MVP",
    subtitle: "Species Scores + Last 30 Days Fishing Board",
    firebaseLabel: "Firebase Config",
    firebaseHint: "Fill firebaseConfig in public/app.js",
    areaLabel: "Area",
    langLabel: "Language",
    refresh: "Refresh",
    seed: "Seed 365 days (local)",
    modeLabel: "Mode",
    modeText: "Bottom fishing (30–100m)",
    modeBottom: "Bottom",
    modeDefault: "Default",
    tideLabel: "Tide Calendar",
    tideType: "Tide",
    noteLabel: "Note",
    tideHint: "Blue on right is tide strength, not fish score",
    tideOpt30: "Next 30 days",
    tideOpt90: "Next 90 days",
    tideOpt180: "Next 6 months",
    tideOptTo2027: "To 2027-12-31",
    listTitle: "Last 30 Days Board",
    listHint: "Right shows overall fish score / 100",
    detail: "Detail",
    pickDay: "Pick a day",
    loading: "Loading...",
    noData: "No data",
    noDataLocal: "No data: click “Seed 365 days (local)” first",
    loadFailed: "Load failed",
    seeding: "Seeding...",
    seedDone: "Seed done",
    seedFailed: (m) => `Seed failed: ${m}`,
    startFailed: (m) => `Start failed: ${m}`,
    seedOnlyLocal: "Local only",
    missingFirebase: "Firebase not configured (fill firebaseConfig in public/app.js)",
    missingFirebaseHint: "After config, click Refresh to load Firestore data",
    tideStrength: (p) => `Tide ${p}%`,
    spring: "Spring tide window",
    neap: "Neap",
    mid: "Mid tide",
    moon: "Moon",
    moonNew: "New Moon",
    moonWaxingCrescent: "Waxing Crescent",
    moonFirstQuarter: "First Quarter",
    moonWaxingGibbous: "Waxing Gibbous",
    moonFull: "Full Moon",
    moonWaningGibbous: "Waning Gibbous",
    moonLastQuarter: "Last Quarter",
    moonWaningCrescent: "Waning Crescent",
    predict: (y) => `Forecast: ${y ? `${y}y ago` : "Climatology"}`,
    tideRange: "Tide m",
    currentKn: "Curr kn",
    waveM: "Wave m",
    tempC: "Temp ℃",
    grouper: "Grouper",
    snapper: "Snapper",
    localStatus: "Local Mode: Node.js API",
    connected: (p) => `Connected: ${p}`
  }
};

let currentLang = localStorage.getItem("lang") || "zh";
function t(key, ...args) {
  const v = i18n[currentLang][key];
  return typeof v === "function" ? v(...args) : v;
}

function setStatus(text, tone) {
  statusEl.textContent = text;
  statusEl.style.borderColor = tone === "danger" ? "rgba(255,92,122,0.45)" : "rgba(58,160,255,0.35)";
}

function hasConfig(config) {
  return Boolean(config && config.apiKey && config.projectId);
}

function formatPill(label, value) {
  const span = document.createElement("span");
  span.className = "pill";
  span.textContent = `${label}:${value}`;
  return span;
}

function formatDangerPill(text) {
  const span = document.createElement("span");
  span.className = "pill pill-danger";
  span.textContent = text;
  return span;
}

function formatWarnPill(text) {
  const span = document.createElement("span");
  span.className = "pill pill-warn";
  span.textContent = text;
  return span;
}

function formatOkPill(text) {
  const span = document.createElement("span");
  span.className = "pill pill-ok";
  span.textContent = text;
  return span;
}

function formatWavePill(waveM, isHigh) {
  const span = document.createElement("span");
  span.className = isHigh ? "pill pill-danger" : "pill";
  span.textContent = `${t("waveM")}:${waveM ?? "-"}`;
  return span;
}

function renderEmpty(message) {
  listEl.innerHTML = "";
  const div = document.createElement("div");
  div.className = "status";
  div.textContent = message;
  listEl.appendChild(div);
}

function renderList(items) {
  listEl.innerHTML = "";
  for (const item of items) {
    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "item-top";

    const date = document.createElement("div");
    date.className = "item-date";
    date.textContent = item.date;

    const score = document.createElement("div");
    score.className = "item-score";
    const overall = item?.computed?.overall ?? item?.scoreOverall;
    score.textContent = `${Math.round(overall)} / 100`;

    top.appendChild(date);
    top.appendChild(score);

    const sub = document.createElement("div");
    sub.className = "item-sub";
    if (item?.source?.kind === "open_meteo_climatology") {
      const yb = item?.source?.yearsBack;
      sub.appendChild(formatWarnPill(t("predict", yb)));
    }
    if (bottomModeToggle && bottomModeToggle.checked) {
      const g = item?.computed?.bySpecies?.grouper;
      const s = item?.computed?.bySpecies?.snapper;
      sub.appendChild(formatOkPill(`${t("grouper")}:${Number.isFinite(g) ? g : "-"}`));
      sub.appendChild(formatOkPill(`${t("snapper")}:${Number.isFinite(s) ? s : "-"}`));
    }
    sub.appendChild(formatPill(t("tideRange"), item?.tide?.rangeM ?? "-"));
    sub.appendChild(formatPill(t("currentKn"), item?.current?.meanKnots ?? "-"));
    sub.appendChild(formatWavePill(item?.meteo?.waveM, Boolean(item?.computed?.flags?.waveHigh)));
    sub.appendChild(formatPill(t("tempC"), item?.ocean?.surfaceTempC ?? "-"));

    div.appendChild(top);
    div.appendChild(sub);

    div.addEventListener("click", () => {
      detailTitleEl.textContent = `${item.areaId} / ${item.date}`;
      const { computed, ...raw } = item;
      detailEl.textContent = JSON.stringify(raw, null, 2);
    });

    listEl.appendChild(div);
  }
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function addDaysUTC(date, days) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toYyyyMmDdUTC(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYyyyMmDdUTC(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const yyyy = Number(s.slice(0, 4));
  const mm = Number(s.slice(5, 7));
  const dd = Number(s.slice(8, 10));
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(d.getTime())) return null;
  return d;
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

function moonPhaseKey(phase) {
  if (phase < 0.03 || phase > 0.97) return "moonNew";
  if (phase < 0.22) return "moonWaxingCrescent";
  if (phase < 0.28) return "moonFirstQuarter";
  if (phase < 0.47) return "moonWaxingGibbous";
  if (phase < 0.53) return "moonFull";
  if (phase < 0.72) return "moonWaningGibbous";
  if (phase < 0.78) return "moonLastQuarter";
  return "moonWaningCrescent";
}

function springNeapIndex(phase) {
  const v = (1 + Math.cos(4 * Math.PI * phase)) / 2;
  return clamp01(v);
}

function springNeapLabel(idx) {
  if (idx >= 0.78) return "spring";
  if (idx <= 0.22) return "neap";
  return "mid";
}

function renderTideCalendar(daysForward, derivedByDate) {
  if (!tideListEl) return;
  tideListEl.innerHTML = "";

  const today = new Date();
  const items = [];
  for (let i = 0; i < daysForward; i++) {
    const d = addDaysUTC(today, i);
    const phase = moonPhaseFraction(d);
    const idx = springNeapIndex(phase);
    const dateStr = toYyyyMmDdUTC(d);
    const doc = derivedByDate.get(dateStr) || null;
    items.push({
      date: dateStr,
      phase,
      phaseKey: moonPhaseKey(phase),
      springNeapIndex: idx,
      springNeapLabel: springNeapLabel(idx),
      doc
    });
  }

  for (const item of items) {
    const div = document.createElement("div");
    div.className = "item";

    const top = document.createElement("div");
    top.className = "item-top";

    const date = document.createElement("div");
    date.className = "item-date";
    date.textContent = item.date;

    const score = document.createElement("div");
    score.className = "item-score";
    score.textContent = t("tideStrength", Math.round(item.springNeapIndex * 100));

    top.appendChild(date);
    top.appendChild(score);

    const sub = document.createElement("div");
    sub.className = "item-sub";
    if (item.springNeapLabel === "spring") sub.appendChild(formatOkPill(t("spring")));
    else if (item.springNeapLabel === "neap") sub.appendChild(formatWarnPill(t("neap")));
    else sub.appendChild(formatPill(t("tideType"), t("mid")));
    sub.appendChild(formatPill(t("moon"), t(item.phaseKey)));
    if (item.doc?.source?.kind === "open_meteo_climatology") {
      const yb = item.doc?.source?.yearsBack;
      sub.appendChild(formatWarnPill(t("predict", yb)));
    }
    if (bottomModeToggle && bottomModeToggle.checked) {
      const g = item.doc?.computed?.bySpecies?.grouper;
      const s = item.doc?.computed?.bySpecies?.snapper;
      sub.appendChild(formatOkPill(`${t("grouper")}:${Number.isFinite(g) ? g : "-"}`));
      sub.appendChild(formatOkPill(`${t("snapper")}:${Number.isFinite(s) ? s : "-"}`));
    }
    sub.appendChild(formatPill(t("tideRange"), item.doc?.tide?.rangeM ?? "-"));
    sub.appendChild(formatPill(t("currentKn"), item.doc?.current?.meanKnots ?? "-"));
    sub.appendChild(formatWavePill(item.doc?.meteo?.waveM, Boolean(item.doc?.computed?.flags?.waveHigh)));
    sub.appendChild(formatPill(t("tempC"), item.doc?.ocean?.surfaceTempC ?? "-"));

    div.appendChild(top);
    div.appendChild(sub);

    div.addEventListener("click", () => {
      if (!item.doc) return;
      detailTitleEl.textContent = `${item.doc.areaId} / ${item.doc.date}`;
      const { computed, ...raw } = item.doc;
      detailEl.textContent = JSON.stringify(raw, null, 2);
    });

    tideListEl.appendChild(div);
  }
}

function scoreCurve(x, min, optMin, optMax, max) {
  if (x === null || x === undefined) return 0;
  if (x <= min || x >= max) return 0;
  if (x >= optMin && x <= optMax) return 1;
  if (x < optMin) return clamp01((x - min) / (optMin - min));
  return clamp01((max - x) / (max - optMax));
}

function computeScoresFromItem(item, bottomMode) {
  const tide = toNumber(item?.tide?.rangeM);
  const cur = toNumber(item?.current?.meanKnots);
  const wave = toNumber(item?.meteo?.waveM);
  const temp = toNumber(item?.ocean?.surfaceTempC);

  const flags = {
    waveHigh: wave !== null && wave > 1.5,
    waveMissing: wave === null || wave === undefined
  };

  const tideScore = scoreCurve(tide, 0.6, 1.4, 2.8, 4.2);
  const curScore = scoreCurve(cur, 0.15, 0.6, 1.25, 2.2);
  const waveScore = scoreCurve(wave, 0.0, 0.35, 1.4, 2.8);
  const tempPelagic = scoreCurve(temp, 24.5, 26.3, 29.2, 31.0);
  const tempReef = scoreCurve(temp, 24.0, 26.0, 30.0, 31.5);

  const curBottom = scoreCurve(cur, 0.05, 0.25, 0.6, 1.2);
  const waveBottom = scoreCurve(wave, 0.0, 0.25, 1.0, 2.0);

  const mackerel = 100 * (0.32 * tideScore + 0.38 * curScore + 0.2 * waveScore + 0.1 * tempPelagic);
  const mahi = 100 * (0.18 * tideScore + 0.35 * curScore + 0.22 * waveScore + 0.25 * tempPelagic);

  const grouper = bottomMode
    ? 100 * (0.46 * tideScore + 0.32 * curBottom + 0.18 * waveBottom + 0.04 * tempReef)
    : 100 * (0.4 * tideScore + 0.25 * curScore + 0.15 * waveScore + 0.2 * tempReef);

  const snapper = bottomMode
    ? 100 * (0.48 * tideScore + 0.28 * curBottom + 0.2 * waveBottom + 0.04 * tempReef)
    : 100 * (0.42 * tideScore + 0.22 * curScore + 0.16 * waveScore + 0.2 * tempReef);

  const bySpecies = {
    mackerel: Math.round(mackerel),
    mahi: Math.round(mahi),
    grouper: Math.round(grouper),
    snapper: Math.round(snapper)
  };

  const overall = bottomMode
    ? Math.round((bySpecies.grouper + bySpecies.snapper) / 2)
    : Math.round((bySpecies.mackerel + bySpecies.mahi + bySpecies.grouper + bySpecies.snapper) / 4);

  return { overall, bySpecies, flags };
}

function getSpeciesScore(item, speciesKey) {
  const score = item?.computed?.bySpecies?.[speciesKey];
  const n = toNumber(score);
  return n ?? null;
}

function pickRecent(allItems, limit) {
  return [...allItems].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}

function pickPastDaysFromToday(allItems, days) {
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startUTC = addDaysUTC(todayUTC, -(days - 1));

  const filtered = allItems.filter((x) => {
    const d = parseYyyyMmDdUTC(String(x?.date || ""));
    if (!d) return false;
    return d.getTime() >= startUTC.getTime() && d.getTime() <= todayUTC.getTime();
  });

  return filtered.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, days);
}

async function fetchDailyStats(db, areaId, limit) {
  const snap = await db
    .collection("dailyStats")
    .where("areaId", "==", areaId)
    .orderBy("date", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((d) => d.data());
}

async function fetchDailyStatsFromApi(areaId, limit) {
  const res = await fetch(`/api/daily?areaId=${encodeURIComponent(areaId)}&limit=${encodeURIComponent(limit)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `fetch failed: ${res.status}`);
  }
  return Array.isArray(json.items) ? json.items : [];
}

async function seedFromApi(areaId) {
  const urlReal = `/api/seed?areaId=${encodeURIComponent(areaId)}&days=365&source=real`;
  const resReal = await fetch(urlReal, { method: "POST" });
  const jsonReal = await resReal.json().catch(() => ({}));
  if (resReal.ok) return jsonReal;

  const urlMock = `/api/seed?areaId=${encodeURIComponent(areaId)}&days=365`;
  const resMock = await fetch(urlMock, { method: "POST" });
  const jsonMock = await resMock.json().catch(() => ({}));
  if (!resMock.ok) {
    throw new Error(jsonMock?.error || jsonReal?.error || `seed failed: ${resMock.status}`);
  }
  return jsonMock;
}

async function main() {
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  let cachedAll = [];
  let derivedAll = [];
  let bottomMode = false;
  const derivedByDate = new Map();
  if (isLocal) {
    setStatus(t("localStatus"), "ok");
  } else {
    if (!hasConfig(firebaseConfig)) {
      setStatus(t("missingFirebase"), "danger");
      renderEmpty(t("missingFirebaseHint"));
      return;
    }
    firebase.initializeApp(firebaseConfig);
    setStatus(t("connected", firebaseConfig.projectId), "ok");
  }

  const db = !isLocal ? firebase.firestore() : null;
  if (!isLocal) {
    seedBtn.disabled = true;
    seedBtn.textContent = t("seedOnlyLocal");
  }

  function derive(items) {
    return items.map((x) => ({ ...x, computed: computeScoresFromItem(x, bottomMode) }));
  }

  if (bottomModeToggle) {
    bottomModeToggle.addEventListener("change", () => {
      bottomMode = Boolean(bottomModeToggle.checked);
      derivedAll = derive(cachedAll);
      renderList(pickRecent(derivedAll, 30));
      const head = isLocal ? t("localStatus") : t("connected", firebaseConfig.projectId);
      setStatus(`${head} / ${bottomMode ? t("modeBottom") : t("modeDefault")}`, "ok");
    });
  }

  if (tideRangeSelect) {
    const v = String(tideRangeSelect.value || "180");
    const days = v === "to_2027" ? null : Number(v);
    renderTideCalendar(1, derivedByDate);
    tideRangeSelect.addEventListener("change", () => {
      renderTideCalendar(1, derivedByDate);
    });
  } else {
    renderTideCalendar(1, derivedByDate);
  }

  function applyI18nStaticTexts() {
    const byId = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    byId("title", t("title"));
    byId("subtitle", t("subtitle"));
    byId("labelFirebase", t("firebaseLabel"));
    byId("hintFirebase", t("firebaseHint"));
    byId("labelArea", t("areaLabel"));
    byId("labelLang", t("langLabel"));
    byId("refreshBtn", t("refresh"));
    byId("seedBtn", t("seed"));
    byId("labelMode", t("modeLabel"));
    byId("toggleText", t("modeText"));
    byId("labelTide", t("tideLabel"));
    byId("labelNote", t("noteLabel"));
    byId("hintTide", t("tideHint"));
    byId("labelListTitle", t("listTitle"));
    byId("hintListTitle", t("listHint"));
    byId("labelDetail", t("detail"));
    byId("detailTitle", t("pickDay"));
    document.title = t("title");

    if (tideRangeSelect) {
      for (const opt of tideRangeSelect.querySelectorAll("option")) {
        const v = opt.getAttribute("value");
        if (v === "30") opt.textContent = t("tideOpt30");
        else if (v === "90") opt.textContent = t("tideOpt90");
        else if (v === "180") opt.textContent = t("tideOpt180");
        else if (v === "to_2027") opt.textContent = t("tideOptTo2027");
      }
    }
  }

  const langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.addEventListener("change", () => {
      currentLang = langSelect.value || "zh";
      localStorage.setItem("lang", currentLang);
      applyI18nStaticTexts();
      refresh().catch(() => {});
    });
  }
  applyI18nStaticTexts();

  async function refresh() {
    detailTitleEl.textContent = t("pickDay");
    detailEl.textContent = "";
    renderEmpty(t("loading"));
    const areaId = areaSelect.value;
    cachedAll = isLocal
      ? await fetchDailyStatsFromApi(areaId, MAX_FETCH_DAYS)
      : await fetchDailyStats(db, areaId, MAX_FETCH_DAYS);
    derivedAll = derive(cachedAll);
    derivedByDate.clear();
    for (const d of derivedAll) {
      if (d?.date) derivedByDate.set(String(d.date), d);
    }
    if (!cachedAll.length) {
      renderEmpty(isLocal ? t("noDataLocal") : t("noData"));
      return;
    }

    const past30 = pickPastDaysFromToday(derivedAll, 30);
    renderList(past30.length ? past30 : pickRecent(derivedAll, 30));

    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endUTC = parseYyyyMmDdUTC(TIDE_END_YYYY_MM_DD);
    let daysForward = 180;
    if (tideRangeSelect && String(tideRangeSelect.value) === "to_2027") {
      daysForward = endUTC ? Math.max(1, Math.round((endUTC.getTime() - todayUTC.getTime()) / (24 * 3600 * 1000)) + 1) : 180;
    } else if (tideRangeSelect) {
      daysForward = Math.max(1, Math.min(2500, Number(tideRangeSelect.value || 180)));
    }
    renderTideCalendar(daysForward, derivedByDate);
  }

  refreshBtn.addEventListener("click", () => {
    refresh().catch((e) => {
      setStatus(`${t("loadFailed")}: ${e.message}`, "danger");
      renderEmpty(t("loadFailed"));
    });
  });

  seedBtn.addEventListener("click", () => {
    const areaId = areaSelect.value;
    setStatus(t("seeding"), "ok");
    seedFromApi(areaId)
      .then(() => refresh())
      .then(() => setStatus(t("seedDone"), "ok"))
      .catch((e) => setStatus(t("seedFailed", e.message), "danger"));
  });

  refresh().catch(() => {});
}

main().catch((e) => {
  const message = e?.message || String(e);
  setStatus(t("startFailed", message), "danger");
});
