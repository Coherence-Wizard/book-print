import { AddressOption } from '@book-print/shared';

export function fillAddressSelect(select: HTMLSelectElement, options: AddressOption[], value: string) {
  select.replaceChildren();
  for (const option of options) select.add(new Option(option.label, option.value));
  // Keep older saved addresses visible rather than silently discarding them.
  if (value && !options.some(o => o.value === value)) select.add(new Option(value, value));
  select.value = value;
}
