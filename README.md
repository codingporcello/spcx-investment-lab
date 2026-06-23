# 偶像特典會心理分析工具

深色模式的「偶像推活研究室」dashboard，用來記錄多位偶像特典會互動後的心情、滿意度、壓力、後悔與 Live 本體吸引力。

目前架構：

Google Sheets → Apps Script Web App → GitHub Pages 網站

Google Sheets 是雲端同步來源。LocalStorage 會作為離線或同步失敗時的本機快取。

## 檔案

- `index.html`：四層 SPA 頁面入口
- `styles.css`：深色偶像風 dashboard 樣式
- `app.js`：localStorage、Google Sheets 同步、圖表與分析邏輯
- `apps-script.gs`：貼到 Google Apps Script 的後端程式
- `public/hzme-icon.jpg`：favicon、瀏覽器分頁與手機 icon
- `config.js`：本機或靜態部署用 Apps Script URL 設定
- `.github/workflows/deploy-pages.yml`：GitHub Actions 自動部署設定

## Google Sheets 結構

請建立兩個工作表。

### idols

```text
id, name, group, type, memo, status, createdAt, updatedAt
```

### records

```text
id, idolId, date, chekiCount, cost, summary, mood, satisfaction, stress, naturalness, wantToMeetAgain, regret, liveOnlyInterest, memo, createdAt, updatedAt
```

`records.idolId` 必須對應 `idols.id`。

## Apps Script 設定

1. 建立 Google Sheets。
2. 在 Google Sheets 選單打開 `Extensions` → `Apps Script`。
3. 刪除預設內容，貼上本專案的 `apps-script.gs`。
4. 儲存後點 `Deploy` → `New deployment`。
5. 類型選 `Web app`。
6. `Execute as` 選 `Me`。
7. `Who has access` 選 `Anyone`。
8. 部署後複製 Web App URL，格式類似：

```text
https://script.google.com/macros/s/xxxxxxxx/exec
```

## 本機測試

```bash
python3 -m http.server 4173
```

開啟：

```text
http://127.0.0.1:4173/
```

同步 URL 可以直接貼在網站上方的「Google Sheets 同步設定」。也可以修改 `config.js`：

```js
window.IDOL_LAB_CONFIG = {
  GOOGLE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/xxxxxxxx/exec",
};
```

## Build 檢查

```bash
npm run check
npm run build
```

build 產物會輸出到 `dist/`。

## GitHub Pages 部署

1. 將專案 push 到 GitHub。
2. 到 repository 的 `Settings` → `Pages`。
3. `Build and deployment` 選 `GitHub Actions`。
4. 到 `Settings` → `Secrets and variables` → `Actions`。
5. 新增 repository secret：

```text
GOOGLE_APPS_SCRIPT_URL
```

值填 Apps Script Web App URL。

6. push 到 `main` 後，GitHub Actions 會自動 build 並部署 `dist/`。

如果暫時不設定 secret，網站仍可部署，右上角會顯示本機模式；你也可以在頁面中手動貼上 Apps Script URL，該設定會存在目前裝置的 localStorage。

## 手機與電腦同步確認

1. 電腦開 GitHub Pages 網站。
2. 確認右上角顯示 `已同步`。
3. 新增一筆偶像或特典紀錄。
4. 手機打開同一個 GitHub Pages URL。
5. 若右上角顯示 `已同步` 並看得到剛新增的資料，代表同步成功。
6. 手機新增一筆紀錄後，電腦重新整理頁面，也應該能看到手機新增的資料。

## 同步狀態

- `已同步`：已成功讀取或寫入 Google Sheets。
- `同步中`：正在讀取或寫入 Google Sheets。
- `同步失敗`：Google Sheets 連線失敗，網站會保留 localStorage 快取。
- `本機模式`：尚未設定 Apps Script URL，只使用 localStorage。
