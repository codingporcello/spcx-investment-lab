const IDOLS_SHEET_NAME = "idols";
const RECORDS_SHEET_NAME = "records";

const IDOL_HEADERS = ["id", "name", "group", "type", "memo", "status", "createdAt", "updatedAt"];
const RECORD_HEADERS = [
  "id",
  "idolId",
  "date",
  "chekiCount",
  "cost",
  "summary",
  "mood",
  "satisfaction",
  "stress",
  "naturalness",
  "wantToMeetAgain",
  "regret",
  "liveOnlyInterest",
  "memo",
  "createdAt",
  "updatedAt",
];

function doGet(e) {
  const payload = parseGetPayload(e);
  if (payload.action === "sync") {
    return syncAll(payload);
  }

  return jsonResponse({
    ok: true,
    idols: readRows(IDOLS_SHEET_NAME, IDOL_HEADERS).map(normalizeIdol),
    records: readRows(RECORDS_SHEET_NAME, RECORD_HEADERS).map(normalizeRecord),
  });
}

function doPost(e) {
  const payload = parsePayload(e);
  const action = payload.action || "list";

  if (action === "list") {
    return doGet();
  }

  if (action === "sync") {
    return syncAll(payload);
  }

  return jsonResponse({ ok: false, error: "Unknown action" });
}

function syncAll(payload) {
  const idols = Array.isArray(payload.idols) ? payload.idols.map(normalizeIdol) : [];
  const idolIds = {};
  idols.forEach(function (idol) {
    idolIds[idol.id] = true;
  });

  const records = Array.isArray(payload.records)
    ? payload.records.map(normalizeRecord).filter(function (record) {
        return idolIds[record.idolId] === true;
      })
    : [];

  writeRows(IDOLS_SHEET_NAME, IDOL_HEADERS, idols);
  writeRows(RECORDS_SHEET_NAME, RECORD_HEADERS, records);

  return jsonResponse({ ok: true, idols: idols, records: records });
}

function readRows(sheetName, headers) {
  const sheet = getSheet(sheetName, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  return sheet
    .getRange(2, 1, lastRow - 1, headers.length)
    .getValues()
    .filter(function (row) {
      return row[0];
    })
    .map(function (row) {
      const item = {};
      headers.forEach(function (header, index) {
        item[header] = row[index];
      });
      return item;
    });
}

function writeRows(sheetName, headers, rows) {
  const sheet = getSheet(sheetName, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!rows.length) return;

  sheet
    .getRange(2, 1, rows.length, headers.length)
    .setValues(
      rows.map(function (row) {
        return headers.map(function (header) {
          return row[header] === undefined || row[header] === null ? "" : row[header];
        });
      }),
    );
}

function getSheet(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaders = headers.some(function (header, index) {
    return firstRow[index] !== header;
  });
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function normalizeIdol(idol) {
  const now = Date.now();
  return {
    id: String(idol.id || Utilities.getUuid()),
    name: String(idol.name || ""),
    group: String(idol.group || ""),
    type: String(idol.type || ""),
    memo: String(idol.memo || ""),
    status: String(idol.status || "active"),
    createdAt: Number(idol.createdAt || now),
    updatedAt: Number(idol.updatedAt || now),
  };
}

function normalizeRecord(record) {
  const now = Date.now();
  return {
    id: String(record.id || Utilities.getUuid()),
    idolId: String(record.idolId || ""),
    date: record.date ? String(record.date).slice(0, 10) : "",
    chekiCount: Number(record.chekiCount || 0),
    cost: Number(record.cost || 0),
    summary: String(record.summary || ""),
    mood: Number(record.mood || 0),
    satisfaction: Number(record.satisfaction || 0),
    stress: Number(record.stress || 0),
    naturalness: Number(record.naturalness || 0),
    wantToMeetAgain: Number(record.wantToMeetAgain || 0),
    regret: Number(record.regret || 0),
    liveOnlyInterest: Number(record.liveOnlyInterest || 0),
    memo: String(record.memo || ""),
    createdAt: Number(record.createdAt || now),
    updatedAt: Number(record.updatedAt || now),
  };
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) return {};

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return {};
  }
}

function parseGetPayload(e) {
  if (!e || !e.parameter || !e.parameter.payload) return {};

  try {
    return JSON.parse(e.parameter.payload);
  } catch (error) {
    return {};
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
