const STORAGE_KEY = "idol-tokuten-lab-v2";
const LEGACY_STORAGE_KEY = "idol-tokuten-lab-v1";
const SETTINGS_KEY = "idol-tokuten-lab-settings-v1";

const scoreFields = [
  ["mood", "心情"],
  ["satisfaction", "特典滿意度"],
  ["stress", "壓力值"],
  ["naturalness", "自然度"],
  ["wantToMeetAgain", "想再見程度"],
  ["regret", "後悔指數"],
  ["liveOnlyInterest", "不特典也想看Live程度"],
];

const initialIdols = [
  { id: "idol-minami-sena", name: "南世菜", group: "AsIs", type: "情感型", memo: "", status: "active" },
  {
    id: "idol-morino-yumeha",
    name: "森乃ゆめは",
    group: "Merry BAD TUNE.",
    type: "治癒型",
    memo: "",
    status: "active",
  },
  { id: "idol-hayakawa-nagisa", name: "早川渚紗", group: "HzMe", type: "探索型", memo: "", status: "active" },
  { id: "idol-fukuma-ayane", name: "福間彩音", group: "ハルニシオン", type: "表演型", memo: "", status: "active" },
];

const state = {
  view: "dashboard",
  detailId: null,
  archiveFilters: {
    idolId: "all",
    group: "all",
    sort: "desc",
  },
  compareIds: [],
  idols: [],
  records: [],
  appsScriptUrl: "",
  syncStatus: "local",
  charts: {},
};

const views = {
  dashboard: document.querySelector("#dashboardView"),
  detail: document.querySelector("#detailView"),
  compare: document.querySelector("#compareView"),
  archive: document.querySelector("#archiveView"),
};

const navButtons = [...document.querySelectorAll(".nav-button")];
const recordDialog = document.querySelector("#recordDialog");
const recordForm = document.querySelector("#recordForm");
const recordFormFields = document.querySelector("#recordFormFields");
const recordDialogTitle = document.querySelector("#recordDialogTitle");
const syncStatusLabel = document.querySelector("#syncStatus");
const syncSettingsForm = document.querySelector("#syncSettingsForm");
const appsScriptUrlInput = document.querySelector("#appsScriptUrl");
const refreshSheetsButton = document.querySelector("#refreshSheetsButton");

function todayString() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampScore(value) {
  return Math.max(0, Math.min(10, numberValue(value)));
}

function average(values) {
  const numbers = values.map(numberValue).filter((value) => Number.isFinite(value));
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function formatScore(value) {
  return value === null || value === undefined ? "-" : numberValue(value).toFixed(1);
}

function formatYen(value) {
  return `¥${Math.round(numberValue(value)).toLocaleString("ja-JP")}`;
}

function formatDate(date) {
  return date ? String(date).replaceAll("-", "/") : "-";
}

function byDateAsc(a, b) {
  return new Date(a.date) - new Date(b.date) || numberValue(a.createdAt) - numberValue(b.createdAt);
}

function byDateDesc(a, b) {
  return new Date(b.date) - new Date(a.date) || numberValue(b.createdAt) - numberValue(a.createdAt);
}

function recordsForIdol(idolId) {
  return state.records.filter((record) => record.idolId === idolId).sort(byDateAsc);
}

function getIdol(idolId) {
  return state.idols.find((idol) => idol.id === idolId);
}

function normalizeIdol(idol) {
  const now = Date.now();
  return {
    id: String(idol.id || uid("idol")),
    name: String(idol.name || "").trim(),
    group: String(idol.group || "").trim(),
    type: String(idol.type || "").trim(),
    memo: String(idol.memo || ""),
    status: idol.status || "active",
    createdAt: numberValue(idol.createdAt || now),
    updatedAt: numberValue(idol.updatedAt || now),
  };
}

function normalizeRecord(record) {
  const now = Date.now();
  const normalized = {
    id: String(record.id || uid("record")),
    idolId: String(record.idolId || ""),
    date: record.date ? String(record.date).slice(0, 10) : todayString(),
    chekiCount: Math.max(0, Math.round(numberValue(record.chekiCount))),
    cost: Math.max(0, Math.round(numberValue(record.cost))),
    summary: String(record.summary || ""),
    memo: String(record.memo || ""),
    createdAt: numberValue(record.createdAt || now),
    updatedAt: numberValue(record.updatedAt || now),
  };

  scoreFields.forEach(([key]) => {
    normalized[key] = clampScore(record[key] ?? 5);
  });

  return normalized;
}

function readLocalData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
    const idols = Array.isArray(saved.idols) && saved.idols.length ? saved.idols.map(normalizeIdol) : initialIdols.map(normalizeIdol);
    const idolIds = new Set(idols.map((idol) => idol.id));
    const records = Array.isArray(saved.records)
      ? saved.records.map(normalizeRecord).filter((record) => idolIds.has(record.idolId))
      : [];
    return { idols, records };
  } catch {
    return { idols: initialIdols.map(normalizeIdol), records: [] };
  }
}

