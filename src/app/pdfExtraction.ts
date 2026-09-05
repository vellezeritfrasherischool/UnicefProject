import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export class PdfExtractionError extends Error {
  constructor(public readonly code: "type" | "size" | "password" | "empty" | "invalid") {
    super(code);
    this.name = "PdfExtractionError";
  }
}

export async function extractPdfText(
  file: File,
  onProgress?: (currentPage: number, totalPages: number) => void
): Promise<string> {
  if (file.size > MAX_PDF_BYTES) throw new PdfExtractionError("size");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  const hasPdfType = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!hasPdfType || signature !== "%PDF-") throw new PdfExtractionError("type");

  try {
    // Keep the sizeable parser out of the initial application bundle.
    const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
    GlobalWorkerOptions.workerSrc = workerUrl;
    const document = await getDocument({ data: bytes }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pages.push(text);
      onProgress?.(pageNumber, document.numPages);
    }
    const result = pages.join("\n\n").trim();
    if (!result) throw new PdfExtractionError("empty");
    return result;
  } catch (error) {
    if (error instanceof PdfExtractionError) throw error;
    const name = typeof error === "object" && error && "name" in error ? String(error.name) : "";
    if (name === "PasswordException") throw new PdfExtractionError("password");
    throw new PdfExtractionError("invalid");
  }
}
