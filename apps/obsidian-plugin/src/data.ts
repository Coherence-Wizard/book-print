import { BookProject, DEFAULT_PLUGIN_SETTINGS, PluginSettings, ShippingAddress } from '@book-print/shared';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAddress(value: unknown): value is ShippingAddress {
  return isRecord(value) && ['fullName', 'addressLine1', 'city', 'state', 'postalCode', 'country'].every(key => typeof value[key] === 'string')
    && ['addressLine2', 'phone', 'email'].every(key => value[key] === undefined || typeof value[key] === 'string');
}

function isProject(value: unknown): value is BookProject {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.coverConfig)) return false;
  const metadata = value.metadata, cover = value.coverConfig;
  return ['id', 'title', 'workingManuscript', 'createdAt', 'updatedAt'].every(key => typeof value[key] === 'string')
    && Array.isArray(value.sourceNotePaths) && value.sourceNotePaths.every((path: unknown) => typeof path === 'string')
    && ['title', 'author'].every(key => typeof metadata[key] === 'string')
    && ['includeTitlePage', 'includeCopyrightPage'].every(key => typeof metadata[key] === 'boolean')
    && ['subtitle', 'imprint', 'copyrightHolder', 'copyrightNoticeText', 'website', 'publisherContact'].every(key => metadata[key] === undefined || typeof metadata[key] === 'string')
    && (metadata.copyrightYear === undefined || typeof metadata.copyrightYear === 'number')
    && ['generic', 'custom'].includes(String(cover.mode))
    && (cover.genericStyle === undefined || typeof cover.genericStyle === 'string' && ['classic', 'minimal', 'natural', 'dark', 'academic', 'contemporary'].includes(cover.genericStyle))
    && (cover.texture === undefined || typeof cover.texture === 'string' && ['paper', 'linen', 'none'].includes(cover.texture))
    && ['customImagePath', 'backImagePath', 'spineText', 'themePrimaryColor', 'themeBackgroundColor'].every(key => cover[key] === undefined || typeof cover[key] === 'string')
    && ['paperback', 'hardcover', 'booklet'].includes(String(value.bindingPreference))
    && typeof value.quantity === 'number' && Number.isFinite(value.quantity)
    && ['removeWikiLinks', 'syncSourceNote'].every(key => value[key] === undefined || typeof value[key] === 'boolean')
    && ['lastOrderId', 'lastOrderToken'].every(key => value[key] === undefined || typeof value[key] === 'string')
    && (value.shippingAddressSource === undefined || typeof value.shippingAddressSource === 'string' && ['settings', 'custom'].includes(value.shippingAddressSource))
    && (value.shippingAddress === undefined || isAddress(value.shippingAddress));
}

/** Reject damaged data without replacing it with an empty project list. */
export function decodePluginData(value: unknown): { settings: PluginSettings; projects: BookProject[] } {
  if (value === null || value === undefined) return { settings: { ...DEFAULT_PLUGIN_SETTINGS }, projects: [] };
  if (!isRecord(value)) throw new Error('Book Print settings could not be read. Your saved data has not been changed.');
  const raw = value.settings ?? value;
  if (!isRecord(raw)) throw new Error('Book Print settings are invalid. Your saved data has not been changed.');
  const settings: PluginSettings = { ...DEFAULT_PLUGIN_SETTINGS };
  for (const key of Object.keys(DEFAULT_PLUGIN_SETTINGS) as (keyof typeof DEFAULT_PLUGIN_SETTINGS)[]) {
    if (key === 'defaultShippingAddress') continue;
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== 'string') throw new Error(`Book Print setting ${key} is invalid. Your saved data has not been changed.`);
      settings[key] = raw[key];
    }
  }
  if (raw.defaultShippingAddress !== undefined) {
    if (!isAddress(raw.defaultShippingAddress)) throw new Error('The saved shipping address is invalid. Your saved data has not been changed.');
    settings.defaultShippingAddress = structuredClone(raw.defaultShippingAddress);
  }
  const projects: unknown = value.projects ?? [];
  if (!Array.isArray(projects) || !projects.every(isProject)) throw new Error('A saved book project is invalid. Your saved data has not been changed.');
  return { settings, projects: structuredClone(projects) };
}
