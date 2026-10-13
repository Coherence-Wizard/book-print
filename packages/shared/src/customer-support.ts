export const BOOK_PRINT_SUPPORT_EMAIL = 'josephrastovich@gmail.com';
export const BOOK_PRINT_REFUND_POLICY = 'Because each book is custom printed, there are no refunds once printing begins, except where required by law. You may cancel within 2 hours of payment if printing has not started. A confirmed cancellation receives a full refund.';
export interface OrderCancellation {
  allowed: boolean;
  deadline?: string;
  state?: string;
  message: string;
}
