import { useCallback, useEffect, useState } from "react";
import { linesOf, nextNumber, num, stamp, text, todayIso, totalsOf, uid } from "./format";
import { MODULES } from "./modules";
import type { Row, Store } from "./types";

/** Bump the suffix when the shape of saved data changes, so old data is not misread. */
const STORAGE_KEY = "agriledger-data-v4";

const seedStore = (): Store =>
  Object.fromEntries(MODULES.filter((m) => m.seed).map((m) => [m.id, m.seed!.map((row) => ({ ...row }))]));

export interface HistoryEntry {
  at: string;
  what: string;
}

/** Adds one line to a record's history. History is what "View history" shows. */
const withHistory = (row: Row, what: string): Row => ({
  ...row,
  history: [...(Array.isArray(row.history) ? (row.history as HistoryEntry[]) : []), { at: stamp(), what }],
});

const adjustStock = (store: Store, product: string, delta: number): Store => ({
  ...store,
  products: (store.products ?? []).map((row) =>
    row.name === product ? { ...row, stock: Math.max(0, num(row.stock) + delta) } : row,
  ),
});

const adjustBatch = (store: Store, product: string, batchNo: string, delta: number): Store => ({
  ...store,
  batches: (store.batches ?? []).map((row) =>
    row.product === product && row.batchNo === batchNo
      ? { ...row, qty: Math.max(0, num(row.qty) + delta) }
      : row,
  ),
});

const adjustBalance = (store: Store, module: "customers" | "suppliers", name: string, delta: number): Store => ({
  ...store,
  [module]: (store[module] ?? []).map((row) =>
    row.name === name ? { ...row, balance: Math.max(0, num(row.balance) + delta) } : row,
  ),
});

/** Marks money against a bill: raises its "paid" figure and moves its status along. */
const settleBill = (store: Store, module: string, no: unknown, amount: number, paidWord: string): Store => ({
  ...store,
  [module]: (store[module] ?? []).map((row) => {
    if (!no || row.no !== no || row.status === "Cancelled") return row;
    const total = totalsOf(row).total;
    const paid = Math.min(total, num(row.paid) + amount);
    return withHistory({ ...row, paid, status: paid >= total ? "Paid" : "Partial" }, `${paidWord} ₹ ${amount.toLocaleString("en-IN")}`);
  }),
});

/** Spreads money over a customer's unpaid bills, oldest bill first. */
const allocate = (store: Store, customer: string, amount: number, word: string): Store => {
  let left = amount;
  const order = (store["sales-invoices"] ?? [])
    .filter((row) => row.customer === customer && row.status !== "Cancelled" && totalsOf(row).total - num(row.paid) > 0)
    .sort((a, b) => (text(a.date) < text(b.date) ? -1 : 1))
    .map((row) => row.id);
  const share = new Map<string, number>();
  order.forEach((id) => {
    const row = (store["sales-invoices"] ?? []).find((entry) => entry.id === id);
    if (!row || left <= 0) return;
    const take = Math.min(left, totalsOf(row).total - num(row.paid));
    share.set(id, take);
    left -= take;
  });
  if (share.size === 0) return store;
  return {
    ...store,
    "sales-invoices": (store["sales-invoices"] ?? []).map((row) => {
      const take = share.get(row.id);
      if (!take) return row;
      const total = totalsOf(row).total;
      const paid = num(row.paid) + take;
      return withHistory({ ...row, paid, status: paid >= total ? "Paid" : "Partial" }, `${word} ₹ ${take.toLocaleString("en-IN")}`);
    }),
  };
};

/** Everything typed on the season settlement form. */
export interface SettlementInput {
  no: string;
  date: string;
  season: string;
  customer: string;
  interest: number;
  received: number;
  mode: string;
  discount: number;
  /** True writes the unpaid remainder off; false carries it to the next season. */
  writeOff: boolean;
  promiseDate: string;
  notes: string;
}

/**
 * What else changes when a NEW record is saved. Editing an old record does not
 * re-run these, so stock and balances are never counted twice.
 */
