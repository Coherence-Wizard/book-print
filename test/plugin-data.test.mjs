import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const compiled = await build({ entryPoints: ['apps/obsidian-plugin/src/data.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { decodePluginData } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
const project = { id: 'test-project', title: 'Sample', sourceNotePaths: ['Sample.md'], workingManuscript: 'Original [[words]]\n///\nNext page', metadata: { title: 'Sample', author: 'Author', includeTitlePage: true, includeCopyrightPage: false }, coverConfig: { mode: 'generic', genericStyle: 'classic' }, bindingPreference: 'paperback', quantity: 1, lastOrderId: 'example-order', lastOrderToken: 'example-private-token', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
test('Legacy settings import preserves manuscripts, page breaks, order access, and project options without mutating input', () => {
  const source = { settings: { defaultAuthorName: 'Writer', printEnvironment: 'sandbox' }, projects: [project] };
  const before = structuredClone(source);
  const parsed = decodePluginData(source);
  assert.deepEqual(source, before);
  assert.deepEqual(parsed.projects, [project]);
  assert.equal(parsed.settings.defaultAuthorName, 'Writer');
  assert.equal(parsed.settings.printEnvironment, undefined);
  parsed.projects[0].workingManuscript = 'Edited';
  assert.equal(source.projects[0].workingManuscript, before.projects[0].workingManuscript);
});
test('Missing data starts clean; older unwrapped settings remain readable', () => {
  assert.deepEqual(decodePluginData(null).projects, []);
  assert.equal(decodePluginData({ defaultAuthorName: 'Earlier author' }).settings.defaultAuthorName, 'Earlier author');
});
test('Damaged project data fails without silently losing or overwriting drafts', () => {
  for (const invalid of [false, { projects: {} }, { settings: { defaultAuthorName: 42 } }, { projects: [{ ...project, coverConfig: { mode: 'generic', genericStyle: {} } }] }, { projects: [{ ...project, metadata: { ...project.metadata, author: null } }] }, { projects: [{ ...project, workingManuscript: null }] }]) {
    assert.throws(() => decodePluginData(invalid), /invalid|could not be read/);
  }
});
test('Public review metadata consistently identifies Book Print by Coherence Wizard', async () => {
  const root = JSON.parse(await readFile('manifest.json', 'utf8'));
  const plugin = JSON.parse(await readFile('apps/obsidian-plugin/manifest.json', 'utf8'));
  assert.deepEqual(root, plugin);
  assert.equal(root.id, 'book-print');
  assert.equal(root.author, 'Coherence Wizard');
  assert.equal(root.isDesktopOnly, true);
  assert.equal(JSON.parse(await readFile('versions.json', 'utf8'))[root.version], root.minAppVersion);
});
