import { BrowserWindow, dialog } from '@electron/remote';
import { shell, BrowserWindow as ElectronBrowserWindow } from 'electron';
import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { isRecord } from '../data.js';
import { Modal, App, Notice, TFile, requestUrl } from 'obsidian';
import { BookProject, PrintQuote, BindingType, BINDING_OPTIONS, bindingPageError, projectShippingAddress, SHIPPING_COUNTRIES, regionOptions, normalizeShippingRegion, BOOK_PRINT_SUPPORT_EMAIL, BOOK_PRINT_REFUND_POLICY, OrderCancellation, ShippingAddress, shippingDetailIssues, shippingDetailsMessage } from '@book-print/shared';
import { coverDocument, frontCoverDocument, backCoverDocument, coverGeometry, coverTexture, coverTextureBackground, COVER_THEMES, CoverDimensions } from '@book-print/book-layout';
import { compileManuscriptToBookHtml } from '@book-print/markdown';
import { renderBookInterior, renderDocumentPdf, renderCoverImage, verify6x9PdfBuffer, PrintWindow } from '@book-print/pdf';
import { ShippingAddressModal } from '../ui/ShippingAddressModal.js';
import type BookPrintPlugin from '../main.js';

interface QuoteResponse { quote: PrintQuote; coverDimensions: CoverDimensions; }
interface OrderResponse { status: string; cancellation?: OrderCancellation; }
interface CheckoutResponse { orderId?: string; customerToken?: string; checkoutUrl?: string; status: string; }

type Tab = 'content' | 'cover' | 'order';
const brandMessage = (message: string) => message.replace(/\blulu\b/gi, 'Book Print');
const errorText = (e: unknown) => brandMessage(e instanceof Error ? e.message : String(e));
interface PdfTrial { validationId: string; status: string; expectedPageCount: number; actualPageCount?: number; interiorStatus?: string; coverStatus?: string; errors?: string[]; interiorPdfUrl: string; coverPdfUrl: string; }

export class BookSetupModal extends Modal {
  private renderWindows = new Set<ElectronBrowserWindow>();
  private childModals = new Set<Modal>();
  private activeTab: Tab = 'content';
  private controls!: HTMLDivElement;
  private editorArea!: HTMLDivElement;
  private preview!: HTMLIFrameElement;
  private previewCaption!: HTMLParagraphElement;
  private editor!: HTMLTextAreaElement;
  private status!: HTMLSpanElement;
  private saveStatus!: HTMLSpanElement;
  private timer?: number;
  private saveTimer?: number;
  private revision = 0;
  private renderedRevision = -1;
  private renderQueue: Promise<void> = Promise.resolve();
  private interior?: Uint8Array;
  private pageCount = 0;
  private quote?: PrintQuote;
  private dimensions?: CoverDimensions;
  private coverPdf?: Uint8Array;
  private interiorUrl?: string;
  private coverUrl?: string;
  private panelCoverUrl?: string;
  private panelCoverRevision = -1;
  private coverPreviewMode: 'front' | 'back' | 'full' = 'front';
  private renderedCoverSide?: 'front' | 'back';
  private uploaded?: { revision: number; interiorFileId: string; coverFileId: string; previewFileId?: string };
  private trial?: PdfTrial;
  private closed = false;
  private busy = false;
  private paymentsReady = false;
  private expectedSource: string;
  private saveQueue: Promise<void> = Promise.resolve();
  private checkoutAttempt?: { key: string; revision: number };
  private orderCancellation?: OrderCancellation;
  private checkingOrder = false;

