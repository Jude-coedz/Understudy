export const SUPPORTED_UPLOAD_ACCEPT = [
  ".txt", ".md", ".markdown", ".json", ".csv", ".tsv", ".yaml", ".yml", ".log",
  ".html", ".htm", ".xml", ".rtf", ".docx", ".pptx", ".xlsx", ".odt", ".pdf",
].join(",");

export const SUPPORTED_UPLOAD_LABEL = "DOCX, PDF, PPTX, XLSX, ODT, RTF, Markdown, CSV and text files";

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".json", ".csv", ".tsv", ".yaml", ".yml", ".log",
]);

function extensionOf(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function readU16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (readU32(view, offset) === 0x06054b50) return offset;
  }
  return -1;
}

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

function zipDirectory(bytes: Uint8Array): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) throw new Error("This Office document has an unsupported ZIP structure.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = readU16(view, eocd + 10);
  let cursor = readU32(view, eocd + 16);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (readU32(view, cursor) !== 0x02014b50) break;
    const method = readU16(view, cursor + 10);
    const compressedSize = readU32(view, cursor + 20);
    const nameLength = readU16(view, cursor + 28);
    const extraLength = readU16(view, cursor + 30);
    const commentLength = readU16(view, cursor + 32);
    const localOffset = readU32(view, cursor + 42);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.push({ name, method, compressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateEntry(bytes: Uint8Array, entry: ZipEntry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const local = entry.localOffset;
  if (readU32(view, local) !== 0x04034b50) throw new Error(`Could not read ${entry.name}.`);
  const nameLength = readU16(view, local + 26);
  const extraLength = readU16(view, local + 28);
  const start = local + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method !== 8) throw new Error(`Unsupported compression method in ${entry.name}.`);
  const compressedBuffer = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([compressedBuffer]).stream().pipeThrough(
    new DecompressionStream("deflate-raw" as CompressionFormat),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zipTextFiles(file: File, wanted: (name: string) => boolean) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = zipDirectory(bytes).filter((entry) => wanted(entry.name));
  const decoder = new TextDecoder();
  const result: Record<string, string> = {};
  for (const entry of entries) result[entry.name] = decoder.decode(await inflateEntry(bytes, entry));
  return result;
}

function decodeXmlEntities(value: string) {
  const document = new DOMParser().parseFromString(`<root>${value}</root>`, "application/xml");
  return document.documentElement.textContent ?? value;
}

function xmlToStructuredText(xml: string, kind: "docx" | "pptx" | "odt") {
  let structured = xml;
  if (kind === "docx") {
    structured = structured
      .replace(/<w:tab\b[^>]*\/>/gi, "\t")
      .replace(/<w:br\b[^>]*\/>/gi, "\n")
      .replace(/<\/w:tc>/gi, "\t")
      .replace(/<\/w:tr>/gi, "\n")
      .replace(/<\/w:p>/gi, "\n");
  } else if (kind === "pptx") {
    structured = structured.replace(/<\/a:p>/gi, "\n").replace(/<a:br\b[^>]*\/>/gi, "\n");
  } else {
    structured = structured
      .replace(/<text:tab\b[^>]*\/>/gi, "\t")
      .replace(/<text:line-break\b[^>]*\/>/gi, "\n")
      .replace(/<\/text:(?:p|h)>/gi, "\n");
  }
  return decodeXmlEntities(structured.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDocx(file: File) {
  const files = await zipTextFiles(
    file,
    (name) => name === "word/document.xml" || /^word\/(?:header|footer)\d+\.xml$/i.test(name),
  );
  const ordered = Object.entries(files).sort(([a], [b]) => (a === "word/document.xml" ? -1 : b === "word/document.xml" ? 1 : a.localeCompare(b)));
  return ordered.map(([name, xml]) => `${name === "word/document.xml" ? "" : `\n[${name}]\n`}${xmlToStructuredText(xml, "docx")}`).join("\n").trim();
}

async function extractPptx(file: File) {
  const files = await zipTextFiles(file, (name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, xml], index) => `Slide ${index + 1}\n${xmlToStructuredText(xml, "pptx")}`)
    .join("\n\n")
    .trim();
}

function childText(element: Element, localName: string) {
  return Array.from(element.getElementsByTagNameNS("*", localName))[0]?.textContent ?? "";
}

async function extractXlsx(file: File) {
  const files = await zipTextFiles(
    file,
    (name) => name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/i.test(name),
  );
  const parser = new DOMParser();
  const shared: string[] = [];
  const sharedXml = files["xl/sharedStrings.xml"];
  if (sharedXml) {
    const doc = parser.parseFromString(sharedXml, "application/xml");
    for (const item of Array.from(doc.getElementsByTagNameNS("*", "si"))) {
      const pieces = Array.from(item.getElementsByTagNameNS("*", "t")).map((node) => node.textContent ?? "");
      shared.push(pieces.join(""));
    }
  }

  return Object.entries(files)
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, xml], sheetIndex) => {
      const doc = parser.parseFromString(xml, "application/xml");
      const rows = Array.from(doc.getElementsByTagNameNS("*", "row")).map((row) => {
        const cells = Array.from(row.getElementsByTagNameNS("*", "c")).map((cell) => {
          const type = cell.getAttribute("t") ?? "";
          if (type === "inlineStr") return childText(cell, "t");
          const raw = childText(cell, "v");
          if (type === "s") return shared[Number(raw)] ?? raw;
          return raw;
        });
        return cells.join("\t");
      });
      return `Sheet ${sheetIndex + 1}\n${rows.join("\n")}`;
    })
    .join("\n\n")
    .trim();
}

async function extractOdt(file: File) {
  const files = await zipTextFiles(file, (name) => name === "content.xml");
  const xml = files["content.xml"];
  if (!xml) throw new Error("ODT content.xml was not found.");
  return xmlToStructuredText(xml, "odt");
}

function extractRtf(raw: string) {
  return raw
    .replace(/\\par[d]?\b/gi, "\n")
    .replace(/\\tab\b/gi, "\t")
    .replace(/\\'[0-9a-f]{2}/gi, (match) => String.fromCharCode(parseInt(match.slice(2), 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractMarkup(raw: string) {
  const doc = new DOMParser().parseFromString(raw, "text/html");
  return (doc.body?.innerText || doc.documentElement.textContent || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/extract-file", { method: "POST", body: form });
  const payload = (await response.json()) as { text?: string; error?: string };
  if (!response.ok || !payload.text) throw new Error(payload.error || "Understudy could not extract this PDF.");
  return payload.text;
}

export async function extractFileText(file: File) {
  const extension = extensionOf(file.name);
  let text = "";

  if (TEXT_EXTENSIONS.has(extension)) text = await file.text();
  else if (extension === ".html" || extension === ".htm" || extension === ".xml") text = extractMarkup(await file.text());
  else if (extension === ".rtf") text = extractRtf(await file.text());
  else if (extension === ".docx") text = await extractDocx(file);
  else if (extension === ".pptx") text = await extractPptx(file);
  else if (extension === ".xlsx") text = await extractXlsx(file);
  else if (extension === ".odt") text = await extractOdt(file);
  else if (extension === ".pdf") text = await extractPdf(file);
  else if (extension === ".doc" || extension === ".xls" || extension === ".ppt") {
    throw new Error("Legacy binary Office files (.doc/.xls/.ppt) are not safely parseable in the browser. Save the file as DOCX/XLSX/PPTX or PDF and upload it again.");
  } else {
    throw new Error(`Understudy does not support ${extension || "this file type"} yet.`);
  }

  const cleaned = text.replace(/\u0000/g, "").trim();
  if (cleaned.length < 20) throw new Error("Understudy could not find enough readable text in this file.");
  return cleaned.slice(0, 60_000);
}
