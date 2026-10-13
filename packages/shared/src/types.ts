export type BindingType = 'paperback' | 'hardcover' | 'booklet';

export type GenericCoverStyle =
  | 'classic'
  | 'minimal'
  | 'natural'
  | 'dark'
  | 'academic'
  | 'contemporary';

export interface CoverConfig {
  mode: 'generic' | 'custom';
  texture?: 'paper' | 'linen' | 'none';
  genericStyle?: GenericCoverStyle;
  customImagePath?: string; // Front image, stored locally as an image data URL.
  backImagePath?: string; // Independent back image, stored locally as an image data URL.
  customImageScale?: number; // Zoom level e.g. 1.0 = 100%
  customImagePosition?: { x: number; y: number }; // Offset values percentage
  themePrimaryColor?: string;
  themeBackgroundColor?: string;
  spineText?: string;
}

export interface BookMetadata {
  title: string;
  subtitle?: string;
  author: string;
  imprint?: string;
  copyrightHolder?: string;
  copyrightYear?: number;
  copyrightNoticeText?: string;
  website?: string;
  publisherContact?: string;
  includeTitlePage: boolean;
  includeCopyrightPage: boolean;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; // ISO 2-letter e.g. 'US'
  phone?: string;
  email?: string;
}

export interface BookProject {
  id: string; // UUID v4
  title: string;
  sourceNotePaths: string[];
  workingManuscript: string; // Combined editable markdown
  removeWikiLinks?: boolean; // Omit linked words in print without editing the source note.
  metadata: BookMetadata;
  coverConfig: CoverConfig;
  bindingPreference: BindingType;
  quantity: number;
  syncSourceNote?: boolean;
  lastOrderId?: string;
  lastOrderToken?: string;
  shippingAddress?: ShippingAddress;
  shippingAddressSource?: 'settings' | 'custom';
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export type OrderStatus =
  | 'draft'
  | 'rendering'
  | 'rendered'
  | 'validating'
  | 'validation_failed'
  | 'ready_for_quote'
  | 'quoted'
  | 'awaiting_payment'
  | 'paid'
  | 'submitting_to_printer'
  | 'printer_accepted'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'canceled'
  | 'failed';

export interface LineItemQuote {
  pageCount: number;
  podPackageId: string;
  unitPriceCents: number;
  totalManufacturingCents: number;
  shippingCostCents: number;
  serviceFeeCents: number;
  taxCents: number;
  totalCostCents: number;
  currency: string;
}

export interface ShippingOption {
  id: string;
  name: string; // e.g. 'Standard Shipping', 'Express Shipping'
  estimatedDays: string;
  minimumBusinessDays?: number;
  maximumBusinessDays?: number;
  costCents: number;
  currency: string;
}

export interface PrintQuote {
  quoteId: string;
  projectId: string;
  binding: BindingType;
  quantity: number;
  manufacturingCostCents: number;
  taxCents?: number;
  fulfillmentCostCents?: number;
  selectedShipping: ShippingOption;
  availableShippingOptions: ShippingOption[];
  serviceFeeCents: number;
  totalCostCents: number;
  currency: string;
  expiresAt: string;
}

export interface PrintOrder {
  id: string; // Backend order ID
  projectId: string;
  status: OrderStatus;
  stripePaymentIntentId?: string;
  printerOrderId?: string; // Lulu order ID
  quote: PrintQuote;
  shippingAddress: ShippingAddress;
  trackingNumber?: string;
  trackingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginSettings {
  defaultAuthorName: string;
  defaultPublisherImprint: string;
  defaultCopyrightHolder: string;
  defaultCopyrightNotice: string;
  defaultWebsite: string;
  defaultPublisherContact: string;
  defaultShippingAddress?: ShippingAddress;
  backendApiUrl: string;
}

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  defaultAuthorName: '',
  defaultPublisherImprint: '',
  defaultCopyrightHolder: '',
  defaultCopyrightNotice: '',
  defaultWebsite: '',
  defaultPublisherContact: '',
  backendApiUrl: 'https://book-print-api.coherencewizard.workers.dev',
};
