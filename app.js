const CACHE_KEY = "spcx-psychology-journal-cache-v2";
const LEGACY_STORAGE_KEY = "spcx-psychology-journal-v1";
const SETTINGS_KEY = "spcx-google-sheets-settings-v1";
const BACKUP_VERSION = 2;

const DEFAULT_REPLAY_CHOICE = "維持原本部位";
const DEFAULT_RECORD_TYPE = "盤中";
const PSYCHE_TAGS = ["FOMO", "貪婪", "害怕", "後悔", "平靜", "興奮", "自信", "懷疑"];

const moodEmojis = [
  { max: 1, emoji: "😭" },
  { max: 3, emoji: "😟" },
  { max: 5, emoji: "😐" },
  { max: 7, emoji: "🙂" },
  { max: 9, emoji: "😆" },
  { max: 10, emoji: "🚀" },
];

const regretEmojis = [
  { max: 2, emoji: "😌" },
  { max: 5, emoji: "🤔" },
  { max: 8, emoji: "😣" },
  { max: 10, emoji: "😭" },
];

const state = {
  entries: [],
  appsScriptUrl: "",
  charts: {
    returnChart: null,
    moodChart: null,
    regretChart: null,
    moodReturnChart: null,
  },
};

const form = document.querySelector("#entryForm");
const fields = {
  id: document.querySelector("#entryId"),
  date: document.querySelector("#date"),
  price: document.querySelector("#price"),
  returnRate: document.querySelector("#returnRate"),
  mood: document.querySelector("#mood"),
  note: document.querySelector("#note"),
  regret: document.querySelector("#regret"),
  stockSymbol: document.querySelector("#stockSymbol"),
  sharesHeld: document.querySelector("#sharesHeld"),
  averageCost: document.querySelector("#averageCost"),
};

const output = {
  moodValue: document.querySelector("#moodValue"),
  regretValue: document.querySelector("#regretValue"),
  totalEntries: document.querySelector("#totalEntries"),
  averageMood: document.querySelector("#averageMood"),
  highestReturn: document.querySelector("#highestReturn"),
  lowestReturn: document.querySelector("#lowestReturn"),
  averageReturn: document.querySelector("#averageReturn"),
  averageRegret: document.querySelector("#averageRegret"),
  mostCommonAction: document.querySelector("#mostCommonAction"),
  mostCommonReplay: document.querySelector("#mostCommonReplay"),
  tagLeaderboard: document.querySelector("#tagLeaderboard"),
  historyList: document.querySelector("#historyList"),
  analysisBox: document.querySelector("#analysisBox"),
  syncStatus: document.querySelector("#syncStatus"),
};

