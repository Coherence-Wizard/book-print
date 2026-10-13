# Book Print

By **Coherence Wizard**. Turn Markdown notes into 6 x 9 inch books with a local PDF preview, printable covers, and optional printing and shipping.

**Local preview and PDF export are free. Physical printing and shipping are paid services.** Book Print is an independent community plugin and is not affiliated with Obsidian.

This is the **0.0.2 review candidate**, not yet approved or listed in the community directory. The hosted ordering backend is separately operated and is not included in this client repository.

## Requirements

- Obsidian Desktop 1.14.4 or newer. The renderer uses desktop Electron APIs; mobile is unsupported.
- No Book Print, Stripe, or printer account is required for customers. An internet connection is required for online cover dimensions, quotes, validation, checkout, and order status.
- The release was tested on macOS. Windows and Linux require additional platform testing.

## Make a book

1. Open a Markdown note and run **Create physical book**, use the book ribbon button, or use the note's context menu. With no active Markdown note, choose notes from the picker.
2. Set the title, author, and optional copyright page. Edit the manuscript while viewing the actual locally generated PDF. Single newlines stay visible; a line containing `///` starts a new page and is omitted from print.
3. Choose a textured or solid cover theme. Optional front and back images each fill their own panel. Use images around 1800 x 2700 pixels or larger; cropping may occur. The solid-color spine adjusts to page count and binding. **Preview full cover** obtains current dimensions online without sending your manuscript or address.
4. Save a local interior PDF with **Save PDF**, or open **Print & ship**. Save default contact details in Settings → Book Print → Default shipping address, or choose another recipient for this book.
5. Use **Step 1: Validate** to upload the interior and cover PDFs for a print check without payment or a print job. It also obtains a quote using your contact/shipping details. Use **Step 2: Get Quote** to refresh the price, then **Step 3: Checkout** to upload the files and open Stripe's hosted payment page.

Typography is bundled Libre Caslon Text: 11 pt body and italic blockquotes, with alternating inside margins. Page 1 is a right-hand page. The preview includes padding to an even page count, or a multiple of four for stapled booklets.

| Binding | Interior pages |
| --- | --- |
| Softcover | 32–800 |
| Hardcover | 24–800 |
| Stapled booklet | 4–48, divisible by four |

### Your notes and saved projects

For a single note, manuscript edits and page-break markers save back to that original note. Book Print detects conflicting changes and retains its draft instead of overwriting another editor's changes. For multiple selected notes, the combined manuscript is saved as a separate book project in plugin data; the original notes are untouched.

**Remove [[links]] from PDF** omits the linked words or aliases only from the rendered PDF. Original Markdown and embedded images stay intact. Obsidian comments and frontmatter are omitted from print; code blocks remain literal.

Use **Resume saved book project** to reopen the most recently saved project. Keep normal vault backups; plugin data contains project drafts, artwork, default addresses, and private order-access tokens. Avoid sharing `data.json` in bug reports.

### Orders and support

Checkout shows the quoted price and estimated delivery. After payment, use **Check Order Status**. An eligible order offers **Cancel order** with a confirmation step. Cancellation is available within two hours of payment only while printing can still be stopped; a confirmed cancellation receives a full refund. Custom books are not refundable once printing begins, except where required by law.

Order confirmation is sent to the checkout email. Automated shipping-update emails are not currently provided by Book Print; check order status or contact support. Estimates are not guaranteed delivery dates.

Support: [josephrastovich@gmail.com](mailto:josephrastovich@gmail.com). Include your order ID, but never card information or private order-access links in a public issue.

## Network, privacy, and file access

Book Print performs local rendering without network requests. It has no client analytics, ads, self-updater, downloaded code, or remote fonts. Raw Markdown is not uploaded. Local vault images are embedded in the PDFs; external Markdown images are not downloaded.

When you request online features, the plugin contacts `https://book-print-api.coherencewizard.workers.dev` over HTTPS. The service uses Cloudflare for hosting/storage, Lulu for printing and fulfillment, and Stripe for payment. These provider names are disclosed here for transparency; the plugin's ordering interface uses Book Print branding. Full card details are entered on Stripe's hosted page, not stored in the plugin.

The operating system's file picker can read cover images outside the vault, and the save dialog can export a PDF outside the vault. Both actions require your explicit file selection. Saved project images are stored locally as data URLs. Earlier-installation import reads only that installation's data inside the same vault configuration folder when you click Import.

See [PRIVACY.md](PRIVACY.md) for the transmitted fields, access model, service records, retention, and deletion requests. A custom backend URL receives the same information; only use a server you trust.

## Earlier private builds

The official-review ID is `book-print`. Earlier private builds used `book-print-obsidian`, including versions numbered 2.x. The author designated the working baseline **0.0.1**, and this review candidate **0.0.2**; the new numbering is intentional.

Back up your vault configuration folder first. Disable the older plugin before switching. Install the new plugin in its own `book-print` folder, then use Settings → Book Print → Earlier installations → **Import earlier data**, before creating any new projects. It copies defaults, projects, artwork, and order-access details from `plugins/book-print-obsidian/data.json` under the current vault's configuration directory. It leaves the original files intact.

If a folder named `book-print` already contains an older private build, preserve it as a backup outside the plugins folder before installing. Do not overwrite any existing `data.json`. If your old files use a different folder, contact support before migrating.

## Development

Use Node.js 22 or later and npm. From a clean checkout:

```sh
npm ci --ignore-scripts
npm run build
npm run lint
npm test
npm run check:release
```

The build produces root `main.js`, `manifest.json`, and `styles.css`. The Book Print license and third-party notices are embedded in `main.js` because those three files are what Obsidian installs. Source modules are in `apps/obsidian-plugin/src` and the four `packages` workspaces. Build output is readable and unminified.

Optional desktop rendering smoke test: run `node node_modules/electron/install.js` to download the official Electron runtime, then `npm run test:render`. This uses synthetic manuscripts and does not contact the ordering service. Release instructions and the review checklist are in [REVIEW.md](REVIEW.md).

## Licensing and credits

Book Print's original code is covered by the [Book Print Source-Available License 1.0](LICENSE). You may use the plugin personally or in a business, sell your own books, inspect the source, and make private modifications. Commercial redistribution, incorporating the code into a product sold to others, operating a competing printing service using the code, and publicly distributing independently branded or modified versions require written permission from Coherence Wizard. Contribution-only GitHub forks are allowed under the license. This is source-available software with commercial restrictions, not OSI open-source software. Third-party components retain their existing licenses.

Libre Caslon Text is by the Libre Caslon Text Project Authors, under the SIL Open Font License 1.1. Bundled JavaScript and country/region data credits and complete licenses are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt), also included in the installed bundle. No rights to the user's manuscript or artwork are claimed by the software license.
