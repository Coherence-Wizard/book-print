import { App, Notice, PluginSettingTab, SettingDefinition, SettingDefinitionItem } from 'obsidian';
import { PluginSettings, ShippingAddress, SHIPPING_COUNTRIES, regionOptions, normalizeShippingRegion, savedShippingAddress } from '@book-print/shared';
import { fillAddressSelect } from '../ui/address-select.js';
import type BookPrintPlugin from '../main.js';

export class BookPrintSettingsTab extends PluginSettingTab {
  constructor(app: App, private bookPlugin: BookPrintPlugin) { super(app, bookPlugin); }

  private async persist() {
    try { await this.bookPlugin.saveSettings(); }
    catch { new Notice('Book Print could not save settings. Check that your vault is writable and try again.'); }
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.bookPlugin.pluginSettings;
    const metadata = (name: string, key: Exclude<keyof PluginSettings, 'defaultShippingAddress'>, desc: string): SettingDefinition => ({
      name, desc,
      render: setting => { setting.addText(text => text.setValue(settings[key]).onChange(async value => { settings[key] = value; await this.persist(); })); },
    });
    const address = savedShippingAddress(undefined, settings.defaultShippingAddress);
    address.country = address.country.trim().toUpperCase();
    address.state = normalizeShippingRegion(address.country, address.state || '');
    const saveAddress = async () => { settings.defaultShippingAddress = address; await this.persist(); };
    const addressField = (name: string, key: keyof ShippingAddress, desc?: string): SettingDefinition => ({
      name, desc,
      render: setting => { setting.addText(text => text.setValue(address[key] || '').onChange(async value => { address[key] = value; await saveAddress(); })); },
    });
    let regionSelect: HTMLSelectElement | undefined;
    return [
      { type: 'group', heading: 'Default book metadata', items: [
        metadata('Default author name', 'defaultAuthorName', 'Used in new book projects.'),
        metadata('Default other details', 'defaultPublisherImprint', 'Optional publication details printed with the title and copyright information.'),
        metadata('Default copyright holder', 'defaultCopyrightHolder', 'Optional copyright holder name.'),
        metadata('Default copyright notice', 'defaultCopyrightNotice', 'Optional extra text on the copyright page.'),
        metadata('Default website', 'defaultWebsite', 'Optional author or publisher website on the copyright page.'),
      ] },
      { type: 'group', heading: 'Default shipping address', items: [
        { name: 'Shipping privacy', desc: 'Saved locally. Quotes send your contact and shipping details to Book Print. Validation and checkout also upload your PDFs. See the privacy policy in the plugin README.' },
        addressField('Full name', 'fullName'),
        addressField('Email', 'email', 'Required for checkout and order confirmation.'),
        addressField('Phone', 'phone', 'Required for shipping.'),
        addressField('Street address', 'addressLine1'),
        addressField('Apartment / unit', 'addressLine2'),
        addressField('City', 'city'),
        { name: 'Country', render: setting => { setting.addDropdown(dropdown => {
          fillAddressSelect(dropdown.selectEl, SHIPPING_COUNTRIES, address.country);
          dropdown.onChange(async value => {
            address.country = value; address.state = '';
            if (regionSelect?.isConnected) fillAddressSelect(regionSelect, regionOptions(value, ''), '');
            await saveAddress();
          });
        }); } },
        { name: 'State / province', render: setting => { setting.addDropdown(dropdown => {
          regionSelect = dropdown.selectEl;
          fillAddressSelect(regionSelect, regionOptions(address.country, address.state), address.state);
          dropdown.onChange(async value => { address.state = value; await saveAddress(); });
        }); } },
        addressField('Postal code', 'postalCode'),
      ] },
      { type: 'group', heading: 'Backend service', items: [
        metadata('Backend API URL', 'backendApiUrl', 'Use the default Book Print service unless you operate a compatible server. This server receives shipping details and PDFs when you request online services.'),
      ] },
      { type: 'group', heading: 'Earlier installations', items: [
        { name: 'Import earlier Book Print data', desc: 'After disabling the earlier plugin, copy its settings and projects into this installation. Replaces these default settings; the earlier files stay intact. Available before you create any projects here.', render: setting => {
          setting.addButton(button => button.setButtonText('Import earlier data').setDisabled(this.bookPlugin.projects.length > 0).onClick(async () => {
            button.setDisabled(true);
            try { await this.bookPlugin.importLegacyData(); this.update(); }
            catch (error) { new Notice(error instanceof Error ? error.message : String(error)); button.setDisabled(false); }
          }));
        } },
      ] },
    ];
  }
}
