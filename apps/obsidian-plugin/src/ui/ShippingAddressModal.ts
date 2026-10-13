import { App, Modal } from 'obsidian';
import { ShippingAddress, SHIPPING_COUNTRIES, regionOptions, normalizeShippingRegion, savedShippingAddress, shippingDetailIssues, shippingDetailsMessage } from '@book-print/shared';
import { fillAddressSelect } from './address-select.js';

export class ShippingAddressModal extends Modal {
  private draft: ShippingAddress;
  private source: 'settings' | 'custom';

  constructor(app: App, address: ShippingAddress, private savedAddress: ShippingAddress | undefined, source: 'settings' | 'custom', private onApply: (address: ShippingAddress, source: 'settings' | 'custom') => void, private otherRecipient = false, private focusField?: keyof ShippingAddress) {
    super(app);
    this.draft = otherRecipient ? { ...savedShippingAddress(), country: address.country, email: address.email || '' } : structuredClone(address);
    this.source = otherRecipient ? 'custom' : source;
  }

  onOpen() {
    this.modalEl.addClass('book-shipping-modal');
    this.renderForm();
  }

  private renderForm() {
    this.contentEl.empty();
    this.contentEl.createEl('h2', { text: this.otherRecipient ? 'Ship to someone else' : 'Change shipping address' });
    this.contentEl.createEl('p', { text: 'Email and phone are required for order confirmations and delivery. Use these details for this book, or set defaults in settings → Book Print → default shipping address.', cls: 'book-help' });
    const issues = shippingDetailIssues(this.draft);
    const warning = this.contentEl.createEl('p', { text: this.focusField ? shippingDetailsMessage(issues) : '', cls: 'book-help book-warning', attr: { role: 'alert' } });
    const form = this.contentEl.createEl('form', { cls: 'book-shipping-form' });
    form.noValidate = true;
    for (const [key, label, type] of [['fullName', 'Full name', 'text'], ['email', 'Order confirmation email', 'email'], ['phone', 'Shipping contact phone', 'tel'], ['addressLine1', 'Street address', 'text'], ['addressLine2', 'Apartment / unit', 'text'], ['city', 'City', 'text'], ['postalCode', 'Postal code', 'text']] as const) {
      const group = form.createEl('label', { cls: 'book-input-group' });
      group.createSpan({ text: label });
      const input = group.createEl('input', { type, attr: { name: key } });
      input.value = this.draft[key] || '';
      input.required = key !== 'addressLine2';
      input.oninput = () => { this.draft[key] = input.value; this.source = 'custom'; };
    }
    this.draft.country = this.draft.country.trim().toUpperCase();
    this.draft.state = normalizeShippingRegion(this.draft.country, this.draft.state || '');
    const countryGroup = form.createEl('label', { cls: 'book-input-group' });
    countryGroup.createSpan({ text: 'Country' });
    const country = countryGroup.createEl('select');
    country.name = 'country';
    fillAddressSelect(country, SHIPPING_COUNTRIES, this.draft.country);
    country.required = true;
    const stateGroup = form.createEl('label', { cls: 'book-input-group' });
    stateGroup.createSpan({ text: 'State / province' });
    const state = stateGroup.createEl('select');
    state.name = 'state';
    fillAddressSelect(state, regionOptions(this.draft.country, this.draft.state), this.draft.state);
    state.required = this.draft.country === 'US';
    country.onchange = () => {
      this.draft.country = country.value;
      this.draft.state = '';
      this.source = 'custom';
      fillAddressSelect(state, regionOptions(country.value, ''), '');
      state.required = country.value === 'US';
    };
    state.onchange = () => { this.draft.state = state.value; this.source = 'custom'; };
    const actions = form.createDiv({ cls: 'book-shipping-form-actions' });
    const updateWarning = () => {
      if (!warning.textContent) return;
      const problems = shippingDetailIssues(this.draft);
      warning.textContent = shippingDetailsMessage(problems);
      for (const input of Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select'))) input.setAttribute('aria-invalid', String(problems.some(issue => issue.field === input.name)));
    };
    form.oninput = updateWarning;
    form.onchange = updateWarning;
    if (this.savedAddress) {
      const reset = actions.createEl('button', { text: 'Use address from settings', type: 'button' });
      reset.onclick = () => { this.draft = savedShippingAddress(undefined, this.savedAddress); this.source = 'settings'; this.renderForm(); };
    }
    const cancel = actions.createEl('button', { text: 'Cancel', type: 'button' });
    cancel.onclick = () => this.close();
    actions.createEl('button', { text: 'Use this address', type: 'submit', cls: 'mod-cta' });
    form.onsubmit = event => {
      event.preventDefault();
      const problems = shippingDetailIssues(this.draft);
      if (problems.length) {
        warning.textContent = shippingDetailsMessage(problems);
        for (const input of Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select'))) input.setAttribute('aria-invalid', String(problems.some(issue => issue.field === input.name)));
        form.querySelector<HTMLElement>(`[name="${problems[0].field}"]`)?.focus();
        return;
      }
      for (const key of Object.keys(this.draft) as (keyof ShippingAddress)[]) if (typeof this.draft[key] === 'string') this.draft[key] = this.draft[key].trim();
      this.onApply(structuredClone(this.draft), this.source);
      this.close();
    };
    if (this.focusField) {
      for (const input of Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select'))) input.setAttribute('aria-invalid', String(issues.some(issue => issue.field === input.name)));
      const field = this.focusField;
      this.contentEl.win.requestAnimationFrame(() => { if (form.isConnected) form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus(); });
    }
  }

  onClose() { this.contentEl.empty(); }
}