export const applyEffects = (input: Store, moduleId: string, row: Row): Store => {
  let store = input;
  const lines = linesOf(row);
  const total = totalsOf(row).total;

  switch (moduleId) {
    case "sales-invoices": {
      lines.forEach((line) => {
        store = adjustStock(store, line.product, -num(line.qty));
        store = adjustBatch(store, line.product, line.batch, -num(line.qty));
      });
      const paid = Math.min(num(row.paid), total);
      store = adjustBalance(store, "customers", text(row.customer), total - paid);
      if (paid > 0) {
        const receipts = store.receipts ?? [];
        store = {
          ...store,
          receipts: [
            {
              id: uid(),
              no: nextNumber(receipts, "no", "RC"),
              date: text(row.date) || todayIso(),
              customer: row.customer,
              amount: paid,
              mode: row.payMode === "Credit" ? "Cash" : row.payMode,
              reference: "",
              againstInvoice: row.no,
              notes: "Received at billing",
            },
            ...receipts,
          ],
        };
      }
      // A sale made from an estimate closes that estimate.
      if (row.fromEstimate) {
        store = {
          ...store,
          estimates: (store.estimates ?? []).map((estimate) =>
            estimate.no === row.fromEstimate ? withHistory({ ...estimate, status: "Converted" }, `Converted to invoice ${text(row.no)}`) : estimate,
          ),
        };
      }
      return store;
    }
    case "sales-returns": {
      if (row.restock) lines.forEach((line) => (store = adjustStock(store, line.product, num(line.qty))));
      if (row.refundMode === "Adjust in ledger") store = adjustBalance(store, "customers", text(row.customer), -total);
      return store;
    }
    case "goods-receipts": {
      const batches = [...(store.batches ?? [])];
      lines.forEach((line) => {
        store = adjustStock(store, line.product, num(line.qty));
        if (line.batch) {
          const product = (store.products ?? []).find((p) => p.name === line.product);
          batches.unshift({
            id: uid(),
            product: line.product,
            batchNo: line.batch,
            mfgDate: "",
            expiryDate: line.expiry ?? "",
            qty: num(line.qty),
            purchaseRate: num(line.rate),
            mrp: num(product?.mrp),
            supplier: row.supplier,
            rack: text(product?.rack),
          });
        }
      });
      store = { ...store, batches };
      // Receiving against an order moves the order along.
      if (row.poNo) {
        store = {
          ...store,
          "purchase-orders": (store["purchase-orders"] ?? []).map((order) =>
            order.no === row.poNo && order.status !== "Received"
              ? withHistory({ ...order, status: row.status === "Shortage reported" ? "Partly received" : "Received" }, `Goods received on ${text(row.no)}`)
              : order,
          ),
        };
      }
      return store;
    }
    case "purchase-bills":
      return adjustBalance(store, "suppliers", text(row.supplier), total - num(row.paid));
    case "purchase-returns": {
      lines.forEach((line) => {
        store = adjustStock(store, line.product, -num(line.qty));
        store = adjustBatch(store, line.product, line.batch, -num(line.qty));
      });
      return adjustBalance(store, "suppliers", text(row.supplier), -total);
    }
    case "stock-adjustments": {
      const delta = row.type === "Excess found in count" ? num(row.qty) : -num(row.qty);
      store = adjustStock(store, text(row.product), delta);
      return adjustBatch(store, text(row.product), text(row.batch), delta);
    }
    case "receipts":
      store = adjustBalance(store, "customers", text(row.customer), -num(row.amount));
      // Money against one invoice settles that invoice; money "on account" clears the oldest bills first.
      return row.againstInvoice
        ? settleBill(store, "sales-invoices", row.againstInvoice, num(row.amount), "Payment received")
        : allocate(store, text(row.customer), num(row.amount), "Payment received");
    case "cash-advances":
      // Cash lent to a customer is owed back, so it is added to their due.
      return adjustBalance(store, "customers", text(row.customer), num(row.amount));
    case "supplier-payments":
      store = adjustBalance(store, "suppliers", text(row.supplier), -num(row.amount));
      return settleBill(store, "purchase-bills", row.againstBill, num(row.amount), "Paid");
    default:
      return store;
  }
};

/** Undoes a sale: goods go back on the shelf and the unpaid part leaves the customer's due. */
const reverseSale = (input: Store, row: Row): Store => {
  let store = input;
  linesOf(row).forEach((line) => {
    store = adjustStock(store, line.product, num(line.qty));
    store = adjustBatch(store, line.product, line.batch, num(line.qty));
  });
  return adjustBalance(store, "customers", text(row.customer), -Math.max(0, totalsOf(row).total - num(row.paid)));
};

export interface AgriStore {
  store: Store;
  /** False until the browser has loaded saved data. Screens wait for this. */
  ready: boolean;
  create: (moduleId: string, row: Row) => void;
  /** `note` is the line written to the record's history. Defaults to "Edited". */
  update: (moduleId: string, row: Row, note?: string) => void;
  remove: (moduleId: string, id: string) => void;
  /** Swaps a module's whole list with no side effects. Used for bills still being typed. */
  replace: (moduleId: string, rows: Row[]) => void;
  /** Season-end settlement: interest, money received, discount, and what happens to the rest. */
  settleSeason: (input: SettlementInput) => void;
  /** Keeps the invoice on the list as Cancelled and puts its stock and due back. */
  cancelInvoice: (id: string) => void;
  resetToSample: () => void;
}

