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
      email: string;
      name: string;
    };
  };
}