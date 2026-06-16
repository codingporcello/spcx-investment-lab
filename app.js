const STORAGE_KEY = "spcx-psychology-journal-v1";

const DEFAULT_REPLAY_CHOICE = "維持原本部位";

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
  historyList: document.querySelector("#historyList"),
  analysisBox: document.querySelector("#analysisBox"),
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

function normalizeEntry(entry) {
  return {
    ...entry,
    stockSymbol: entry.stockSymbol || "SPCX",
    replayChoice: entry.replayChoice || DEFAULT_REPLAY_CHOICE,
    sharesHeld: entry.sharesHeld ?? null,
    averageCost: entry.averageCost ?? null,
    createdAt: entry.createdAt || Date.now(),
    updatedAt: entry.updatedAt || entry.createdAt || Date.now(),
  };
}

function loadEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.entries = Array.isArray(saved) ? saved.map(normalizeEntry) : [];
  } catch {
    state.entries = [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function sortEntries(entries, ascending = false) {
  return [...entries].sort((a, b) => {
    const dateCompare = new Date(a.date) - new Date(b.date);
    if (dateCompare !== 0) return ascending ? dateCompare : -dateCompare;
    return ascending ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
  });
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

function getSelectedReplayChoice() {
  return getSelectedRadio("replayChoice", DEFAULT_REPLAY_CHOICE);
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
  setSelectedRadio("action", "抱著");
  setSelectedRadio("replayChoice", DEFAULT_REPLAY_CHOICE);
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
  const latest = sortEntries(state.entries)[0];
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
  setSelectedRadio("action", latest.action);
  setSelectedRadio("replayChoice", latest.replayChoice || DEFAULT_REPLAY_CHOICE);
  updateRangeLabels();
  document.querySelector("#saveButton").textContent = "儲存日記";
}

function upsertEntry(event) {
  event.preventDefault();

  const id = fields.id.value || crypto.randomUUID();
  const existing = state.entries.find((entry) => entry.id === id);
  const now = Date.now();

  const entry = normalizeEntry({
    id,
    date: fields.date.value,
    price: parseNumber(fields.price.value),
    returnRate: parseNumber(fields.returnRate.value),
    mood: parseNumber(fields.mood.value),
    action: getSelectedAction(),
    replayChoice: getSelectedReplayChoice(),
    note: fields.note.value.trim(),
    regret: parseNumber(fields.regret.value),
    stockSymbol: fields.stockSymbol.value || "SPCX",
    sharesHeld: fields.sharesHeld.value === "" ? null : parseNumber(fields.sharesHeld.value),
    averageCost: fields.averageCost.value === "" ? null : parseNumber(fields.averageCost.value),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });

  if (existing) {
    state.entries = state.entries.map((item) => (item.id === id ? entry : item));
  } else {
    state.entries.push(entry);
  }

  saveEntries();
  resetForm();
  render();
}

function editEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
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
  setSelectedRadio("action", entry.action);
  setSelectedRadio("replayChoice", entry.replayChoice || DEFAULT_REPLAY_CHOICE);
  updateRangeLabels();
  document.querySelector("#saveButton").textContent = "更新日記";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  const confirmed = window.confirm(`確定刪除 ${entry.date} 的日記嗎？`);
  if (!confirmed) return;

  state.entries = state.entries.filter((item) => item.id !== id);
  saveEntries();
  render();
}

function mostCommon(values) {
  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function calculateStats() {
  const total = state.entries.length;
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
    };
  }

  const returns = state.entries.map((entry) => entry.returnRate);
  return {
    total,
    averageMood: average(state.entries.map((entry) => entry.mood)),
    highestReturn: Math.max(...returns),
    lowestReturn: Math.min(...returns),
    averageReturn: average(returns),
    averageRegret: average(state.entries.map((entry) => entry.regret)),
    mostCommonAction: mostCommon(state.entries.map((entry) => entry.action)),
    mostCommonReplay: mostCommon(
      state.entries.map((entry) => entry.replayChoice || DEFAULT_REPLAY_CHOICE),
    ),
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
}

function renderHistory() {
  output.historyList.innerHTML = "";

  if (!state.entries.length) {
    const template = document.querySelector("#emptyStateTemplate");
    output.historyList.append(template.content.cloneNode(true));
    return;
  }

  sortEntries(state.entries).forEach((entry) => {
    const card = document.createElement("article");
    card.className = "journal-card";
    card.innerHTML = `
      <div class="journal-divider" aria-hidden="true"></div>
      <div class="journal-line"><span>📅</span><strong>${formatDate(entry.date)}</strong></div>
      <div class="journal-line"><span>💰</span><div>SPCX：<strong>${formatNumber(entry.price)}</strong></div></div>
      <div class="journal-line"><span>📈</span><div>報酬率：<strong>${formatPercent(entry.returnRate)}</strong></div></div>
      <div class="journal-line"><span>${emojiFor(entry.mood, moodEmojis)}</span><div>心情：<strong>${entry.mood}</strong></div></div>
      <div class="journal-line"><span>🚀</span><div>動作：<strong>${displayAction(entry.action)}</strong></div></div>
      <div class="journal-line"><span>🎯</span><div>重來一次：<strong>${entry.replayChoice || DEFAULT_REPLAY_CHOICE}</strong></div></div>
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
  if (typeof Chart === "undefined") {
    return;
  }

  const ordered = sortEntries(state.entries, true);
  const labels = ordered.map((entry) => entry.date);

  const chartConfigs = [
    {
      key: "returnChart",
      element: "returnChart",
      label: "總報酬率 %",
      type: "line",
      data: ordered.map((entry) => entry.returnRate),
      color: "#2d8cff",
      options: chartOptions("總報酬率 %", { yTitle: "總報酬率 %" }),
    },
    {
      key: "moodChart",
      element: "moodChart",
      label: "心情分數",
      type: "line",
      data: ordered.map((entry) => entry.mood),
      color: "#78d4a5",
      options: chartOptions("心情分數", { yMin: 0, yMax: 10, yTitle: "心情分數" }),
    },
    {
      key: "regretChart",
      element: "regretChart",
      label: "後悔指數",
      type: "line",
      data: ordered.map((entry) => entry.regret),
      color: "#c8d0da",
      options: chartOptions("後悔指數", { yMin: 0, yMax: 10, yTitle: "後悔指數" }),
    },
  ];

  chartConfigs.forEach((config) => {
    const ctx = document.querySelector(`#${config.element}`);
    if (state.charts[config.key]) {
      state.charts[config.key].destroy();
    }

    state.charts[config.key] = new Chart(ctx, {
      type: config.type,
      data: {
        labels,
        datasets: [makeDataset(config.label, config.data, config.color)],
      },
      options: config.options,
    });
  });

  const scatterCtx = document.querySelector("#moodReturnChart");
  if (state.charts.moodReturnChart) {
    state.charts.moodReturnChart.destroy();
  }
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
  if (state.entries.length < 2) {
    return ["至少需要兩篇日記，才能看出心理變化的方向。"];
  }

  const entries = sortEntries(state.entries, true);
  const stats = calculateStats();
  const insights = [];
  const holdCount = entries.filter((entry) => entry.action === "抱著").length;
  const sellCount = entries.filter((entry) => entry.action === "賣").length;
  const highReturnEntries = entries.filter((entry) => entry.returnRate >= 20);
  const lossEntries = entries.filter((entry) => entry.returnRate < 0);
  const returnMoodCorrelation = correlation(entries, "returnRate", "mood");
  const returnRegretCorrelation = correlation(entries, "returnRate", "regret");
  const regretAverage = stats.averageRegret;

  insights.push(
    `你有 ${percentage(holdCount, entries.length)}% 的時間選擇「繼續抱著」，目前最常出現的操作傾向是「${displayAction(
      stats.mostCommonAction,
    )}」。`,
  );

  if (highReturnEntries.length) {
    const highReturnRegret = average(highReturnEntries.map((entry) => entry.regret));
    const delta = highReturnRegret - regretAverage;
    insights.push(
      delta >= 1
        ? `當報酬率超過20%後，你的後悔指數平均為 ${highReturnRegret.toFixed(
            1,
          )}，比整體平均高 ${delta.toFixed(1)}，顯示獲利後反而更容易回想「如果當初更多」。`
        : `報酬率超過20%的紀錄中，後悔指數平均為 ${highReturnRegret.toFixed(
            1,
          )}，和整體平均 ${regretAverage.toFixed(1)} 接近，高報酬沒有明顯放大後悔感。`,
    );
  }

  insights.push(
    `你的平均心情與報酬率呈現「${describeCorrelation(
      returnMoodCorrelation,
    )}」（相關係數 ${returnMoodCorrelation.toFixed(2)}），這能幫你觀察自己是不是因為賺錢才開心。`,
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
    if (lossSellRate === 0 && overallSellRate === 0) {
      insights.push("虧損紀錄中沒有出現賣出的想法，目前看起來你在下跌時更偏向觀察或持有。");
    } else {
      insights.push(
        lossSellRate <= overallSellRate
          ? `虧損時，你只有 ${lossSellRate}% 的紀錄想賣，低於或接近整體賣出傾向 ${overallSellRate}%，代表虧損不一定會立刻觸發你想逃離。`
          : `虧損時，你有 ${lossSellRate}% 的紀錄想賣，高於整體賣出傾向 ${overallSellRate}%，要特別留意虧損壓力是否推動決策。`,
      );
    }
  }

  insights.push(`如果重來一次，你最常選擇「${stats.mostCommonReplay}」。這是你的心理後照鏡。`);

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
    "date",
    "stockSymbol",
    "price",
    "returnRate",
    "mood",
    "action",
    "replayChoice",
    "note",
    "regret",
    "sharesHeld",
    "averageCost",
    "createdAt",
    "updatedAt",
  ];
  const rows = sortEntries(state.entries, true).map((entry) =>
    headers
      .map((key) => {
        const value = entry[key] ?? "";
        return `"${String(value).replaceAll('"', '""')}"`;
      })
      .join(","),
  );
  downloadFile(
    "spcx-investment-psychology-journal.csv",
    [headers.join(","), ...rows].join("\n"),
    "text/csv;charset=utf-8",
  );
}

function exportJson() {
  downloadFile(
    "spcx-investment-psychology-journal.json",
    JSON.stringify(sortEntries(state.entries, true), null, 2),
    "application/json;charset=utf-8",
  );
}

function exportReport() {
  const stats = calculateStats();
  const insights = generatePsychologyInsights();
  const records = sortEntries(state.entries, true)
    .map(
      (entry) => `## ${formatDate(entry.date)}

- SPCX：${formatNumber(entry.price)}
- 報酬率：${formatPercent(entry.returnRate)}
- 心情：${entry.mood}/10 ${emojiFor(entry.mood, moodEmojis)}
- 動作：${displayAction(entry.action)}
- 重來一次：${entry.replayChoice || DEFAULT_REPLAY_CHOICE}
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
}

function init() {
  loadEntries();
  bindEvents();
  resetForm();
  render();
}

init();
