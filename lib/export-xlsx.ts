type CellValue = string | number | boolean | Date | null | undefined;

interface ZipFile {
  path: string;
  content: Uint8Array;
}

const encoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function createZip(files: ZipFile[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const records: Array<{ file: ZipFile; crc: number; offset: number; name: Uint8Array }> = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const crc = crc32(file.content);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);

    writeUint32(view, 0, 0x04034b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 0);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, 0);
    writeUint32(view, 14, crc);
    writeUint32(view, 18, file.content.length);
    writeUint32(view, 22, file.content.length);
    writeUint16(view, 26, name.length);
    writeUint16(view, 28, 0);
    header.set(name, 30);

    records.push({ file, crc, offset, name });
    localParts.push(header, file.content);
    offset += header.length + file.content.length;
  }

  const centralOffset = offset;

  for (const record of records) {
    const header = new Uint8Array(46 + record.name.length);
    const view = new DataView(header.buffer);

    writeUint32(view, 0, 0x02014b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 20);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, 0);
    writeUint16(view, 14, 0);
    writeUint32(view, 16, record.crc);
    writeUint32(view, 20, record.file.content.length);
    writeUint32(view, 24, record.file.content.length);
    writeUint16(view, 28, record.name.length);
    writeUint16(view, 30, 0);
    writeUint16(view, 32, 0);
    writeUint16(view, 34, 0);
    writeUint16(view, 36, 0);
    writeUint32(view, 38, 0);
    writeUint32(view, 42, record.offset);
    header.set(record.name, 46);

    centralParts.push(header);
    offset += header.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, records.length);
  writeUint16(endView, 10, records.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, centralOffset);
  writeUint16(endView, 20, 0);

  return concatBytes([...localParts, centralDirectory, end]);
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function columnName(index: number) {
  let name = '';
  let value = index;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function normalizeCell(value: CellValue) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function createCell(value: CellValue, ref: string, style?: number) {
  const normalized = normalizeCell(value);
  const styleAttr = style ? ` s="${style}"` : '';

  if (typeof normalized === 'number' && Number.isFinite(normalized)) {
    return `<c r="${ref}"${styleAttr}><v>${normalized}</v></c>`;
  }

  if (typeof normalized === 'boolean') {
    return `<c r="${ref}" t="b"${styleAttr}><v>${normalized ? 1 : 0}</v></c>`;
  }

  const text = String(normalized ?? '');
  const preserveSpace = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t${preserveSpace}>${escapeXml(text)}</t></is></c>`;
}

function createWorksheet(headers: string[], rows: CellValue[][]) {
  const data = [headers, ...rows];
  const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const rowCount = Math.max(data.length, 1);
  const lastCell = `${columnName(columnCount)}${rowCount}`;
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const maxLength = data.reduce((max, row) => {
      const value = normalizeCell(row[index]);
      return Math.max(max, String(value ?? '').length);
    }, 8);
    const width = Math.min(Math.max(maxLength + 2, 10), 42);
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join('');

  const sheetRows = data
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = Array.from({ length: columnCount }, (_, columnIndex) =>
        createCell(row[columnIndex], `${columnName(columnIndex + 1)}${rowNumber}`, rowIndex === 0 ? 1 : undefined)
      ).join('');

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCell}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columns}</cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function createWorkbook(sheetName: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName.slice(0, 31) || 'Sheet1')}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;

export function downloadXlsxFile(
  filename: string,
  headers: string[],
  rows: CellValue[][],
  sheetName = 'Sheet1'
) {
  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const files: ZipFile[] = [
    { path: '[Content_Types].xml', content: encoder.encode(contentTypes) },
    { path: '_rels/.rels', content: encoder.encode(rootRels) },
    { path: 'xl/workbook.xml', content: encoder.encode(createWorkbook(sheetName)) },
    { path: 'xl/_rels/workbook.xml.rels', content: encoder.encode(workbookRels) },
    { path: 'xl/worksheets/sheet1.xml', content: encoder.encode(createWorksheet(headers, rows)) },
    { path: 'xl/styles.xml', content: encoder.encode(styles) },
  ];

  const zip = createZip(files);
  const blob = new Blob([zip], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = safeFilename;
  link.click();
  URL.revokeObjectURL(url);
}