function loadSettings() {
  const configUrl = window.IDOL_LAB_CONFIG?.GOOGLE_APPS_SCRIPT_URL || "";
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    state.appsScriptUrl = saved.appsScriptUrl || configUrl;
  } catch {
    state.appsScriptUrl = configUrl;
  }
  appsScriptUrlInput.value = state.appsScriptUrl;
}

function saveSettings() {
  state.appsScriptUrl = appsScriptUrlInput.value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ appsScriptUrl: state.appsScriptUrl }));
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      idols: state.idols.map(normalizeIdol),
      records: state.records.map(normalizeRecord),
    }),
  );
}

function setSyncStatus(status) {
  state.syncStatus = status;
  const labels = {
    synced: "已同步",
    syncing: "同步中",
    failed: "同步失敗",
    local: "本機模式",
  };
  syncStatusLabel.textContent = labels[status] || labels.local;
  syncStatusLabel.dataset.status = status;
}

async function sheetsRequest(payload) {
  if (!state.appsScriptUrl) throw new Error("尚未設定 Apps Script URL");
  let data = null;

  try {
    const response = await fetch(state.appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Google Sheets 回應錯誤：${response.status}`);
    data = await response.json();
  } catch (error) {
    const url = new URL(state.appsScriptUrl);
    url.searchParams.set("payload", JSON.stringify(payload));
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Google Sheets 回應錯誤：${response.status}`);
    data = await response.json();
  }

  if (!data.ok) throw new Error(data.error || "Google Sheets 同步失敗");
  return data;
}

async function loadFromSheets() {
  if (!state.appsScriptUrl) {
    setSyncStatus("local");
    return false;
  }

  setSyncStatus("syncing");
  try {
    const data = await sheetsRequest({ action: "list" });
    const remoteIdols = Array.isArray(data.idols) ? data.idols.map(normalizeIdol) : [];
    const remoteRecords = Array.isArray(data.records) ? data.records.map(normalizeRecord) : [];

    if (remoteIdols.length || remoteRecords.length) {
      const idolIds = new Set(remoteIdols.map((idol) => idol.id));
      state.idols = remoteIdols.length ? remoteIdols : initialIdols.map(normalizeIdol);
      state.records = remoteRecords.filter((record) => idolIds.has(record.idolId));
      state.compareIds = state.idols.slice(0, 3).map((idol) => idol.id);
      saveState();
    } else {
      await syncToSheets();
      return true;
    }

    setSyncStatus("synced");
    render();
    return true;
  } catch (error) {
    console.warn(error);
    setSyncStatus("failed");
    return false;
  }
}

async function syncToSheets() {
  if (!state.appsScriptUrl) {
    setSyncStatus("local");
    return;
  }

  setSyncStatus("syncing");
  try {
    const data = await sheetsRequest({
      action: "sync",
      idols: state.idols.map(normalizeIdol),
      records: state.records.map(normalizeRecord),
    });
    state.idols = data.idols.map(normalizeIdol);
    state.records = data.records.map(normalizeRecord);
    saveState();
    setSyncStatus("synced");
    render();
  } catch (error) {
    console.warn(error);
    setSyncStatus("failed");
  }
}

function persistAndSync() {
  saveState();
  render();
  void syncToSheets();
}