const controls = {
  appsScriptUrl: document.querySelector("#appsScriptUrl"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  refreshSheetsButton: document.querySelector("#refreshSheetsButton"),
};

function todayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString("zh-TW", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(value) {
  return `${formatNumber(value)}%`;
}

function formatDate(dateString) {
  return dateString ? dateString.replaceAll("-", "/") : "-";
}

function displayAction(action) {
  return action === "抱著" ? "繼續抱著" : action;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emojiFor(value, scale) {
  return scale.find((item) => value <= item.max)?.emoji || scale.at(-1).emoji;
}

function normalizeTags(value) {
  const tags = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[、,|]/)
        .map((tag) => tag.trim());
  return [...new Set(tags.filter((tag) => PSYCHE_TAGS.includes(tag)))];
}

function formatTags(tags) {
  const normalized = normalizeTags(tags);
  return normalized.length ? normalized.join("、") : "未標記";
}

function normalizeTimestamp(value) {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeEntry(entry) {
  const now = Date.now();
  return {
    id: entry.id || crypto.randomUUID(),
    date: entry.date || todayString(),
    recordType: entry.recordType || DEFAULT_RECORD_TYPE,
    price: parseNumber(entry.price ?? entry.spcxPrice),
    returnRate: parseNumber(entry.returnRate),
    mood: parseNumber(entry.mood ?? entry.moodScore),
    action: entry.action || "抱著",
    replayChoice: entry.replayChoice || entry.redoChoice || DEFAULT_REPLAY_CHOICE,
    psycheTags: normalizeTags(entry.psycheTags),
    regret: parseNumber(entry.regret ?? entry.regretScore),
    note: entry.note || "",
    stockSymbol: entry.stockSymbol || "SPCX",
    sharesHeld: entry.sharesHeld ?? null,
    averageCost: entry.averageCost ?? null,
    deleted: entry.deleted === true || String(entry.deleted).toUpperCase() === "TRUE",
    deletedAt: entry.deletedAt ? normalizeTimestamp(entry.deletedAt) : null,
    createdAt: entry.createdAt ? normalizeTimestamp(entry.createdAt) : now,
    updatedAt: entry.updatedAt ? normalizeTimestamp(entry.updatedAt) : now,
  };
}

function toSheetEntry(entry) {
  const normalized = normalizeEntry(entry);
  return {
    id: normalized.id,
    date: normalized.date,
    recordType: normalized.recordType,
    spcxPrice: normalized.price,
    returnRate: normalized.returnRate,
    moodScore: normalized.mood,
    action: normalized.action,
    redoChoice: normalized.replayChoice,
    psycheTags: normalized.psycheTags.join("、"),
    regretScore: normalized.regret,
    note: normalized.note,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    deleted: normalized.deleted,
    deletedAt: normalized.deletedAt,
  };
}

function activeEntries() {
  return state.entries.filter((entry) => !entry.deleted);
}

function sortEntries(entries, ascending = false) {
  return [...entries].sort((a, b) => {
    const dateCompare = new Date(a.date) - new Date(b.date);
    if (dateCompare !== 0) return ascending ? dateCompare : -dateCompare;
    return ascending ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
  });
}

function setSyncStatus(status) {
  const labels = {
    synced: "🟢 已同步",
    syncing: "🟡 同步中",
    offline: "🔴 無法連線",
  };
  output.syncStatus.textContent = labels[status] || labels.offline;
}

function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    state.appsScriptUrl = settings.appsScriptUrl || "";
  } catch {
    state.appsScriptUrl = "";
  }
  controls.appsScriptUrl.value = state.appsScriptUrl;
}

function saveSettings() {
  state.appsScriptUrl = controls.appsScriptUrl.value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ appsScriptUrl: state.appsScriptUrl }));
  loadFromSheets();
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    if (Array.isArray(cached)) return cached.map(normalizeEntry);
  } catch {
    // Fall through to legacy cache.
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
    return Array.isArray(legacy) ? legacy.map(normalizeEntry) : [];
  } catch {
    return [];
  }
}

function writeCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(state.entries.map(normalizeEntry)));
}

async function sheetsRequest(action, payload = {}) {
  if (!state.appsScriptUrl) {
    throw new Error("Missing Apps Script URL");
  }

  if (action === "list") {
    const url = new URL(state.appsScriptUrl);
    url.searchParams.set("action", "list");
    url.searchParams.set("_", String(Date.now()));
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) throw new Error("Google Sheets read failed");
    const result = await response.json();
    if (result.ok === false) throw new Error(result.error || "Google Sheets read failed");
    return result;
  }

  const response = await fetch(state.appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!response.ok) throw new Error("Google Sheets write failed");
  const result = await response.json();
  if (result.ok === false) throw new Error(result.error || "Google Sheets write failed");
  return result;
}

async function loadFromSheets() {
  if (!state.appsScriptUrl) {
    state.entries = readCache();
    setSyncStatus("offline");
    render();
    output.analysisBox.textContent = "請先填入 Apps Script Web App URL，才能使用 Google Sheets 雲端資料。";
    return;
  }

  setSyncStatus("syncing");
  try {
    const result = await sheetsRequest("list");
    state.entries = Array.isArray(result.entries) ? result.entries.map(normalizeEntry) : [];
    writeCache();
    setSyncStatus("synced");
    render();
  } catch (error) {
    state.entries = readCache();
    setSyncStatus("offline");
    render();
    output.analysisBox.textContent = "無法連線 Google Sheets，已顯示本機快取資料。";
  }
}

function getSelectedRadio(name, fallback) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
}

