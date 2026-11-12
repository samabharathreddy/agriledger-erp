import { Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { date, inWords, lineTax, lineTaxable, linesOf, maskAadhaar, money, num, text, todayIso, totalsOf } from "./format";
import type { Column, Line, ModuleDef, Row, Store } from "./types";
import { cellText } from "./ui";

/**
 * Everything that can be printed is described as one PrintDoc. The same sheet
 * then draws a tax invoice, a challan, a voucher, a statement or a plain list.
 */
export interface PrintDoc {
  title: string;
  number?: string;
  date?: string;
  partyLabel?: string;
  partyName?: string;
  partyLines?: string[];
  /** Small label and value pairs under the title, e.g. "Paid by: UPI". */
  meta?: [string, string][];
  lines?: Line[];
  /** Delivery challans list goods only, with no rates or amounts. */
  hidePrices?: boolean;
  /** Rows between the items total and the grand total, e.g. discount or freight. */
  adjustments?: [string, number][];
  total?: number;
  paid?: number;
  /** For receipts and vouchers: one sentence, the amount, and a few facts. */
  voucher?: { sentence: string; amount: number; rows: [string, string][] };
  /** For statements and lists: a ready-made table. `right` lists right-aligned column numbers. */
  table?: { head: string[]; rows: string[][]; right: number[]; foot?: string[] };
  note?: string;
  /** Who signs at the bottom left. Left out for plain lists. */
  receiver?: string;
  /** "Original", "Duplicate" or "Triplicate", printed under the title. */
  copy?: string;
  /** Sale to another state: one IGST column instead of CGST and SGST. */
  igst?: boolean;
}

const shopOf = (store: Store): Row | undefined => (store.shop ?? [])[0];

const customerLines = (store: Store, name: unknown): string[] => {
  const party = (store.customers ?? []).find((row) => row.name === name);
  if (!party) return [];
  return [
    [party.village, party.mandal, party.district].map(text).filter(Boolean).join(", "),
    party.phone ? `Phone ${text(party.phone)}` : "",
    party.gstin ? `GSTIN ${text(party.gstin)}` : "",
  ].filter(Boolean);
};

const supplierLines = (store: Store, name: unknown): string[] => {
  const party = (store.suppliers ?? []).find((row) => row.name === name);
  if (!party) return [];
  return [
    [party.city, party.state].map(text).filter(Boolean).join(", "),
    party.phone ? `Phone ${text(party.phone)}` : "",
    party.gstin ? `GSTIN ${text(party.gstin)}` : "",
  ].filter(Boolean);
};

/** Builds the printable document for one record, or null when that module has no print. */
export const buildDoc = (moduleId: string, row: Row, store: Store, variant?: "challan"): PrintDoc | null => {
  const base = { number: text(row.no), date: text(row.date), lines: linesOf(row), total: totalsOf(row).total };
  const toCustomer = { partyLabel: "Billed to", partyName: text(row.customer), partyLines: customerLines(store, row.customer) };
  const toSupplier = { partyLabel: "Supplier", partyName: text(row.supplier), partyLines: supplierLines(store, row.supplier) };
  const discount: [string, number][] = num(row.discount) ? [["Discount", -num(row.discount)]] : [];

  switch (moduleId) {
    case "sales-invoices":
      if (variant === "challan") {
        return { ...base, ...toCustomer, title: "Delivery challan", partyLabel: "Deliver to", hidePrices: true, total: undefined, meta: [["Against invoice", text(row.no)]], receiver: "Received the above goods in good condition" };
      }
      return {
        ...base,
        ...toCustomer,
        // A counter sale can carry the buyer's own name and phone instead of "Walk-in customer".
        ...(row.billTo ? { partyName: text(row.billTo) } : {}),
        ...(row.billTo || row.phone ? { partyLines: [row.phone ? `Phone ${text(row.phone)}` : "", ...customerLines(store, row.customer)].filter(Boolean) } : {}),
        title: row.status === "Cancelled" ? "Tax invoice (cancelled)" : "Tax invoice",
        copy: text(row.copy),
        igst: Boolean(row.placeOfSupply) && row.placeOfSupply !== text(shopOf(store)?.state),
        meta: [["Sale type", text(row.saleType)], ["Paid by", text(row.payMode)], ["Place of supply", text(row.placeOfSupply)]],
        adjustments: discount,
        paid: num(row.paid),
        note: text(row.notes),
        receiver: "Customer's signature",
      };
    case "estimates":
      return { ...base, ...toCustomer, title: "Estimate", partyLabel: "Prepared for", meta: [["Valid till", date(row.validTill)]], adjustments: discount, note: text(row.notes) || "This is an estimate, not a tax invoice. Prices hold until the valid-till date.", receiver: "Customer's signature" };
    case "sales-returns":
      return { ...base, ...toCustomer, title: "Credit note", partyLabel: "Returned by", meta: [["Against invoice", text(row.invoiceNo)], ["Reason", text(row.reason)], ["Settled by", text(row.refundMode)]], receiver: "Customer's signature" };
    case "purchase-orders":
      return { ...base, ...toSupplier, title: "Purchase order", partyLabel: "To", meta: [["Expected delivery", date(row.expectedDate)]], note: text(row.terms), receiver: "Supplier's acceptance" };
    case "goods-receipts":
      return { ...base, ...toSupplier, title: "Goods receipt note", partyLabel: "Received from", meta: [["Purchase order", text(row.poNo)], ["Supplier invoice", text(row.supplierInvoiceNo)], ["Vehicle", text(row.vehicleNo)], ["Received by", text(row.receivedBy)]], note: text(row.notes), receiver: "Driver's signature" };
    case "purchase-bills":
      return { ...base, ...toSupplier, title: "Purchase bill", meta: [["Supplier bill number", text(row.billNo)], ["Pay by", date(row.dueDate)]], adjustments: num(row.freight) ? [["Freight and other charges", num(row.freight)]] : [], paid: num(row.paid) };
    case "purchase-returns":
      return { ...base, ...toSupplier, title: "Debit note", partyLabel: "Returned to", number: text(row.debitNoteNo) || text(row.no), meta: [["Against bill", text(row.billNo)], ["Reason", text(row.reason)]], receiver: "Supplier's signature" };
    case "receipts":
      return {
        title: "Payment receipt",
        number: text(row.no),
        date: text(row.date),
        partyLabel: "Received from",
        partyName: text(row.customer),
        partyLines: customerLines(store, row.customer),
        voucher: { sentence: `Received with thanks from ${text(row.customer)}`, amount: num(row.amount), rows: [["Mode", text(row.mode)], ["Reference", text(row.reference)], ["Against invoice", text(row.againstInvoice) || "Advance"]] },
        note: text(row.notes),
        receiver: "Payer's signature",
      };
    case "supplier-payments":
      return {
        title: "Payment voucher",
        number: text(row.no),
        date: text(row.date),
        partyLabel: "Paid to",
        partyName: text(row.supplier),
        partyLines: supplierLines(store, row.supplier),
        voucher: { sentence: `Paid to ${text(row.supplier)}`, amount: num(row.amount), rows: [["Mode", text(row.mode)], ["Reference", text(row.reference)], ["Against bill", text(row.againstBill) || "Advance"]] },
        note: text(row.notes),
        receiver: "Receiver's signature",
      };
    case "cash-advances":
      return {
        title: "Cash advance voucher",
        number: text(row.no),
        date: text(row.date),
        partyLabel: "Given to",
        partyName: text(row.customer),
        partyLines: customerLines(store, row.customer),
        voucher: { sentence: `Cash lent to ${text(row.customer)}, added to the amount due`, amount: num(row.amount), rows: [["Mode", text(row.mode)], ["Reason", text(row.reason)], ["To be returned by", row.returnBy ? date(row.returnBy) : ""]] },
        note: text(row.notes),
        receiver: "Receiver's signature",
      };
    case "settlements":
      return {
        title: "Season settlement",
        number: text(row.no),
        date: text(row.date),
        partyLabel: "Account of",
        partyName: text(row.customer),
        partyLines: customerLines(store, row.customer),
        meta: [["Season", text(row.season)], ["Paid by", text(row.mode)]],
        table: {
          head: ["Particulars", "Amount"],
          rows: [
            ["Amount due before settlement", money(row.dueBefore)],
            ...(num(row.interest) ? [["Add: interest for late payment", money(row.interest)]] : []),
            ["Less: amount received now", money(row.received)],
            ...(num(row.discount) ? [["Less: discount allowed", money(row.discount)]] : []),
            ...(num(row.writtenOff) ? [["Less: written off", money(row.writtenOff)]] : []),
          ],
          right: [1],
          foot: [num(row.carried) > 0 ? "Balance carried forward to next season" : "Balance", money(row.carried)],
        },
        note: [num(row.carried) > 0 && row.promiseDate ? `The customer has agreed to pay the balance by ${date(row.promiseDate)}.` : "", text(row.notes)].filter(Boolean).join(" "),
        receiver: "Customer's signature",
      };
    case "expenses":
      return {
        title: "Expense voucher",
        number: text(row.no),
        date: text(row.date),
        partyLabel: "Paid to",
        partyName: text(row.paidTo) || "—",
        voucher: { sentence: `Paid towards ${text(row.category).toLowerCase()}`, amount: num(row.amount), rows: [["Mode", text(row.mode)], ["Bill or voucher number", text(row.billNo)]] },
        note: text(row.notes),
        receiver: "Receiver's signature",
      };
    default:
      return null;
  }
};

/**
 * A plain "details" page for any record that has no document of its own
 * (a customer, a product, a licence…): every filled field, label beside value.
 * Photos are left out and Aadhaar is masked.
 */
export const detailDoc = (module: ModuleDef, row: Row): PrintDoc => {
  const rows: string[][] = [];
  (module.sections ?? []).forEach((section) =>
    section.fields.forEach((field) => {
      if (field.type === "image" || field.type === "lines") return;
      const value = row[field.key];
      if (value === undefined || value === "" || value === null) return;
      const shown =
        field.key === "aadhaarNo" ? maskAadhaar(value)
        : field.type === "money" ? money(value)
        : field.type === "date" ? date(value)
        : field.type === "toggle" ? (value ? "Yes" : "No")
        : `${text(value)}${field.type === "percent" ? "%" : field.unit ? ` ${field.unit}` : ""}`;
      rows.push([field.label, shown]);
    }),
  );
  const nameKey = module.numberKey ?? (module.columns ?? [])[0]?.key ?? "id";
  return { title: `${module.singular.charAt(0).toUpperCase()}${module.singular.slice(1)} details`, number: text(row[nameKey]), date: todayIso(), table: { head: ["Field", "Details"], rows, right: [] } };
};

/** A printable copy of whatever list is on screen, with the same columns. */
export const listDoc = (module: ModuleDef, rows: Row[], subtitle?: string): PrintDoc => {
  const columns: Column[] = module.columns ?? [];
  return {
    title: module.title,
    date: todayIso(),
    meta: subtitle ? [["Showing", subtitle]] : [],
    table: {
      head: columns.map((column) => column.label),
      rows: rows.map((row) => columns.map((column) => cellText(column, row))),
      right: columns.map((column, index) => (["money", "number", "linesTotal", "due"].includes(column.kind ?? "") ? index : -1)).filter((index) => index >= 0),
    },
    note: `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`,
  };
};

export interface StatementEntry {
  date: string;
  what: string;
  added: number;
  settled: number;
}

/** Entries for one customer or supplier, oldest first. */
export const statementEntries = (store: Store, side: "customer" | "supplier", name: string): StatementEntry[] => {
  const entries: StatementEntry[] =
    side === "customer"
      ? [
          ...(store["sales-invoices"] ?? []).filter((r) => r.customer === name && r.status !== "Cancelled").map((r) => ({ date: text(r.date), what: `Invoice ${text(r.no)}`, added: totalsOf(r).total, settled: 0 })),
          ...(store.receipts ?? []).filter((r) => r.customer === name).map((r) => ({ date: text(r.date), what: `Receipt ${text(r.no)}, ${text(r.mode)}`, added: 0, settled: num(r.amount) })),
          ...(store["sales-returns"] ?? []).filter((r) => r.customer === name && r.refundMode === "Adjust in ledger").map((r) => ({ date: text(r.date), what: `Return ${text(r.no)}`, added: 0, settled: totalsOf(r).total })),
          ...(store["cash-advances"] ?? []).filter((r) => r.customer === name).map((r) => ({ date: text(r.date), what: `Cash lent ${text(r.no)}${r.reason ? `, ${text(r.reason).toLowerCase()}` : ""}`, added: num(r.amount), settled: 0 })),
          // A settlement's cash is already listed as its receipt; only interest, discount and write-off are extra.
          ...(store.settlements ?? []).filter((r) => r.customer === name && num(r.interest) > 0).map((r) => ({ date: text(r.date), what: `Interest, settlement ${text(r.no)}`, added: num(r.interest), settled: 0 })),
          ...(store.settlements ?? []).filter((r) => r.customer === name && num(r.discount) + num(r.writtenOff) > 0).map((r) => ({ date: text(r.date), what: `${num(r.writtenOff) > 0 ? "Written off" : "Discount"}, settlement ${text(r.no)}`, added: 0, settled: num(r.discount) + num(r.writtenOff) })),
        ]
      : [
          ...(store["purchase-bills"] ?? []).filter((r) => r.supplier === name).map((r) => ({ date: text(r.date), what: `Bill ${text(r.billNo)}`, added: totalsOf(r).total, settled: 0 })),
          ...(store["supplier-payments"] ?? []).filter((r) => r.supplier === name).map((r) => ({ date: text(r.date), what: `Payment ${text(r.no)}, ${text(r.mode)}`, added: 0, settled: num(r.amount) })),
          ...(store["purchase-returns"] ?? []).filter((r) => r.supplier === name).map((r) => ({ date: text(r.date), what: `Return ${text(r.no)}`, added: 0, settled: totalsOf(r).total })),
        ];
  // Same-day entries keep bills ahead of the money that settles them.
  return entries.sort((a, b) => (a.date === b.date ? b.added - a.added : a.date < b.date ? -1 : 1));
};

export const statementDoc = (store: Store, side: "customer" | "supplier", name: string): PrintDoc => {
  const entries = statementEntries(store, side, name);
  const party = (store[side === "customer" ? "customers" : "suppliers"] ?? []).find((row) => row.name === name);
  const added = entries.reduce((s, e) => s + e.added, 0);
  const settled = entries.reduce((s, e) => s + e.settled, 0);
  return {
    title: side === "customer" ? "Customer statement" : "Supplier statement",
    date: todayIso(),
    partyLabel: "Account of",
    partyName: name,
    partyLines: side === "customer" ? customerLines(store, name) : supplierLines(store, name),
    table: {
      head: ["Date", "Entry", side === "customer" ? "Billed" : "Bill amount", side === "customer" ? "Received or returned" : "Paid or returned"],
      rows: entries.map((e) => [date(e.date), e.what, e.added ? money(e.added) : "", e.settled ? money(e.settled) : ""]),
      right: [2, 3],
      foot: ["", "Total", money(added), money(settled)],
    },
    total: num(party?.balance),
    note: "The balance includes any opening balance entered with the account.",
  };
};

/* ------------------------------------------------------------------ */
/* The sheet                                                           */
/* ------------------------------------------------------------------ */

const SIZES = ["A4", "A5", "Thermal 3 inch"];

/** One printed page: an invoice, voucher, statement or list. */
function SheetPage({ doc, store, size }: { doc: PrintDoc; store: Store; size: string }) {
  const shop = shopOf(store);
  const licence = (word: string) => text((store.licences ?? []).find((row) => text(row.name).includes(word))?.number);
  const licences = [
    ["Fertilizer licence", licence("Fertilizer")],
    ["Insecticide licence", licence("Insecticide")],
    ["Seed licence", licence("Seed")],
  ].filter(([, value]) => value);

  const lines = doc.lines ?? [];
  const product = (name: string) => (store.products ?? []).find((row) => row.name === name);
  const expiryOf = (line: Line) =>
    line.expiry || text((store.batches ?? []).find((b) => b.product === line.product && b.batchNo === line.batch)?.expiryDate);
  const taxable = lines.reduce((s, l) => s + lineTaxable(l), 0);
  const tax = lines.reduce((s, l) => s + lineTax(l), 0);
  const slabs = [...new Set(lines.map((l) => num(l.gst)))].sort((a, b) => a - b).map((rate) => {
    const of = lines.filter((l) => num(l.gst) === rate);
    return { rate, taxable: of.reduce((s, l) => s + lineTaxable(l), 0), tax: of.reduce((s, l) => s + lineTax(l), 0) };
  });
  const two = (value: number) => money(Math.round(value * 100) / 100);
  const balance = doc.total !== undefined && doc.paid !== undefined ? Math.max(0, doc.total - doc.paid) : undefined;
  const isBill = lines.length > 0 && !doc.hidePrices;

  return (
    <article className={`ag-sheet ag-sheet-${size.split(" ")[0].toLowerCase()}`}>
      <header className="ag-sheet-head">
        <div>
          <h1>{text(shop?.shopName) || "Your shop"}</h1>
          <p>{[shop?.address, shop?.town, shop?.district, shop?.state, shop?.pin].map(text).filter(Boolean).join(", ")}</p>
          <p>
            {shop?.phone ? `Phone ${text(shop.phone)}` : ""}
            {shop?.gstin ? `   GSTIN ${text(shop.gstin)}` : ""}
          </p>
          {licences.length > 0 && <p className="ag-sheet-licences">{licences.map(([label, value]) => `${label} ${value}`).join("   ")}</p>}
        </div>
        <div className="ag-sheet-title">
          <h2>{doc.title}</h2>
          {doc.copy && <p>{doc.copy} copy</p>}
          {doc.number && <p><b>{doc.number}</b></p>}
          {doc.date && <p>{date(doc.date)}</p>}
        </div>
      </header>

      {(doc.partyName || (doc.meta ?? []).length > 0) && (
        <section className="ag-sheet-party">
          {doc.partyName && (
            <div>
              <small>{doc.partyLabel}</small>
              <b>{doc.partyName}</b>
              {(doc.partyLines ?? []).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
          <dl>
            {(doc.meta ?? []).filter(([, value]) => value && value !== "—").map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {lines.length > 0 && (
        <table className="ag-sheet-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Item</th>
              <th>HSN</th>
              <th className="ag-r">Qty</th>
              {!doc.hidePrices && (
                <>
                  <th className="ag-r">Rate</th>
                  <th className="ag-r">GST</th>
                  <th className="ag-r">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const found = product(line.product);
              const expiry = expiryOf(line);
              const details = [
                line.company && line.company !== found?.brand ? text(line.company) : "",
                line.cases ? `${num(line.cases)} cases` : "",
                shop?.showBatch !== false && line.batch ? `Batch ${line.batch}` : "",
                shop?.showBatch !== false && line.lot ? `Lot ${line.lot}` : "",
                shop?.showBatch !== false && line.mfg ? `Mfg ${date(line.mfg)}` : "",
                shop?.showBatch !== false && expiry ? `Exp ${date(expiry)}` : "",
                shop?.showDose !== false && found?.category === "Pesticide" && found.dose ? `Dose ${text(found.dose)}` : "",
              ].filter(Boolean);
              return (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <b>{line.product}</b>
                    {details.length > 0 && <small>{details.join(", ")}</small>}
                  </td>
                  <td>{text(found?.hsn)}</td>
                  <td className="ag-r">
                    {num(line.qty)} {(line.unit || text(found?.unit)).toLowerCase()}
                  </td>
                  {!doc.hidePrices && (
                    <>
                      <td className="ag-r">{two(num(line.rate))}</td>
                      <td className="ag-r">{num(line.gst)}%</td>
                      <td className="ag-r">{two(lineTaxable(line) + lineTax(line))}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {isBill && (
        <section className="ag-sheet-sums">
          <table className="ag-sheet-tax">
            <thead>
              <tr>
                <th>GST rate</th>
                <th className="ag-r">Taxable</th>
                {doc.igst ? (
                  <th className="ag-r">IGST</th>
                ) : (
                  <>
                    <th className="ag-r">CGST</th>
                    <th className="ag-r">SGST</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {slabs.map((slab) => (
                <tr key={slab.rate}>
                  <td>{slab.rate}%</td>
                  <td className="ag-r">{two(slab.taxable)}</td>
                  {doc.igst ? (
                    <td className="ag-r">{two(slab.tax)}</td>
                  ) : (
                    <>
                      <td className="ag-r">{two(slab.tax / 2)}</td>
                      <td className="ag-r">{two(slab.tax / 2)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <dl>
            <div>
              <dt>Taxable value</dt>
              <dd>{two(taxable)}</dd>
            </div>
            <div>
              <dt>GST</dt>
              <dd>{two(tax)}</dd>
            </div>
            {(doc.adjustments ?? []).map(([label, amount]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{amount < 0 ? `− ${money(-amount)}` : money(amount)}</dd>
              </div>
            ))}
            <div className="ag-sheet-grand">
              <dt>Total</dt>
              <dd>{money(doc.total)}</dd>
            </div>
            {doc.paid !== undefined && (
              <>
                <div>
                  <dt>Paid</dt>
                  <dd>{money(doc.paid)}</dd>
                </div>
                <div>
                  <dt>Balance due</dt>
                  <dd>{money(balance)}</dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}
      {isBill && <p className="ag-sheet-words">{inWords(doc.total)}</p>}

      {doc.voucher && (
        <section className="ag-sheet-voucher">
          <p>{doc.voucher.sentence}</p>
          <b>{money(doc.voucher.amount)}</b>
          <p className="ag-sheet-words">{inWords(doc.voucher.amount)}</p>
          <dl>
            {doc.voucher.rows.filter(([, value]) => value).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {doc.table && (
        <table className="ag-sheet-table">
          <thead>
            <tr>
              {doc.table.head.map((label, index) => (
                <th key={label + index} className={doc.table!.right.includes(index) ? "ag-r" : ""}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.table.rows.map((cells, rowIndex) => (
              <tr key={rowIndex}>
                {cells.map((cell, index) => (
                  <td key={index} className={doc.table!.right.includes(index) ? "ag-r" : ""}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {doc.table.foot && (
            <tfoot>
              <tr>
                {doc.table.foot.map((cell, index) => (
                  <td key={index} className={doc.table!.right.includes(index) ? "ag-r" : ""}>
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      )}
      {doc.table && doc.total !== undefined && (
        <p className="ag-sheet-balance">
          Balance due <b>{money(doc.total)}</b>
        </p>
      )}

      {doc.note && <p className="ag-sheet-note">{doc.note}</p>}
      {isBill && doc.title.startsWith("Tax invoice") && shop?.terms ? <p className="ag-sheet-note">{text(shop.terms)}</p> : null}

      {doc.receiver && (
        <footer className="ag-sheet-sign">
          <span>{doc.receiver}</span>
          <span>For {text(shop?.shopName) || "the shop"}</span>
        </footer>
      )}
    </article>
  );
}

export function PrintSheet({ docs, store, onClose, notify }: { docs: PrintDoc[]; store: Store; onClose: () => void; notify: (message: string) => void }) {
  const shop = shopOf(store);
  const [size, setSize] = useState(text(shop?.invoiceSize) || "A5");
  const doc = docs[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const print = () => {
    try {
      window.print();
    } catch {
      notify("Printing is blocked in this window. Open the app in its own tab to print.");
    }
  };

  return createPortal(
    <div className="ag-sheet-layer">
      <div className="ag-sheet-bar">
        <b>{docs.length > 1 ? `${docs.length} documents: ${docs.map((entry) => entry.number).filter(Boolean).join(", ")}` : `${doc.title}${doc.number ? ` ${doc.number}` : ""}`}</b>
        <div className="ag-segment" role="group" aria-label="Paper size">
          {SIZES.map((option) => (
            <label key={option} className={size === option ? "ag-on" : ""}>
              <input type="radio" name="ag-sheet-size" checked={size === option} onChange={() => setSize(option)} />
              {option}
            </label>
          ))}
        </div>
        <span className="ag-grow" />
        <button className="ag-btn ag-btn-primary" onClick={print}>
          <Printer size={17} /> Print or save as PDF
        </button>
        <button className="ag-icon-btn" aria-label="Close preview" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="ag-sheet-scroll">
        {/* Each document starts on its own sheet of paper. */}
        {docs.map((entry, index) => (
          <SheetPage key={index} doc={entry} store={store} size={size} />
        ))}
      </div>
    </div>,
    document.body,
  );
}
