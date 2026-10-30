export function formatPhone(digits: string): string {
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.startsWith("1") && digits.length === 11) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return `+${digits}`;
}

export const GREETING = "Hi Astra!";
