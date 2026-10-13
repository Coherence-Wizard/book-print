import { BookMetadata } from '@book-print/shared';
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export function generateTitlePageHtml(m: BookMetadata): string {
  if (!m.includeTitlePage) return '';
  return `<div class="book-title-page"><h1 class="book-main-title">${escapeHtml(m.title)}</h1>${m.subtitle ? `<p class="book-main-subtitle">${escapeHtml(m.subtitle)}</p>` : ''}<p class="book-author-name">${escapeHtml(m.author)}</p>${m.imprint ? `<p class="book-other-details">${escapeHtml(m.imprint)}</p>` : ''}</div>`;
}
export function generateCopyrightPageHtml(m: BookMetadata): string {
  if (!m.includeCopyrightPage) return '';
  return `<div class="book-copyright-page"><p>Copyright © ${m.copyrightYear || new Date().getFullYear()} by ${escapeHtml(m.copyrightHolder || m.author)}</p>${m.copyrightNoticeText ? `<p>${escapeHtml(m.copyrightNoticeText).replace(/\n/g, '<br>')}</p>` : ''}${m.imprint ? `<p>${escapeHtml(m.imprint)}</p>` : ''}${m.website ? `<p>${escapeHtml(m.website)}</p>` : ''}${m.publisherContact ? `<p>${escapeHtml(m.publisherContact)}</p>` : ''}</div>`;
}