function getMetrics(idolId) {
  const records = recordsForIdol(idolId);
  const metric = (key) => average(records.map((record) => record[key]));
  return {
    count: records.length,
    mood: metric("mood"),
    satisfaction: metric("satisfaction"),
    stress: metric("stress"),
    regret: metric("regret"),
    wantToMeetAgain: metric("wantToMeetAgain"),
    liveOnlyInterest: metric("liveOnlyInterest"),
    cost: records.reduce((sum, record) => sum + numberValue(record.cost), 0),
    trend: getTrend(records),
  };
}

function getTrend(records) {
  if (records.length < 3) return "資料不足";
  const sorted = [...records].sort(byDateAsc);
  const recent = sorted.slice(-3);
  const values = recent.map(
    (record) =>
      record.mood * 0.35 +
      record.satisfaction * 0.25 +
      record.wantToMeetAgain * 0.2 +
      record.liveOnlyInterest * 0.2 -
      record.stress * 0.18 -
      record.regret * 0.18,
  );
  const spread = Math.max(...values) - Math.min(...values);
  const slope = values.at(-1) - values[0];
  if (spread >= 3.2) return "高波動";
  if (slope >= 1.1) return "上升";
  if (slope <= -1.1) return "冷卻";
  return "穩定";
}

function statusClass(status) {
  return {
    上升: "status-up",
    冷卻: "status-cool",
    高波動: "status-volatile",
    資料不足: "status-low",
  }[status] || "";
}

function inferMainValue(records) {
  const metrics = {
    情緒安定: 10 - numberValue(average(records.map((record) => record.stress))),
    新鮮感: numberValue(average(records.map((record) => record.naturalness))),
    表演滿足: numberValue(average(records.map((record) => record.liveOnlyInterest))),
    特典互動: numberValue(average(records.map((record) => record.satisfaction))),
    習慣性消費:
      numberValue(average(records.map((record) => record.wantToMeetAgain))) -
      numberValue(average(records.map((record) => record.satisfaction))) +
      numberValue(average(records.map((record) => record.regret))) * 0.45,
  };
  return Object.entries(metrics).sort((a, b) => b[1] - a[1])[0][0];
}

function analyzeIdol(idolId) {
  const records = recordsForIdol(idolId);
  if (records.length < 3) return null;
  const metric = (key) => average(records.map((record) => record[key]));
  const stress = numberValue(metric("stress"));
  const regret = numberValue(metric("regret"));
  const satisfaction = numberValue(metric("satisfaction"));
  const liveOnlyInterest = numberValue(metric("liveOnlyInterest"));
  const wantToMeetAgain = numberValue(metric("wantToMeetAgain"));

  return {
    status: getTrend(records),
    mainValue: inferMainValue(records),
    highStress: stress >= 6.5 || records.slice(-3).some((record) => record.stress >= 8),
    regretSpend: regret >= 6 && satisfaction <= 6.2,
    reduceFrequency: stress >= 6.5 || regret >= 6.5 || (wantToMeetAgain >= 7 && satisfaction < 5.5),
    liveOnlyType: liveOnlyInterest >= 7,
  };
}

function render() {
  Object.values(state.charts).forEach((chart) => chart?.destroy());
  state.charts = {};

  Object.entries(views).forEach(([name, element]) => {
    element.hidden = name !== state.view;
  });

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });

  if (state.view === "dashboard") renderDashboard();
  if (state.view === "detail") renderDetail();
  if (state.view === "compare") renderCompare();
  if (state.view === "archive") renderArchive();
}

