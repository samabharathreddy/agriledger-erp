import { Plus, Printer, Save, Search, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { date, daysUntil, linesOf, live, money, nextNumber, num, text, todayIso, totalsOf, uid } from "./format";
import { CATEGORIES, GST_RATES, PAY_MODES, UNITS } from "./modules";
import { buildDoc } from "./print";
import type { PrintDoc } from "./print";
import type { ScreenProps } from "./shell";
import type { Line, Row } from "./types";
import { Empty, Modal, ProductMark, productSubline } from "./ui";

/** One row of a bill while it is being typed. */
interface Item {
  product: string;
  cases: number | "";
  batch: string;
  lot: string;
  exp: string;
  mfg: string;
  company: string;
  qty: number;
  unit: string;
  /** Price for one unit with GST. The "without GST" view is worked out from this. */
  price: number;
  gst: number;
}

/** One open bill. Several can be open at once, each in its own tab. */
interface Bill {
  id: string;
  date: string;
  customer: string;
  billTo: string;
  phone: string;
  saleType: string;
  place: string;
  items: Item[];
  /** How Price/unit and Amount are shown and typed in the grid. */
  priceMode: "with" | "without";
  discountKind: "₹" | "%";
  discountValue: number;
  payMode: string;
  /** null means "the full amount". */
  received: number | null;
  restrictedOk: boolean;
}

/** One invoice that a bill will be saved as. A mixed bill becomes up to four of these. */
interface Part {
  category: string;
  series: string;
  no: string;
  items: Item[];
  gross: number;
  discount: number;
  total: number;
  paid: number;
}

/** Where bills that are still open are kept, so they survive moving to another screen. */
const OPEN = "open-bills";
/** Invoice number series for each kind of product: F-0001, P-0001, S-0001, G-0001. */
const SERIES: Record<string, string> = { Fertilizer: "F", Pesticide: "P", Seed: "S", Other: "G" };
const STATES = ["Telangana", "Andhra Pradesh", "Karnataka", "Maharashtra", "Tamil Nadu", "Chhattisgarh", "Odisha", "Other state"];
const round2 = (value: number) => Math.round(value * 100) / 100;

const netOf = (item: Item) => num(item.qty) * num(item.price);
const taxableOf = (item: Item) => netOf(item) / (1 + num(item.gst) / 100);
const grossOf = (items: Item[]) => items.reduce((s, item) => s + netOf(item), 0);

/** What is saved on the invoice: the rate before GST, plus the extra details typed on the line. */
const toLine = (item: Item): Line => ({
  product: item.product,
  batch: item.batch,
  qty: num(item.qty),
  // Kept unrounded so that rate x quantity x tax comes back to exactly the price typed.
  rate: num(item.price) / (1 + num(item.gst) / 100),
  gst: num(item.gst),
  ...(item.exp ? { expiry: item.exp } : {}),
  ...(num(item.cases) ? { cases: num(item.cases) } : {}),
  ...(item.lot ? { lot: item.lot } : {}),
  ...(item.mfg ? { mfg: item.mfg } : {}),
  ...(item.company ? { company: item.company } : {}),
  ...(item.unit ? { unit: item.unit } : {}),
});

export function SaleBill({ api, go, notify, ui, prefill }: ScreenProps) {
  const { store } = api;
  const shop = (store.shop ?? [])[0];
  const homeState = text(shop?.state) || "Telangana";
  const split = shop?.splitInvoices !== false;
  const products = useMemo(() => (store.products ?? []).filter((p) => p.status !== "Stopped"), [store.products]);
  const customers = store.customers ?? [];
  const invoices = store["sales-invoices"] ?? [];
  const bills = (store[OPEN] ?? []) as unknown as Bill[];

  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [finderOpen, setFinderOpen] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<{ name: string; phone: string; village: string; type: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const blank = (customer = "Walk-in customer"): Bill => ({
    id: uid(),
    date: todayIso(),
    customer,
    billTo: "",
    phone: "",
    saleType: "Retail",
    place: homeState,
    items: [],
    priceMode: "with",
    discountKind: "₹",
    discountValue: 0,
    payMode: "Cash",
    received: null,
    restrictedOk: false,
  });
  const write = (next: Bill[]) => api.replace(OPEN, next as unknown as Row[]);

  // There is always at least one bill open. Coming from a customer's page starts a bill for them.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const wanted = text(prefill?.customer);
    if (bills.length === 0) {
      const first = blank(wanted || undefined);
      write([first]);
      setActiveId(first.id);
    } else if (wanted) {
      const empty = bills.find((entry) => entry.items.length === 0);
      if (empty) {
        write(bills.map((entry) => (entry.id === empty.id ? { ...entry, customer: wanted } : entry)));
        setActiveId(empty.id);
      } else {
        const extra = blank(wanted);
        write([...bills, extra]);
        setActiveId(extra.id);
      }
    }
    // Runs once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bill = bills.find((entry) => entry.id === activeId) ?? bills[0];
  const set = (change: Partial<Bill>) => {
    if (!bill) return;
    setError("");
    write(bills.map((entry) => (entry.id === bill.id ? { ...entry, ...change } : entry)));
  };

  const find = (name: string) => products.find((p) => p.name === name);
  const kindOf = (name: string) => {
    const kind = text(find(name)?.category);
    return SERIES[kind] ? kind : "Other";
  };
  const batchesOf = (name: string) =>
    (store.batches ?? [])
      .filter((b) => b.product === name && num(b.qty) > 0 && daysUntil(b.expiryDate) >= 0)
      .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!needle || [p.name, p.brand, p.technical, p.npk, p.crop, p.hsn, p.barcode].some((v) => text(v).toLowerCase().includes(needle))),
    );
  }, [products, query, category]);

  const today = todayIso();
  const todays = useMemo(() => live(invoices).filter((row) => row.date === today), [invoices, today]);
  const history = useMemo(() => live(invoices).filter((row) => row.customer === bill?.customer), [invoices, bill?.customer]);
  const usual = useMemo(() => {
    const count = new Map<string, number>();
    history.forEach((row) => linesOf(row).forEach((line) => count.set(line.product, (count.get(line.product) ?? 0) + num(line.qty))));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name).filter((name) => products.some((p) => p.name === name)).slice(0, 5);
  }, [history, products]);

  // Keyboard: F2 product search, F4 new bill, F9 save.
  const keys = useRef({ save: (_print: boolean) => {}, newBill: () => {} });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key === "F4") {
        event.preventDefault();
        keys.current.newBill();
      } else if (event.key === "F9") {
        event.preventDefault();
        keys.current.save(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!bill) return <p className="ag-loading">Opening a new bill…</p>;

  const items = bill.items;
  const party = customers.find((c) => c.name === bill.customer);
  const walkIn = bill.customer === "Walk-in customer";
  const withTax = bill.priceMode === "with";
  const interState = bill.place !== homeState;

  /* ---------- Money ---------- */
  const gross = grossOf(items);
  const subtotal = items.reduce((s, item) => s + taxableOf(item), 0);
  const gst = gross - subtotal;
  const billDiscount = Math.min(gross, bill.discountKind === "%" ? (gross * Math.min(100, num(bill.discountValue))) / 100 : num(bill.discountValue));

  /**
   * The invoices this bill will be saved as. With separate invoices switched on,
   * fertilizer, pesticide and seed lines each go to their own invoice and number
   * series; the bill discount is shared between them in proportion to value.
   */
  const groups = split ? CATEGORIES.filter((kind) => items.some((item) => kindOf(item.product) === kind)) : items.length ? ["All"] : [];
  const numbered: Row[] = [...invoices];
  const partsBase = groups.map((kind) => {
    const own = kind === "All" ? items : items.filter((item) => kindOf(item.product) === kind);
    const series = kind === "All" ? text(shop?.invoicePrefix) || "INV" : SERIES[kind];
    const no = nextNumber(numbered, "no", series);
    numbered.push({ id: no, no });
    const partGross = grossOf(own);
    const discount = gross > 0 ? round2((billDiscount * partGross) / gross) : 0;
    return { category: kind, series, no, items: own, gross: partGross, discount, total: Math.max(0, Math.round(partGross - discount)) };
  });
  const total = partsBase.reduce((s, part) => s + part.total, 0);
  const roundOff = round2(total - (gross - billDiscount));
  const tendered = bill.payMode === "Credit" ? 0 : (bill.received ?? total);
  const paid = Math.min(total, tendered);
  const balance = total - paid;
  const change = Math.max(0, tendered - total);
  // Money received fills the invoices in order, so at most one of them is left part-paid.
  let left = paid;
  const parts: Part[] = partsBase.map((part) => {
    const take = Math.min(part.total, left);
    left -= take;
    return { ...part, paid: take };
  });

  /* ---------- Checks ---------- */
  const restricted = items.filter((item) => find(item.product)?.restricted);
  const overStock = items.filter((item) => num(item.qty) > num(find(item.product)?.stock));
  const aboveMrp = items.filter((item) => num(find(item.product)?.mrp) > 0 && round2(num(item.price)) > num(find(item.product)?.mrp));
  const expiredLine = items.find((item) => item.exp && daysUntil(item.exp) < 0);
  const overLimit = balance > 0 && party && num(party.creditLimit) > 0 && num(party.balance) + balance > num(party.creditLimit);

  /* ---------- Editing ---------- */
  /** Batch details that fill in on their own when a batch is picked. */
  const fromBatch = (name: string, batchNo: string) => {
    const batch = (store.batches ?? []).find((b) => b.product === name && b.batchNo === batchNo);
    return batch ? { exp: text(batch.expiryDate), mfg: text(batch.mfgDate), lot: text(batch.lotNo) } : {};
  };
  const add = (name: string) => {
    const product = find(name);
    if (!product) return;
    const index = items.findIndex((item) => item.product === name);
    if (index >= 0) return set({ items: items.map((item, i) => (i === index ? { ...item, qty: num(item.qty) + 1 } : item)) });
    const batchNo = text(batchesOf(name)[0]?.batchNo);
    set({
      items: [
        ...items,
        { product: name, cases: "", batch: batchNo, lot: "", exp: "", mfg: "", company: text(product.brand), qty: 1, unit: text(product.unit) || "Piece", price: num(product.sellPrice), gst: num(product.gst), ...fromBatch(name, batchNo) },
      ],
    });
  };
  const patch = (index: number, changeTo: Partial<Item>) => set({ items: items.map((item, i) => (i === index ? { ...item, ...changeTo } : item)) });
  const shownPrice = (item: Item) => round2(withTax ? num(item.price) : num(item.price) / (1 + num(item.gst) / 100));
  const typedPrice = (item: Item, value: number) => (withTax ? value : value * (1 + num(item.gst) / 100));

  const newBill = () => {
    const extra = blank();
    write([...bills, extra]);
    setActiveId(extra.id);
    setError("");
    setQuery("");
  };
  /** Closes a tab. The last tab is emptied instead, so one bill is always open. */
  const closeBill = (id: string) => {
    const rest = bills.filter((entry) => entry.id !== id);
    if (rest.length === 0) {
      const fresh = blank();
      write([fresh]);
      setActiveId(fresh.id);
    } else {
      write(rest);
      if (id === bill.id) setActiveId(rest[Math.max(0, bills.findIndex((entry) => entry.id === id) - 1)].id);
    }
    setError("");
  };
  const askClose = (entry: Bill, label: string) =>
    entry.items.length === 0
      ? closeBill(entry.id)
      : ui.confirm({ title: `Discard ${label}?`, body: `${entry.items.length} items typed on this bill will be lost. Nothing has been saved, so stock and dues are not affected.`, action: "Discard bill", danger: true, onConfirm: () => closeBill(entry.id) });

  const check = (): string => {
    if (items.length === 0) return "Add at least one product to the bill.";
    if (items.some((item) => num(item.qty) <= 0)) return "Quantity must be more than zero on every line.";
    if (overStock.length) return `Only ${num(find(overStock[0].product)?.stock)} of ${overStock[0].product} in stock. Reduce the quantity.`;
    if (expiredLine) return `${expiredLine.product} has an expiry date in the past. Expired stock cannot be sold.`;
    if (aboveMrp.length) return `${aboveMrp[0].product} is priced above its MRP of ${money(find(aboveMrp[0].product)?.mrp)}. Selling above MRP is not allowed.`;
    if (balance > 0 && walkIn) return "Choose a named customer to leave a balance on credit.";
    if (restricted.length && !bill.restrictedOk) return "Tick the restricted product check before saving.";
    return "";
  };

  const save = (thenPrint: boolean) => {
    const problem = check();
    setError(problem);
    if (problem) return;
    const rows: Row[] = parts.map((part) => ({
      id: uid(),
      no: part.no,
      date: bill.date,
      time: new Date().toTimeString().slice(0, 5),
      customer: bill.customer,
      billTo: bill.billTo.trim(),
      phone: bill.phone.trim(),
      saleType: bill.saleType,
      placeOfSupply: bill.place,
      payMode: part.paid === 0 && part.total > 0 && bill.payMode !== "Credit" && balance > 0 ? "Credit" : bill.payMode,
      lines: part.items.map(toLine),
      discount: part.discount,
      paid: part.paid,
      status: part.paid >= part.total ? "Paid" : part.paid === 0 ? "Credit" : "Partial",
      // Invoices saved from one bill share this id, so they can be traced back together.
      billGroup: bill.id,
      billType: part.category === "All" ? "Combined" : part.category,
      notes: "",
    }));
    rows.forEach((row) => api.create("sales-invoices", row));
    // The saved bill leaves its tab. With other bills open you land on the next one.
    const rest = bills.filter((entry) => entry.id !== bill.id);
    const next = rest.length ? rest : [blank()];
    write(next);
    setActiveId(next[0].id);
    notify(rows.length === 1 ? `Invoice ${text(rows[0].no)} saved` : `${rows.length} invoices saved: ${rows.map((row) => text(row.no)).join(", ")}`);
    if (thenPrint) {
      const docs = rows.map((row) => buildDoc("sales-invoices", row, store)).filter((doc): doc is PrintDoc => Boolean(doc));
      if (docs.length) ui.print(docs);
    }
  };
  keys.current = { save, newBill };

  const saveCustomer = () => {
    if (!adding || !adding.name.trim()) return;
    const existing = customers.find((c) => text(c.name).toLowerCase() === adding.name.trim().toLowerCase());
    if (!existing) {
      api.create("customers", { id: uid(), name: adding.name.trim(), phone: adding.phone.trim(), village: adding.village.trim(), type: adding.type, creditLimit: 0, creditDays: 0, balance: 0, status: "Active" });
      notify(`${adding.name.trim()} added`);
    }
    set({ customer: existing ? text(existing.name) : adding.name.trim() });
    setAdding(null);
  };

  const tabTotal = (entry: Bill) => {
    const g = grossOf(entry.items);
    return Math.round(g - Math.min(g, entry.discountKind === "%" ? (g * num(entry.discountValue)) / 100 : num(entry.discountValue)));
  };

  return (
    <div className="ag-sb ag-bl">
      {/* ---------- Open bills ---------- */}
      <div className="ag-bl-tabs" role="tablist" aria-label="Open bills">
        {bills.map((entry, index) => (
          <div key={entry.id} className={`ag-bl-tab ${entry.id === bill.id ? "ag-on" : ""}`}>
            <button role="tab" aria-selected={entry.id === bill.id} onClick={() => { setActiveId(entry.id); setError(""); }}>
              <b>Bill {index + 1}</b>
              <span>{entry.billTo || (entry.customer === "Walk-in customer" ? "Counter sale" : entry.customer)}</span>
              <em className="ag-num">{money(tabTotal(entry))}</em>
            </button>
            <button className="ag-bl-tab-close" aria-label={`Close bill ${index + 1}`} onClick={() => askClose(entry, `bill ${index + 1}`)}>
              <X size={14} />
            </button>
          </div>
        ))}
        <button className="ag-bl-tab-new" onClick={newBill}>
          <Plus size={16} /> New bill <kbd>F4</kbd>
        </button>
        <span className="ag-grow" />
        <span className="ag-bl-today">
          Today: <b>{todays.length}</b> {todays.length === 1 ? "invoice" : "invoices"}, <b>{money(todays.reduce((s, row) => s + totalsOf(row).total, 0))}</b>
        </span>
        <button className="ag-link" onClick={() => go("sales-invoices")}>
          Saved invoices
        </button>
      </div>

      <section className="ag-bl-sheet">
        {/* ---------- Who and when ---------- */}
        <div className="ag-bl-head">
          <div className="ag-bl-party">
            <h2>Bill to</h2>
            <div className="ag-sb-row">
              <select aria-label="Customer" value={bill.customer} onChange={(event) => set({ customer: event.target.value })}>
                {customers.map((c) => (
                  <option key={c.id} value={text(c.name)}>
                    {text(c.name)}
                    {c.village ? `, ${text(c.village)}` : ""}
                  </option>
                ))}
              </select>
              <button className="ag-btn ag-btn-outline ag-btn-icon" title="Add a new customer" aria-label="Add a new customer" onClick={() => setAdding({ name: "", phone: "", village: "", type: "Farmer" })}>
                <UserPlus size={17} />
              </button>
            </div>
            {walkIn ? (
              <div className="ag-sb-pair">
                <input aria-label="Name on the bill" value={bill.billTo} placeholder="Name on the bill (optional)" onChange={(event) => set({ billTo: event.target.value })} />
                <input aria-label="Phone" type="tel" value={bill.phone} placeholder="Phone (optional)" onChange={(event) => set({ phone: event.target.value })} />
              </div>
            ) : (
              <>
                <p className="ag-sb-who">{[party?.phone, party?.village, party?.type].map(text).filter(Boolean).join(", ") || "No contact details saved"}</p>
                <dl className="ag-bl-facts">
                  <div className={num(party?.balance) > 0 ? "ag-bl-fact-bad" : ""}>
                    <dt>Owes now</dt>
                    <dd>{money(party?.balance)}</dd>
                  </div>
                  <div>
                    <dt>Credit limit</dt>
                    <dd>{num(party?.creditLimit) > 0 ? money(party?.creditLimit) : "Cash only"}</dd>
                  </div>
                  <div>
                    <dt>Last bought</dt>
                    <dd>{history[0] ? date(history[0].date) : "Never"}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>

          <dl className="ag-bl-meta">
            <div>
              <dt>Invoice number</dt>
              <dd className="ag-bl-numbers">
                {parts.length === 0 ? <span className="ag-dim">Given when you add items</span> : parts.map((part) => <b key={part.no}>{part.no}</b>)}
              </dd>
            </div>
            <div>
              <dt>
                <label htmlFor="bl-date">Date</label>
              </dt>
              <dd>
                <input id="bl-date" type="date" value={bill.date} max={today} onChange={(event) => set({ date: event.target.value })} />
              </dd>
            </div>
            <div>
              <dt>
                <label htmlFor="bl-type">Sale type</label>
              </dt>
              <dd>
                <select id="bl-type" value={bill.saleType} onChange={(event) => set({ saleType: event.target.value })}>
                  <option>Retail</option>
                  <option>Wholesale</option>
                </select>
              </dd>
            </div>
            <div>
              <dt>
                <label htmlFor="bl-place">Place of supply</label>
              </dt>
              <dd>
                <select id="bl-place" value={bill.place} onChange={(event) => set({ place: event.target.value })}>
                  {[...new Set([homeState, ...STATES])].map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </dd>
            </div>
          </dl>
        </div>

        {/* ---------- Add items ---------- */}
        <div className="ag-sb-finder ag-bl-finder">
          <label className="ag-search">
            <Search size={17} />
            <input
              ref={searchRef}
              value={query}
              placeholder="Add an item: type a name, brand, HSN, or scan a barcode"
              aria-label="Search products to add"
              onFocus={() => setFinderOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setFinderOpen(true);
              }}
              onKeyDown={(event) => {
                // Enter adds the first match, which is also what a barcode scanner sends.
                if (event.key === "Enter" && shown[0] && num(shown[0].stock) > 0) {
                  add(text(shown[0].name));
                  setQuery("");
                  // The list closes after each add and reopens as soon as you type again.
                  setFinderOpen(false);
                }
                if (event.key === "Escape") setFinderOpen(false);
              }}
            />
            <kbd>F2</kbd>
          </label>
          {usual.length > 0 && !walkIn && (
            <span className="ag-bl-usual">
              Usually buys
              {usual.slice(0, 3).map((name) => (
                <button key={name} onClick={() => add(name)}>
                  <Plus size={12} /> {name}
                </button>
              ))}
            </span>
          )}
          <span className="ag-sb-mode">
            Show prices
            <span className="ag-segment">
              {(["with", "without"] as const).map((mode) => (
                <label key={mode} className={bill.priceMode === mode ? "ag-on" : ""}>
                  <input type="radio" name="sb-price-mode" checked={bill.priceMode === mode} onChange={() => set({ priceMode: mode })} />
                  {mode === "with" ? "With GST" : "Without GST"}
                </label>
              ))}
            </span>
          </span>
          {finderOpen && (
            <>
              <button className="ag-sb-shade" aria-label="Close product list" onClick={() => setFinderOpen(false)} />
              <div className="ag-sb-drop">
                <div className="ag-tabs" role="tablist" aria-label="Filter products by category">
                  {["All", ...CATEGORIES.slice(0, 3)].map((value) => (
                    <button key={value} role="tab" aria-selected={category === value} className={category === value ? "ag-on" : ""} onClick={() => setCategory(value)}>
                      {value}
                    </button>
                  ))}
                  <button className="ag-link" onClick={() => setFinderOpen(false)}>
                    Close
                  </button>
                </div>
                {shown.length === 0 ? (
                  <Empty title="No product matches">Check the spelling, or add it under Stock, then Products.</Empty>
                ) : (
                  <ul className="ag-sb-list">
                    {shown.map((product) => {
                      const none = num(product.stock) === 0;
                      const inBill = items.find((item) => item.product === product.name);
                      return (
                        <li key={product.id}>
                          <button disabled={none} className={inBill ? "ag-on" : ""} onClick={() => add(text(product.name))}>
                            <ProductMark product={product} />
                            <span className="ag-two ag-grow">
                              <b>{text(product.name)}</b>
                              <small>
                                {productSubline(product)}, {text(product.packSize)}
                              </small>
                            </span>
                            <small className={none ? "ag-tone-bad" : num(product.stock) <= num(product.reorder) ? "ag-tone-warn" : ""}>
                              {none ? "Out of stock" : `${num(product.stock)} in stock`}
                              {Boolean(product.restricted) && ", restricted"}
                            </small>
                            <span className="ag-two ag-r">
                              <b className="ag-num">{money(product.sellPrice)}</b>
                              {inBill && <em>{num(inBill.qty)} in bill</em>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* ---------- The grid ---------- */}
        <div className="ag-table-scroll">
          <table className="ag-bl-grid">
            <thead>
              <tr>
                <th>No.</th>
                <th>Item</th>
                <th>Cases</th>
                <th>Batch no.</th>
                <th>Lot no.</th>
                <th>Exp. date</th>
                <th>Mfg. date</th>
                <th>Company</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>
                  Price/unit <small>{withTax ? "with GST" : "without GST"}</small>
                </th>
                <th>Tax %</th>
                <th>
                  Amount <small>{withTax ? "with GST" : "without GST"}</small>
                </th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const product = find(item.product);
                const kind = kindOf(item.product);
                const short = num(item.qty) > num(product?.stock);
                const listId = `bl-batches-${index}`;
                return (
                  <tr key={item.product}>
                    <td className="ag-bl-no">{index + 1}</td>
                    <td className="ag-bl-item">
                      <i className={`ag-bl-kind ag-bl-kind-${kind.toLowerCase()}`} title={kind}>
                        {SERIES[kind]}
                      </i>
                      <span>
                        <b>{item.product}</b>
                        <small>
                          {text(product?.packSize)}
                          {Boolean(product?.restricted) && ", restricted"}
                          {short && <em className="ag-tone-bad">, only {num(product?.stock)} in stock</em>}
                        </small>
                      </span>
                    </td>
                    <td>
                      <input
                        aria-label={`Cases of ${item.product}`}
                        className="ag-r"
                        type="number"
                        min="0"
                        value={item.cases}
                        placeholder="0"
                        onChange={(event) => {
                          const cases = event.target.value === "" ? "" : num(event.target.value);
                          const perCase = num(product?.perCase);
                          // When the product has a case size, cases set the quantity.
                          patch(index, { cases, ...(perCase > 0 && cases !== "" ? { qty: cases * perCase } : {}) });
                        }}
                      />
                    </td>
                    <td>
                      <input aria-label={`Batch number of ${item.product}`} list={listId} value={item.batch} placeholder="Batch" onChange={(event) => patch(index, { batch: event.target.value, ...fromBatch(item.product, event.target.value) })} />
                      <datalist id={listId}>
                        {batchesOf(item.product).map((b) => (
                          <option key={b.id} value={text(b.batchNo)}>
                            {num(b.qty)} left, expires {date(b.expiryDate)}
                          </option>
                        ))}
                      </datalist>
                    </td>
                    <td>
                      <input aria-label={`Lot number of ${item.product}`} value={item.lot} placeholder="Lot" onChange={(event) => patch(index, { lot: event.target.value })} />
                    </td>
                    <td className={item.exp && daysUntil(item.exp) < 0 ? "ag-bl-cell-bad" : item.exp && daysUntil(item.exp) <= 60 ? "ag-bl-cell-warn" : ""}>
                      <input aria-label={`Expiry date of ${item.product}`} type="date" value={item.exp} onChange={(event) => patch(index, { exp: event.target.value })} />
                    </td>
                    <td>
                      <input aria-label={`Manufacturing date of ${item.product}`} type="date" max={today} value={item.mfg} onChange={(event) => patch(index, { mfg: event.target.value })} />
                    </td>
                    <td>
                      <input aria-label={`Company of ${item.product}`} value={item.company} placeholder="Company" onChange={(event) => patch(index, { company: event.target.value })} />
                    </td>
                    <td className={short ? "ag-bl-cell-bad" : ""}>
                      <input aria-label={`Quantity of ${item.product}`} className="ag-r ag-bl-strong" type="number" min="0" value={item.qty} onChange={(event) => patch(index, { qty: num(event.target.value) })} />
                    </td>
                    <td>
                      <select aria-label={`Unit of ${item.product}`} value={item.unit} onChange={(event) => patch(index, { unit: event.target.value })}>
                        {[...new Set([item.unit, ...UNITS])].map((unit) => (
                          <option key={unit}>{unit}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input aria-label={`Price of ${item.product}`} className="ag-r" type="number" min="0" step="0.01" value={shownPrice(item)} onChange={(event) => patch(index, { price: typedPrice(item, num(event.target.value)) })} />
                    </td>
                    <td>
                      <select aria-label={`Tax rate of ${item.product}`} value={String(item.gst)} onChange={(event) => patch(index, { gst: num(event.target.value) })}>
                        {[...new Set([String(item.gst), ...GST_RATES])].map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="ag-bl-amount ag-num">{money(round2(withTax ? netOf(item) : taxableOf(item)))}</td>
                    <td className="ag-bl-del">
                      <button aria-label={`Remove ${item.product}`} onClick={() => set({ items: items.filter((_, i) => i !== index) })}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={14} className="ag-bl-empty">
                    No items yet. Click the search box above to pick a product, type its name and press Enter, or scan its barcode.
                  </td>
                </tr>
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </td>
                  <td className="ag-r">{items.reduce((s, item) => s + num(item.cases), 0) || ""}</td>
                  <td colSpan={5} />
                  <td className="ag-r">{items.reduce((s, item) => s + num(item.qty), 0)}</td>
                  <td colSpan={3} />
                  <td className="ag-bl-amount ag-num">{money(round2(withTax ? gross : subtotal))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ---------- Payment and totals ---------- */}
        <div className="ag-bl-foot">
          <div className="ag-bl-pay">
            <h2>Payment</h2>
            <div className="ag-segment ag-segment-wrap">
              {[...PAY_MODES.slice(0, 4), "Credit"].map((option) => (
                <label key={option} className={bill.payMode === option ? "ag-on" : ""}>
                  <input type="radio" name="sb-pay" checked={bill.payMode === option} onChange={() => set({ payMode: option })} />
                  {option}
                </label>
              ))}
            </div>
            {bill.payMode === "Credit" ? (
              <p className="ag-sb-result ag-tone-warn">The full {money(total)} goes to the customer's ledger as due.</p>
            ) : (
              <>
                <div className="ag-bl-received">
                  <label htmlFor="bl-received">Amount received</label>
                  <input id="bl-received" type="number" min="0" value={bill.received ?? total} onChange={(event) => set({ received: event.target.value === "" ? 0 : num(event.target.value) })} />
                  <div className="ag-sb-quick">
                    <button onClick={() => set({ received: null })}>Exact</button>
                    {[...new Set([100, 500, 2000].map((note) => Math.ceil(total / note) * note))].filter((amount) => amount > total).slice(0, 2).map((amount) => (
                      <button key={amount} onClick={() => set({ received: amount })}>
                        {money(amount)}
                      </button>
                    ))}
                  </div>
                </div>
                <p className={`ag-sb-result ${balance > 0 ? "ag-tone-warn" : "ag-tone-good"}`}>
                  {balance > 0 ? `${money(balance)} goes to the customer's ledger as due.` : change > 0 ? `Return ${money(change)} to the customer.` : "Paid in full."}
                </p>
              </>
            )}
            {restricted.length > 0 && (
              <label className="ag-notice ag-notice-bad">
                <input type="checkbox" checked={bill.restrictedOk} onChange={(event) => set({ restrictedOk: event.target.checked })} />
                <span>
                  <b>{restricted.map((item) => item.product).join(", ")} is a restricted product.</b> I have checked that this buyer is allowed to buy it.
                </span>
              </label>
            )}
            {overLimit && (
              <p className="ag-notice ag-notice-warn">
                This bill takes {bill.customer} over the credit limit of {money(party?.creditLimit)}.
              </p>
            )}
          </div>

          <div className="ag-bl-totals">
            <dl>
              <div>
                <dt>Subtotal without GST</dt>
                <dd>{money(round2(subtotal))}</dd>
              </div>
              <div>
                <dt>{interState ? "IGST" : "GST (CGST and SGST)"}</dt>
                <dd>{money(round2(gst))}</dd>
              </div>
              <div>
                <dt>
                  <label htmlFor="sb-discount">Discount</label>
                </dt>
                <dd className="ag-sb-discount">
                  <span className="ag-segment">
                    {(["₹", "%"] as const).map((kind) => (
                      <label key={kind} className={bill.discountKind === kind ? "ag-on" : ""}>
                        <input type="radio" name="sb-disc-kind" checked={bill.discountKind === kind} onChange={() => set({ discountKind: kind })} />
                        {kind}
                      </label>
                    ))}
                  </span>
                  <input id="sb-discount" type="number" min="0" value={bill.discountValue || ""} placeholder="0" onChange={(event) => set({ discountValue: num(event.target.value) })} />
                </dd>
              </div>
              {roundOff !== 0 && (
                <div>
                  <dt>Round off</dt>
                  <dd>{roundOff > 0 ? `+ ${money(roundOff)}` : `− ${money(-roundOff)}`}</dd>
                </div>
              )}
            </dl>
            {parts.length > 1 && (
              <ul className="ag-bl-parts">
                {parts.map((part) => (
                  <li key={part.no}>
                    <i className={`ag-bl-kind ag-bl-kind-${part.category.toLowerCase()}`}>{part.series}</i>
                    <span>
                      {part.category} invoice <b>{part.no}</b>
                    </span>
                    <b className="ag-num">{money(part.total)}</b>
                  </li>
                ))}
              </ul>
            )}
            <div className="ag-sb-grand">
              <span>Grand total</span>
              <b>{money(total)}</b>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="ag-form-alert" role="alert">
          {error}
        </p>
      )}

      {/* ---------- Actions ---------- */}
      <footer className="ag-sb-bar ag-bl-bar">
        <span className="ag-bl-will ag-grow">
          {parts.length === 0
            ? "Add items to start the bill."
            : parts.length === 1
              ? `Saves as invoice ${parts[0].no}.`
              : `Saves as ${parts.length} invoices: ${parts.map((part) => `${part.no} (${part.category.toLowerCase()})`).join(", ")}.`}
        </span>
        <button className="ag-btn ag-btn-outline" onClick={() => save(true)}>
          <Printer size={17} /> Save and print
        </button>
        <button className="ag-btn ag-btn-primary ag-sb-save" onClick={() => save(false)}>
          <Save size={17} /> Save {parts.length > 1 ? "invoices" : "invoice"} <kbd>F9</kbd>
        </button>
      </footer>

      {adding && (
        <Modal
          title="Add a new customer"
          onClose={() => setAdding(null)}
          footer={
            <>
              <button className="ag-btn ag-btn-soft" onClick={() => setAdding(null)}>
                Cancel
              </button>
              <button className="ag-btn ag-btn-primary" disabled={!adding.name.trim()} onClick={saveCustomer}>
                Save customer
              </button>
            </>
          }
        >
          <div className="ag-sb-newcust">
            <label>
              <span>Full name</span>
              <input autoFocus value={adding.name} onChange={(event) => setAdding({ ...adding, name: event.target.value })} />
            </label>
            <label>
              <span>Mobile number</span>
              <input type="tel" value={adding.phone} onChange={(event) => setAdding({ ...adding, phone: event.target.value })} />
            </label>
            <label>
              <span>Village or town</span>
              <input value={adding.village} onChange={(event) => setAdding({ ...adding, village: event.target.value })} />
            </label>
            <label>
              <span>Type</span>
              <select value={adding.type} onChange={(event) => setAdding({ ...adding, type: event.target.value })}>
                <option>Farmer</option>
                <option>Retail customer</option>
                <option>Dealer</option>
              </select>
            </label>
            <p>Photo, Aadhaar, credit limit and farm details can be added later under Customers and farmers.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
