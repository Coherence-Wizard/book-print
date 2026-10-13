import { ShippingAddress } from './types.js';

export interface ShippingDetailIssue { field: keyof ShippingAddress; label: string; message: string; }
export function shippingDetailIssues(address?: ShippingAddress): ShippingDetailIssue[] {
  const fields = [['fullName', 'full name'], ['addressLine1', 'street address'], ['city', 'city'], ['postalCode', 'postal code'], ['country', 'country'], ['email', 'email'], ['phone', 'phone number']] as const;
  const issues: ShippingDetailIssue[] = fields.filter(([field]) => !address?.[field]?.trim()).map(([field, label]) => ({ field, label, message: `Missing ${label}.` }));
  if (address?.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email.trim())) issues.push({ field: 'email', label: 'email', message: 'Enter a valid email address.' });
  if (address?.country?.trim().toUpperCase() === 'US') {
    if (!address.state?.trim()) issues.push({ field: 'state', label: 'state', message: 'Choose a state.' });
    if (address.postalCode?.trim() && !/^\d{5}(?:-\d{4})?$/.test(address.postalCode.trim())) issues.push({ field: 'postalCode', label: 'postal code', message: 'Use a five-digit ZIP or ZIP+4.' });
  }
  return issues;
}
export function shippingDetailsMessage(issues: ShippingDetailIssue[]): string {
  return issues.map(issue => issue.message).join(' ');
}