function setSelectedRadio(name, value) {
  const input = form.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function getSelectedAction() {
  return getSelectedRadio("action", "抱著");
}

function getSelectedRecordType() {
  return getSelectedRadio("recordType", DEFAULT_RECORD_TYPE);
}

function getSelectedReplayChoice() {
  return getSelectedRadio("replayChoice", DEFAULT_REPLAY_CHOICE);
}

function getSelectedTags() {
  return [...form.querySelectorAll('input[name="psycheTags"]:checked')].map((input) => input.value);
}

function setSelectedTags(tags) {
  const normalized = normalizeTags(tags);
  form.querySelectorAll('input[name="psycheTags"]').forEach((input) => {
    input.checked = normalized.includes(input.value);
  });
}

function resetForm() {
  form.reset();
  fields.id.value = "";
  fields.date.value = todayString();
  fields.mood.value = 5;
  fields.regret.value = 5;
  fields.stockSymbol.value = "SPCX";
  fields.sharesHeld.value = "";
  fields.averageCost.value = "";
  setSelectedRadio("recordType", DEFAULT_RECORD_TYPE);
  setSelectedRadio("action", "抱著");
  setSelectedRadio("replayChoice", DEFAULT_REPLAY_CHOICE);
  setSelectedTags([]);
  updateRangeLabels();
  document.querySelector("#saveButton").textContent = "儲存日記";
}

function updateRangeLabels() {
  const mood = parseNumber(fields.mood.value);
  const regret = parseNumber(fields.regret.value);
  output.moodValue.textContent = `今日心情：${mood}/10 ${emojiFor(mood, moodEmojis)}`;
  output.regretValue.textContent = `後悔指數：${regret}/10 ${emojiFor(regret, regretEmojis)}`;
}

function useYesterdayData() {
  const latest = sortEntries(activeEntries())[0];
  if (!latest) {
    output.analysisBox.textContent = "目前還沒有可複製的日記。先建立第一筆心理紀錄。";
    return;
  }

  fields.id.value = "";
  fields.date.value = todayString();
  fields.price.value = "";
  fields.returnRate.value = latest.returnRate;
  fields.mood.value = latest.mood;
  fields.note.value = latest.note;
  fields.regret.value = latest.regret;
  fields.stockSymbol.value = latest.stockSymbol || "SPCX";
  fields.sharesHeld.value = latest.sharesHeld ?? "";
  fields.averageCost.value = latest.averageCost ?? "";
  setSelectedRadio("recordType", latest.recordType || DEFAULT_RECORD_TYPE);
  setSelectedRadio("action", latest.action);
  setSelectedRadio("replayChoice", latest.replayChoice || DEFAULT_REPLAY_CHOICE);
  setSelectedTags(latest.psycheTags);
  updateRangeLabels();
  document.querySelector("#saveButton").textContent = "儲存日記";
}

async function upsertEntry(event) {
  event.preventDefault();
  if (!state.appsScriptUrl) {
    window.alert("請先設定 Apps Script Web App URL。");
    return;
  }

  const id = fields.id.value || crypto.randomUUID();
  const existing = state.entries.find((entry) => entry.id === id);
  const now = Date.now();
  const entry = normalizeEntry({
    id,
    date: fields.date.value,
    recordType: getSelectedRecordType(),
    price: parseNumber(fields.price.value),
    returnRate: parseNumber(fields.returnRate.value),
    mood: parseNumber(fields.mood.value),
    action: getSelectedAction(),
    replayChoice: getSelectedReplayChoice(),
    psycheTags: getSelectedTags(),
    note: fields.note.value.trim(),
    regret: parseNumber(fields.regret.value),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  setSyncStatus("syncing");
  try {
    await sheetsRequest(existing ? "update" : "create", { entry: toSheetEntry(entry) });
    resetForm();
    await loadFromSheets();
  } catch (error) {
    setSyncStatus("offline");
    window.alert("無法寫入 Google Sheets，請檢查 Apps Script URL 或網路連線。");
  }
}

function editEntry(id) {
  const entry = state.entries.find((item) => item.id === id && !item.deleted);
  if (!entry) return;

  fields.id.value = entry.id;
  fields.date.value = entry.date;
  fields.price.value = entry.price;
  fields.returnRate.value = entry.returnRate;
  fields.mood.value = entry.mood;
  fields.note.value = entry.note;
  fields.regret.value = entry.regret;
  fields.stockSymbol.value = entry.stockSymbol || "SPCX";
  fields.sharesHeld.value = entry.sharesHeld ?? "";
  fields.averageCost.value = entry.averageCost ?? "";
  setSelectedRadio("recordType", entry.recordType || DEFAULT_RECORD_TYPE);
  setSelectedRadio("action", entry.action);
  setSelectedRadio("replayChoice", entry.replayChoice || DEFAULT_REPLAY_CHOICE);
  setSelectedTags(entry.psycheTags);
  updateRangeLabels();
  document.querySelector("#saveButton").textContent = "更新日記";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(id) {
  const entry = state.entries.find((item) => item.id === id && !item.deleted);
  if (!entry) return;

  const confirmed = window.confirm(`確定刪除 ${entry.date} 的日記嗎？`);
  if (!confirmed) return;

  setSyncStatus("syncing");
  try {
    await sheetsRequest("delete", { id });
    await loadFromSheets();
  } catch (error) {
    setSyncStatus("offline");
    window.alert("無法刪除 Google Sheets 資料，請檢查連線後再試。");
  }
}

function mostCommon(values) {
  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function countTags(entries) {
  return entries
    .flatMap((entry) => normalizeTags(entry.psycheTags))
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
}

function rankedTags(entries) {
  return Object.entries(countTags(entries)).sort((a, b) => b[1] - a[1]);
}

function formatTagLeaderboard(entries) {
  const ranking = rankedTags(entries);
  return ranking.length ? ranking.map(([tag, count]) => `${tag}：${count}次`).join("\n") : "-";
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function calculateStats() {
  const entries = activeEntries();
  const total = entries.length;
  if (!total) {
    return {
      total,
      averageMood: 0,
      highestReturn: 0,
      lowestReturn: 0,
      averageReturn: 0,
      averageRegret: 0,
      mostCommonAction: "-",
      mostCommonReplay: "-",
      tagLeaderboard: "-",
    };
  }

  const returns = entries.map((entry) => entry.returnRate);
  return {
    total,
    averageMood: average(entries.map((entry) => entry.mood)),
    highestReturn: Math.max(...returns),
    lowestReturn: Math.min(...returns),
    averageReturn: average(returns),
    averageRegret: average(entries.map((entry) => entry.regret)),
    mostCommonAction: mostCommon(entries.map((entry) => entry.action)),
    mostCommonReplay: mostCommon(entries.map((entry) => entry.replayChoice || DEFAULT_REPLAY_CHOICE)),
    tagLeaderboard: formatTagLeaderboard(entries),
  };
}

function renderStats() {
  const stats = calculateStats();
  output.totalEntries.textContent = stats.total;
  output.averageMood.textContent = stats.averageMood.toFixed(1);
  output.highestReturn.textContent = formatPercent(stats.highestReturn);
  output.lowestReturn.textContent = formatPercent(stats.lowestReturn);
  output.averageReturn.textContent = formatPercent(stats.averageReturn);
  output.averageRegret.textContent = stats.averageRegret.toFixed(1);
  output.mostCommonAction.textContent = displayAction(stats.mostCommonAction);
  output.mostCommonReplay.textContent = stats.mostCommonReplay;
  output.tagLeaderboard.textContent = stats.tagLeaderboard;
}

function renderHistory() {
  output.historyList.innerHTML = "";
  const entries = activeEntries();

  if (!entries.length) {
    const template = document.querySelector("#emptyStateTemplate");
    output.historyList.append(template.content.cloneNode(true));
    return;
  }

  sortEntries(entries).forEach((entry) => {
    const card = document.createElement("article");
    card.className = "journal-card";
    card.innerHTML = `
      <div class="journal-divider" aria-hidden="true"></div>
      <div class="journal-line"><span>📅</span><strong>${formatDate(entry.date)}</strong></div>
      <div class="journal-line"><span>🕒</span><div>記錄類型：<strong>${escapeHtml(entry.recordType || DEFAULT_RECORD_TYPE)}</strong></div></div>
      <div class="journal-line"><span>💰</span><div>SPCX：<strong>${formatNumber(entry.price)}</strong></div></div>
      <div class="journal-line"><span>📈</span><div>報酬率：<strong>${formatPercent(entry.returnRate)}</strong></div></div>
      <div class="journal-line"><span>${emojiFor(entry.mood, moodEmojis)}</span><div>心情：<strong>${entry.mood}</strong></div></div>
      <div class="journal-line"><span>🚀</span><div>動作：<strong>${displayAction(entry.action)}</strong></div></div>
      <div class="journal-line"><span>🎯</span><div>重來一次：<strong>${entry.replayChoice || DEFAULT_REPLAY_CHOICE}</strong></div></div>
      <div class="journal-line"><span>🧠</span><div>心理標籤：<strong>${escapeHtml(formatTags(entry.psycheTags))}</strong></div></div>
      <div class="journal-line"><span>${emojiFor(entry.regret, regretEmojis)}</span><div>後悔指數：<strong>${entry.regret}</strong></div></div>
      <div class="journal-line"><span>💬</span><div>心得：</div></div>
      <p class="journal-note">${escapeHtml(entry.note)}</p>
      <div class="card-actions">
        <button class="card-button" type="button" data-action="edit">✏️ 編輯</button>
        <button class="card-button delete" type="button" data-action="delete">🗑️ 刪除</button>
      </div>
      <div class="journal-divider" aria-hidden="true"></div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener("click", () => editEntry(entry.id));
    card
      .querySelector('[data-action="delete"]')
      .addEventListener("click", () => deleteEntry(entry.id));
    output.historyList.append(card);
  });
}

function chartOptions(title, overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#05070d",
        borderColor: "#263446",
        borderWidth: 1,
        titleColor: "#ffffff",
        bodyColor: "#c8d0da",
      },
      title: { display: false, text: title },
    },
    scales: {
      x: {
        title: { display: Boolean(overrides.xTitle), text: overrides.xTitle, color: "#c8d0da" },
        ticks: { color: "#9aa8b8", maxRotation: 0 },
        grid: { color: "rgba(200, 208, 218, 0.08)" },
      },
      y: {
        title: { display: Boolean(overrides.yTitle), text: overrides.yTitle, color: "#c8d0da" },
        min: overrides.yMin,
        max: overrides.yMax,
        ticks: { color: "#9aa8b8" },
        grid: { color: "rgba(200, 208, 218, 0.08)" },
      },
    },
  };
}

function makeDataset(label, data, color) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: `${color}22`,
    pointBackgroundColor: "#ffffff",
    pointBorderColor: color,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 2,
    tension: 0.32,
    fill: true,
  };
}

function renderCharts() {
  if (typeof Chart === "undefined") return;

  const ordered = sortEntries(activeEntries(), true);
  const labels = ordered.map((entry) => entry.date);
  const chartConfigs = [
    {
      key: "returnChart",
      element: "returnChart",
      label: "總報酬率 %",
      data: ordered.map((entry) => entry.returnRate),
      color: "#2d8cff",
      options: chartOptions("總報酬率 %", { yTitle: "總報酬率 %" }),
    },
    {
      key: "moodChart",
      element: "moodChart",
      label: "心情分數",
      data: ordered.map((entry) => entry.mood),
      color: "#78d4a5",
      options: chartOptions("心情分數", { yMin: 0, yMax: 10, yTitle: "心情分數" }),
    },
    {
      key: "regretChart",
      element: "regretChart",
      label: "後悔指數",
      data: ordered.map((entry) => entry.regret),
      color: "#c8d0da",
      options: chartOptions("後悔指數", { yMin: 0, yMax: 10, yTitle: "後悔指數" }),
    },
  ];

  chartConfigs.forEach((config) => {
    const ctx = document.querySelector(`#${config.element}`);
    if (state.charts[config.key]) state.charts[config.key].destroy();
    state.charts[config.key] = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [makeDataset(config.label, config.data, config.color)] },
      options: config.options,
    });
  });

  const scatterCtx = document.querySelector("#moodReturnChart");
  if (state.charts.moodReturnChart) state.charts.moodReturnChart.destroy();
  state.charts.moodReturnChart = new Chart(scatterCtx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "心情 vs 報酬率",
          data: ordered.map((entry) => ({ x: entry.returnRate, y: entry.mood })),
          borderColor: "#ffffff",
          backgroundColor: "rgba(45, 140, 255, 0.72)",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: chartOptions("心情 vs 報酬率", {
      xTitle: "報酬率 %",
      yTitle: "心情分數",
      yMin: 0,
      yMax: 10,
    }),
  });
}

function correlation(entries, xKey, yKey) {
  if (entries.length < 2) return 0;
  const xs = entries.map((entry) => entry[xKey]);
  const ys = entries.map((entry) => entry[yKey]);
  const avgX = average(xs);
  const avgY = average(ys);
  const numerator = entries.reduce(
    (sum, _entry, index) => sum + (xs[index] - avgX) * (ys[index] - avgY),
    0,
  );
  const denominatorX = Math.sqrt(xs.reduce((sum, value) => sum + (value - avgX) ** 2, 0));
  const denominatorY = Math.sqrt(ys.reduce((sum, value) => sum + (value - avgY) ** 2, 0));
  if (!denominatorX || !denominatorY) return 0;
  return numerator / (denominatorX * denominatorY);
}

function describeCorrelation(value) {
  const strength = Math.abs(value);
  if (strength >= 0.65) return value > 0 ? "明顯正相關" : "明顯負相關";
  if (strength >= 0.35) return value > 0 ? "中度正相關" : "中度負相關";
  if (strength >= 0.15) return value > 0 ? "輕微正相關" : "輕微負相關";
  return "關聯不明顯";
}

function percentage(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function generatePsychologyInsights() {
  const entries = sortEntries(activeEntries(), true);
  if (entries.length < 2) return ["至少需要兩篇日記，才能看出心理變化的方向。"];

  const stats = calculateStats();
  const insights = [];
  const holdCount = entries.filter((entry) => entry.action === "抱著").length;
  const sellCount = entries.filter((entry) => entry.action === "賣").length;
  const highReturnEntries = entries.filter((entry) => entry.returnRate >= 20);
  const lossEntries = entries.filter((entry) => entry.returnRate < 0);
  const returnMoodCorrelation = correlation(entries, "returnRate", "mood");
  const returnRegretCorrelation = correlation(entries, "returnRate", "regret");
  const topTag = rankedTags(entries)[0];

  insights.push(
    `你有 ${percentage(holdCount, entries.length)}% 的時間選擇「繼續抱著」，目前最常出現的操作傾向是「${displayAction(
      stats.mostCommonAction,
    )}」。`,
  );

  if (topTag) {
    const [tag, count] = topTag;
    insights.push(
      `你最常出現的心理標籤是「${tag}」，出現比例 ${percentage(
        count,
        entries.length,
      )}%。這是目前最值得持續觀察的投資心理訊號。`,
    );
  }

  if (highReturnEntries.length) {
    const highReturnRegret = average(highReturnEntries.map((entry) => entry.regret));
    const delta = highReturnRegret - stats.averageRegret;
    insights.push(
      delta >= 1
        ? `當報酬率超過20%後，你的後悔指數平均為 ${highReturnRegret.toFixed(
            1,
          )}，比整體平均高 ${delta.toFixed(1)}。`
        : `報酬率超過20%的紀錄中，後悔指數平均為 ${highReturnRegret.toFixed(
            1,
          )}，和整體平均 ${stats.averageRegret.toFixed(1)} 接近。`,
    );
  }

  insights.push(
    `你的平均心情與報酬率呈現「${describeCorrelation(
      returnMoodCorrelation,
    )}」（相關係數 ${returnMoodCorrelation.toFixed(2)}）。`,
  );
  insights.push(
    `報酬率與後悔指數呈現「${describeCorrelation(
      returnRegretCorrelation,
    )}」（相關係數 ${returnRegretCorrelation.toFixed(2)}）。`,
  );

  if (lossEntries.length) {
    const lossSellRate = percentage(
      lossEntries.filter((entry) => entry.action === "賣").length,
      lossEntries.length,
    );
    const overallSellRate = percentage(sellCount, entries.length);
    insights.push(
      lossSellRate <= overallSellRate
        ? `虧損時，你想賣出的比例是 ${lossSellRate}%，低於或接近整體賣出傾向 ${overallSellRate}%。`
        : `虧損時，你想賣出的比例是 ${lossSellRate}%，高於整體賣出傾向 ${overallSellRate}%。`,
    );
  }

  insights.push(`如果重來一次，你最常選擇「${stats.mostCommonReplay}」。`);
  return insights;
}

function analyzePsychology() {
  output.analysisBox.innerHTML = generatePsychologyInsights()
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const headers = [
    "id",
    "date",
    "recordType",
    "spcxPrice",
    "returnRate",
    "moodScore",
    "action",
    "redoChoice",
    "psycheTags",
    "regretScore",
    "note",
    "createdAt",
    "updatedAt",
  ];
  const rows = sortEntries(activeEntries(), true).map((entry) => {
    const sheetEntry = toSheetEntry(entry);
    return headers
      .map((key) => `"${String(sheetEntry[key] ?? "").replaceAll('"', '""')}"`)
      .join(",");
  });
  downloadFile(
    "spcx-investment-psychology-journal.csv",
    [headers.join(","), ...rows].join("\n"),
    "text/csv;charset=utf-8",
  );
}

function exportJson() {
  downloadFile(
    `spcx-investment-lab-export-${todayString()}.json`,
    JSON.stringify(
      {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        source: "google-sheets-cache",
        entries: sortEntries(state.entries, true).map(toSheetEntry),
      },
      null,
      2,
    ),
    "application/json;charset=utf-8",
  );
}

function exportReport() {
  const stats = calculateStats();
  const insights = generatePsychologyInsights();
  const records = sortEntries(activeEntries(), true)
    .map(
      (entry) => `## ${formatDate(entry.date)}

- 記錄類型：${entry.recordType || DEFAULT_RECORD_TYPE}
- SPCX：${formatNumber(entry.price)}
- 報酬率：${formatPercent(entry.returnRate)}
- 心情：${entry.mood}/10 ${emojiFor(entry.mood, moodEmojis)}
- 動作：${displayAction(entry.action)}
- 重來一次：${entry.replayChoice || DEFAULT_REPLAY_CHOICE}
- 心理標籤：${formatTags(entry.psycheTags)}
- 後悔指數：${entry.regret}/10 ${emojiFor(entry.regret, regretEmojis)}
- 心得：${entry.note}`,
    )
    .join("\n\n");

  const report = `# SPCX 投資心理研究室完整報告

產出時間：${new Date().toLocaleString("zh-TW")}

## 總覽

- 總日記數：${stats.total}
- 平均心情：${stats.averageMood.toFixed(1)}
- 平均報酬率：${formatPercent(stats.averageReturn)}
- 平均後悔指數：${stats.averageRegret.toFixed(1)}
- 最高報酬率：${formatPercent(stats.highestReturn)}
- 最低報酬率：${formatPercent(stats.lowestReturn)}
- 最常選擇的動作：${displayAction(stats.mostCommonAction)}
- 最常出現的重來一次選項：${stats.mostCommonReplay}
- 心理標籤排行榜：
${stats.tagLeaderboard
  .split("\n")
  .map((line) => `  - ${line}`)
  .join("\n")}

## 心理分析摘要

${insights.map((line) => `- ${line}`).join("\n")}

## 所有歷史紀錄

${records || "尚未建立日記。"}
`;

  downloadFile("spcx-investment-psychology-report.md", report, "text/markdown;charset=utf-8");
}

function render() {
  renderStats();
  renderHistory();
  renderCharts();
}

function bindEvents() {
  form.addEventListener("submit", upsertEntry);
  fields.mood.addEventListener("input", updateRangeLabels);
  fields.regret.addEventListener("input", updateRangeLabels);
  document.querySelector("#resetFormButton").addEventListener("click", resetForm);
  document.querySelector("#useYesterdayButton").addEventListener("click", useYesterdayData);
  document.querySelector("#analyzeButton").addEventListener("click", analyzePsychology);
  document.querySelector("#exportCsvButton").addEventListener("click", exportCsv);
  document.querySelector("#exportJsonButton").addEventListener("click", exportJson);
  document.querySelector("#exportReportButton").addEventListener("click", exportReport);
  controls.saveSettingsButton.addEventListener("click", saveSettings);
  controls.refreshSheetsButton.addEventListener("click", loadFromSheets);
}

function init() {
  loadSettings();
  bindEvents();
  resetForm();
  state.entries = readCache();
  render();
  loadFromSheets();
}

init();
