# Book Print privacy disclosure

Review candidate dated October 12, 2026. Operator and support: Coherence Wizard, [josephrastovich@gmail.com](mailto:josephrastovich@gmail.com).

## Local work

Manuscript editing, pagination, PDF previews, front/back cover previews, and PDF export run on your computer. Markdown manuscripts are never uploaded by the plugin. Book projects, cover artwork, contact/address defaults, and private order-access tokens are saved in the plugin's `data.json` inside your vault configuration directory. Any synchronization or backup of that folder follows the services you configured for your vault.

A single-note manuscript saves to its original note; a combined manuscript is kept in plugin data. Imported cover images are read only after file selection. PDF export writes only to the destination selected in the save dialog. There are no client analytics or background requests on plugin startup.

## Online requests

| Action | Data sent |
| --- | --- |
| Preview full cover | Binding and interior page count, for exact cover dimensions |
| Get Quote | Project identifier, page count, binding, quantity, name, email, phone, and shipping address |
| Validate | Quote/contact details above, plus the compiled interior and complete cover PDFs |
| Checkout | Those PDFs, a front-cover preview image, book title, project/quote/file identifiers, and an idempotency identifier |
| Check Order Status / Cancel order | Order identifier and private order-access token; cancellation also includes your explicit confirmation |

Opening Print & ship for a project with an existing order refreshes its status. Viewing an uploaded PDF downloads that file from the configured service. None of these requests uploads the original Markdown text as a separate file. PDF contents can still contain any personal information present in the manuscript.

## Providers and service records

The default Book Print API is hosted on Cloudflare Workers; Cloudflare D1 and R2 hold quotes, orders, PDF/image uploads, validation results, and submission/cancellation records. Lulu receives the PDFs and the contact/shipping details needed to quote, print, and fulfill the order. Stripe receives payment-session details, the title and preview image, contact/shipping information and the amount. Your browser sends payment details directly to Stripe. Book Print does not store full payment-card details.

Cloudflare and the payment/printing providers process ordinary connection information such as IP addresses and request metadata under their own service policies. Server-side operational records are used for validation, payment reconciliation, duplicate-submission protection, fulfillment, cancellation, and support. Book Print includes no client-side analytics package and does not sell manuscript or address data.

Provider policies: [Cloudflare](https://www.cloudflare.com/privacypolicy/), [Lulu](https://www.lulu.com/privacy-policy), [Stripe](https://stripe.com/privacy).

## Access and retention

Uploaded PDFs and checkout images use unguessable file URLs so the printing/payment providers can fetch them. Possession of a file URL grants access; these URLs currently do not expire automatically. Treat uploaded-PDF links and order-access links/tokens as private. Administrators with service access can review order records and associated files for fulfillment/support.

The current service retains ordered files and order/submission records. There is no automatic deletion period currently configured. Administrators can purge unused uploads older than 24 hours, but that is an operator action, not a promise that every unused file is deleted after 24 hours. Payment and printing providers also have their own retention obligations and policies.

For access or deletion requests, email support with the order ID. We will verify the request and identify what can be removed, and what must be retained for fulfillment, accounting, fraud prevention, or applicable law. Disabling or uninstalling the plugin does not delete service-side records. Removing local plugin data can also remove your convenient access to order status; keep the order ID and purchase confirmation.