export function useAgriStore(): AgriStore {
  const [store, setStore] = useState<Store>({});
  const [ready, setReady] = useState(false);

  // Browser storage is read after mount only, so server rendering never touches it.
  useEffect(() => {
    let loaded: Store | null = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) loaded = JSON.parse(saved) as Store;
    } catch {
      loaded = null;
    }
    setStore(loaded ? { ...seedStore(), ...loaded } : seedStore());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Storage can be full or blocked; the app keeps working for this visit.
    }
  }, [store, ready]);

  const create = useCallback((moduleId: string, input: Row) => {
    const row = withHistory(input, "Created");
    setStore((current) =>
      applyEffects({ ...current, [moduleId]: [row, ...(current[moduleId] ?? [])] }, moduleId, row),
    );
  }, []);

  const update = useCallback((moduleId: string, row: Row, note = "Edited") => {
    setStore((current) => ({
      ...current,
      [moduleId]: (current[moduleId] ?? []).map((existing) => (existing.id === row.id ? withHistory(row, note) : existing)),
    }));
  }, []);

  const remove = useCallback((moduleId: string, id: string) => {
    setStore((current) => {
      const target = (current[moduleId] ?? []).find((row) => row.id === id);
      let next = current;
      // Deleting a live invoice must not leave its stock and due behind.
      if (target && moduleId === "sales-invoices" && target.status !== "Cancelled") next = reverseSale(next, target);
      return { ...next, [moduleId]: (next[moduleId] ?? []).filter((row) => row.id !== id) };
    });
  }, []);

  const cancelInvoice = useCallback((id: string) => {
    setStore((current) => {
      const target = (current["sales-invoices"] ?? []).find((row) => row.id === id);
      if (!target || target.status === "Cancelled") return current;
      const next = reverseSale(current, target);
      return {
        ...next,
        "sales-invoices": (next["sales-invoices"] ?? []).map((row) =>
          row.id === id ? withHistory({ ...row, status: "Cancelled" }, "Cancelled. Stock and due were put back.") : row,
        ),
      };
    });
  }, []);

  const replace = useCallback((moduleId: string, rows: Row[]) => {
    setStore((current) => ({ ...current, [moduleId]: rows }));
  }, []);

  const settleSeason = useCallback((input: SettlementInput) => {
    setStore((current) => {
      const name = input.customer;
      const dueBefore = num((current.customers ?? []).find((row) => row.name === name)?.balance);
      const owed = dueBefore + input.interest;
      const received = Math.min(owed, input.received);
      const discount = Math.min(owed - received, input.discount);
      const remaining = Math.max(0, owed - received - discount);
      const writtenOff = input.writeOff ? remaining : 0;
      const carried = remaining - writtenOff;

      let next = adjustBalance(current, "customers", name, input.interest - received - discount - writtenOff);
      if (received > 0) {
        const receipts = next.receipts ?? [];
        next = {
          ...next,
          receipts: [
            { id: uid(), no: nextNumber(receipts, "no", "RC"), date: input.date, customer: name, amount: received, mode: input.mode, reference: "", againstInvoice: "", notes: `Season settlement ${input.no}, ${input.season}` },
            ...receipts,
          ],
        };
        next = allocate(next, name, received, "Payment received");
      }
      if (discount > 0) next = allocate(next, name, discount, "Discount allowed");
      if (writtenOff > 0) next = allocate(next, name, writtenOff, "Written off");
      return {
        ...next,
        customers: (next.customers ?? []).map((row) =>
          row.name === name
            ? withHistory({ ...row, promiseDate: carried > 0 ? input.promiseDate : "", lastSettled: input.date }, `Season settled (${input.season}): received ₹ ${received.toLocaleString("en-IN")}, carried forward ₹ ${carried.toLocaleString("en-IN")}`)
            : row,
        ),
        settlements: [
          { id: uid(), no: input.no, date: input.date, season: input.season, customer: name, dueBefore, interest: input.interest, received, mode: input.mode, discount, writtenOff, carried, promiseDate: carried > 0 ? input.promiseDate : "", notes: input.notes },
          ...(next.settlements ?? []),
        ],
      };
    });
  }, []);

  const resetToSample = useCallback(() => setStore(seedStore()), []);

  return { store, ready, create, update, remove, replace, settleSeason, cancelInvoice, resetToSample };
}