function setView(view, detailId = null) {
  state.view = view;
  state.detailId = detailId;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDashboard() {
  views.dashboard.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">總覽</p>
        <h2>研究對象總覽</h2>
      </div>
    </div>
    <form id="idolForm" class="panel" autocomplete="off">
      <div class="section-heading">
        <div>
          <p class="eyebrow">新增研究對象</p>
          <h3>新增偶像</h3>
        </div>
      </div>
      <div class="form-grid">
        <label>偶像姓名<input name="name" required placeholder="例：南世菜" /></label>
        <label>所屬團體<input name="group" required placeholder="例：AsIs" /></label>
        <label>類型標籤<input name="type" required placeholder="例：情感型" /></label>
        <label>狀態
          <select name="status">
            <option value="active">觀察中</option>
            <option value="paused">暫停觀察</option>
          </select>
        </label>
        <label class="full-span">備註<textarea name="memo" placeholder="這位偶像在心理分析上的初始假設"></textarea></label>
      </div>
      <div class="form-actions">
        <button class="primary-button" type="submit">新增偶像</button>
      </div>
    </form>
    <div class="dashboard-grid">${state.idols.map(renderIdolCard).join("")}</div>
  `;

  views.dashboard.querySelector("#idolForm").addEventListener("submit", handleIdolSubmit);
  views.dashboard.querySelectorAll("[data-open-idol]").forEach((button) => {
    button.addEventListener("click", () => setView("detail", button.dataset.openIdol));
  });
}

function renderIdolCard(idol) {
  const metrics = getMetrics(idol.id);
  return `
    <button class="idol-card" type="button" data-open-idol="${idol.id}">
      <div class="idol-card-head">
        <div>
          <h3>${escapeHtml(idol.name)}</h3>
          <small>${escapeHtml(idol.group)}</small>
        </div>
        <span class="pill ${statusClass(metrics.trend)}">${metrics.trend}</span>
      </div>
      <div class="pill-row">
        <span class="pill">${escapeHtml(idol.type)}</span>
        <span class="pill muted-pill">${metrics.count} 筆紀錄</span>
      </div>
      <div class="metric-grid">
        ${metricHtml("平均心情", formatScore(metrics.mood))}
        ${metricHtml("特典滿意度", formatScore(metrics.satisfaction))}
        ${metricHtml("平均壓力值", formatScore(metrics.stress))}
        ${metricHtml("後悔指數", formatScore(metrics.regret))}
        ${metricHtml("不特典也想看Live", formatScore(metrics.liveOnlyInterest))}
      </div>
    </button>
  `;
}

function metricHtml(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function handleIdolSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.idols.push(
    normalizeIdol({
      id: uid("idol"),
      name: formData.get("name"),
      group: formData.get("group"),
      type: formData.get("type"),
      memo: formData.get("memo"),
      status: formData.get("status"),
    }),
  );
  state.compareIds = state.idols.slice(0, 3).map((idol) => idol.id);
  event.currentTarget.reset();
  persistAndSync();
}

function renderDetail() {
  const idol = getIdol(state.detailId) || state.idols[0];
  if (!idol) {
    views.detail.innerHTML = `<div class="empty-state">尚未建立偶像資料。</div>`;
    return;
  }
  state.detailId = idol.id;
  const records = recordsForIdol(idol.id);
  const analysis = analyzeIdol(idol.id);

  views.detail.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">單一偶像分析</p>
        <h2>${escapeHtml(idol.name)}</h2>
      </div>
      <div class="section-actions">
        <button class="ghost-button" type="button" data-back-dashboard>回總覽</button>
      </div>
    </div>
    <div class="detail-layout">
      <div class="stack">
        <article class="panel">
          <p class="eyebrow">偶像基本資料</p>
          <form id="idolProfileForm" class="form-grid">
            <label>偶像姓名<input name="name" required value="${escapeHtml(idol.name)}" /></label>
            <label>所屬團體<input name="group" required value="${escapeHtml(idol.group)}" /></label>
            <label>類型標籤<input name="type" required value="${escapeHtml(idol.type)}" /></label>
            <label>狀態
              <select name="status">
                <option value="active" ${idol.status === "active" ? "selected" : ""}>觀察中</option>
                <option value="paused" ${idol.status === "paused" ? "selected" : ""}>暫停觀察</option>
              </select>
            </label>
            <label class="full-span">備註<textarea name="memo">${escapeHtml(idol.memo)}</textarea></label>
            <div class="form-actions full-span">
              <button class="primary-button" type="submit">儲存偶像資料</button>
              <button class="ghost-button danger-button" type="button" data-delete-idol>刪除偶像與紀錄</button>
            </div>
          </form>
        </article>
        <article class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">新增特典紀錄</p>
              <h3>新增特典紀錄</h3>
            </div>
          </div>
          <form id="quickRecordForm" class="form-grid">
            ${recordFieldsHtml({ idolId: idol.id })}
            <div class="form-actions full-span">
              <button class="primary-button" type="submit">新增紀錄</button>
            </div>
          </form>
        </article>
        <article class="panel">
          <p class="eyebrow">歷史紀錄</p>
          <h3>歷史紀錄列表</h3>
          <div class="record-list">${records.length ? records.slice().reverse().map(renderRecordCard).join("") : emptyState("還沒有特典紀錄。")}</div>
        </article>
      </div>
      <div class="stack">
        ${analysis ? renderAnalysis(analysis) : `<div class="analysis-box"><p class="muted">同一位偶像累積 3 筆以上紀錄後，會顯示自動文字分析。</p></div>`}
        <div class="chart-grid">
          ${chartSlot("moodChart", "心情變化")}
          ${chartSlot("satisfactionChart", "特典滿意度變化")}
          ${chartSlot("stressChart", "壓力值變化")}
          ${chartSlot("wantChart", "想再見程度變化")}
          ${chartSlot("regretChart", "後悔指數變化")}
          ${chartSlot("liveChart", "不特典也想看Live程度變化")}
        </div>
      </div>
    </div>
  `;

  views.detail.querySelector("[data-back-dashboard]").addEventListener("click", () => setView("dashboard"));
  views.detail.querySelector("#idolProfileForm").addEventListener("submit", handleIdolProfileSubmit);
  views.detail.querySelector("[data-delete-idol]").addEventListener("click", () => deleteIdol(idol.id));
  views.detail.querySelector("#quickRecordForm").addEventListener("submit", handleRecordSubmit);
  bindRecordActions(views.detail);
  bindRangeOutputs(views.detail);
  createDetailCharts(records);
}

function handleIdolProfileSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const index = state.idols.findIndex((idol) => idol.id === state.detailId);
  if (index < 0) return;
  state.idols[index] = normalizeIdol({
    ...state.idols[index],
    name: formData.get("name"),
    group: formData.get("group"),
    type: formData.get("type"),
    memo: formData.get("memo"),
    status: formData.get("status"),
    updatedAt: Date.now(),
  });
  persistAndSync();
}

