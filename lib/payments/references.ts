import { PaymentType } from "./plans";

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
  paymentType: PaymentType
): string {
  const timestamp = Date.now();

  const random = generateRandomString();

  return `KONN_${paymentType.toUpperCase()}_${timestamp}_${random}`;
}

export function isKonneqtaReference(txRef: string): boolean {
  return txRef.startsWith("KONN_");
}