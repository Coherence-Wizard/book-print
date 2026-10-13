import { BindingType, BookProject, ShippingAddress } from './types.js';
import { normalizeShippingRegion } from './address-options.js';

// Lulu's current 6 × 9, black-and-white, 60# white products.
// https://help.lulu.com/en/support/solutions/articles/64000255583
export const BINDING_OPTIONS: Record<BindingType, { label: string; minPages: number; maxPages: number; pageMultiple: 2 | 4; podCode: string }> = {
  paperback: { label: 'Softcover (perfect bound)', minPages: 32, maxPages: 800, pageMultiple: 2, podCode: 'PB' },
  hardcover: { label: 'Hardcover (casewrap)', minPages: 24, maxPages: 800, pageMultiple: 2, podCode: 'CW' },
  booklet: { label: 'Stapled booklet (saddle stitch)', minPages: 4, maxPages: 48, pageMultiple: 4, podCode: 'SS' },
};

export function bindingPageError(binding: BindingType, pageCount: number): string | undefined {
  const option = BINDING_OPTIONS[binding];
  if (!option) return 'Choose softcover, hardcover or stapled booklet.';
  if (!Number.isInteger(pageCount) || pageCount < option.minPages || pageCount > option.maxPages) {
    return `${option.label} needs ${option.minPages}–${option.maxPages} interior pages. This manuscript has ${pageCount} pages.`;
  }
  if (pageCount % option.pageMultiple) return `${option.label} needs a page count divisible by ${option.pageMultiple}. Rebuild the PDF with this binding selected.`;
}

export function savedShippingAddress(project?: ShippingAddress, defaults?: ShippingAddress): ShippingAddress {
  const result: ShippingAddress = { fullName: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'US', email: '', phone: '', ...defaults };
  const hasProjectAddress = !!project && Object.entries(project).some(([key, value]) => key !== 'country' && typeof value === 'string' && value.trim());
  for (const key of Object.keys(result) as (keyof ShippingAddress)[]) {
    if (key === 'country' && !hasProjectAddress) continue;
    if (typeof project?.[key] === 'string' && project[key]!.trim()) result[key] = project[key]!;
  }
  return result;
}

export function projectShippingAddress(project: Pick<BookProject, 'shippingAddress' | 'shippingAddressSource'>, defaults?: ShippingAddress): { shippingAddress: ShippingAddress; shippingAddressSource: 'settings' | 'custom' } {
  if (project.shippingAddressSource === 'custom' && project.shippingAddress) return { shippingAddress: structuredClone(project.shippingAddress), shippingAddressSource: 'custom' };
  const saved = savedShippingAddress(undefined, defaults);
  if (project.shippingAddressSource === 'settings') return { shippingAddress: saved, shippingAddressSource: 'settings' };
  const existing = savedShippingAddress(project.shippingAddress, defaults);
  const comparable = (address: ShippingAddress) => [address.fullName, address.addressLine1, address.addressLine2, address.city, normalizeShippingRegion(address.country, address.state), address.postalCode, address.country.toUpperCase(), address.email, address.phone].map(value => (value || '').trim());
  const savedFields = comparable(saved);
  const usesSettings = comparable(existing).every((value, index) => value === savedFields[index]);
  return { shippingAddress: usesSettings ? saved : existing, shippingAddressSource: usesSettings ? 'settings' : 'custom' };
}
