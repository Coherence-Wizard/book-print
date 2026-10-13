# Review and release guide

Book Print 0.0.3 by Coherence Wizard. Repository: [Coherence-Wizard/book-print](https://github.com/Coherence-Wizard/book-print).

## Build and release

Use Node.js 22 or later:

```sh
npm ci --ignore-scripts
npm run build
npm run lint
npm test
npm run check:release
```

Release tags must exactly match the root manifest version, without a `v` prefix. Attach `main.js`, `manifest.json`, and `styles.css`, along with `LICENSE` and `THIRD_PARTY_NOTICES.txt`. The release workflow builds and checks the plugin, then creates a draft release for publication.

Submit a published release through the [Obsidian Community directory](https://community.obsidian.md/) using the repository owner's linked GitHub account. Check the current [submission instructions](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin) and [developer policies](https://docs.obsidian.md/community-directory/developer-policies). Publication on GitHub does not imply acceptance into the directory.

## Runtime and licensing

The build is readable and unminified. Obsidian, Electron, and @electron/remote are host-provided externals. Hidden renderer windows disable Node integration and enable context isolation and sandboxing. Generated documents use a restrictive Content Security Policy; raw Markdown HTML is disabled. Renderer scripts are fixed pagination and font-loading code.

The client uses Obsidian requestUrl and public Vault APIs. Modal cleanup closes child dialogs and renderer windows, revokes preview URLs, and clears pending timers. The plugin has no analytics, self-update, or downloaded-code path. Service credentials belong to the separately operated backend and are not part of the client.

The official Obsidian ESLint recommended configuration is enabled. A small set of sentence-case exceptions preserves the labels used throughout the interface. The Moment 2.31.0 development dependency override addresses GHSA-4p3w-j4w9-5jqw in the Obsidian type dependency tree; Moment is not bundled.

The original client code uses the [MIT License](LICENSE). Dependencies and fonts retain their respective licenses. Both the original-code license and third-party notices are embedded in the installed bundle. The separately operated printing backend is outside this repository and license grant.

## Review scenarios

1. Open a sample note and check offline PDF preview, single newlines, `///` page breaks, wiki-link filtering, title/copyright options, and local export.
2. Confirm page 1 has its inside margin on the left and page 2 on the right. Body text and italic blockquotes use 11 pt; generated PDF fonts are embedded.
3. Preview front and back themes and custom images. Check dynamic full-wrap dimensions for each binding and page count, a solid spine, and no default back-cover text. Dimension requests send book specifications but no address or manuscript.
4. Check shipping defaults, recipient draft cancel/apply behavior, explicit missing-email/phone warnings, page-count limits, and the three checkout steps.
5. Use a test backend for payment tests. Validation creates no paid order. Real checkout requires payment on Stripe.
6. Close or disable the plugin during rendering. Hidden windows must close, and late responses must not open checkout.
7. Back up plugin data, disable an earlier private build, and import its data into a fresh installation. Check projects, original notes, covers, addresses, and order access. Malformed input must fail without replacing saved data.

## Verification for 0.0.3

This release changes licensing, release metadata, and documentation. Runtime code is unchanged from 0.0.2. Run the build, lint, client tests, and release checks above to verify the updated bundle and metadata.

## Baseline verification for 0.0.2

- Clean lockfile installation and TypeScript build pass.
- Official Obsidian ESLint passes with zero warnings.
- All 15 client regression tests pass, including saved-data and release-metadata checks.
- Release metadata, installed license notices, and assets pass `npm run check:release`.
- Full dependency audit reports zero known vulnerabilities at release preparation.
- A fresh source-archive build reproduces the release assets byte for byte.
- Local rendering checks cover a 14-page sample, an 8-page padded booklet, and a 260-page book. All 1,700 numbered words and the final chapter were preserved; sampled fonts were embedded and interior pages measured 432 x 648 pt.
- Obsidian 1.14.4 on macOS: manuscript and cover previews, settings, and ordering controls checked.
- Windows/Linux and other Obsidian versions require further testing.

Optional rendering smoke test: `node node_modules/electron/install.js && npm run test:render`. It uses sample manuscripts and does not contact the ordering service.

## Hosted service

Online ordering depends on the separately operated service. Local preview and export work offline. File access, retention, payment handling, and shipping-notification limitations are documented in [PRIVACY.md](PRIVACY.md).
