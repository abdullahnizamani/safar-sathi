import { format, parseISO } from "date-fns";

export function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(dateString: string) {
  try {
    return format(parseISO(dateString), "MMM d, yyyy • h:mm a");
  } catch {
    return dateString;
  }
}

export function formatDate(dateString: string) {
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
}
