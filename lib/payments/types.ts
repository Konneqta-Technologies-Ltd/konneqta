import { PaymentType } from "./plans";

export interface PaymentSession {
  publicKey: string;
  txRef: string;
  amount: number;
  currency: string;

  customer: {
    email: string;
    name: string;
    phone_number?: string;
  };

  customizations: {
    title: string;
    description: string;
  };

  /**
   * Which payment methods to show in the Flutterwave modal.
   * - Recurring (card-only): "card"
   * - One-time (all methods): "card,banktransfer,ussd"
   */
  paymentOptions: string;

  /** Flutterwave Payment Plan ID — passed to the checkout modal for recurring. */
  paymentPlan?: number;
}
export type PaymentStatus =
  | "pending"
  | "successful"
  | "failed"
  | "cancelled"
  | "refunded";

export interface InitializePaymentParams {
  txRef: string;
  amount: number;
  currency: string;
  paymentType: PaymentType;

  customer: {
    email: string;
    name: string;
    phone_number?: string;
    };

    customizations: {
    title: string;
    description: string;
  };

  /** Flutterwave Payment Plan ID — when set, the charge becomes recurring. */
  paymentPlan?: number;
}

export interface ServiceSuccess<T> {
  success: true;
  data: T;
}

export interface ServiceError {
  success: false;
 message: string;
}

export type ServiceResponse<T> =
  | ServiceSuccess<T>
  | ServiceError;

export interface FlutterwaveInitializeResponse {
  status: string;
  message: string;
  data: {
  link: string;
  };
}

export interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data: {
    id: number;
    tx_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    customer: {
      id?: number;
      email: string;
      name: string;
    };
    /** Present when the payment is part of a recurring Payment Plan. */
    card?: {
      first_6digits?: string;
      last_4digits?: string;
      issuer?: string;
      country?: string;
      type?: string;
      token?: string;
    };
    /** Sub-set of fields from the full Flutterwave response. */
    created_at?: string;
  };
}

// ── Subscription-related types ────────────────────────────────────────────

export interface FlutterwaveSubscriptionResponse {
  status: string;
  message: string;
  data: {
    id: number;
    customer: {
      id: number;
      email: string;
    };
    plan: number;
    status: string; // 'active', 'cancelled', 'completed'
    amount: number;
    currency: string;
    next_charge_date?: string | null;
    created_at: string;
    next_payment_date?: string | null;
  };
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  provider: string;
  external_subscription_id: string | null;
  external_customer_id: string | null;
  external_plan_id: string | null;
  origin: string;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
}
