import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  { ignores: ['**/node_modules/**', '**/dist/**', '**/main.js', 'work/**', 'archive/**'] },
  ...obsidianmd.configs.recommended,
  {
    rules: {
      'obsidianmd/ui/sentence-case': ['error', { brands: ['Book Print', 'Stripe', 'Libre Caslon Text', 'PDFs'], acronyms: ['PDF', 'API', 'URL', 'MB', 'DPI', 'JPEG', 'PNG', 'WEBP', 'US'], allowAutoFix: true,
        // These labels were explicitly requested by the product owner.
        ignoreRegex: ['^Step 2: Get Quote$', '^Check Order Status$', '^Optional: Choose (Background|Back) Image$', '^Remove (Custom Background|Back Image)$'] }],
    },
    files: ['apps/obsidian-plugin/src/**/*.ts'],
    languageOptions: { parserOptions: { project: './apps/obsidian-plugin/tsconfig.json', tsconfigRootDir: import.meta.dirname } },
  },
]);
