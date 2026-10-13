import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const manifest = await readJson('manifest.json');
if (JSON.stringify(manifest) !== JSON.stringify(await readJson('apps/obsidian-plugin/manifest.json'))) throw new Error('Root and plugin manifests must match.');
// Support both standalone source and the release-document layout used by the workspace build.
const license = await readFile(path.join(root, 'LICENSE'), 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return readFile(path.join(root, 'review-docs/LICENSE'), 'utf8');
});
if (!license.trim() || /DRAFT|pending author|awaiting.*approval/i.test(license)) throw new Error('A finalized client license is required.');
const output = await build({ absWorkingDir: root, entryPoints: ['apps/obsidian-plugin/src/main.ts'], bundle: true, external: ['obsidian', 'electron', '@electron/remote'], platform: 'node', format: 'cjs', target: 'es2022', outfile: 'main.js', metafile: true, write: false, minify: false, legalComments: 'inline' });
const dependencies = new Map();
for (const input of Object.keys(output.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let directory = path.dirname(path.resolve(root, input));
  while (directory !== root && directory !== path.dirname(directory)) {
    try {
      const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      if (pkg.name) { dependencies.set(pkg.name, { ...pkg, directory }); break; }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    directory = path.dirname(directory);
  }
}
const notices = ['Book Print third-party notices', 'These components retain their own licenses, independently of the Book Print source-code license.'];
for (const [name, pkg] of [...dependencies].sort(([a], [b]) => a.localeCompare(b))) {
  const files = (await readdir(pkg.directory)).filter(name => /^(licen[cs]e|copying)([.-].*)?$/i.test(name));
  if (!files.length) throw new Error(`Missing bundled dependency license: ${name}`);
  notices.push(`\n${name} ${pkg.version} (${pkg.license || 'see below'})`);
  for (const file of files) notices.push(await readFile(path.join(pkg.directory, file), 'utf8'));
}
notices.push('\nLibre Caslon Text font software', await readFile(path.join(root, 'packages/book-layout/fonts/OFL.txt'), 'utf8'));
const text = notices.join('\n\n') + '\n';
// Obsidian installs only these three assets, so both original-code and third-party licenses travel in main.js.
const javascript = `/*!\n${license.replaceAll('*/', '* /')}\n${text.replaceAll('*/', '* /')}*/\n${output.outputFiles[0].text}`;
await mkdir(path.join(root, 'work'), { recursive: true });
await writeFile(path.join(root, 'work/plugin-metafile.json'), JSON.stringify(output.metafile, null, 2));
await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.txt'), text);
await writeFile(path.join(root, 'main.js'), javascript);
await writeFile(path.join(root, 'apps/obsidian-plugin/main.js'), javascript);
await copyFile(path.join(root, 'apps/obsidian-plugin/styles.css'), path.join(root, 'styles.css'));
console.log(`Built Book Print ${manifest.version}; included the Book Print license and licenses for ${dependencies.size} bundled packages and Libre Caslon Text.`);
