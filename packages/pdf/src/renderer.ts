import { getBookPrintCss, paginateBookDocument } from '@book-print/book-layout';

export const BOOK_6X9_PRINT_OPTIONS = {
  pageSize: { width: 6, height: 9 }, // printToPDF uses inches; print() uses microns.
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: false,
  scale: 1,
};
export type ElectronPrintToPDFOptions = typeof BOOK_6X9_PRINT_OPTIONS;
export interface PrintWindow {
  loadURL(url: string): Promise<void>;
  destroy(): void;
  webContents: {
    executeJavaScript<T = unknown>(code: string): Promise<T>;
    printToPDF(options: typeof BOOK_6X9_PRINT_OPTIONS): Promise<Uint8Array>;
    capturePage?(rect: { x: number; y: number; width: number; height: number }, options: { stayHidden: boolean }): Promise<{ resize(options: { width: number; height: number }): { toPNG(): Uint8Array } }>;
  };
}
export async function renderCoverImage(html: string, makeWindow: () => PrintWindow): Promise<Uint8Array> {
  const win = makeWindow();
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  try {
    await win.loadURL(url);
    await win.webContents.executeJavaScript(READY_SCRIPT);
    if (!win.webContents.capturePage) throw new Error('The local cover image renderer is unavailable.');
    const bounds = await win.webContents.executeJavaScript<{ x: number; y: number; width: number; height: number }>(`(() => {
      const front = document.querySelector('.front');
      if (!front) throw new Error('The front cover is unavailable.');
      const r = front.getBoundingClientRect();
      if (r.x < 0 || r.y < 0 || r.right > innerWidth || r.bottom > innerHeight) throw new Error('The front cover does not fit the image renderer.');
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })()`);
    const image = await win.webContents.capturePage(bounds, { stayHidden: true });
    return image.resize({ width: 432, height: 648 }).toPNG();
  } finally { win.destroy(); URL.revokeObjectURL(url); }
}
export interface PdfRenderResult { pdfBuffer: Uint8Array; pageCount: number; }
export function interiorDocument(contentHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><style>${getBookPrintCss()}</style></head><body><div id="book-source">${contentHtml}</div><div id="book-pages"></div></body></html>`;
}
const READY_SCRIPT = `Promise.all([document.fonts.load('12pt "Libre Caslon Text"'), document.fonts.load('bold 12pt "Libre Caslon Text"'), document.fonts.load('italic 12pt "Libre Caslon Text"'), document.fonts.load('bold italic 12pt "Libre Caslon Text"'), ...Array.from(document.images).map(i => i.decode())]).then(() => document.fonts.ready).then(() => {
  if (!document.fonts.check('12pt "Libre Caslon Text"') || !document.fonts.check('bold 12pt "Libre Caslon Text"') || !document.fonts.check('italic 12pt "Libre Caslon Text"') || !document.fonts.check('bold italic 12pt "Libre Caslon Text"')) throw new Error('The bundled book fonts failed to load.');
  return true;
})`;
export async function renderBookInterior(contentHtml: string, makeWindow: () => PrintWindow, pageMultiple: 2 | 4 = 2): Promise<PdfRenderResult> {
  const win = makeWindow();
  const url = URL.createObjectURL(new Blob([interiorDocument(contentHtml)], { type: 'text/html' }));
  try {
    await win.loadURL(url);
    await win.webContents.executeJavaScript(READY_SCRIPT);
    const result = await win.webContents.executeJavaScript<ReturnType<typeof paginateBookDocument>>(`(${paginateBookDocument.toString()})(${pageMultiple})`);
    if (result.overflowPages.length) throw new Error(`Print content overflows page(s) ${result.overflowPages.join(', ')}.`);
    const pdfBuffer = await win.webContents.printToPDF(BOOK_6X9_PRINT_OPTIONS);
    return { pdfBuffer, pageCount: result.pageCount };
  } finally { win.destroy(); URL.revokeObjectURL(url); }
}
export async function renderDocumentPdf(html: string, makeWindow: () => PrintWindow): Promise<Uint8Array> {
  const win = makeWindow();
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  try {
    await win.loadURL(url);
    await win.webContents.executeJavaScript(READY_SCRIPT);
    return await win.webContents.printToPDF(BOOK_6X9_PRINT_OPTIONS);
  } finally { win.destroy(); URL.revokeObjectURL(url); }
}