function deleteIdol(idolId) {
  const idol = getIdol(idolId);
  if (!idol || !window.confirm(`確定要刪除「${idol.name}」與她的所有特典紀錄嗎？`)) return;
  state.idols = state.idols.filter((item) => item.id !== idolId);
  state.records = state.records.filter((record) => record.idolId !== idolId);
  state.compareIds = state.compareIds.filter((id) => id !== idolId);
  state.detailId = state.idols[0]?.id || null;
  state.view = "dashboard";
  persistAndSync();
}

function recordFieldsHtml(record = {}) {
  const idolOptions = state.idols
    .map((idol) => `<option value="${idol.id}" ${idol.id === record.idolId ? "selected" : ""}>${escapeHtml(idol.name)} / ${escapeHtml(idol.group)}</option>`)
    .join("");
  return `
    <input type="hidden" name="id" value="${escapeHtml(record.id || "")}" />
    <label>偶像
      <select name="idolId" required>${idolOptions}</select>
    </label>
    <label>日期<input name="date" type="date" required value="${escapeHtml(record.date || todayString())}" /></label>
    <label>拍立得張數<input name="chekiCount" type="number" min="0" step="1" inputmode="numeric" value="${record.chekiCount ?? 1}" /></label>
    <label>花費（日圓）<input name="cost" type="number" min="0" step="1" inputmode="numeric" value="${record.cost ?? ""}" placeholder="例：1650" /></label>
    <label class="full-span">一句摘要<input name="summary" maxlength="80" value="${escapeHtml(record.summary || "")}" placeholder="例：她記得上次聊過的事" /></label>
    ${scoreFields.map(([key, label]) => rangeFieldHtml(key, label, record[key] ?? 5)).join("")}
    <label class="full-span">備註<textarea name="memo" placeholder="互動細節、自己當下的反應、離開後的感覺">${escapeHtml(record.memo || "")}</textarea></label>
  `;
}

function rangeFieldHtml(key, label, value) {
  return `
    <label class="range-field">
      <span class="range-label"><span>${label}</span><strong class="range-value" data-range-value="${key}">${value}/10</strong></span>
      <input name="${key}" type="range" min="0" max="10" value="${value}" data-range="${key}" />
    </label>
  `;
}

function bindRangeOutputs(root) {
  root.querySelectorAll("[data-range]").forEach((input) => {
    const output = root.querySelector(`[data-range-value="${input.dataset.range}"]`);
    const update = () => {
      output.textContent = `${input.value}/10`;
    };
    input.addEventListener("input", update);
    update();
  });
}

