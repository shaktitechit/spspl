import { stripHtml } from "./workPlanUtils";

export interface ExportExcelColumn {
  key: string;
  label: string;
}

export type ExportExcelRow = Record<string, string | number | boolean | null | undefined>;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function u16(n: number): Uint8Array {
  const arr = new Uint8Array(2);
  arr[0] = n & 0xff;
  arr[1] = (n >> 8) & 0xff;
  return arr;
}

function u32(n: number): Uint8Array {
  const arr = new Uint8Array(4);
  arr[0] = n & 0xff;
  arr[1] = (n >> 8) & 0xff;
  arr[2] = (n >> 16) & 0xff;
  arr[3] = (n >> 24) & 0xff;
  return arr;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, file.data);

    centralParts.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(file.data.length),
        u32(file.data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]),
    );
    offset += localHeader.length + file.data.length;
  }

  const central = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);

  const zipBytes = concatBytes([...localParts, central, end]);
  const ab = new ArrayBuffer(zipBytes.byteLength);
  new Uint8Array(ab).set(zipBytes);
  return new Blob([ab], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colLetter(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function cellText(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return stripHtml(String(val));
}

/** Download a clean .xlsx workbook for the given columns and rows. */
export function downloadExcelReport(options: {
  filename: string;
  sheetName?: string;
  title?: string;
  columns: ExportExcelColumn[];
  rows: ExportExcelRow[];
}): void {
  const { filename, sheetName = "Sheet1", title, columns, rows } = options;
  const encoder = new TextEncoder();
  const safeSheet = sheetName.replace(/[\\/*?:\[\]]/g, "_").slice(0, 31) || "Sheet1";

  const sheetRows: string[] = [];
  let rowIdx = 1;

  if (title) {
    sheetRows.push(
      `<row r="${rowIdx}"><c r="A${rowIdx}" t="inlineStr"><is><t>${xmlEscape(title)}</t></is></c></row>`,
    );
    rowIdx += 1;
    sheetRows.push(`<row r="${rowIdx}"/>`);
    rowIdx += 1;
  }

  const headerCells = columns
    .map(
      (col, i) =>
        `<c r="${colLetter(i)}${rowIdx}" t="inlineStr"><is><t>${xmlEscape(col.label)}</t></is></c>`,
    )
    .join("");
  sheetRows.push(`<row r="${rowIdx}">${headerCells}</row>`);
  rowIdx += 1;

  for (const row of rows) {
    const cells = columns
      .map((col, i) => {
        const text = xmlEscape(cellText(row[col.key]));
        return `<c r="${colLetter(i)}${rowIdx}" t="inlineStr"><is><t>${text}</t></is></c>`;
      })
      .join("");
    sheetRows.push(`<row r="${rowIdx}">${cells}</row>`);
    rowIdx += 1;
  }

  const lastCol = colLetter(Math.max(0, columns.length - 1));
  const lastRow = Math.max(1, rowIdx - 1);
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetData>
    ${sheetRows.join("\n    ")}
  </sheetData>
</worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEscape(safeSheet)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const blob = zipStore([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheetXml) },
  ]);

  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  triggerDownload(blob, safeName);
}
