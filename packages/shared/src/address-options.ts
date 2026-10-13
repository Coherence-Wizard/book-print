import { allCountries } from 'country-region-data';

export interface AddressOption { value: string; label: string; }
export const SHIPPING_COUNTRIES: AddressOption[] = allCountries.map(([name, code]) => ({ value: code, label: name })).sort((a, b) => a.label.localeCompare(b.label));
export function shippingRegions(country: string): AddressOption[] {
  const data = allCountries.find(([, code]) => code === country.trim().toUpperCase());
  return (data?.[2] || []).map(([name, code]) => ({ value: code || name, label: name })).sort((a, b) => a.label.localeCompare(b.label));
}
export function normalizeShippingRegion(country: string, value: string): string {
  const saved = value.trim().replace(new RegExp(`^${country.toUpperCase()}-`, 'i'), '');
  const match = shippingRegions(country).find(r => r.value.toLowerCase() === saved.toLowerCase() || r.label.toLowerCase() === saved.toLowerCase());
  return match?.value || value.trim();
}
export function regionOptions(country: string, saved: string): AddressOption[] {
  const options = shippingRegions(country);
  const value = normalizeShippingRegion(country, saved);
  if (value && !options.some(o => o.value === value)) options.push({ value, label: value });
  return [{ value: '', label: options.length ? 'Choose state / province' : 'Not required' }, ...options];
}