function handleRecordSubmit(event) {
  event.preventDefault();
  const record = readRecordForm(event.currentTarget);
  const existingIndex = state.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    state.records[existingIndex] = normalizeRecord({ ...state.records[existingIndex], ...record, updatedAt: Date.now() });
  } else {
    state.records.push(normalizeRecord({ ...record, id: uid("record"), createdAt: Date.now(), updatedAt: Date.now() }));
  }
  recordDialog.close();
  persistAndSync();
}

function readRecordForm(form) {
  const formData = new FormData(form);
  const record = {
    id: formData.get("id") || "",
    idolId: formData.get("idolId"),
    date: formData.get("date"),
    chekiCount: formData.get("chekiCount"),
    cost: formData.get("cost"),
    summary: formData.get("summary").trim(),
    memo: formData.get("memo").trim(),
  };
  scoreFields.forEach(([key]) => {
    record[key] = clampScore(formData.get(key));
  });
  return record;
}

function renderRecordCard(record) {
  const idol = getIdol(record.idolId);
  return `
    <article class="record-card">
      <div class="record-card-head">
        <div>
          <h3>${escapeHtml(record.summary || "未命名紀錄")}</h3>
          <small>${formatDate(record.date)} / ${escapeHtml(idol?.name || "未知偶像")} / ${formatYen(record.cost)}</small>
        </div>
        <div class="section-actions">
          <button class="ghost-button" type="button" data-edit-record="${record.id}">編輯</button>
          <button class="ghost-button danger-button" type="button" data-delete-record="${record.id}">刪除</button>
        </div>
      </div>
      <div class="record-meta">
        <span class="pill">心情 ${record.mood}</span>
        <span class="pill">滿意 ${record.satisfaction}</span>
        <span class="pill">壓力 ${record.stress}</span>
        <span class="pill">想再見 ${record.wantToMeetAgain}</span>
        <span class="pill">後悔 ${record.regret}</span>
        <span class="pill">${record.chekiCount} 張</span>
      </div>
      <p class="record-memo">${escapeHtml(record.memo || "沒有備註。")}</p>
    </article>
  `;
}

function renderAnalysis(analysis) {
  const boolText = (value) => (value ? "是" : "否");
  return `
    <article class="analysis-box">
      <p class="eyebrow">自動分析</p>
      <h3>自動文字分析</h3>
      <div class="analysis-grid">
        ${analysisItem("目前狀態", analysis.status)}
        ${analysisItem("主要價值", analysis.mainValue)}
        ${analysisItem("高壓力傾向", boolText(analysis.highStress))}
        ${analysisItem("花錢但後悔傾向", boolText(analysis.regretSpend))}
        ${analysisItem("適合降低特典頻率", boolText(analysis.reduceFrequency))}
        ${analysisItem("不特典也會想看Live型", boolText(analysis.liveOnlyType))}
      </div>
    </article>
  `;
}

function analysisItem(label, value) {
  return `<div class="analysis-item"><span>${label}</span><strong>${value}</strong></div>`;
}

function chartSlot(id, title) {
  return `<article class="chart-card"><h3>${title}</h3><canvas id="${id}"></canvas></article>`;
}

function createDetailCharts(records) {
  const labels = records.map((record) => formatDate(record.date));
  [
    ["moodChart", "mood", "心情", "#ff8fc7"],
    ["satisfactionChart", "satisfaction", "特典滿意度", "#8bdcff"],
    ["stressChart", "stress", "壓力值", "#f6cf73"],
    ["wantChart", "wantToMeetAgain", "想再見程度", "#bca8ff"],
    ["regretChart", "regret", "後悔指數", "#ff7f92"],
    ["liveChart", "liveOnlyInterest", "不特典也想看Live", "#8ef2dc"],
  ].forEach(([canvasId, key, label, color]) => {
    const canvas = document.querySelector(`#${canvasId}`);
    if (!canvas) return;
    state.charts[canvasId] = makeLineChart(canvas, labels, records.map((record) => record[key]), label, color);
  });
}

function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 10,
        grid: { color: "rgba(255, 210, 234, 0.12)" },
        ticks: { color: "#c9bdd4", stepSize: 2 },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#c9bdd4" },
      },
    },
    plugins: {
      legend: { labels: { color: "#f5edf8" } },
    },
  };
}

