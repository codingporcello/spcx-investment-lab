import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs");
const outputPath = path.join(outputDir, "idol-tokuten-lab-google-sheets-template.xlsx");

const idolHeaders = ["id", "name", "group", "type", "memo", "status", "createdAt", "updatedAt"];
const recordHeaders = [
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

const workbook = Workbook.create();
const idols = workbook.worksheets.add("idols");
const records = workbook.worksheets.add("records");

function setupSheet(sheet, headers, width = 18) {
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format.fill.color = "#171021";
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format.font.color = "#FFF8FD";
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format.font.bold = true;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format.borders = {
    preset: "outside",
    style: "thin",
    color: "#FF8FC7",
  };
  sheet.getRangeByIndexes(0, 0, 200, headers.length).format.columnWidth = width;
  sheet.getRangeByIndexes(0, 0, 200, headers.length).format.rowHeight = 24;
  sheet.freezePanes.freezeRows(1);
}

setupSheet(idols, idolHeaders, 20);
setupSheet(records, recordHeaders, 18);

records.getRange("C:C").setNumberFormat("yyyy-mm-dd");
records.getRange("D:E").setNumberFormat("#,##0");
records.getRange("G:M").setNumberFormat("0");
idols.getRange("G:H").setNumberFormat("0");
records.getRange("O:P").setNumberFormat("0");

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(outputPath);
