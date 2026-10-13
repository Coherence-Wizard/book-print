import { PDFDocument } from 'pdf-lib';

export interface PdfVerificationResult {
  isValid: boolean;
  pageCount: number;
  widthPoints: number;
  heightPoints: number;
  widthMm: number;
  heightMm: number;
  errors: string[];
}

// 6x9 inches in Points (72 points/inch): 432 x 648 pt
// 6x9 inches in Millimeters: 152.4 x 228.6 mm
const EXPECTED_WIDTH_PT = 432;
const EXPECTED_HEIGHT_PT = 648;
const TOLERANCE_PT = 0.5;

export async function verify6x9PdfBuffer(pdfBuffer: Uint8Array): Promise<PdfVerificationResult> {
  const errors: string[] = [];

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;

    if (pageCount === 0) {
      errors.push('PDF contains 0 pages');
      return {
        isValid: false,
        pageCount: 0,
        widthPoints: 0,
        heightPoints: 0,
        widthMm: 0,
        heightMm: 0,
        errors,
      };
    }

    const firstPage = pages[0];
    const { width: widthPoints, height: heightPoints } = firstPage.getSize();
    const widthMm = (widthPoints / 72) * 25.4;
    const heightMm = (heightPoints / 72) * 25.4;

    // Inspect every page, including pages following frontmatter and manual breaks.
    for (const [index, page] of pages.entries()) {
    const { width: w, height: h } = page.getSize();
    if (Math.abs(w - EXPECTED_WIDTH_PT) > TOLERANCE_PT) {
      errors.push(
        `Page ${index + 1}: invalid width ${w.toFixed(2)}pt; expected 432pt.`
      );
    }

    if (Math.abs(h - EXPECTED_HEIGHT_PT) > TOLERANCE_PT) {
      errors.push(
        `Page ${index + 1}: invalid height ${h.toFixed(2)}pt; expected 648pt.`
      );
    }
    }

    return {
      isValid: errors.length === 0,
      pageCount,
      widthPoints,
      heightPoints,
      widthMm,
      heightMm,
      errors,
    };
  } catch (err: unknown) {
    return {
      isValid: false,
      pageCount: 0,
      widthPoints: 0,
      heightPoints: 0,
      widthMm: 0,
      heightMm: 0,
      errors: [`Failed to parse PDF document: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}
