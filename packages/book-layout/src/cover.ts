import { BookMetadata, CoverConfig } from '@book-print/shared';
import { FONT_CSS } from './fonts.js';
export interface CoverDimensions { width: number; height: number; unit: 'pt'; }
export function coverGeometry(dimensions: CoverDimensions) {
  const outer = (dimensions.height - 648) / 2;
  const spineWidth = Math.max(0, dimensions.width - 864 - 2 * outer);
  return { outer, spineWidth, spineLeft: (dimensions.width - spineWidth) / 2 };
}
export const COVER_THEMES = {
  classic: { label: 'Classic', background: '#172033', foreground: '#ffffff' },
  minimal: { label: 'Minimal', background: '#f5f2e9', foreground: '#151515' },
  natural: { label: 'Natural', background: '#23493c', foreground: '#ffffff' },
  dark: { label: 'Dark', background: '#111111', foreground: '#ffffff' },
  academic: { label: 'Academic', background: '#322952', foreground: '#ffffff' },
  contemporary: { label: 'Contemporary', background: '#7a293d', foreground: '#ffffff' },
};
export function coverTexture(cover: CoverConfig): 'paper' | 'linen' | 'none' {
  return cover.texture || (['classic', 'academic', 'dark'].includes(cover.genericStyle || 'classic') ? 'linen' : 'paper');
}
/** Small repeating vector textures; bundled locally and shared by previews and print. */
export function coverTextureBackground(cover: CoverConfig): string {
  const texture = coverTexture(cover);
  if (texture === 'none') return 'none';
  let seed = 137;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const marks: string[] = [];
  for (let i = 0; i < 650; i++) {
    const x = (random() * 160).toFixed(2), y = (random() * 160).toFixed(2);
    const radius = (.2 + random() * .55).toFixed(2);
    marks.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${i % 2 ? '#fff' : '#000'}" opacity="${i % 2 ? .14 : .09}"/>`);
  }
  if (texture === 'linen') {
    for (let i = 0; i < 80; i++) {
      const offset = (i * 2 + random() * .6).toFixed(2);
      marks.push(`<path d="M${offset} 0V160M0 ${offset}H160" stroke="${i % 2 ? '#fff' : '#000'}" stroke-width=".5" opacity=".09"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">${marks.join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function coverDocument(metadata: BookMetadata, cover: CoverConfig, dimensions: CoverDimensions): string {
  const { width, height } = dimensions;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 864 || height < 648) throw new Error('Invalid printer cover dimensions.');
  const { outer, spineWidth } = coverGeometry(dimensions);
  return coverHtml(metadata, cover, width, height, outer, spineWidth, 'wrap');
}
export function frontCoverDocument(metadata: BookMetadata, cover: CoverConfig): string {
  return coverHtml(metadata, cover, 432, 648, 0);
}
export function backCoverDocument(metadata: BookMetadata, cover: CoverConfig): string {
  return coverHtml(metadata, cover, 432, 648, 0, 0, 'back');
}
function coverHtml(metadata: BookMetadata, cover: CoverConfig, width: number, height: number, outer: number, spineWidth = 0, panel: 'front' | 'back' | 'wrap' = 'front'): string {
  const { background: bg, foreground: fg } = COVER_THEMES[cover.genericStyle || 'classic'] || COVER_THEMES.classic;
  const artwork = (src?: string) => /^data:image\/(png|jpeg|webp);base64,/.test(src || '') ? `<img class="art" src="${escape(src!)}">` : '';
  const image = cover.mode === 'custom' ? artwork(cover.customImagePath) : '';
  const backImage = artwork(cover.backImagePath);
  const spineFontSize = Math.min(12, spineWidth / 2);
  const spineText = cover.spineText ?? `${metadata.title} · ${metadata.author}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><style>${FONT_CSS}
    @page { size: ${width}pt ${height}pt; margin: 0; }
    * { box-sizing: border-box; } body { position: relative; margin: 0; width: ${width}pt; height: ${height}pt; overflow: hidden; background-color: ${bg}; background-image: ${coverTextureBackground(cover)}; color: ${fg}; font-family: 'Libre Caslon Text'; }
    .front { position: absolute; top: ${outer}pt; right: ${outer}pt; width: 432pt; height: 648pt; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 54pt; text-align: center; clip-path: inset(-${outer}pt -${outer}pt -${outer}pt 0); }
    .back { position: absolute; top: ${outer}pt; left: ${outer}pt; width: 432pt; height: 648pt; clip-path: inset(-${outer}pt 0 -${outer}pt -${outer}pt); }
    .front > :not(img) { position: relative; } h1 { font-size: 26pt; line-height: 1.2; margin: 0 0 18pt; overflow-wrap: anywhere; } p { font-size: 14pt; } .author { margin-top: 36pt; } .details { font-size: 10pt; }
    .art { position: absolute; inset: -${outer}pt; width: calc(100% + ${outer * 2}pt); height: calc(100% + ${outer * 2}pt); object-fit: cover; opacity: .8; }
    .spine { position: absolute; left: ${(width - spineWidth) / 2}pt; top: 0; width: ${spineWidth}pt; height: ${height}pt; background-color: ${bg}; display: flex; align-items: center; justify-content: center; }
    .spine span { position: absolute; width: 500pt; text-align: center; transform: rotate(90deg); font-size: ${spineFontSize}pt; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    </style></head><body>${panel !== 'front' ? `<div class="back">${backImage}</div>` : ''}${panel === 'wrap' && spineWidth > 0 ? `<div class="spine">${spineWidth > .5 && spineText.trim() ? `<span>${escape(spineText)}</span>` : ''}</div>` : ''}${panel !== 'back' ? `<div class="front">${image}<h1>${escape(metadata.title)}</h1>${metadata.subtitle ? `<p>${escape(metadata.subtitle)}</p>` : ''}<p class="author">${escape(metadata.author)}</p>${metadata.imprint ? `<p class="details">${escape(metadata.imprint)}</p>` : ''}</div>` : ''}</body></html>`;
}