  constructor(app: App, private plugin: BookPrintPlugin, private project: BookProject) {
    super(app);
    this.expectedSource = project.workingManuscript;
    Object.assign(project, projectShippingAddress(project, plugin.pluginSettings.defaultShippingAddress));
  }
  onOpen() {
    this.modalEl.addClass('book-print-modal');
    this.contentEl.addClass('book-setup-modal-container');
    this.contentEl.empty();
    const header = this.contentEl.createDiv({ cls: 'book-modal-header' });
    header.createEl('h2', { text: 'Book Print · 6 × 9' });
    this.status = header.createSpan({ text: 'Preparing local PDF…' });
    this.saveStatus = header.createSpan({ text: 'Saved locally' });
    const main = this.contentEl.createDiv({ cls: 'book-modal-main' });
    const left = main.createDiv({ cls: 'book-editor-panel' });
    const nav = left.createDiv({ cls: 'book-tabs-nav' });
    for (const [id, text] of [['content', 'Manuscript'], ['cover', 'Cover'], ['order', 'Print & ship']] as const) {
      const btn = nav.createEl('button', { text, cls: id === this.activeTab ? 'active' : '' });
      btn.onclick = () => {
        this.activeTab = id;
        if (id === 'order') {
          const shipping = projectShippingAddress(this.project, this.plugin.pluginSettings.defaultShippingAddress);
          const addressChanged = JSON.stringify(this.project.shippingAddress) !== JSON.stringify(shipping.shippingAddress);
          Object.assign(this.project, shipping);
          if (addressChanged) this.changed();
        }
        nav.querySelectorAll('button').forEach(b => b.toggleClass('active', b === btn));
        this.renderControls();
        this.showPreview();
        if (id === 'cover') this.scheduleRender(0);
        if (id === 'order' && this.project.lastOrderId) void this.checkOrderStatus(false);
      };
    }
    this.controls = left.createDiv({ cls: 'book-controls' });
    this.editorArea = left.createDiv({ cls: 'book-editor-area' });
    const toolbar = this.editorArea.createDiv({ cls: 'book-editor-toolbar' });
    const breakBtn = toolbar.createEl('button', { text: 'Insert page break (///)' });
    breakBtn.onclick = () => {
      const { selectionStart: start, selectionEnd: end, value } = this.editor;
      this.editor.value = value.slice(0, start) + '\n\n///\n\n' + value.slice(end);
      this.editor.selectionStart = this.editor.selectionEnd = start + 7;
      this.editor.focus();
      this.project.workingManuscript = this.editor.value;
      this.changed();
      void this.save().catch(e => new Notice(errorText(e)));
    };
    const exportBtn = toolbar.createEl('button', { text: 'Save PDF…' });
    exportBtn.onclick = () => void this.exportPdf().catch(e => new Notice(errorText(e)));
    this.editor = this.editorArea.createEl('textarea', { cls: 'book-manuscript-input', attr: { 'aria-label': 'Book manuscript' } });
    this.editor.value = this.project.workingManuscript;
    this.editor.oninput = () => { this.project.workingManuscript = this.editor.value; this.changed(); };
    const right = main.createDiv({ cls: 'book-preview-panel' });
    this.previewCaption = right.createEl('p', { text: 'Preview of the actual interior PDF that will be submitted', cls: 'book-preview-caption' });
    this.preview = right.createEl('iframe', { cls: 'book-pdf-preview', attr: { title: 'Book PDF preview' } });
    this.renderControls();
    this.scheduleRender(0);
  }
  private makeWindow(): PrintWindow {
    if (this.closed) throw new Error('The book window is closed.');
    const win = new BrowserWindow({ show: false, width: 640, height: 920, useContentSize: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    this.renderWindows.add(win);
    return {
      loadURL: url => win.loadURL(url),
      webContents: win.webContents,
      destroy: () => { this.renderWindows.delete(win); if (!win.isDestroyed()) win.destroy(); },
    };
  }
  private openChild(modal: Modal) {
    const close = modal.onClose.bind(modal);
    modal.onClose = () => { this.childModals.delete(modal); close(); };
    this.childModals.add(modal);
    this.plugin.openModal(modal);
  }

  private changed() {
    this.revision++;
    this.quote = undefined;
    this.dimensions = undefined;
    this.coverPdf = undefined;
    if (this.coverPreviewMode === 'full') this.coverPreviewMode = 'front';
    if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
    this.coverUrl = undefined;
    if (this.panelCoverUrl) URL.revokeObjectURL(this.panelCoverUrl);
    this.panelCoverUrl = undefined;
    this.uploaded = undefined;
    this.trial = undefined;
    this.checkoutAttempt = undefined;
    this.status.textContent = 'Updating local PDF…';
    this.showPreview();
    this.saveStatus.textContent = 'Saving…';
    this.contentEl.win.clearTimeout(this.saveTimer);
    this.saveTimer = this.contentEl.win.setTimeout(() => void this.save().catch(e => { this.saveStatus.textContent = errorText(e); }), 400);
    this.scheduleRender(600);
  }
  private save(): Promise<void> {
    const snapshot = structuredClone(this.project);
    this.saveQueue = this.saveQueue.catch(() => {}).then(async () => {
      await this.plugin.saveProject(snapshot);
      if (snapshot.sourceNotePaths.length === 1 && snapshot.syncSourceNote !== false) {
        const file = this.app.vault.getAbstractFileByPath(snapshot.sourceNotePaths[0]);
        if (!(file instanceof TFile)) throw new Error('Source note is unavailable; the Book Project is saved locally.');
        await this.app.vault.process(file, current => {
          if (current !== this.expectedSource && current !== snapshot.workingManuscript) throw new Error('The original note changed outside Book Print. Your draft is saved; reopen the note to resolve the conflict.');
          return snapshot.workingManuscript;
        });
        this.expectedSource = snapshot.workingManuscript;
      }
      this.saveStatus.textContent = snapshot.sourceNotePaths.length === 1 ? 'Saved to original note' : 'Book Project saved';
    });
    return this.saveQueue;
  }
  private scheduleRender(delay: number) {
    this.contentEl.win.clearTimeout(this.timer);
    this.timer = this.contentEl.win.setTimeout(() => { void this.ensureInterior().then(() => this.ensureCoverPanel()).catch(e => { if (!this.closed) this.status.textContent = errorText(e); }); }, delay);
  }
  private async imageData(): Promise<Map<string, string>> {
    const images = new Map<string, string>();
    const refs = Array.from(this.project.workingManuscript.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\(([^)]+)\)/g));
    for (const match of refs) {
      const src = (match[1] || match[2]).trim();
      const file = this.app.metadataCache.getFirstLinkpathDest(src, this.project.sourceNotePaths[0] || '');
      if (!file || !/^(png|jpe?g|webp)$/i.test(file.extension)) continue;
      const bytes = await this.app.vault.readBinary(file);
      const type = /jpe?g/i.test(file.extension) ? 'jpeg' : file.extension.toLowerCase();
      images.set(src, `data:image/${type};base64,${Buffer.from(bytes).toString('base64')}`);
    }
    return images;
  }
  private async ensureInterior() {
    const revision = this.revision;
    this.renderQueue = this.renderQueue.catch(() => {}).then(async () => {
      if (this.closed || this.renderedRevision === this.revision) return;
      const version = this.revision;
      const snapshot = structuredClone(this.project);
      const images = await this.imageData();
      const html = compileManuscriptToBookHtml(snapshot.workingManuscript, { metadata: snapshot.metadata, removeWikiLinks: snapshot.removeWikiLinks, resolveImagePath: p => images.get(p) || '' });
      const result = await renderBookInterior(html, () => this.makeWindow(), BINDING_OPTIONS[snapshot.bindingPreference].pageMultiple);
      const verified = await verify6x9PdfBuffer(result.pdfBuffer);
      if (!verified.isValid || verified.pageCount !== result.pageCount) throw new Error(verified.errors.join('\n') || 'Rendered page count does not match the print layout.');
      if (this.closed || version !== this.revision) return;
      this.interior = result.pdfBuffer;
      this.pageCount = verified.pageCount;
      this.renderedRevision = version;
      if (this.interiorUrl) URL.revokeObjectURL(this.interiorUrl);
      this.interiorUrl = this.pdfUrl(result.pdfBuffer);
      this.status.textContent = `${this.pageCount} pages · Libre Caslon Text · 11 pt · 6 × 9`;
      this.showPreview();
      if (this.activeTab === 'order') this.renderControls();
    });
    await this.renderQueue;
    if (!this.closed && (this.renderedRevision !== this.revision || revision !== this.revision)) await this.ensureInterior();
  }
  private pdfUrl(bytes: Uint8Array): string { return URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' })); }
  private async ensureCoverPanel() {
    if (this.closed || this.activeTab !== 'cover' || this.coverPreviewMode === 'full') return;
    const side = this.coverPreviewMode;
    if (this.panelCoverRevision === this.revision && this.renderedCoverSide === side) return;
    const version = this.revision;
    const snapshot = structuredClone(this.project);
    const document = side === 'back' ? backCoverDocument : frontCoverDocument;
    const bytes = await renderDocumentPdf(document(snapshot.metadata, snapshot.coverConfig), () => this.makeWindow());
    if (this.closed || version !== this.revision || side !== this.coverPreviewMode) return;
    if (this.panelCoverUrl) URL.revokeObjectURL(this.panelCoverUrl);
    this.panelCoverUrl = this.pdfUrl(bytes);
    this.panelCoverRevision = version;
    this.renderedCoverSide = side;
    this.showPreview();
  }
  private showPreview() {
    const isCover = this.activeTab === 'cover';
    const isFull = this.coverPreviewMode === 'full';
    const url = isCover ? isFull ? this.coverUrl : this.renderedCoverSide === this.coverPreviewMode ? this.panelCoverUrl : undefined : this.interiorUrl;
    this.previewCaption.textContent = isCover ? isFull ? 'Exact full-wrap cover PDF · back, spine and front' : `${this.coverPreviewMode === 'back' ? 'Back' : 'Front'}-cover PDF · use Preview full cover to check the complete wrap` : 'Preview of the actual interior PDF that will be submitted';
    if (isCover && isFull && this.coverUrl && this.dimensions) this.previewCaption.textContent += ` · spine ${(coverGeometry(this.dimensions).spineWidth / 72).toFixed(2)}″`;
    if (url && !this.preview.src.startsWith(url)) this.preview.src = `${url}#toolbar=0&view=FitH`;
    if (!url) this.preview.src = 'about:blank';
  }
  private text(label: string, value: string, update: (v: string) => void, multiline = false) {
    const group = this.controls.createEl('label', { cls: 'book-input-group' });
    group.createSpan({ text: label });
    const input = multiline ? group.createEl('textarea') : group.createEl('input');
    input.value = value;
    input.onchange = () => { update(input.value); this.changed(); };
    return input;
  }
  private toggle(label: string, value: boolean, update: (v: boolean) => void) {
    const group = this.controls.createEl('label', { cls: 'book-checkbox' });
    const input = group.createEl('input', { type: 'checkbox' });
    input.checked = value;
    group.createSpan({ text: label });
    input.onchange = () => { update(input.checked); this.changed(); this.renderControls(); };
  }
  private renderControls() {
    this.controls.empty();
    this.editorArea.toggleClass('book-hidden', this.activeTab !== 'content');
    if (this.activeTab === 'content') {
      const m = this.project.metadata;
      this.text('Title', m.title, v => { m.title = v; this.project.title = v; });
      this.text('Subtitle', m.subtitle || '', v => { m.subtitle = v; });
      this.text('Author', m.author, v => { m.author = v; });
      this.text('Other details', m.imprint || '', v => { m.imprint = v; });
      this.toggle('Include title page', m.includeTitlePage, v => { m.includeTitlePage = v; });
      this.toggle('Include copyright page', m.includeCopyrightPage, v => { m.includeCopyrightPage = v; });
      this.toggle('Remove [[links]] from PDF', this.project.removeWikiLinks === true, v => { this.project.removeWikiLinks = v; });
      this.controls.createEl('p', { text: 'Remove [[links]] hides linked words and aliases in print. Your markdown and embedded images stay intact.', cls: 'book-help' });
      if (m.includeCopyrightPage) this.text('Copyright notice (optional; blank omits extra text)', m.copyrightNoticeText || '', v => { m.copyrightNoticeText = v; }, true);
      this.controls.createEl('p', { text: this.project.sourceNotePaths.length === 1 ? 'Edits and /// page breaks save to the original note. Page-break markers are omitted from the printed PDF.' : 'This combined manuscript is saved as a Book Project. Original notes remain separate.', cls: 'book-help' });
    } else if (this.activeTab === 'cover') {
      const c = this.project.coverConfig;
      const group = this.controls.createEl('label', { cls: 'book-input-group' });
      group.createSpan({ text: 'Cover theme' });
      const themes = group.createEl('select');
      for (const [value, theme] of Object.entries(COVER_THEMES)) themes.createEl('option', { value, text: theme.label });
      themes.value = c.genericStyle || 'classic';
      themes.onchange = () => { c.genericStyle = themes.value as typeof c.genericStyle; this.changed(); this.renderControls(); };
      const textureGroup = this.controls.createEl('label', { cls: 'book-input-group' });
      textureGroup.createSpan({ text: 'Cover texture' });
      const textures = textureGroup.createEl('select');
      for (const [value, text] of [['paper', 'Paper grain'], ['linen', 'Book cloth'], ['none', 'Solid color']]) textures.createEl('option', { value, text });
      textures.value = coverTexture(c);
      textures.onchange = () => { c.texture = textures.value as typeof c.texture; this.changed(); this.renderControls(); };
      const gallery = this.controls.createDiv({ cls: 'book-cover-gallery' });
      for (const [value, theme] of Object.entries(COVER_THEMES)) {
        const button = gallery.createEl('button', { cls: 'book-cover-choice', attr: { 'aria-label': `${theme.label} cover`, 'aria-pressed': String(value === (c.genericStyle || 'classic')) } });
        const swatch = button.createDiv({ cls: 'book-cover-swatch' });
        swatch.setCssProps({ '--book-cover-background': theme.background, '--book-cover-foreground': theme.foreground, '--book-cover-texture': coverTextureBackground({ ...c, genericStyle: value as typeof c.genericStyle }) });
        swatch.createSpan({ text: this.project.metadata.title || 'Your book', cls: 'book-cover-title' });
        swatch.createSpan({ text: this.project.metadata.author || 'Author', cls: 'book-cover-author' });
        button.createSpan({ text: theme.label });
        button.onclick = () => { c.genericStyle = value as typeof c.genericStyle; this.changed(); this.renderControls(); };
      }
      this.text('Spine text (blank omits it)', c.spineText ?? `${this.project.metadata.title} · ${this.project.metadata.author}`, v => { c.spineText = v; }).setAttribute('maxlength', '300');
      this.bindingSelector();
      const previews = this.controls.createDiv({ cls: 'book-cover-preview-actions' });
      for (const side of ['front', 'back'] as const) {
        const button = previews.createEl('button', { text: `Preview ${side}`, attr: { 'aria-pressed': String(this.coverPreviewMode === side) } });
        button.disabled = this.busy;
        button.onclick = () => { this.coverPreviewMode = side; this.renderControls(); this.showPreview(); this.scheduleRender(0); };
      }
      const wrap = previews.createEl('button', { text: 'Preview full cover', cls: 'mod-cta' });
      wrap.disabled = this.busy;
      wrap.onclick = () => void this.previewFullCover();
      this.controls.createEl('p', { text: 'Front/back artwork: JPEG, PNG or WebP, preferably 1800 × 2700 pixels or larger (300 DPI) for each image. Each image fills its own cover panel and may be cropped. Panels without an image use your theme’s color and texture. The spine stays a solid theme color and adjusts automatically to page count and binding. Keep important details away from the outer 0.25 inch; hardcover wrap margins may crop more of the edges. Stapled booklets have no spine. Use Preview full cover to check the complete wrap and cropping.', cls: 'book-help' });
      for (const side of ['front', 'back'] as const) {
        const artworkActions = this.controls.createDiv({ cls: 'book-cover-upload-actions' });
        artworkActions.createEl('h3', { text: `${side === 'front' ? 'Front' : 'Back'} cover image` });
        const chooser = artworkActions.createEl('input', { type: 'file', attr: { accept: 'image/png,image/jpeg,image/webp', 'aria-label': `Choose ${side} background image` } });
        chooser.hidden = true;
        const choose = artworkActions.createEl('button', { text: side === 'front' ? 'Optional: Choose Background Image' : 'Optional: Choose Back Image' });
        choose.onclick = () => chooser.click();
        chooser.onchange = () => {
          const file = chooser.files?.[0];
          if (!file) return;
          if (file.size > 20 * 1024 * 1024) { new Notice('Choose a cover image smaller than 20 MB.'); return; }
          const reader = new FileReader();
          reader.onload = () => {
            if (this.closed) return;
            if (typeof reader.result !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/i.test(reader.result)) { new Notice('Choose a JPEG, PNG or WEBP image.'); return; }
            if (side === 'front') { c.customImagePath = reader.result; c.mode = 'custom'; }
            else c.backImagePath = reader.result;
            this.coverPreviewMode = side;
            this.changed(); this.renderControls(); new Notice(`Loaded ${side} image: ${file.name}`);
          };
          reader.onerror = () => { if (!this.closed) new Notice('The cover image could not be read.'); };
          reader.readAsDataURL(file);
        };
        const reset = artworkActions.createEl('button', { text: side === 'front' ? 'Remove Custom Background' : 'Remove Back Image' });
        reset.disabled = side === 'front' ? c.mode !== 'custom' || !c.customImagePath : !c.backImagePath;
        reset.onclick = () => {
          if (side === 'front') { c.mode = 'generic'; c.customImagePath = undefined; }
          else c.backImagePath = undefined;
          this.coverPreviewMode = side;
          this.changed(); this.renderControls();
        };
      }
    } else {
      this.bindingSelector();
      const copies = this.text('Copies', String(this.project.quantity), v => {
        const quantity = Number(v);
        if (!Number.isSafeInteger(quantity) || quantity < 1) { new Notice('Enter a whole number of copies, at least 1.'); return; }
        this.project.quantity = quantity;
      });
      copies.setAttribute('type', 'number'); copies.setAttribute('min', '1'); copies.setAttribute('step', '1');
      const option = BINDING_OPTIONS[this.project.bindingPreference];
      const ready = this.renderedRevision === this.revision;
      const pageError = ready ? bindingPageError(this.project.bindingPreference, this.pageCount) : undefined;
      this.controls.createEl('p', { text: ready ? pageError || `${this.pageCount} interior pages · eligible for ${option.label.toLowerCase()}.` : 'Updating the page count for this binding…', cls: pageError ? 'book-help book-warning' : 'book-help' });
      if (this.project.bindingPreference === 'booklet') this.controls.createEl('p', { text: 'Booklets are stapled at the fold and have no spine. Blank pages are added locally to reach a multiple of four; the preview includes them.', cls: 'book-help' });
      this.shippingSummary();
      const actions = this.controls.createDiv({ cls: 'book-order-actions' });
      const trialBtn = actions.createEl('button', { text: 'Step 1: Validate' });
      trialBtn.disabled = this.busy || !ready || !!pageError;
      trialBtn.onclick = () => void this.validatePdfs();
      const quoteBtn = actions.createEl('button', { text: 'Step 2: Get Quote', cls: 'mod-cta' });
      quoteBtn.disabled = this.busy || !ready || !!pageError;
      quoteBtn.onclick = () => void this.fetchQuote();
      actions.createEl('p', { text: 'Validate checks your PDFs without payment or printing.', cls: 'book-help' });
      if (this.trial) {
        const t = this.trial;
        const message = t.status === 'validated' ? `Book Print accepted the interior PDF (${t.actualPageCount} pages, expected ${t.expectedPageCount}) and the cover PDF. No payment or print job was created.` : t.status === 'failed' ? `Book Print validation failed: ${(t.errors || []).map(brandMessage).join('; ')}` : 'Book Print validation is pending. Click Step 1: Validate again to continue the same trial.';
        this.controls.createEl('p', { text: message, cls: 'book-help book-trial-result' });
        for (const [label, url] of [['View uploaded interior PDF', t.interiorPdfUrl], ['View uploaded cover PDF', t.coverPdfUrl]]) {
          const view = this.controls.createEl('button', { text: label });
          view.onclick = () => {
            let fileUrl: URL;
            try { fileUrl = new URL(url); } catch { new Notice('The server returned an invalid PDF address.'); return; }
            const base = new URL(this.plugin.pluginSettings.backendApiUrl);
            if (fileUrl.origin !== base.origin || !fileUrl.pathname.startsWith('/v1/files/') || fileUrl.username || fileUrl.password) { new Notice('The server returned an unexpected PDF address.'); return; }
            this.preview.src = `${fileUrl.href}#toolbar=0&view=FitH`; this.previewCaption.textContent = `${label.replace('View ', '')} · file supplied to Book Print`; };
        }
      }
      if (this.quote) this.controls.createEl('p', { text: `${this.quote.quantity} ${this.quote.quantity === 1 ? 'copy' : 'copies'} · ${(this.quote.totalCostCents / 100).toFixed(2)} ${this.quote.currency} including shipping and tax`, cls: 'book-price' });
      const support = this.controls.createDiv({ cls: 'book-order-policy' });
      support.createEl('p', { text: this.quote ? `Estimated delivery: ${this.quote.selectedShipping.estimatedDays}. Includes printing and shipping; holidays or customs may affect arrival.` : 'Get a quote to see your total and estimated delivery, including printing and shipping.', cls: 'book-help' });
      support.createEl('p', { text: BOOK_PRINT_REFUND_POLICY, cls: 'book-help' });
      support.createEl('p', { text: 'Quotes use your shipping details. Validation and checkout upload PDFs; Markdown stays local.', cls: 'book-help' });
      support.createSpan({ text: 'Questions? ' });
      support.createEl('a', { text: BOOK_PRINT_SUPPORT_EMAIL, href: `mailto:${BOOK_PRINT_SUPPORT_EMAIL}?subject=${encodeURIComponent(this.project.lastOrderId ? `Book Print order ${this.project.lastOrderId}` : 'Book Print support')}` });
      if (this.quote && !this.paymentsReady) this.controls.createEl('p', { text: 'Checkout is temporarily unavailable. Your PDF and quote are ready.', cls: 'book-help' });
      const checkoutActions = this.controls.createDiv({ cls: 'book-order-actions' });
      const order = checkoutActions.createEl('button', { text: 'Step 3: Checkout', cls: 'mod-cta' });
      order.disabled = this.busy || !this.quote || !this.paymentsReady || this.renderedRevision !== this.revision;
      order.onclick = () => void this.checkout();
      if (this.project.lastOrderId) {
        const refresh = checkoutActions.createEl('button', { text: 'Check Order Status' });
        refresh.disabled = this.busy || this.checkingOrder;
        refresh.onclick = () => void this.checkOrderStatus(true);
        checkoutActions.createEl('p', { text: `Latest order: ${this.project.lastOrderId}`, cls: 'book-help' });
        if (this.orderCancellation) checkoutActions.createEl('p', { text: `${this.orderCancellation.message}${this.orderCancellation.allowed && this.orderCancellation.deadline ? ` Deadline: ${new Date(this.orderCancellation.deadline).toLocaleString()}.` : ''}`, cls: 'book-help book-cancellation-status' });
        if (this.project.lastOrderToken) {
          const cancel = checkoutActions.createEl('button', { text: 'Cancel order' });
          cancel.disabled = this.busy || this.checkingOrder || !this.orderCancellation?.allowed;
          cancel.onclick = () => void this.cancelOrder();
        }
      }
    }
  }
  private bindingSelector() {
    const group = this.controls.createEl('label', { cls: 'book-input-group' });
    group.createSpan({ text: 'Binding' });
    const select = group.createEl('select');
    for (const [value, option] of Object.entries(BINDING_OPTIONS)) select.createEl('option', { value, text: `${option.label} · ${option.minPages}–${option.maxPages} pages` });
    select.value = this.project.bindingPreference;
    select.onchange = () => { this.project.bindingPreference = select.value as BindingType; this.changed(); this.renderControls(); };
  }
  private shippingSummary() {
    const address = this.project.shippingAddress!;
    const summary = this.controls.createDiv({ cls: 'book-shipping-summary' });
    summary.createEl('h3', { text: this.project.shippingAddressSource === 'custom' ? 'Ship to · this book' : 'Ship to · saved address' });
    const state = regionOptions(address.country, address.state).find(option => option.value === normalizeShippingRegion(address.country, address.state))?.label || address.state;
    const country = SHIPPING_COUNTRIES.find(option => option.value === address.country.toUpperCase())?.label || address.country;
    const locality = [address.city, address.state ? state : '', address.postalCode].filter(Boolean).join(', ');
    const lines = address.addressLine1 ? [address.fullName, address.addressLine1, address.addressLine2, locality, country].filter(Boolean).join('\n') : 'No shipping address saved. Add an address here or save one in Book Print Settings.';
    summary.createEl('p', { text: lines, cls: 'book-shipping-lines' });
    const actions = summary.createDiv({ cls: 'book-shipping-actions' });
    const edit = actions.createEl('button', { text: address.addressLine1 ? 'Change shipping address' : 'Add shipping address' });
    const gift = actions.createEl('button', { text: 'Ship to someone else' });
    edit.disabled = gift.disabled = this.busy;
    edit.onclick = () => this.openShippingEditor(false);
    gift.onclick = () => this.openShippingEditor(true);
    const issues = shippingDetailIssues(address);
    if (issues.length) {
      summary.createEl('p', { text: `${shippingDetailsMessage(issues)} Add the missing details below, or update Settings → Book Print → Default shipping address.`, cls: 'book-help book-warning', attr: { role: 'alert' } });
      const fix = summary.createEl('button', { text: 'Add missing details' });
      fix.disabled = this.busy;
      fix.onclick = () => this.openShippingEditor(false, issues[0].field);
    }
  }
  private openShippingEditor(otherRecipient: boolean, focusField?: keyof ShippingAddress) {
    this.openChild(new ShippingAddressModal(this.app, this.project.shippingAddress!, this.plugin.pluginSettings.defaultShippingAddress, this.project.shippingAddressSource || 'settings', (shippingAddress, shippingAddressSource) => {
      if (this.closed) return;
      Object.assign(this.project, { shippingAddress, shippingAddressSource });
      this.changed();
      this.renderControls();
    }, otherRecipient, focusField));
  }
  private requireShippingDetails(): boolean {
    const issues = shippingDetailIssues(this.project.shippingAddress);
    if (!issues.length) return true;
    new Notice(`${shippingDetailsMessage(issues)} Add them in the form now open, or in Settings → Book Print → Default shipping address.`, 12000);
    this.openShippingEditor(false, issues[0].field);
    return false;
  }
  private async previewFullCover() {
    if (this.busy) return;
    this.busy = true;
    this.renderControls();
    try {
      await this.ensureInterior();
      const pageError = bindingPageError(this.project.bindingPreference, this.pageCount);
      if (pageError) throw new Error(pageError);
      const version = this.revision;
      const data = await this.api<{ coverDimensions: CoverDimensions }>('/v1/cover-dimensions', { pageCount: this.pageCount, binding: this.project.bindingPreference });
      const bytes = await renderDocumentPdf(coverDocument(this.project.metadata, this.project.coverConfig, data.coverDimensions), () => this.makeWindow());
      if (version !== this.revision || this.closed) throw new Error('The book changed. Preview the new cover again.');
      this.dimensions = data.coverDimensions;
      this.coverPdf = bytes;
      if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
      this.coverUrl = this.pdfUrl(bytes);
      this.coverPreviewMode = 'full';
      this.showPreview();
    } catch (e) { new Notice(errorText(e), 10000); }
    finally { this.busy = false; if (!this.closed) this.renderControls(); }
  }
  private async api<T extends object>(path: string, body?: unknown, bytes?: Uint8Array, token?: string): Promise<T> {
    if (this.closed) throw new Error('The book window is closed.');
    const base = this.plugin.pluginSettings.backendApiUrl.trim().replace(/\/+$/, '');
    const url = new URL(base);
    if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('The backend must use HTTPS.');
    const response = await requestUrl({ url: `${base}${path}`, method: body || bytes ? 'POST' : 'GET', headers: { 'Content-Type': bytes ? path.includes('kind=preview') ? 'image/png' : 'application/pdf' : 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: bytes ? new Uint8Array(bytes).buffer : body ? JSON.stringify(body) : undefined, throw: false });
    let data: unknown;
    try { data = JSON.parse(response.text); } catch { throw new Error(`The API returned an unreadable response (HTTP ${response.status}).`); }
    if (!isRecord(data)) throw new Error('The API returned an unexpected response.');
    if (response.status >= 400 || data.success === false) throw new Error(typeof data.error === 'string' ? data.error : `The API returned HTTP ${response.status}.`);
    return data as T;
  }
  private async checkOrderStatus(notify: boolean) {
    if (!this.project.lastOrderId || this.checkingOrder) return;
    this.checkingOrder = true;
    try {
      const data = await this.api<OrderResponse>(`/v1/orders/${encodeURIComponent(this.project.lastOrderId)}`, undefined, undefined, this.project.lastOrderToken);
      this.orderCancellation = data.cancellation;
      if (notify) {
        const labels: Record<string, string> = { awaiting_payment: 'Waiting for payment', paid: 'Payment confirmed', submitting: 'Submitting to Book Print', printer_accepted: 'Accepted by Book Print; printing has not started', in_production: 'In production', shipped: 'Shipped', delivered: 'Delivered', manual_review: 'Order needs review', canceling: 'Checking cancellation', canceled: 'Canceled', failed: 'Printer reported an error' };
        new Notice(`${labels[data.status] || data.status}${data.cancellation ? `\n${data.cancellation.message}` : ''}`, 12000);
      }
      return data;
    } catch (e) { this.orderCancellation = undefined; new Notice(errorText(e), 10000); }
    finally { this.checkingOrder = false; if (!this.closed) this.renderControls(); }
  }
  private async cancelOrder() {
    if (this.busy || !this.project.lastOrderId || !this.project.lastOrderToken) return;
    const current = await this.checkOrderStatus(false);
    if (!current?.cancellation?.allowed) { new Notice(current?.cancellation?.message || 'Cancellation could not be verified.'); return; }
    const confirmed = await new Promise<boolean>(resolve => {
      const modal = new Modal(this.app);
      modal.onOpen = () => {
        modal.contentEl.createEl('h2', { text: 'Cancel this order?' });
        modal.contentEl.createEl('p', { text: 'This stops the entire order and requests a full refund to your original payment method. Book Print checks again that printing has not started.' });
        modal.contentEl.createEl('p', { text: `Order: ${this.project.lastOrderId}` });
        const keep = modal.contentEl.createEl('button', { text: 'Keep order' });
        keep.onclick = () => modal.close();
        const stop = modal.contentEl.createEl('button', { text: 'Confirm cancellation', cls: 'mod-warning' });
        stop.onclick = () => { resolve(true); modal.close(); };
      };
      modal.onClose = () => resolve(false);
      this.openChild(modal);
    });
    if (!confirmed || this.closed) return;
    this.busy = true; this.renderControls();
    try {
      const data = await this.api<OrderResponse>(`/v1/orders/${encodeURIComponent(this.project.lastOrderId)}/cancel`, { customerToken: this.project.lastOrderToken, confirm: 'CANCEL_ORDER' });
      this.orderCancellation = data.cancellation;
      new Notice(data.cancellation?.message || 'Cancellation requested. Check order status for confirmation.', 15000);
    } catch (e) { new Notice(errorText(e), 12000); await this.checkOrderStatus(false); }
    finally { this.busy = false; if (!this.closed) this.renderControls(); }
  }
  private async fetchQuote() {
    if (this.busy || !this.requireShippingDetails()) return;
    this.busy = true;
    this.renderControls();
    try {
      await this.ensureInterior();
      const pageError = bindingPageError(this.project.bindingPreference, this.pageCount);
      if (pageError) throw new Error(pageError);
      const version = this.revision;
      const health = await this.api<{ protocolVersion: number; stripeConfigured: boolean }>('/v1/health');
      if (health.protocolVersion !== 2) throw new Error('This backend needs the Book Print v2 update before ordering. Local PDF preview and export are ready.');
      this.paymentsReady = health.stripeConfigured === true;
      const payload = { projectId: this.project.id, pageCount: this.pageCount, binding: this.project.bindingPreference, quantity: this.project.quantity, shippingAddress: this.project.shippingAddress };
      const data = await this.api<QuoteResponse>('/v1/quotes', payload);
      if (version !== this.revision || this.closed) throw new Error('The manuscript or shipping details changed. Request a new quote.');
      this.dimensions = data.coverDimensions;
      const cover = await renderDocumentPdf(coverDocument(this.project.metadata, this.project.coverConfig, data.coverDimensions), () => this.makeWindow());
      if (version !== this.revision || this.closed) throw new Error('The book changed while preparing the cover. Request a new quote.');
      this.quote = data.quote;
      this.uploaded = undefined;
      this.trial = undefined;
      this.coverPdf = cover;
      if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
      this.coverUrl = this.pdfUrl(cover);
      this.coverPreviewMode = 'full';
      this.checkoutAttempt = { key: crypto.randomUUID(), revision: version };
      this.showPreview();
      await this.save();
    } catch (e) { this.quote = undefined; new Notice(errorText(e), 10000); }
    finally { this.busy = false; if (!this.closed) this.renderControls(); }
  }
  private async uploadPdfs(includePreview = false) {
    const revision = this.revision;
    if (this.uploaded?.revision === revision) {
      if (includePreview && !this.uploaded.previewFileId) await this.uploadCheckoutImage(revision);
      if (!this.uploaded || this.uploaded.revision !== this.revision) throw new Error('The book changed during upload. Request a new quote.');
      return this.uploaded;
    }
    if (!this.interior || !this.coverPdf || this.renderedRevision !== revision) throw new Error('Prepare the current book and cover before uploading.');
    const interiorBytes = this.interior, coverBytes = this.coverPdf;
    const interior = await this.api<{ fileId: string }>('/v1/upload?kind=interior', undefined, interiorBytes);
    const cover = await this.api<{ fileId: string }>('/v1/upload?kind=cover', undefined, coverBytes);
    if (revision !== this.revision || this.closed) throw new Error('The book changed during upload. Request a new quote.');
    this.uploaded = { revision, interiorFileId: interior.fileId, coverFileId: cover.fileId };
    if (includePreview) await this.uploadCheckoutImage(revision);
    if (!this.uploaded || this.uploaded.revision !== this.revision) throw new Error('The book changed during upload. Request a new quote.');
      return this.uploaded;
  }
  private async uploadCheckoutImage(revision: number) {
    const image = await renderCoverImage(frontCoverDocument(this.project.metadata, this.project.coverConfig), () => this.makeWindow());
    if (revision !== this.revision || this.closed) throw new Error('The cover changed. Request a new quote.');
    const data = await this.api<{ fileId: string }>('/v1/upload?kind=preview', undefined, image);
    if (revision !== this.revision || !this.uploaded || this.closed) throw new Error('The book changed during upload. Request a new quote.');
    this.uploaded.previewFileId = data.fileId;
  }
  private async validatePdfs() {
    if (this.busy || !this.requireShippingDetails()) return;
    if (!this.quote) await this.fetchQuote();
    if (!this.quote || this.closed) return;
    this.busy = true;
    this.renderControls();
    try {
      const version = this.revision;
      const quoteId = this.quote.quoteId;
      await this.save();
      const files = await this.uploadPdfs();
      let result: PdfTrial = await this.api<PdfTrial>('/v1/pdf-validation', { quoteId, interiorFileId: files.interiorFileId, coverFileId: files.coverFileId });
      const deadline = Date.now() + 90000;
      while (result.status === 'validating' && Date.now() < deadline && !this.closed && version === this.revision) {
        this.status.textContent = 'Book Print is checking this book’s PDFs · no payment…';
        await new Promise(resolve => this.contentEl.win.setTimeout(resolve, 2000));
        result = await this.api<PdfTrial>(`/v1/pdf-validation/${encodeURIComponent(result.validationId)}`);
      }
      if (version !== this.revision || this.closed) throw new Error('The book changed during validation. Run the trial again for the new version.');
      this.trial = result;
      this.status.textContent = result.status === 'validated' ? `Interior (${result.actualPageCount} pages) and cover accepted · no payment` : result.status === 'failed' ? 'Book Print reported a PDF problem' : 'Book Print validation pending';
    } catch (e) { new Notice(`PDF trial: ${errorText(e)}`, 12000); }
    finally { this.busy = false; if (!this.closed) this.renderControls(); }
  }
  private async checkout() {
    if (this.busy || !this.quote || !this.interior || !this.coverPdf || !this.checkoutAttempt || this.checkoutAttempt.revision !== this.revision) return;
    this.busy = true;
    this.renderControls();
    try {
      const version = this.revision;
      const quote = this.quote;
      const attempt = this.checkoutAttempt;
      await this.save();
      const files = await this.uploadPdfs(true);
      if (version !== this.revision) throw new Error('The book changed during upload. Request a new quote before checkout.');
      const payload = { idempotencyKey: attempt.key, projectId: this.project.id, quoteId: quote.quoteId, bookTitle: this.project.metadata.title, interiorFileId: files.interiorFileId, coverFileId: files.coverFileId, previewFileId: files.previewFileId };
      let data = await this.api<CheckoutResponse>('/v1/checkout', payload);
      if (data.orderId) { if (this.project.lastOrderId !== data.orderId) { this.project.lastOrderToken = undefined; this.orderCancellation = undefined; } this.project.lastOrderId = data.orderId; this.project.lastOrderToken = data.customerToken; await this.save(); }
      const deadline = Date.now() + 90000;
      while (!data.checkoutUrl && data.status === 'validating' && Date.now() < deadline && !this.closed) {
        this.status.textContent = 'Book Print is validating your PDF files…';
        await new Promise(resolve => this.contentEl.win.setTimeout(resolve, 2000));
        if (version !== this.revision) throw new Error('The book changed. Request a new quote.');
        data = await this.api<CheckoutResponse>('/v1/checkout', payload);
      }
      if (!data.checkoutUrl) throw new Error('Printer validation is still pending. Retry checkout to continue the same order.');
      this.project.lastOrderToken = data.customerToken; await this.save();
      const checkout = new URL(data.checkoutUrl);
      if (checkout.protocol !== 'https:' || checkout.hostname !== 'checkout.stripe.com') throw new Error('The backend did not return a valid Stripe checkout URL.');
      if (this.closed) return;
      await shell.openExternal(checkout.href);
      new Notice('Checkout opened. The print job will be submitted after Stripe confirms payment.');
    } catch (e) { new Notice(`Checkout was not completed: ${errorText(e)}`, 10000); }
    finally { this.busy = false; if (!this.closed) this.renderControls(); }
  }
  private async exportPdf() {
    await this.ensureInterior();
    if (!this.interior) throw new Error('The local PDF is unavailable.');
    if (this.closed) return;
    const result = await dialog.showSaveDialog({ title: 'Save book interior PDF', defaultPath: `${this.project.metadata.title.replace(/[\\/:*?"<>|]/g, '-')}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (!result.canceled && result.filePath) { await writeFile(result.filePath, this.interior); new Notice('Saved the exact interior PDF shown in the preview.'); }
  }
  onClose() {
    this.closed = true;
    for (const modal of this.childModals) modal.close();
    this.childModals.clear();
    for (const win of this.renderWindows) if (!win.isDestroyed()) win.destroy();
    this.renderWindows.clear();
    this.contentEl.win.clearTimeout(this.timer);
    this.contentEl.win.clearTimeout(this.saveTimer);
    void this.save().catch(e => new Notice(errorText(e)));
    if (this.interiorUrl) URL.revokeObjectURL(this.interiorUrl);
    if (this.coverUrl) URL.revokeObjectURL(this.coverUrl);
    if (this.panelCoverUrl) URL.revokeObjectURL(this.panelCoverUrl);
    this.contentEl.empty();
  }
}