function makeLineChart(canvas, labels, values, label, color) {
  if (typeof Chart === "undefined") return null;
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderColor: color,
          backgroundColor: `${color}33`,
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.32,
          fill: true,
        },
      ],
    },
    options: chartDefaults(),
  });
}

function makeBarChart(canvas, labels, datasets) {
  if (typeof Chart === "undefined") return null;
  return new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      ...chartDefaults(),
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(255, 210, 234, 0.12)" }, ticks: { color: "#c9bdd4" } },
        x: { grid: { display: false }, ticks: { color: "#c9bdd4" } },
      },
    },
  });
}

function renderCompare() {
  const selectedIds = state.compareIds.filter((id) => getIdol(id)).slice(0, 5);
  state.compareIds = selectedIds.length ? selectedIds : state.idols.slice(0, 2).map((idol) => idol.id);
  const selectedIdols = state.compareIds.map(getIdol).filter(Boolean);
  const labels = selectedIdols.map((idol) => idol.name);
  const metrics = selectedIdols.map((idol) => getMetrics(idol.id));

  views.compare.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">比較分析</p>
        <h2>比較分析</h2>
      </div>
    </div>
    <div class="compare-selector">
      ${state.idols.map((idol) => `
        <label class="check-tile">
          <input type="checkbox" value="${idol.id}" ${state.compareIds.includes(idol.id) ? "checked" : ""} />
          <span>${escapeHtml(idol.name)}<br /><small class="muted">${escapeHtml(idol.group)}</small></span>
        </label>
      `).join("")}
    </div>
    <div class="chart-grid">
      ${chartSlot("compareScoreChart", "平均分數比較")}
      ${chartSlot("compareCostChart", "花費與紀錄次數")}
    </div>
    <article class="analysis-box">
      <p class="eyebrow">比較摘要</p>
      <p class="summary-text">${compareText(selectedIdols, metrics)}</p>
    </article>
  `;

  views.compare.querySelectorAll(".check-tile input").forEach((input) => {
    input.addEventListener("change", handleCompareSelection);
  });

  state.charts.compareScoreChart = makeBarChart(views.compare.querySelector("#compareScoreChart"), labels, [
    dataset("平均心情", metrics.map((m) => m.mood), "#ff8fc7"),
    dataset("特典滿意度", metrics.map((m) => m.satisfaction), "#8bdcff"),
    dataset("壓力值", metrics.map((m) => m.stress), "#f6cf73"),
    dataset("後悔指數", metrics.map((m) => m.regret), "#ff7f92"),
    dataset("想再見程度", metrics.map((m) => m.wantToMeetAgain), "#bca8ff"),
    dataset("不特典也想看Live", metrics.map((m) => m.liveOnlyInterest), "#8ef2dc"),
  ]);
  state.charts.compareCostChart = makeBarChart(views.compare.querySelector("#compareCostChart"), labels, [
    dataset("花費總額", metrics.map((m) => m.cost), "#8bdcff"),
    dataset("特典紀錄次數", metrics.map((m) => m.count), "#ff8fc7"),
  ]);
}

function dataset(label, data, color) {
  return { label, data: data.map((value) => value ?? 0), backgroundColor: `${color}99`, borderColor: color, borderWidth: 1 };
}

function handleCompareSelection(event) {
  const id = event.currentTarget.value;
  if (event.currentTarget.checked) {
    if (state.compareIds.length >= 5) {
      event.currentTarget.checked = false;
      return;
    }
    state.compareIds.push(id);
  } else {
    state.compareIds = state.compareIds.filter((selectedId) => selectedId !== id);
  }
  if (state.compareIds.length < 2 && state.idols.length >= 2) {
    event.currentTarget.checked = true;
    state.compareIds.push(id);
  }
  renderCompare();
}

function compareText(idols, metrics) {
  if (idols.length < 2) return "請選擇 2 至 5 位偶像進行比較。";
  if (!metrics.some((metric) => metric.count > 0)) {
    return "目前選擇的偶像尚未累積特典紀錄。新增紀錄後，這裡會比較平均心情、滿意度、壓力、後悔、想再見程度、Live 本體吸引力與花費。";
  }
  const bestMoodIndex = maxIndex(metrics.map((metric) => metric.mood ?? -1));
  const highestStressIndex = maxIndex(metrics.map((metric) => metric.stress ?? -1));
  const bestLiveIndex = maxIndex(metrics.map((metric) => metric.liveOnlyInterest ?? -1));
  return `${idols[bestMoodIndex]?.name || "-"} 目前帶來最高平均心情；${idols[highestStressIndex]?.name || "-"} 的平均壓力值最高，適合觀察是否需要降低特典頻率；${idols[bestLiveIndex]?.name || "-"} 的「不特典也想看Live程度」最高，較接近表演本體也能成立的支持型。`;
}

function maxIndex(values) {
  return values.reduce((best, value, index) => (value > values[best] ? index : best), 0);
}

function renderArchive() {
  const groups = [...new Set(state.idols.map((idol) => idol.group))];
  const filtered = state.records
    .filter((record) => state.archiveFilters.idolId === "all" || record.idolId === state.archiveFilters.idolId)
    .filter((record) => {
      const idol = getIdol(record.idolId);
      return state.archiveFilters.group === "all" || idol?.group === state.archiveFilters.group;
    })
    .sort(state.archiveFilters.sort === "asc" ? byDateAsc : byDateDesc);

  views.archive.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">歷史紀錄</p>
        <h2>所有特典紀錄</h2>
      </div>
      <div class="section-actions">
        <button class="primary-button" type="button" data-new-record>新增紀錄</button>
      </div>
    </div>
    <div class="filter-grid">
      <label>依偶像篩選
        <select data-filter="idolId">
          <option value="all">全部偶像</option>
          ${state.idols.map((idol) => `<option value="${idol.id}" ${state.archiveFilters.idolId === idol.id ? "selected" : ""}>${escapeHtml(idol.name)}</option>`).join("")}
        </select>
      </label>
      <label>依團體篩選
        <select data-filter="group">
          <option value="all">全部團體</option>
          ${groups.map((group) => `<option value="${escapeHtml(group)}" ${state.archiveFilters.group === group ? "selected" : ""}>${escapeHtml(group)}</option>`).join("")}
        </select>
      </label>
      <label>依日期排序
        <select data-filter="sort">
          <option value="desc" ${state.archiveFilters.sort === "desc" ? "selected" : ""}>新到舊</option>
          <option value="asc" ${state.archiveFilters.sort === "asc" ? "selected" : ""}>舊到新</option>
        </select>
      </label>
    </div>
    <div class="record-list">${filtered.length ? filtered.map(renderRecordCard).join("") : emptyState("沒有符合條件的紀錄。")}</div>
  `;

  views.archive.querySelector("[data-new-record]").addEventListener("click", () => openRecordDialog());
  views.archive.querySelectorAll("[data-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.archiveFilters[select.dataset.filter] = select.value;
      renderArchive();
    });
  });
  bindRecordActions(views.archive);
}

