import {
  ArrowLeftRight,
  Ban,
  Banknote,
  ClipboardCheck,
  Copy,
  FileText,
  HandCoins,
  History,
  LayoutDashboard,
  PackagePlus,
  Pencil,
  Printer,
  ReceiptText,
  ShoppingCart,
  Sprout,
  Trash2,
  Truck,
  Undo2,
} from "lucide-react";
import { dueOf, linesOf, money, num, text, todayIso, totalsOf } from "./format";
import { moduleById } from "./modules";
import { buildDoc, detailDoc, statementDoc } from "./print";
import type { ScreenProps } from "./shell";
import type { Row } from "./types";
import type { Action } from "./ui";

interface Context extends ScreenProps {
  /** Opens the edit form for this row. */
  edit: () => void;
  /** Opens the row's own dashboard, where the screen has one. */
  open?: () => void;
}

/** Lines copied to a new document: batch and expiry are dropped so they are picked afresh. */
const copyLines = (row: Row, keepBatch = true) =>
  linesOf(row).map((line) => ({ ...line, ...(keepBatch ? {} : { batch: "", expiry: undefined }) }));

/** Copies a record's own fields without its identity, number, status or history. */
const duplicateOf = (row: Row): Record<string, unknown> => {
  const { id: _id, no: _no, history: _history, status: _status, paid: _paid, ...rest } = row;
  return { ...rest, date: todayIso(), lines: Array.isArray(row.lines) ? copyLines(row) : undefined };
};

/**
 * The three-dot menu for one row. Every screen gets Edit, Duplicate and Delete;
 * each module then adds the actions that make sense for it.
 */
