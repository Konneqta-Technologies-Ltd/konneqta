import { type Currency, PaymentType } from "./plans";

function generateRandomString(length = 10): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return result;
}

export function generateTransactionReference(
  paymentType: PaymentType,
  currency?: Currency
): string {
  const timestamp = Date.now();

  const random = generateRandomString();

  // Non-NGN currencies are embedded in the reference so support can identify
  // the currency from the tx_ref alone. NGN stays bare — matching every
  // historical reference (KONN_MONTHLY_..., KONN_YEARLY_...).
  const currencySuffix = currency && currency !== "NGN" ? `_${currency}` : "";

  return `KONN_${paymentType.toUpperCase()}${currencySuffix}_${timestamp}_${random}`;
}

export function isKonneqtaReference(txRef: string): boolean {
  return txRef.startsWith("KONN_");
}