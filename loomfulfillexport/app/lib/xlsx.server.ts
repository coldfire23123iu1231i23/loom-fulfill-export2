import ExcelJS from "exceljs";
import { COLUMNS, type FulfillRow } from "./columns";

export async function buildFulfillWorkbook(rows: FulfillRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet("Trang tính2");

  ws.columns = COLUMNS.map((c) => ({ key: c.key as string, width: c.width ?? 13 }));

  const header = ws.addRow(COLUMNS.map((c) => c.header));
  header.eachCell((cell, i) => {
    const col = COLUMNS[i - 1];
    cell.font = { bold: col.header.startsWith("*"), size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC0C0C0" },
    };
    cell.alignment = { vertical: "middle", wrapText: false };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  for (const row of rows) {
    const values = COLUMNS.map((c) => {
      const v = row[c.key];
      if (v === "" || v === null || v === undefined) return null;
      return v;
    });
    const added = ws.addRow(values);
    added.eachCell({ includeEmpty: true }, (cell, i) => {
      const col = COLUMNS[i - 1];
      if (col?.text) cell.numFmt = "@";
    });
  }

  // Giống file mẫu: khoá tiêu đề + 4 cột đầu.
  ws.views = [{ state: "frozen", xSplit: 4, ySplit: 1 }];

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function exportFilename(from: string, to: string): string {
  const stamp = from === to ? from : `${from}_${to}`;
  return `fulfill_${stamp}.xlsx`;
}
