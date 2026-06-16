const SHEET_NAME = "SPCX_JOURNAL";
const HEADERS = [
  "id",
  "date",
  "spcxPrice",
  "returnRate",
  "moodScore",
  "action",
  "redoChoice",
  "regretScore",
  "note",
  "createdAt",
  "updatedAt",
  "deleted",
  "deletedAt",
];

function doGet(e) {
  return jsonResponse({
    ok: true,
    entries: readEntries(),
  });
}

function doPost(e) {
  const payload = parsePayload(e);
  const action = payload.action || "create";

  if (action === "list") {
    return doGet(e);
  }
  if (action === "create") {
    return createEntry(payload.entry);
  }
  if (action === "update") {
    return updateEntry(payload.entry);
  }
  if (action === "delete") {
    return softDeleteEntry(payload.id);
  }

  return jsonResponse({ ok: false, error: "Unknown action" });
}

function doPut(e) {
  const payload = parsePayload(e);
  return updateEntry(payload.entry);
}

function doDelete(e) {
  const payload = parsePayload(e);
  return softDeleteEntry(payload.id);
}

function createEntry(entry) {
  const sheet = getJournalSheet();
  const normalized = normalizeEntry(entry);
  const rowIndex = findRowIndexById(normalized.id);

  if (rowIndex > 0) {
    writeEntryToRow(sheet, rowIndex, normalized);
  } else {
    sheet.appendRow(HEADERS.map((key) => normalized[key] ?? ""));
  }

  return jsonResponse({ ok: true, entry: normalized, entries: readEntries() });
}

function updateEntry(entry) {
  const sheet = getJournalSheet();
  const normalized = normalizeEntry(entry);
  const rowIndex = findRowIndexById(normalized.id);

  if (rowIndex > 0) {
    writeEntryToRow(sheet, rowIndex, normalized);
  } else {
    sheet.appendRow(HEADERS.map((key) => normalized[key] ?? ""));
  }

  return jsonResponse({ ok: true, entry: normalized, entries: readEntries() });
}

function softDeleteEntry(id) {
  if (!id) {
    return jsonResponse({ ok: false, error: "Missing id" });
  }

  const sheet = getJournalSheet();
  const rowIndex = findRowIndexById(id);
  if (rowIndex < 1) {
    return jsonResponse({ ok: false, error: "Entry not found" });
  }

  const entry = rowToEntry(sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0]);
  const now = Date.now();
  entry.deleted = true;
  entry.deletedAt = now;
  entry.updatedAt = now;
  writeEntryToRow(sheet, rowIndex, entry);

  return jsonResponse({ ok: true, entry: entry, entries: readEntries() });
}

function readEntries() {
  const sheet = getJournalSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  return sheet
    .getRange(2, 1, lastRow - 1, HEADERS.length)
    .getValues()
    .filter((row) => row[0])
    .map(rowToEntry);
}

function getJournalSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => firstRow[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  return sheet;
}

function findRowIndexById(id) {
  const sheet = getJournalSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return -1;
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(id)) {
      return index + 2;
    }
  }
  return -1;
}

function writeEntryToRow(sheet, rowIndex, entry) {
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([
    HEADERS.map((key) => entry[key] ?? ""),
  ]);
}

function rowToEntry(row) {
  const entry = {};
  HEADERS.forEach((key, index) => {
    entry[key] = row[index];
  });

  return normalizeEntry(entry);
}

function normalizeEntry(entry) {
  const now = Date.now();
  return {
    id: String(entry.id || Utilities.getUuid()),
    date: entry.date ? String(entry.date).slice(0, 10) : "",
    spcxPrice: Number(entry.spcxPrice || 0),
    returnRate: Number(entry.returnRate || 0),
    moodScore: Number(entry.moodScore || 0),
    action: entry.action || "",
    redoChoice: entry.redoChoice || "",
    regretScore: Number(entry.regretScore || 0),
    note: entry.note || "",
    createdAt: Number(entry.createdAt || now),
    updatedAt: Number(entry.updatedAt || now),
    deleted: entry.deleted === true || String(entry.deleted).toUpperCase() === "TRUE",
    deletedAt: entry.deletedAt ? Number(entry.deletedAt) : "",
  };
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return {};
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