function bindRecordActions(root) {
  root.querySelectorAll("[data-edit-record]").forEach((button) => {
    button.addEventListener("click", () => openRecordDialog(button.dataset.editRecord));
  });
  root.querySelectorAll("[data-delete-record]").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.deleteRecord));
  });
}

function openRecordDialog(recordId = null) {
  const record = recordId ? state.records.find((item) => item.id === recordId) : { idolId: state.detailId || state.idols[0]?.id };
  recordDialogTitle.textContent = recordId ? "編輯特典紀錄" : "新增特典紀錄";
  recordFormFields.innerHTML = `<div class="form-grid">${recordFieldsHtml(record || {})}</div>`;
  bindRangeOutputs(recordForm);
  recordDialog.showModal();
}

function deleteRecord(recordId) {
  if (!window.confirm("確定要刪除這筆特典紀錄嗎？")) return;
  state.records = state.records.filter((record) => record.id !== recordId);
  persistAndSync();
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

recordForm.addEventListener("submit", handleRecordSubmit);
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => recordDialog.close());
});

syncSettingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings();
  void loadFromSheets();
});

refreshSheetsButton.addEventListener("click", () => {
  void loadFromSheets();
});

loadSettings();
const localData = readLocalData();
state.idols = localData.idols;
state.records = localData.records;
state.compareIds = state.idols.slice(0, 3).map((idol) => idol.id);
saveState();
render();
void loadFromSheets();
