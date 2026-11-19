import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  getUkNowParts,
  isBookingStartTimePassed as sharedIsBookingStartTimePassed,
  isBookingEndTimePassed as sharedIsBookingEndTimePassed,
} from "../../shared/booking";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr < getUkNowParts().dateStr;
}

/**
 * Returns true if the scheduled slot start time on the booking date has already passed (Europe/London).
 */
export function isBookingStartTimePassed(dateStr: string, timeSlot?: string | null): boolean {
  return sharedIsBookingStartTimePassed(dateStr, timeSlot);
}

/**
 * Returns true if the entire scheduled cleaning slot has concluded (Europe/London).
 */
export function isBookingEndTimePassed(dateStr: string, timeSlot?: string | null, durationHours?: number | null): boolean {
  return sharedIsBookingEndTimePassed(dateStr, timeSlot, durationHours);
}

export function isActiveUpcomingBooking(status: string, dateStr: string, timeSlot?: string | null, paymentStatus?: string | null): boolean {
  if (status === "cancelled" || status === "completed") return false;
  // If payment hasn't been completed and the start time has already arrived/passed, it's expired/cancelled
  if (paymentStatus !== "paid" && isBookingStartTimePassed(dateStr, timeSlot)) return false;
  // If paid and the end time has passed, it has moved to pending completion (no longer upcoming)
  if (paymentStatus === "paid" && isBookingEndTimePassed(dateStr, timeSlot)) return false;
  return ["upcoming", "pending", "confirmed"].includes(status) && !isPastDate(dateStr);
}

export function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `MMC-${year}-${random}`;
}

/**
 * Extracts clean user notes by stripping legacy bracketed metadata tags like
 * [Access: ...], [Supplies: ...], [Parking: ...], [Pets: ...].
 */
export function sanitizeCleanNotes(rawNotes?: string | null): string {
  if (!rawNotes) return "";
  return rawNotes
    .replace(/\[Access:\s*[^\]]+\]/gi, "")
    .replace(/\[Supplies:\s*[^\]]+\]/gi, "")
    .replace(/\[Parking:\s*[^\]]+\]/gi, "")
    .replace(/\[Pets:\s*[^\]]+\]/gi, "")
    .replace(/^[\s"\n]+|[\s"\n]+$/g, "")
    .trim();
}
