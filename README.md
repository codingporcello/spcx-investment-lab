# 🚀 SPCX 投資心理研究室

價格記錄市場，日記記錄自己。

這是一個可部署於 GitHub Pages 的單頁網站，用來研究投資人的心情、後悔指數、記錄類型、心理標籤、操作傾向與「如果重來一次」的心理變化。

V3 版使用：

Google Sheets → Apps Script API → GitHub Pages 網站

Google Sheets 是唯一真實資料來源。LocalStorage 只作為 Google Sheets 暫時無法連線時的本機快取。

## 檔案

- `index.html`：頁面結構
- `styles.css`：深色太空研究室風格
- `app.js`：Google Sheets 同步、圖表、統計分析、匯出功能
- `apps-script.gs`：貼到 Google Apps Script 的後端 API 程式碼

## Google Sheets 設定教學

### 1. 建立 Google Sheets

1. 到 [Google Sheets](https://sheets.google.com)。
2. 建立一個新的試算表。
3. 將試算表命名成 `SPCX 投資心理研究室`。
4. 建立或改名一個工作表為 `SPCX_JOURNAL`。

第一列請放這些欄位：

```text
id
date
spcxPrice
returnRate
moodScore
action
redoChoice
regretScore
note
createdAt
updatedAt
deleted
deletedAt
recordType
psycheTags
```

`deleted` 和 `deletedAt` 是軟刪除用欄位。畫面不會顯示 deleted 為 TRUE 的資料。

如果你已經有舊版資料，請把 `recordType` 和 `psycheTags` 加在最後兩欄，不要插到中間。舊資料缺少這兩欄時，網站會自動視為：

- `recordType`：盤中
- `psycheTags`：空白

V3 只保留三種記錄類型：`盤中`、`收盤`、`回顧`。不加入盤後，避免資料被過度切碎。

### 2. 建立 Apps Script

1. 在 Google Sheets 上方選單點 `Extensions`。
2. 點 `Apps Script`。
3. 刪掉預設內容。
4. 將本專案的 `apps-script.gs` 全部內容貼上。
5. 按儲存。

### 3. 部署為 Web App

1. 在 Apps Script 右上角點 `Deploy`。
2. 點 `New deployment`。
3. 類型選 `Web app`。
4. Description 可填：`SPCX Journal API`。
5. `Execute as` 選 `Me`。
6. `Who has access` 選 `Anyone`。
7. 點 `Deploy`。
8. 第一次會要求授權，照畫面登入並允許存取這份 Google Sheet。
9. 複製產生的 Web App URL，格式大約是：

```text
https://script.google.com/macros/s/xxxxxxxx/exec
```

### 4. 貼回網站

1. 打開 GitHub Pages 網站。
2. 找到 `⚙️ Google Sheets 設定`。
3. 將 Web App URL 貼進 `Apps Script Web App URL`。
4. 按 `儲存設定`。
5. 右上角顯示 `🟢 已同步` 就代表成功。

之後你在 Mac 新增一筆日記，iPhone 重新整理同一個網站後，就會從同一份 Google Sheets 讀到資料。

## 同步狀態

- `🟢 已同步`：已成功讀取或寫入 Google Sheets。
- `🟡 同步中`：正在讀取或寫入 Google Sheets。
- `🔴 無法連線`：目前無法連線 Google Sheets，畫面會顯示 LocalStorage 快取資料。

## GitHub Pages 部署

1. 將此資料夾推送到 GitHub repository。
2. 到 repository 的 Settings。
3. 開啟 Pages。
4. Source 選擇 `Deploy from a branch`。
5. Branch 選擇 `main`，資料夾選擇 `/root`。

## 重要安全提醒

這個版本沒有登入系統。Apps Script Web App 設定為 `Anyone` 後，只要知道 API URL 的人就可能送資料。

私人使用時請不要公開 Apps Script Web App URL。如果之後要更嚴格保護，可以再升級成登入或加入簡單 API key 檢查。

## Apps Script 方法

`apps-script.gs` 內提供：

- `doGet()`：讀取全部資料
- `doPost()`：新增、更新、軟刪除資料
- `doPut()`：更新資料
- `doDelete()`：軟刪除資料

網站端為了減少瀏覽器跨網域預檢問題，實際寫入會用 `doPost()` 搭配 `action` 欄位呼叫新增、更新、刪除。
