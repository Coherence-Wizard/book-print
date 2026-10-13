import { FONT_CSS } from './fonts.js';
export * from './pagination.js';
export * from './cover.js';
export function getBookPrintCss(): string {
  return `${FONT_CSS}
    @page { size: 6in 9in; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; color: #000; background: #fff; }
    body { font-family: 'Libre Caslon Text'; font-size: 11pt; line-height: 15pt; }
    .book-page { width: 6in; height: 9in; position: relative; padding: .75in .60in .75in .85in; break-after: page; }
    .book-page:last-child { break-after: auto; }
    .book-page[data-side="even"] { padding-left: .60in; padding-right: .85in; }
    .book-page-inner { height: 7.5in; width: 100%; display: flow-root; }
    .book-page-footer { position: absolute; bottom: .30in; left: .60in; right: .60in; text-align: center; font-size: 9pt; }
    p { margin: 0 0 6pt; text-align: justify; overflow-wrap: anywhere; orphans: 2; widows: 2; }
    h1, h2, h3, h4 { font-family: 'Libre Caslon Text'; line-height: 1.2; margin: 18pt 0 12pt; overflow-wrap: anywhere; }
    h1 { font-size: 24pt; } h2 { font-size: 18pt; } h3 { font-size: 14pt; } h4 { font-size: 12pt; }
    h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
    blockquote { font-size: inherit; font-style: italic; margin: 12pt 18pt; }
    /* Caslon's standard italic ligatures include an ornate st; use separate letters. */
    em, i, blockquote, .book-main-subtitle { font-variant-ligatures: no-common-ligatures no-discretionary-ligatures; }
    ul, ol { padding-left: 20pt; margin: 6pt 0; } li { margin-bottom: 4pt; }
    pre { font: 9pt/12pt monospace; white-space: pre-wrap; overflow-wrap: anywhere; margin: 10pt 0; }
    code { font-size: .85em; } table { border-collapse: collapse; width: 100%; font-size: 10pt; }
    mark { background: #eee; color: inherit; }
    td, th { border: 1px solid #999; padding: 4pt; overflow-wrap: anywhere; }
    img { display: block; max-width: 100%; max-height: 6.5in; object-fit: contain; margin: 8pt auto; filter: grayscale(1); }
    hr { border: 0; border-top: 1px solid #888; margin: 12pt 0; }
    .book-title-page { height: 7.5in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .book-title-page > * { width: 100%; text-align: center; text-indent: 0; }
    .book-main-title { margin: 0 0 18pt; font-size: 26pt; }
    .book-main-subtitle { font-size: 14pt; font-style: italic; }
    .book-author-name { margin-top: 36pt; font-size: 14pt; }
    .book-other-details { margin-top: 12pt; font-size: 11pt; }
    .book-copyright-page { padding-top: 2in; font-size: 10pt; line-height: 14pt; }
    .book-copyright-page p { text-align: left; margin-bottom: 14pt; }
    #book-source { display: none; }
  `;
}
