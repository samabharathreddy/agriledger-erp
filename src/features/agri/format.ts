import type { Line, Row } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const text = (value: unknown): string => (value == null ? "" : String(value));

/** ₹ 1,24,500 — Indian digit grouping, paise only when present. */
export const money = (value: unknown): string => {
  const amount = num(value);
  const hasPaise = Math.round(amount * 100) % 100 !== 0;
  return `₹ ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};

/** ₹ 4.8 L style, for tight dashboard tiles. */
export const moneyShort = (value: unknown): string => {
  const amount = num(value);
  if (Math.abs(amount) >= 10000000) return `₹ ${(amount / 10000000).toFixed(2)} Cr`;
  if (Math.abs(amount) >= 100000) return `₹ ${(amount / 100000).toFixed(2)} L`;
  return money(Math.round(amount));
};

/** "2026-11-12" → "12 Nov 2026". Parsed by hand so time zones never shift the day. */
export const date = (value: unknown): string => {
  const parts = text(value).split("-");
  if (parts.length !== 3) return text(value) || "—";
  return `${parts[2]} ${MONTHS[Number(parts[1]) - 1] ?? ""} ${parts[0]}`;
};

export const todayIso = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const addDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
};

/** Whole days from today until the given date. Negative means already past. */
export const daysUntil = (iso: unknown, from: string = todayIso()): number => {
  const parse = (v: string) => {
    const [y, m, d] = v.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const target = text(iso);
  if (target.split("-").length !== 3) return 9999;
  return Math.round((parse(target) - parse(from)) / 86400000);
};

export const lineTaxable = (line: Line): number => num(line.qty) * num(line.rate);
export const lineTax = (line: Line): number => (lineTaxable(line) * num(line.gst)) / 100;

export const linesOf = (row: Record<string, unknown>): Line[] =>
  Array.isArray(row.lines) ? (row.lines as Line[]) : [];

export interface Totals {
  taxable: number;
  tax: number;
  total: number;
}

/** Bill totals: taxable value + GST, less discount, plus freight where present. */
export const totalsOf = (row: Record<string, unknown>): Totals => {
  const lines = linesOf(row);
  const taxable = lines.reduce((sum, line) => sum + lineTaxable(line), 0);
  const tax = lines.reduce((sum, line) => sum + lineTax(line), 0);
  // The tiny nudge stops a total such as 266.4999999 (really 266.50) rounding the wrong way.
  const total = Math.round(taxable + tax - num(row.discount) + num(row.freight) + 1e-6);
  return { taxable, tax, total };
};

export const sum = (rows: Row[], pick: (row: Row) => number): number =>
  rows.reduce((total, row) => total + pick(row), 0);

/**
 * Next running number in one series, e.g. INV-0185 after INV-0184.
 * Only numbers that start with the same prefix are counted, so the fertilizer,
 * pesticide and seed series (F-, P-, S-) each run on their own.
 */
export const nextNumber = (rows: Row[], key: string, prefix: string): string => {
  const highest = rows.reduce((max, row) => {
    const value = text(row[key]);
    if (!value.startsWith(`${prefix}-`)) return max;
    const match = value.slice(prefix.length + 1).match(/^(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
};

export const uid = (): string =>
  `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Rows that still count. A cancelled bill stays on the list but out of every total. */
export const live = (rows: Row[]): Row[] => rows.filter((row) => row.status !== "Cancelled");

/** What is still unpaid on a bill. Cancelled bills owe nothing. */
export const dueOf = (row: Row): number =>
  row.status === "Cancelled" ? 0 : Math.max(0, totalsOf(row).total - num(row.paid));

export const stamp = (): string => new Date().toISOString();

/** "2026-11-12T09:14:00Z" → "12 Nov 2026, 2:44 pm" in the viewer's own time zone. */
export const stampText = (iso: unknown): string => {
  const when = new Date(text(iso));
  if (Number.isNaN(when.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = when.getHours();
  return `${pad(when.getDate())} ${MONTHS[when.getMonth()]} ${when.getFullYear()}, ${hours % 12 || 12}:${pad(when.getMinutes())} ${hours < 12 ? "am" : "pm"}`;
};

export const monthLabel = (iso: string): string => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const below100 = (n: number): string => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const below1000 = (n: number): string =>
  n < 100 ? below100(n) : `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${below100(n % 100)}` : ""}`;

/** 152430 → "Rupees one lakh fifty two thousand four hundred and thirty only" (Indian units). */
export const inWords = (value: unknown): string => {
  let rest = Math.round(Math.abs(num(value)));
  if (rest === 0) return "Rupees zero only";
  const parts: string[] = [];
  const take = (size: number, label: string) => {
    const count = Math.floor(rest / size);
    if (count) parts.push(`${below1000(count)} ${label}`.trim());
    rest %= size;
  };
  take(10000000, "crore");
  take(100000, "lakh");
  take(1000, "thousand");
  if (rest) parts.push(below1000(rest));
  return `Rupees ${parts.join(" ")} only`;
};

/** Aadhaar is shown with only its last four digits: XXXX XXXX 1234. */
export const maskAadhaar = (value: unknown): string => {
  const digits = text(value).replace(/\D/g, "");
  return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : "";
};

/** Crop season a date falls in: Kharif June to October, Rabi November to March, Summer April and May. */
export const seasonOf = (iso: string): string => {
  const [y, m] = iso.split("-").map(Number);
  if (m >= 6 && m <= 10) return `Kharif ${y}`;
  if (m >= 11) return `Rabi ${y}-${String(y + 1).slice(2)}`;
  if (m <= 3) return `Rabi ${y - 1}-${String(y).slice(2)}`;
  return `Summer ${y}`;
};
