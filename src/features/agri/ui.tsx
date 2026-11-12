import { EllipsisVertical, FlaskConical, Plus, Sprout, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { date, daysUntil, dueOf, lineTaxable, lineTax, money, num, text, totalsOf } from "./format";
import { GST_RATES } from "./modules";
import type { Column, Field, Line, Row, Stat, Store } from "./types";

/* ------------------------------------------------------------------ */
/* Status pill                                                         */
/* ------------------------------------------------------------------ */

const GOOD = ["Paid", "Active", "Received", "Checked", "Refunded", "Adjusted", "Credit received", "On file", "In stock", "Not needed", "Converted"];
const WARN = ["Partial", "Pending", "Pending check", "Sent", "Partly received", "Applied", "Sent to supplier", "Low", "Credit", "Draft", "Open"];
const BAD = ["Unpaid", "Shortage reported", "Damage reported", "Blocked", "Stopped", "Disabled", "Missing", "Expired", "Cancelled", "Out of stock"];

export const toneOf = (value: string): "good" | "warn" | "bad" | "plain" =>
  GOOD.includes(value) ? "good" : WARN.includes(value) ? "warn" : BAD.includes(value) ? "bad" : "plain";

export function Pill({ value, tone }: { value: string; tone?: "good" | "warn" | "bad" | "plain" }) {
  if (!value) return <span className="ag-dim">—</span>;
  return <span className={`ag-pill ag-pill-${tone ?? toneOf(value)}`}>{value}</span>;
}

/* ------------------------------------------------------------------ */
/* Product mark: the nutrient bars or the toxicity diamond             */
/* ------------------------------------------------------------------ */

/** "18:46:0" → [18, 46, 0]. Returns null when there is no grade. */
export const parseNpk = (value: unknown): [number, number, number] | null => {
  const parts = text(value).split(":").map((part) => parseFloat(part));
  return parts.length === 3 && parts.every((part) => Number.isFinite(part))
    ? [parts[0], parts[1], parts[2]]
    : null;
};

const toxClass = (value: unknown): string => text(value).split(" ")[0].toLowerCase() || "none";

export function ProductMark({ product }: { product: Record<string, unknown> | undefined }) {
  if (!product) return <span className="ag-mark ag-mark-other" aria-hidden="true" />;
  if (product.category === "Fertilizer") {
    const grade = parseNpk(product.npk);
    // Micronutrients and bio-fertilizers carry no N:P:K grade, so they get a plain flask.
    if (!grade) {
      return (
        <span className="ag-mark ag-mark-plain" title="Fertilizer without an N:P:K grade">
          <FlaskConical size={17} />
        </span>
      );
    }
    return (
      <span className="ag-mark ag-mark-npk" title={`N ${grade[0]}  P ${grade[1]}  K ${grade[2]}`}>
        {grade.map((value, index) => (
          <i key={index} className={`ag-npk-${index}`} style={{ height: `${Math.max(8, Math.min(100, (value / 46) * 100))}%` }} />
        ))}
      </span>
    );
  }
  if (product.category === "Pesticide") {
    return (
      <span className="ag-mark ag-mark-tox" title={text(product.toxicity) || "Pesticide"}>
        <i className={`ag-tox ag-tox-${toxClass(product.toxicity)}`} />
      </span>
    );
  }
  if (product.category === "Seed") {
    return (
      <span className="ag-mark ag-mark-seed" title="Seed">
        <Sprout size={18} />
      </span>
    );
  }
  return <span className="ag-mark ag-mark-other" aria-hidden="true" />;
}

/** One quiet line that says what the product is, built from its own fields. */
export const productSubline = (product: Record<string, unknown>): string => {
  const bits: string[] = [];
  if (product.brand) bits.push(text(product.brand));
  if (product.category === "Fertilizer") bits.push(product.npk ? `grade ${text(product.npk)}` : text(product.fertType).toLowerCase());
  if (product.category === "Pesticide") bits.push(`${text(product.pestType).toLowerCase()} ${text(product.strength)} ${text(product.formulation).split(" ")[0]}`.trim());
  if (product.category === "Seed") bits.push(`${text(product.crop).toLowerCase()} ${text(product.seedClass).toLowerCase()}`.trim());
  return bits.filter(Boolean).join(", ");
};

/* ------------------------------------------------------------------ */
/* Stats strip, empty state                                            */
/* ------------------------------------------------------------------ */

export function Stats({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <dl className="ag-stats">
      {stats.map((stat) => (
        <div key={stat.label} className={`ag-stat ag-stat-${stat.tone ?? "plain"}`}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
          {stat.note && <small>{stat.note}</small>}
        </div>
      ))}
    </dl>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ag-empty">
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table cells                                                         */
/* ------------------------------------------------------------------ */

export function ExpiryCell({ value }: { value: unknown }) {
  if (!value) return <span className="ag-dim">No expiry</span>;
  const days = daysUntil(value);
  const tone = days < 0 ? "bad" : days <= 60 ? "warn" : "good";
  const label = days < 0 ? `Expired ${-days} days ago` : days === 0 ? "Expires today" : days <= 60 ? `${days} days left` : "Valid";
  return (
    <span className="ag-two">
      <span>{date(value)}</span>
      <small className={`ag-tone-${tone}`}>{label}</small>
    </span>
  );
}

export function Cell({ column, row, store }: { column: Column; row: Row; store: Store }) {
  const value = row[column.key];
  const sub = column.subKey ? row[column.subKey] : undefined;
  const subText = column.subKey === "mrp" ? `MRP ${money(sub)}` : text(sub);
  let main: ReactNode;

  switch (column.kind) {
    case "money":
      main = <span className="ag-num">{money(value)}</span>;
      break;
    case "number":
      main = <span className="ag-num">{text(value) === "" ? "—" : num(value).toLocaleString("en-IN")}</span>;
      break;
    case "date":
      main = value ? date(value) : <span className="ag-dim">—</span>;
      break;
    case "status":
      return <Pill value={text(value)} />;
    case "expiry":
      return <ExpiryCell value={value} />;
    case "linesTotal": {
      const lines = Array.isArray(value) ? (value as Line[]) : [];
      const total = totalsOf(row).total;
      return (
        <span className="ag-two">
          <span className="ag-num ag-strong">{money(total)}</span>
          <small>{lines.length === 1 ? "1 item" : `${lines.length} items`}</small>
        </span>
      );
    }
    case "due": {
      const left = dueOf(row);
      if (row.status === "Cancelled") return <span className="ag-dim">—</span>;
      return left > 0 ? <span className="ag-num ag-strong ag-tone-bad">{money(left)}</span> : <span className="ag-num ag-tone-good">Nil</span>;
    }
    case "product": {
      const low = num(row.stock) <= num(row.reorder);
      return (
        <span className="ag-product">
          <ProductMark product={row} />
          <span className="ag-two">
            <span className="ag-strong">
              {text(value)}
              {Boolean(row.restricted) && <em className="ag-flag">Restricted</em>}
              {low && <em className="ag-flag ag-flag-warn">{num(row.stock) === 0 ? "Out of stock" : "Low stock"}</em>}
            </span>
            <small>{productSubline(row)}</small>
          </span>
        </span>
      );
    }
    case "id":
      main = <span className="ag-id">{text(value) || "—"}</span>;
      break;
    case "strong":
      main = <span className="ag-strong">{text(value) || "—"}</span>;
      break;
    default:
      main = text(value) || <span className="ag-dim">—</span>;
  }

  void store;
  if (!column.subKey || !subText) return <>{main}</>;
  return (
    <span className="ag-two">
      <span>{main}</span>
      <small>{subText}</small>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

export function Drawer({
  title,
  subtitle,
  wide,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ag-drawer-layer">
      <button className="ag-scrim" aria-label="Close" onClick={onClose} />
      <section className={`ag-drawer ${wide ? "ag-drawer-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="ag-drawer-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="ag-icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="ag-drawer-body">{children}</div>
        <footer className="ag-drawer-foot">{footer}</footer>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Line items editor                                                   */
/* ------------------------------------------------------------------ */

export const emptyLine = (): Line => ({ product: "", batch: "", qty: 1, rate: 0, gst: 0 });

/** Earliest-expiring batch that is not already expired: first expiry, first out. */
export const pickBatch = (store: Store, product: string): Row | undefined =>
  (store.batches ?? [])
    .filter((batch) => batch.product === product && num(batch.qty) > 0 && daysUntil(batch.expiryDate) >= 0)
    .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))[0];

/** Price for a new line. Selling prices include GST, so the rate is worked back from them. */
export const priceLine = (store: Store, product: string, priceFrom: "buy" | "sell"): Line => {
  const found = (store.products ?? []).find((row) => row.name === product);
  const gst = num(found?.gst);
  const rate =
    priceFrom === "sell"
      ? Math.round((num(found?.sellPrice) / (1 + gst / 100)) * 10000) / 10000
      : num(found?.purchasePrice);
  return {
    product,
    batch: priceFrom === "sell" ? text(pickBatch(store, product)?.batchNo) : "",
    qty: 1,
    rate,
    gst,
  };
};

export function LinesEditor({
  lines,
  onChange,
  store,
  priceFrom,
  withExpiry,
  error,
}: {
  lines: Line[];
  onChange: (lines: Line[]) => void;
  store: Store;
  priceFrom: "buy" | "sell";
  withExpiry?: boolean;
  error?: string;
}) {
  const listId = useId();
  const products = store.products ?? [];
  const patch = (index: number, change: Partial<Line>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...change } : line)));

  const taxable = lines.reduce((s, l) => s + lineTaxable(l), 0);
  const tax = lines.reduce((s, l) => s + lineTax(l), 0);

  return (
    <div className={`ag-lines ${error ? "ag-lines-error" : ""}`}>
      <div className="ag-lines-scroll">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch</th>
              {withExpiry && <th>Expiry</th>}
              <th className="ag-r">Qty</th>
              <th className="ag-r">Rate before GST</th>
              <th className="ag-r">GST %</th>
              <th className="ag-r">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const batches = (store.batches ?? []).filter((b) => b.product === line.product);
              return (
                <tr key={index}>
                  <td className="ag-lines-product">
                    <select
                      aria-label="Product"
                      value={line.product}
                      onChange={(event) => patch(index, { ...priceLine(store, event.target.value, priceFrom), qty: line.qty })}
                    >
                      <option value="">Choose a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={text(product.name)}>
                          {text(product.name)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label="Batch"
                      list={`${listId}-${index}`}
                      value={line.batch}
                      placeholder="Batch no."
                      onChange={(event) => patch(index, { batch: event.target.value })}
                    />
                    <datalist id={`${listId}-${index}`}>
                      {batches.map((batch) => (
                        <option key={batch.id} value={text(batch.batchNo)} />
                      ))}
                    </datalist>
                  </td>
                  {withExpiry && (
                    <td>
                      <input aria-label="Expiry" type="date" value={line.expiry ?? ""} onChange={(event) => patch(index, { expiry: event.target.value })} />
                    </td>
                  )}
                  <td>
                    <input aria-label="Quantity" className="ag-r ag-w-qty" type="number" min="0" value={line.qty} onChange={(event) => patch(index, { qty: num(event.target.value) })} />
                  </td>
                  <td>
                    <input aria-label="Rate" className="ag-r ag-w-rate" type="number" min="0" step="0.01" value={Math.round(num(line.rate) * 100) / 100} onChange={(event) => patch(index, { rate: num(event.target.value) })} />
                  </td>
                  <td>
                    <select aria-label="GST rate" className="ag-r" value={String(line.gst)} onChange={(event) => patch(index, { gst: num(event.target.value) })}>
                      {GST_RATES.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="ag-r ag-num ag-strong">{money(Math.round((lineTaxable(line) + lineTax(line)) * 100) / 100)}</td>
                  <td>
                    <button type="button" className="ag-icon-btn ag-icon-btn-quiet" aria-label="Remove item" onClick={() => onChange(lines.filter((_, i) => i !== index))}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={withExpiry ? 8 : 7} className="ag-lines-empty">
                  No items yet. Add the first one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="ag-lines-foot">
        <button type="button" className="ag-btn ag-btn-soft" onClick={() => onChange([...lines, emptyLine()])}>
          <Plus size={16} /> Add item
        </button>
        <dl>
          <div>
            <dt>Taxable value</dt>
            <dd>{money(Math.round(taxable * 100) / 100)}</dd>
          </div>
          <div>
            <dt>GST</dt>
            <dd>{money(Math.round(tax * 100) / 100)}</dd>
          </div>
          <div className="ag-lines-total">
            <dt>Items total</dt>
            <dd>{money(Math.round(taxable + tax))}</dd>
          </div>
        </dl>
      </div>
      {error && <p className="ag-field-error">{error}</p>}
    </div>
  );
}

/**
 * Shrinks a chosen photo before it is saved. Photos are kept with the record in
 * the browser, where space is small, so a phone photo of several MB becomes a
 * JPEG of a few tens of KB.
 */
export const shrinkImage = (file: File, maxSide: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("decode"));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

/* ------------------------------------------------------------------ */
/* One form field                                                      */
/* ------------------------------------------------------------------ */

export function FieldControl({
  field,
  value,
  onChange,
  store,
  error,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  store: Store;
  error?: string;
}) {
  const id = useId();
  const options =
    field.options ??
    (field.optionsFrom
      ? [...new Set((store[field.optionsFrom.module] ?? []).map((row) => text(row[field.optionsFrom!.key])).filter(Boolean))]
      : []);
  const span = `ag-span-${field.span ?? 2}`;

  if (field.type === "lines") {
    return (
      <div className={`ag-field ${span}`}>
        <LinesEditor
          lines={Array.isArray(value) ? (value as Line[]) : []}
          onChange={onChange}
          store={store}
          priceFrom={field.priceFrom ?? "sell"}
          withExpiry={field.withExpiry}
          error={error}
        />
      </div>
    );
  }

  if (field.type === "image") {
    return (
      <div className={`ag-field ${span}`}>
        <label htmlFor={id}>{field.label}</label>
        <div className="ag-photo">
          {text(value) ? <img src={text(value)} alt={field.label} /> : <span className="ag-photo-none">No photo</span>}
          <div>
            <label className="ag-btn ag-btn-soft" htmlFor={id}>
              {text(value) ? "Change photo" : "Choose photo"}
            </label>
            <input
              id={id}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) shrinkImage(file, field.key.toLowerCase().includes("aadhaar") ? 900 : 420).then(onChange).catch(() => undefined);
                event.target.value = "";
              }}
            />
            {text(value) && (
              <button type="button" className="ag-btn ag-btn-ghost-danger" onClick={() => onChange("")}>
                Remove
              </button>
            )}
          </div>
        </div>
        {field.hint && <small className="ag-hint">{field.hint}</small>}
      </div>
    );
  }

  if (field.type === "toggle") {
    return (
      <label className={`ag-toggle ${span}`} htmlFor={id}>
        <span>
          <b>{field.label}</b>
          {field.hint && <small>{field.hint}</small>}
        </span>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <i aria-hidden="true" />
      </label>
    );
  }

  if (field.type === "segment") {
    return (
      <fieldset className={`ag-field ${span}`}>
        <legend>
          {field.label}
          {field.required && <span className="ag-req"> *</span>}
        </legend>
        <div className="ag-segment">
          {options.map((option) => (
            <label key={option} className={text(value) === option ? "ag-on" : ""}>
              <input type="radio" name={id} value={option} checked={text(value) === option} onChange={() => onChange(option)} />
              {option}
              {field.unit ?? ""}
            </label>
          ))}
        </div>
        {field.hint && <small className="ag-hint">{field.hint}</small>}
      </fieldset>
    );
  }

  const prefix = field.type === "money" ? "₹" : undefined;
  const suffix = field.type === "percent" ? "%" : field.unit;
  const numeric = field.type === "number" || field.type === "money" || field.type === "percent";

  return (
    <div className={`ag-field ${span} ${error ? "ag-field-bad" : ""}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="ag-req"> *</span>}
      </label>
      {field.type === "select" ? (
        <select id={id} value={text(value)} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose…</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {text(value) && !options.includes(text(value)) && <option value={text(value)}>{text(value)}</option>}
        </select>
      ) : field.type === "textarea" ? (
        <textarea id={id} rows={3} value={text(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <div className={`ag-input ${prefix ? "ag-has-prefix" : ""} ${suffix ? "ag-has-suffix" : ""}`}>
          {prefix && <span className="ag-affix">{prefix}</span>}
          <input
            id={id}
            type={field.type === "date" ? "date" : numeric ? "number" : field.type === "phone" ? "tel" : "text"}
            inputMode={numeric ? "decimal" : undefined}
            step={field.type === "money" ? "0.01" : undefined}
            min={numeric ? "0" : undefined}
            value={text(value)}
            placeholder={field.placeholder}
            onChange={(event) => onChange(numeric ? (event.target.value === "" ? "" : num(event.target.value)) : event.target.value)}
          />
          {suffix && <span className="ag-affix ag-affix-end">{suffix}</span>}
        </div>
      )}
      {error ? <small className="ag-field-error">{error}</small> : field.hint && <small className="ag-hint">{field.hint}</small>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plain-text value of a cell, used when a list is printed             */
/* ------------------------------------------------------------------ */

export const cellText = (column: Column, row: Row): string => {
  const value = row[column.key];
  switch (column.kind) {
    case "money":
      return money(value);
    case "date":
      return value ? date(value) : "";
    case "expiry":
      return value ? date(value) : "No expiry";
    case "linesTotal":
      return money(totalsOf(row).total);
    case "due":
      return row.status === "Cancelled" ? "" : money(dueOf(row));
    default:
      return text(value);
  }
};

/* ------------------------------------------------------------------ */
/* Row action menu (the three-dot button at the end of a row)          */
/* ------------------------------------------------------------------ */

export interface Action {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  /** Draws a line above this action, to separate groups. */
  divider?: boolean;
}

export function RowMenu({ actions, label }: { actions: Action[]; label: string }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [at]);

  const open = () => {
    const box = button.current?.getBoundingClientRect();
    if (!box) return;
    // The menu is drawn on top of the page, so a table's scroll area never clips it.
    const height = actions.length * 38 + 16;
    const top = box.bottom + height > window.innerHeight ? Math.max(8, box.top - height) : box.bottom + 4;
    setAt({ top, left: Math.max(8, box.right - 232) });
  };

  return (
    <>
      <button
        ref={button}
        className="ag-icon-btn ag-icon-btn-quiet"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(at)}
        onClick={(event) => {
          event.stopPropagation();
          if (at) setAt(null);
          else open();
        }}
      >
        <EllipsisVertical size={17} />
      </button>
      {at &&
        createPortal(
          <div className="ag-menu-layer" onClick={(event) => { event.stopPropagation(); setAt(null); }}>
            <ul className="ag-menu" role="menu" style={{ top: at.top, left: at.left }}>
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <li key={action.label} className={action.divider ? "ag-menu-divider" : ""} role="none">
                    <button
                      role="menuitem"
                      className={action.danger ? "ag-menu-danger" : ""}
                      onClick={(event) => {
                        event.stopPropagation();
                        setAt(null);
                        action.onSelect();
                      }}
                    >
                      {Icon && <Icon size={16} />}
                      {action.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Small centred dialog: confirmations and history                     */
/* ------------------------------------------------------------------ */

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="ag-modal-layer">
      <button className="ag-scrim" aria-label="Close" onClick={onClose} />
      <section className="ag-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <button className="ag-icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="ag-modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
