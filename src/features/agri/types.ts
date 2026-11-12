import type { LucideIcon } from "lucide-react";

/** One saved record in any module. Every record has an `id`; the rest is free-form. */
export type Row = Record<string, unknown> & { id: string };

/** A product line inside an order, bill, invoice or return. */
export interface Line {
  product: string;
  batch: string;
  qty: number;
  rate: number;
  gst: number;
  /** Expiry date, captured when stock is received or typed on the sale bill. */
  expiry?: string;
  /** Extra details typed on the sale bill. All optional. */
  cases?: number;
  lot?: string;
  mfg?: string;
  company?: string;
  unit?: string;
}

export type FieldType =
  | "text"
  | "number"
  | "money"
  | "percent"
  | "date"
  | "phone"
  | "select"
  | "segment"
  | "textarea"
  | "toggle"
  /** A photo, shrunk in the browser and saved with the record. */
  | "image"
  | "lines";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  /** Fixed choices for `select` and `segment`. */
  options?: string[];
  /** Fill the choices from another module's records, e.g. supplier names. */
  optionsFrom?: { module: string; key: string };
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Short unit shown inside the input, e.g. "kg" or "days". */
  unit?: string;
  /** How many of the 6 grid columns the field takes. Default 2 (a third). */
  span?: 2 | 3 | 4 | 6;
  /** Show the field only when this returns true for the current form values. */
  showIf?: (values: Record<string, unknown>) => boolean;
  initial?: unknown;
  /** `lines` only: "buy" prices lines at purchase price, "sell" at selling price. */
  priceFrom?: "buy" | "sell";
  /** `lines` only: also ask for each line's expiry date (goods receipt). */
  withExpiry?: boolean;
}

export interface Section {
  title: string;
  description?: string;
  fields: Field[];
  showIf?: (values: Record<string, unknown>) => boolean;
}

export type ColumnKind =
  | "text"
  | "strong"
  | "id"
  | "money"
  | "number"
  | "date"
  | "status"
  | "product"
  | "expiry"
  | "linesTotal"
  /** Bill total minus what has been paid. */
  | "due";

export interface Column {
  key: string;
  label: string;
  kind?: ColumnKind;
  /** A second, quieter line shown under the main value. */
  subKey?: string;
}

export interface Stat {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "warn" | "bad" | "plain";
}

export type Store = Record<string, Row[]>;

export interface ModuleDef {
  id: string;
  title: string;
  /** Used on buttons: "New supplier", "Save supplier". */
  singular: string;
  description: string;
  icon: LucideIcon;
  /**
   * records – a list with an add/edit form
   * form    – one settings form (shop profile)
   * custom  – a hand-built screen (dashboard, billing, stock, reports…)
   */
  kind: "records" | "form" | "custom";
  /** Prefix for generated numbers, e.g. "PO" gives PO-0007. */
  idPrefix?: string;
  /** The field that receives the generated number. */
  numberKey?: string;
  columns?: Column[];
  sections?: Section[];
  /** Quick filter tabs above the table, built from one field's values. */
  tabs?: { key: string; values: string[] };
  stats?: (rows: Row[], store: Store) => Stat[];
  seed?: Row[];
  /** Fields searched by the search box. Defaults to all text columns. */
  searchKeys?: string[];
}

export interface NavGroup {
  label: string;
  modules: string[];
}
