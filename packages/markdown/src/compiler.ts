import MarkdownIt from 'markdown-it';
import { BookMetadata } from '@book-print/shared';
import { installWikilinks } from './wikilinks.js';
import { generateTitlePageHtml, generateCopyrightPageHtml } from './frontmatter.js';

export interface CompileOptions {
  metadata: BookMetadata;
  resolveImagePath?: (src: string) => string;
  removeWikiLinks?: boolean;
}
export interface RenderedPageSheet { pageNumber: number; type: 'title' | 'copyright' | 'content'; html: string; }
export function stripYamlFrontmatter(markdown: string): string {
  return markdown.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '');
}
/** Obsidian comments are omitted from print, but remain literal in code. */
export function stripObsidianComments(markdown: string): string {
  let result = '', fence = '', i = 0;
  while (i < markdown.length) {
    if (i === 0 || markdown[i - 1] === '\n') {
      const end = markdown.indexOf('\n', i);
      const line = markdown.slice(i, end < 0 ? markdown.length : end);
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence || marker) {
        if (fence && marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = '';
        else if (!fence && marker) fence = marker[1];
        result += line + (end < 0 ? '' : '\n');
        i = end < 0 ? markdown.length : end + 1;
        continue;
      }
      if (/^(?: {4}|\t)/.test(line)) { result += line + (end < 0 ? '' : '\n'); i = end < 0 ? markdown.length : end + 1; continue; }
    }
    if (markdown[i] === '\\' && i + 1 < markdown.length) { result += markdown.slice(i, i + 2); i += 2; continue; }
    if (markdown[i] === '`') {
      const ticks = markdown.slice(i).match(/^`+/)![0];
      let end = i + ticks.length;
      while ((end = markdown.indexOf(ticks, end)) >= 0) {
        if (markdown[end - 1] !== '`' && markdown[end + ticks.length] !== '`') break;
        end += ticks.length;
      }
      if (end >= 0) { result += markdown.slice(i, end + ticks.length); i = end + ticks.length; continue; }
    }
    if (markdown.slice(i, i + 2) === '%%') {
      const end = markdown.indexOf('%%', i + 2);
      if (end >= 0) { result += markdown.slice(i, end + 2).replace(/[^\n]/g, ''); i = end + 2; continue; }
    }
    result += markdown[i++];
  }
  return result;
}
/** Semantic sections only. Chromium measures physical pagination after fonts load. */
export function compileManuscriptToPageSheets(manuscript: string, options: CompileOptions): RenderedPageSheet[] {
  const sheets: RenderedPageSheet[] = [];
  if (options.metadata.includeTitlePage) sheets.push({ pageNumber: sheets.length + 1, type: 'title', html: generateTitlePageHtml(options.metadata) });
  if (options.metadata.includeCopyrightPage) sheets.push({ pageNumber: sheets.length + 1, type: 'copyright', html: generateCopyrightPageHtml(options.metadata) });
  sheets.push({ pageNumber: sheets.length + 1, type: 'content', html: renderMarkdownToHtml(stripYamlFrontmatter(manuscript), options.resolveImagePath, options.removeWikiLinks) });
  return sheets;
}
export function compileManuscriptToBookHtml(manuscript: string, options: CompileOptions): string {
  return compileManuscriptToPageSheets(manuscript, options).map(s => `<section data-book-section="${s.type}">${s.html}</section>`).join('\n');
}
export function renderMarkdownToHtml(markdown: string, resolveImagePath?: (src: string) => string, removeWikiLinks = false): string {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: true });
  installWikilinks(md, removeWikiLinks);
  md.inline.ruler.before('emphasis', 'book_highlight', (state, silent) => {
    if (state.src.slice(state.pos, state.pos + 2) !== '==') return false;
    const end = state.src.indexOf('==', state.pos + 2);
    if (end <= state.pos + 2) return false;
    if (!silent) {
      state.push('mark_open', 'mark', 1);
      state.md.inline.parse(state.src.slice(state.pos + 2, end), state.md, state.env, state.tokens);
      state.push('mark_close', 'mark', -1);
    }
    state.pos = end + 2;
    return true;
  });
  md.block.ruler.before('hr', 'book_page_break', (state, start, _end, silent) => {
    const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
    if (line.trim() !== '///') return false;
    if (!silent) { state.push('book_page_break', 'div', 0); state.line = start + 1; }
    return true;
  });
  md.renderer.rules.book_page_break = () => '<div class="book-page-break"></div>\n';
  md.renderer.rules.link_open = () => '';
  md.renderer.rules.link_close = () => '';
  const defaultImage = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, opt, env, self) => {
    const token = tokens[idx];
    const raw = String(token.attrGet('src') || '');
    const src = resolveImagePath?.(raw) || '';
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(src)) return `<span>[Image: ${md.utils.escapeHtml(token.content || raw)}]</span>`;
    token.attrSet('src', src);
    return defaultImage(tokens, idx, opt, env, self);
  };
  const tokens = md.parse(stripObsidianComments(markdown), {});
  for (const token of tokens) {
    const children = token.children;
    if (!children) continue;
    if (/^\[![a-zA-Z]+\][+-]?(?:\s|$)/.test(children[0]?.content || '')) children[0].content = children[0].content.replace(/^\[![a-zA-Z]+\][+-]?\s*/, '');
    for (let i = children.length - 3; i >= 0; i--) {
      if (children[i].type === 'link_open' && children[i + 1].type === 'text' && children[i + 1].content === '#' && children[i + 2].type === 'link_close') children.splice(i, 3);
    }
  }
  const html = md.renderer.render(tokens, md.options, {});
  return removeWikiLinks ? html.replace(/<p>\s*<\/p>\n/g, '') : html;
}
