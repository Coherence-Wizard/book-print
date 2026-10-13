import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileManuscriptToBookHtml, renderMarkdownToHtml, stripYamlFrontmatter } from '@book-print/markdown';
import { verify6x9PdfBuffer, BOOK_6X9_PRINT_OPTIONS } from '@book-print/pdf';
import { PDFDocument } from 'pdf-lib';
test('Optional removal hides wikilink words and aliases only in rendered content', () => {
  const manuscript = 'Before [[Folder/Hidden.md|Secret alias]] after.\n\n[[Standalone]]\n\n`[[Literal inline]]`\n\n```md\n[[Literal fenced]]\n```\n\n    [[Literal indented]]\n\n\\[\\[Escaped\\]\\]\n\n![[art.png|Artwork]]';
  const image = 'data:image/png;base64,aGVsbG8=';
  const metadata = { title: 'Links', author: 'Test', includeTitlePage: false, includeCopyrightPage: false };
  const retained = compileManuscriptToBookHtml(manuscript, { metadata, resolveImagePath: () => image });
  assert.ok(retained.includes('Secret alias'));
  assert.ok(retained.includes('Standalone'));
  const omitted = compileManuscriptToBookHtml(manuscript, { metadata, removeWikiLinks: true, resolveImagePath: () => image });
  assert.ok(!omitted.includes('Secret alias'));
  assert.ok(!omitted.includes('Standalone'));
  assert.ok(omitted.includes('Before  after.'));
  assert.ok(omitted.includes('[[Literal inline]]'));
  assert.ok(omitted.includes('[[Literal fenced]]'));
  assert.ok(omitted.includes('[[Literal indented]]'));
  assert.ok(omitted.includes('[[Escaped]]'));
  assert.ok(omitted.includes(image));
  assert.ok(manuscript.includes('[[Folder/Hidden.md|Secret alias]]'));
});
test('Single manuscript newlines stay on separate printed lines; blank lines separate paragraphs', () => {
  const names = 'Wes Pesto\nShiloh Buffalo Heart\nIan Piano Concert\nMargo Pie';
  const expected = '<p>Wes Pesto<br>\nShiloh Buffalo Heart<br>\nIan Piano Concert<br>\nMargo Pie</p>\n';
  assert.equal(renderMarkdownToHtml(names), expected);
  assert.equal(renderMarkdownToHtml(names.replaceAll('\n', '\r\n')), expected);
  assert.equal(renderMarkdownToHtml('First sentence.\nSecond **sentence**.\n\nNew paragraph.'), '<p>First sentence.<br>\nSecond <strong>sentence</strong>.</p>\n<p>New paragraph.</p>\n');
});
test('Line breaks preserve Markdown blocks and do not duplicate existing hard breaks', () => {
  const html = renderMarkdownToHtml('First  \nSecond\\\nThird\n\n> Quote one\n> Quote two\n\n- List one\n  Continued\n- List two\n\n```text\nCode one\nCode two\n```');
  assert.ok(html.includes('<p>First<br>\nSecond<br>\nThird</p>'));
  assert.ok(html.includes('<blockquote>\n<p>Quote one<br>\nQuote two</p>'));
  assert.ok(html.includes('<li>List one<br>\nContinued</li>'));
  assert.ok(html.includes('<pre><code class="language-text">Code one\nCode two\n</code></pre>'));
  assert.equal((html.match(/<br>/g) || []).length, 4);
});
test('Markdown preserves images, inline formatting, lists and code; page breaks only outside fences', () => {
  const image = 'data:image/png;base64,aGVsbG8=';
  const result = renderMarkdownToHtml('![Art](cover.png)\n\n**Bold** and *italic* and [Chapter](file.html#anchor) [#](#)\n\n- One\n- Two\n\n///\n\n```\n///\n<script>\n```', () => image);
  assert.ok(result.includes(image));
  assert.ok(result.includes('<strong>Bold</strong>'));
  assert.ok(result.includes('<em>italic</em>'));
  assert.ok(result.includes('<ul>'));
  assert.ok(!result.includes('file.html'));
  assert.ok(!result.includes('[#]'));
  assert.equal((result.match(/class="book-page-break"/g) || []).length, 1);
  assert.ok(result.includes('&lt;script&gt;'));
});
test('Frontmatter can be omitted and blank copyright adds no hardcoded edition text', () => {
  const metadata = { title: 'Actual Title', author: 'Real Author', includeTitlePage: true, includeCopyrightPage: true, copyrightNoticeText: '' };
  const html = compileManuscriptToBookHtml('---\ntitle: hidden\n---\n\n# Content\n\nActual text.', { metadata });
  assert.ok(!html.includes('title: hidden'));
  assert.ok(!html.includes('Physical Book Edition'));
  assert.ok(html.includes('Real Author'));
  const omitted = compileManuscriptToBookHtml('Actual text.', { metadata: { ...metadata, includeCopyrightPage: false } });
  assert.ok(!omitted.includes('book-copyright-page'));
  assert.equal(stripYamlFrontmatter('body\n---\nx\n---'), 'body\n---\nx\n---');
});
test('Obsidian hidden comments stay out of print, highlights render, and literal code survives', () => {
  const input='Visible %%hidden inline%% prose.\n\n%%\nHidden block\n\n///\nMore hidden text\n%%\n\n==Highlighted **bold** text==\n\n> [!NOTE] Note title\n> Note body\n\n`%% literal inline %%`\n\n```md\n%% literal fenced %%\n==literal highlight==\n```\n\n    %% literal indented %%';
  const html=renderMarkdownToHtml(input);
  assert.ok(!html.includes('hidden inline'));assert.ok(!html.includes('Hidden block'));assert.ok(!html.includes('More hidden'));
  assert.ok(!html.includes('book-page-break'));assert.ok(!html.includes('[!NOTE]'));
  assert.ok(html.includes('<mark>Highlighted <strong>bold</strong> text</mark>'));
  assert.ok(html.includes('%% literal inline %%'));assert.ok(html.includes('%% literal fenced %%'));
  assert.ok(html.includes('==literal highlight=='));assert.ok(html.includes('%% literal indented %%'));
});
test('PDF verifier checks later pages and modern Electron inches', async () => {
  assert.deepEqual(BOOK_6X9_PRINT_OPTIONS.pageSize, { width: 6, height: 9 });
  const pdf = await PDFDocument.create();
  pdf.addPage([432,648]);
  pdf.addPage([612,792]);
  const result = await verify6x9PdfBuffer(await pdf.save());
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some(e => e.startsWith('Page 2:')));
});