export const actionsFor = (moduleId: string, row: Row, ctx: Context): Action[] => {
  const { api, go, notify, ui } = ctx;
  const module = moduleById(moduleId);
  const name = text(row[module.numberKey ?? (module.columns ?? [])[0]?.key ?? "id"]);
  const doc = buildDoc(moduleId, row, api.store);
  const cancelled = row.status === "Cancelled";

  const edit: Action = { label: "View or edit", icon: Pencil, onSelect: ctx.edit };
  // Every row can be printed: its own document where it has one, a details page where it does not.
  const print: Action[] = [
    doc
      ? { label: `Print ${doc.title.toLowerCase()}`, icon: Printer, onSelect: () => ui.print(doc) }
      : { label: "Print details", icon: Printer, onSelect: () => ui.print(detailDoc(module, row)) },
  ];
  const duplicate: Action = { label: "Duplicate", icon: Copy, onSelect: () => go(moduleId, true, duplicateOf(row)) };
  const history: Action = { label: "View history", icon: History, onSelect: () => ui.history(row, `${module.singular} ${name}`) };
  const remove: Action = {
    label: "Delete",
    icon: Trash2,
    danger: true,
    divider: true,
    onSelect: () =>
      ui.confirm({
        title: `Delete ${module.singular} ${name}?`,
        body:
          moduleId === "sales-invoices" && !cancelled
            ? "The invoice is removed for good. Its stock goes back on the shelf and its unpaid amount leaves the customer's due."
            : "It is removed for good. This cannot be undone.",
        action: "Delete",
        danger: true,
        onConfirm: () => {
          api.remove(moduleId, row.id);
          notify(`${name} deleted`);
        },
      }),
  };

  switch (moduleId) {
    case "sales-invoices": {
      const due = dueOf(row);
      const challan = buildDoc(moduleId, row, api.store, "challan");
      return [
        edit,
        ...print,
        ...(challan ? [{ label: "Print delivery challan", icon: Truck, onSelect: () => ui.print(challan) }] : []),
        ...(due > 0 ? [{ label: `Receive payment (${money(due)} due)`, icon: HandCoins, onSelect: () => go("receipts", true, { customer: row.customer, againstInvoice: row.no, amount: due }) }] : []),
        ...(!cancelled ? [{ label: "Convert to return", icon: Undo2, onSelect: () => go("sales-returns", true, { customer: row.customer, invoiceNo: row.no, lines: copyLines(row) }) }] : []),
        duplicate,
        history,
        ...(!cancelled
          ? [
              {
                label: "Cancel invoice",
                icon: Ban,
                danger: true,
                divider: true,
                onSelect: () =>
                  ui.confirm({
                    title: `Cancel invoice ${name}?`,
                    body: `The invoice stays on the list marked Cancelled. Its stock goes back on the shelf and ${money(due)} leaves the customer's due.${num(row.paid) > 0 ? ` ${money(row.paid)} already received stays in the cash book, so refund it or keep it as an advance.` : ""}`,
                    action: "Cancel invoice",
                    danger: true,
                    onConfirm: () => {
                      api.cancelInvoice(row.id);
                      notify(`Invoice ${name} cancelled`);
                    },
                  }),
              },
            ]
          : []),
        { ...remove, divider: cancelled },
      ];
    }
    case "estimates":
      return [
        edit,
        ...print,
        ...(row.status !== "Converted"
          ? [{ label: "Convert to sale", icon: ShoppingCart, onSelect: () => go("sales-invoices", true, { customer: row.customer, lines: copyLines(row), discount: row.discount, fromEstimate: row.no, payMode: "Cash", paid: totalsOf(row).total }) }]
          : []),
        duplicate,
        history,
        remove,
      ];
    case "purchase-orders":
      return [
        edit,
        ...print,
        ...(row.status !== "Received" && row.status !== "Cancelled"
          ? [{ label: "Receive goods", icon: PackagePlus, onSelect: () => go("goods-receipts", true, { supplier: row.supplier, poNo: row.no, lines: copyLines(row) }) }]
          : []),
        duplicate,
        history,
        remove,
      ];
    case "goods-receipts":
      return [
        edit,
        ...print,
        { label: "Create purchase bill", icon: ReceiptText, onSelect: () => go("purchase-bills", true, { supplier: row.supplier, grnNo: row.no, billNo: row.supplierInvoiceNo, lines: copyLines(row) }) },
        history,
        remove,
      ];
    case "purchase-bills": {
      const due = dueOf(row);
      return [
        edit,
        ...print,
        ...(due > 0 ? [{ label: `Pay supplier (${money(due)} due)`, icon: HandCoins, onSelect: () => go("supplier-payments", true, { supplier: row.supplier, againstBill: row.no, amount: due }) }] : []),
        { label: "Convert to return", icon: ArrowLeftRight, onSelect: () => go("purchase-returns", true, { supplier: row.supplier, billNo: row.billNo, lines: copyLines(row) }) },
        history,
        remove,
      ];
    }
    case "customers":
      return [
        ...(ctx.open ? [{ label: "Open customer dashboard", icon: LayoutDashboard, onSelect: ctx.open }] : []),
        { label: "Edit details", icon: Pencil, onSelect: ctx.edit },
        { label: "New sale", icon: ShoppingCart, onSelect: () => go("new-sale", false, { customer: row.name }) },
        { label: "Receive payment", icon: HandCoins, onSelect: () => go("receipts", true, { customer: row.name, amount: num(row.balance) || "" }) },
        { label: "Lend cash", icon: Banknote, onSelect: () => go("cash-advances", true, { customer: row.name }) },
        { label: "Settle season dues", icon: Sprout, onSelect: () => go("season", false, { customer: row.name }) },
        { label: "Print statement", icon: Printer, onSelect: () => ui.print(statementDoc(api.store, "customer", text(row.name))) },
        ...print,
        history,
        remove,
      ];
    case "suppliers":
      return [
        edit,
        { label: "New purchase order", icon: FileText, onSelect: () => go("purchase-orders", true, { supplier: row.name }) },
        { label: "Pay supplier", icon: HandCoins, onSelect: () => go("supplier-payments", true, { supplier: row.name, amount: num(row.balance) || "" }) },
        { label: "Print statement", icon: Printer, onSelect: () => ui.print(statementDoc(api.store, "supplier", text(row.name))) },
        ...print,
        history,
        remove,
      ];
    case "products":
      return [
        edit,
        { label: "Order more", icon: FileText, onSelect: () => go("purchase-orders", true, { lines: [{ product: row.name, batch: "", qty: Math.max(1, num(row.reorder) * 2 - num(row.stock)), rate: num(row.purchasePrice), gst: num(row.gst) }] }) },
        { label: "Adjust stock", icon: ClipboardCheck, onSelect: () => go("stock-adjustments", true, { product: row.name }) },
        { label: "Duplicate", icon: Copy, onSelect: () => go(moduleId, true, { ...duplicateOf(row), name: `${text(row.name)} (copy)`, stock: 0, status: "Active" }) },
        ...print,
        history,
        remove,
      ];
    case "batches":
      return [
        edit,
        { label: "Write off this batch", icon: ClipboardCheck, onSelect: () => go("stock-adjustments", true, { product: row.product, batch: row.batchNo, qty: row.qty, type: "Expired write-off", reason: `Batch ${text(row.batchNo)} written off` }) },
        ...print,
        { label: "Return to supplier", icon: ArrowLeftRight, onSelect: () => go("purchase-returns", true, { supplier: row.supplier, reason: "Near expiry", lines: [{ product: row.product, batch: row.batchNo, qty: num(row.qty), rate: num(row.purchaseRate), gst: num((api.store.products ?? []).find((p) => p.name === row.product)?.gst) }] }) },
        remove,
      ];
    default:
      return [edit, ...print, ...(module.idPrefix ? [duplicate] : []), history, remove];
  }
};
