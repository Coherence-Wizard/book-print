import { OrderStatus } from './types.js';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['rendering', 'canceled'],
  rendering: ['rendered', 'failed'],
  rendered: ['validating', 'failed'],
  validating: ['ready_for_quote', 'validation_failed', 'failed'],
  validation_failed: ['rendering', 'canceled'],
  ready_for_quote: ['quoted', 'failed'],
  quoted: ['awaiting_payment', 'canceled'],
  awaiting_payment: ['paid', 'canceled'],
  paid: ['submitting_to_printer', 'failed'],
  submitting_to_printer: ['printer_accepted', 'failed'],
  printer_accepted: ['in_production', 'failed'],
  in_production: ['shipped', 'failed'],
  shipped: ['delivered'],
  delivered: [],
  canceled: [],
  failed: ['rendering', 'submitting_to_printer'],
};

export function canTransitionOrder(current: OrderStatus, next: OrderStatus): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function assertValidOrderTransition(current: OrderStatus, next: OrderStatus): void {
  if (!canTransitionOrder(current, next)) {
    throw new Error(`Invalid order status transition from '${current}' to '${next}'`);
  }
}
