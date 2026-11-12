import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, HandCoins, Landmark, Minus, PackagePlus, Plus, Printer, Search, ShoppingCart, Tags, Trash2, TrendingUp, Truck, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, date, daysUntil, lineTax, lineTaxable, linesOf, live, money, moneyShort, nextNumber, num, sum, text, todayIso, totalsOf, uid } from "./format";
import { CATEGORIES, PAY_MODES } from "./modules";
import { buildDoc, statementDoc, statementEntries } from "./print";
import type { ScreenProps } from "./shell";
import type { Line, Row } from "./types";
import { Empty, ExpiryCell, Pill, ProductMark, Stats, pickBatch, priceLine, productSubline } from "./ui";

export type { ScreenProps } from "./shell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};
const stockState = (row: Row) => (num(row.stock) === 0 ? "Out of stock" : num(row.stock) <= num(row.reorder) ? "Low" : "In stock");
const due = (row: Row) => Math.max(0, totalsOf(row).total - num(row.paid));

/* ================================================================== */
/* Dashboard                                                           */
/* ================================================================== */

const pageOnly = () => {
  try {
    window.print();
  } catch {
    // Printing can be blocked inside an embedded preview; nothing else to do.
  }
};

/** Prints the page that is on screen, without the menu and top bar. */
export function PrintPageButton() {
  return (
    <button className="ag-btn ag-btn-soft ag-noprint" onClick={pageOnly}>
      <Printer size={17} /> Print
    </button>
  );
}

export function Dashboard({ api, go }: ScreenProps) {
  const { store } = api;
  const today = todayIso();
  const [span, setSpan] = useState(7);
  const invoices = live(store["sales-invoices"] ?? []);
  const products = store.products ?? [];
  const batches = store.batches ?? [];
  const bills = store["purchase-bills"] ?? [];
  const licences = store.licences ?? [];
  const customers = store.customers ?? [];
  const receipts = store.receipts ?? [];
  const outflow = [...(store["supplier-payments"] ?? []), ...(store.expenses ?? []), ...(store["cash-advances"] ?? [])];

  const inRange = (row: Row, from: number, to: number) => {
    const age = -daysUntil(row.date, today);
    return age >= from && age <= to;
  };
  const salesIn = (from: number, to: number) => sum(invoices.filter((r) => inRange(r, from, to)), (r) => totalsOf(r).total);
  const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

  const salesToday = salesIn(0, 0);
  const salesMonth = salesIn(0, 29);
  const salesPrevMonth = salesIn(30, 59);
  const collectedToday = sum(receipts.filter((r) => r.date === today), (r) => num(r.amount));
  const receivable = sum(customers, (c) => num(c.balance));
  const payable = sum(store.suppliers ?? [], (s) => num(s.balance));
  const cashIn = sum(receipts.filter((r) => r.mode === "Cash"), (r) => num(r.amount)) - sum(outflow.filter((r) => r.mode === "Cash"), (r) => num(r.amount));
  const bankIn = sum(receipts.filter((r) => r.mode !== "Cash"), (r) => num(r.amount)) - sum(outflow.filter((r) => r.mode !== "Cash"), (r) => num(r.amount));

  const series = Array.from({ length: span }, (_, index) => {
    const day = addDays(today, index - (span - 1));
    return { day, total: sum(invoices.filter((row) => row.date === day), (row) => totalsOf(row).total) };
  });
  const peak = Math.max(1, ...series.map((entry) => entry.total));
  const seriesTotal = series.reduce((s, e) => s + e.total, 0);
  const prevTotal = salesIn(span, span * 2 - 1);
  const seriesChange = change(seriesTotal, prevTotal);

  const expired = batches.filter((b) => num(b.qty) > 0 && daysUntil(b.expiryDate) < 0);
  const expiring = batches.filter((b) => num(b.qty) > 0 && daysUntil(b.expiryDate) >= 0 && daysUntil(b.expiryDate) <= 60).sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));
  const low = products.filter((p) => num(p.stock) <= num(p.reorder)).sort((a, b) => num(a.stock) - num(b.stock));
  const overdueBills = bills.filter((b) => b.status !== "Paid" && daysUntil(b.dueDate) < 0);
  const licenceIssues = licences.filter((l) => l.expiryDate && daysUntil(l.expiryDate) <= 60).sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));
  const debtors = customers.filter((c) => num(c.balance) > 0).sort((a, b) => num(b.balance) - num(a.balance));

  const sold = new Map<string, { qty: number; value: number }>();
  invoices.filter((r) => inRange(r, 0, 29)).forEach((row) =>
    linesOf(row).forEach((line) => {
      const entry = sold.get(line.product) ?? { qty: 0, value: 0 };
      entry.qty += num(line.qty);
      entry.value += lineTaxable(line) + lineTax(line);
      sold.set(line.product, entry);
    }),
  );
  const top = [...sold.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 5);
  const topPeak = Math.max(1, ...top.map(([, v]) => v.value));

  const alerts: { tone: "bad" | "warn"; label: string; to: string }[] = [];
  licenceIssues.forEach((l) => alerts.push({ tone: daysUntil(l.expiryDate) < 0 ? "bad" : "warn", label: daysUntil(l.expiryDate) < 0 ? `${text(l.name)} expired on ${date(l.expiryDate)}` : `${text(l.name)} expires in ${daysUntil(l.expiryDate)} days`, to: "licences" }));
  if (expired.length) alerts.push({ tone: "bad", label: `${expired.length} expired ${expired.length === 1 ? "batch is" : "batches are"} still in stock`, to: "batches" });
  if (overdueBills.length) alerts.push({ tone: "bad", label: `${overdueBills.length} supplier ${overdueBills.length === 1 ? "bill is" : "bills are"} past the pay-by date`, to: "purchase-bills" });

  const Delta = ({ value, label }: { value: number | null; label: string }) =>
    value === null ? (
      <small>{label}</small>
    ) : (
      <small className={value >= 0 ? "ag-tone-good" : "ag-tone-bad"}>
        {value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {Math.abs(value)}% {label}
      </small>
    );

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            {weekday(today)}, {date(today)}
          </p>
        </div>
        <div className="ag-quick">
          <button className="ag-quick-sale" onClick={() => go("new-sale")}>
            <ShoppingCart size={18} /> New sale
          </button>
          <button className="ag-quick-buy" onClick={() => go("goods-receipts", true)}>
            <Truck size={18} /> Receive goods
          </button>
          <button className="ag-quick-in" onClick={() => go("receipts", true)}>
            <HandCoins size={18} /> Payment in
          </button>
          <button className="ag-quick-out" onClick={() => go("expenses", true)}>
            <Wallet size={18} /> Expense
          </button>
          <button className="ag-quick-item" onClick={() => go("products", true)}>
            <Tags size={18} /> Product
          </button>
        </div>
      </header>

      {alerts.length > 0 && (
        <ul className="ag-alerts">
          {alerts.map((alert) => (
            <li key={alert.label} className={`ag-alert-${alert.tone}`}>
              <AlertTriangle size={16} />
              <span>{alert.label}</span>
              <button className="ag-link" onClick={() => go(alert.to)}>
                Fix <ArrowRight size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="ag-kpis">
        <button className="ag-kpi ag-kpi-blue" onClick={() => go("sales-invoices")}>
          <span className="ag-kpi-icon"><TrendingUp size={20} /></span>
          <span className="ag-kpi-label">Sales today</span>
          <b>{money(salesToday)}</b>
          <small>{invoices.filter((r) => r.date === today).length} bills, {money(collectedToday)} collected</small>
        </button>
        <button className="ag-kpi ag-kpi-violet" onClick={() => go("sales-invoices")}>
          <span className="ag-kpi-icon"><ShoppingCart size={20} /></span>
          <span className="ag-kpi-label">Sales, last 30 days</span>
          <b>{moneyShort(salesMonth)}</b>
          <Delta value={change(salesMonth, salesPrevMonth)} label="vs the 30 days before" />
        </button>
        <button className="ag-kpi ag-kpi-green" onClick={() => go("dues")}>
          <span className="ag-kpi-icon"><HandCoins size={20} /></span>
          <span className="ag-kpi-label">To collect</span>
          <b>{money(receivable)}</b>
          <small>{debtors.length} customers owe you</small>
        </button>
        <button className="ag-kpi ag-kpi-amber" onClick={() => go("dues")}>
          <span className="ag-kpi-icon"><Truck size={20} /></span>
          <span className="ag-kpi-label">To pay</span>
          <b>{money(payable)}</b>
          <small>{overdueBills.length ? `${overdueBills.length} overdue` : "nothing overdue"}</small>
        </button>
      </div>

      <div className="ag-dash">
        <section className="ag-card">
          <header className="ag-card-head">
            <div>
              <h2>Sales trend</h2>
              <p className="ag-card-sub">
                <b className="ag-num">{money(seriesTotal)}</b> <Delta value={seriesChange} label={`vs the ${span} days before`} />
              </p>
            </div>
            <div className="ag-segment" role="group" aria-label="Chart period">
              {[7, 14, 30].map((days) => (
                <label key={days} className={span === days ? "ag-on" : ""}>
                  <input type="radio" name="dash-span" checked={span === days} onChange={() => setSpan(days)} />
                  {days} days
                </label>
              ))}
            </div>
          </header>
          <div className={`ag-bars ag-bars-${span}`} role="img" aria-label={`Sales for each of the last ${span} days`}>
            {series.map((entry, index) => (
              <div key={entry.day} className={entry.day === today ? "ag-bars-today" : ""} title={`${date(entry.day)}: ${money(entry.total)}`}>
                {span === 7 && <small className="ag-num">{entry.total ? moneyShort(entry.total).replace("₹ ", "") : ""}</small>}
                <i style={{ height: `${Math.max(2, (entry.total / peak) * 100)}%` }} />
                <span>{entry.day === today ? "Today" : span === 7 ? weekday(entry.day) : index % (span === 14 ? 2 : 5) === 0 ? entry.day.slice(8) : ""}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="ag-dash-side">
          <section className="ag-card">
            <header className="ag-card-head">
              <h2>Cash and bank</h2>
              <button className="ag-link" onClick={() => go("cashbook")}>
                Open book <ArrowRight size={14} />
              </button>
            </header>
            <ul className="ag-money">
              <li>
                <span className="ag-kpi-icon ag-chip-green"><Banknote size={18} /></span>
                <span className="ag-two ag-grow">
                  <b>Cash movement</b>
                  <small>cash received less cash paid out</small>
                </span>
                <b className="ag-num">{money(cashIn)}</b>
              </li>
              <li>
                <span className="ag-kpi-icon ag-chip-blue"><Landmark size={18} /></span>
                <span className="ag-two ag-grow">
                  <b>Bank and UPI movement</b>
                  <small>received less paid out</small>
                </span>
                <b className="ag-num">{money(bankIn)}</b>
              </li>
            </ul>
          </section>
          <section className="ag-card">
            <header className="ag-card-head">
              <h2>Best sellers, last 30 days</h2>
            </header>
            {top.length === 0 ? (
              <Empty title="No sales yet">Bills you save show up here.</Empty>
            ) : (
              <ul className="ag-split">
                {top.map(([name, entry]) => (
                  <li key={name}>
                    <span>
                      <b>{name}</b>
                      <small>{entry.qty} sold</small>
                    </span>
                    <span className="ag-meter ag-meter-primary">
                      <i style={{ width: `${(entry.value / topPeak) * 100}%` }} />
                    </span>
                    <b className="ag-num">{moneyShort(entry.value)}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="ag-three-col">
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>Low stock</h2>
            <span className="ag-count ag-count-warn">{low.length}</span>
          </header>
          {low.length === 0 ? (
            <Empty title="Stock is healthy" />
          ) : (
            <ul className="ag-mini">
              {low.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <ProductMark product={p} />
                  <span className="ag-two ag-grow">
                    <b>{text(p.name)}</b>
                    <small className={num(p.stock) === 0 ? "ag-tone-bad" : "ag-tone-warn"}>
                      {num(p.stock) === 0 ? "Out of stock" : `${num(p.stock)} left, reorder at ${num(p.reorder)}`}
                    </small>
                  </span>
                  <button className="ag-link" onClick={() => go("purchase-orders", true, { lines: [{ product: p.name, batch: "", qty: Math.max(1, num(p.reorder) * 2 - num(p.stock)), rate: num(p.purchasePrice), gst: num(p.gst) }] })}>
                    Order
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>Expiring soon</h2>
            <span className="ag-count ag-count-bad">{expired.length + expiring.length}</span>
          </header>
          {expired.length + expiring.length === 0 ? (
            <Empty title="Nothing expires in 60 days" />
          ) : (
            <ul className="ag-mini">
              {[...expired, ...expiring].slice(0, 5).map((b) => (
                <li key={b.id}>
                  <span className="ag-two ag-grow">
                    <b>{text(b.product)}</b>
                    <small>
                      Batch {text(b.batchNo)}, {num(b.qty)} in stock
                    </small>
                  </span>
                  <Pill value={daysUntil(b.expiryDate) < 0 ? "Expired" : `${daysUntil(b.expiryDate)} days`} tone={daysUntil(b.expiryDate) < 0 ? "bad" : "warn"} />
                </li>
              ))}
            </ul>
          )}
          <button className="ag-link ag-card-foot" onClick={() => go("batches")}>
            All batches <ArrowRight size={14} />
          </button>
        </section>
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>Highest dues</h2>
            <span className="ag-count">{debtors.length}</span>
          </header>
          {debtors.length === 0 ? (
            <Empty title="No customer owes you" />
          ) : (
            <ul className="ag-mini">
              {debtors.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <span className="ag-avatar ag-avatar-soft">{text(c.name).slice(0, 1)}</span>
                  <span className="ag-two ag-grow">
                    <b>{text(c.name)}</b>
                    <small>{text(c.village) || text(c.type)}</small>
                  </span>
                  <span className="ag-two ag-r">
                    <b className="ag-num">{money(c.balance)}</b>
                    <button className="ag-link" onClick={() => go("receipts", true, { customer: c.name, amount: num(c.balance) })}>
                      Receive
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button className="ag-link ag-card-foot" onClick={() => go("customers")}>
            Customer dashboard <ArrowRight size={14} />
          </button>
        </section>
      </div>

      <section className="ag-card ag-table-card">
        <header className="ag-card-head ag-card-head-pad">
          <h2>Latest bills</h2>
          <button className="ag-link" onClick={() => go("sales-invoices")}>
            All invoices <ArrowRight size={14} />
          </button>
        </header>
        <div className="ag-table-scroll">
          <table className="ag-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Paid by</th>
                <th className="ag-r">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 6).map((row) => (
                <tr key={row.id} onClick={() => go("sales-invoices")}>
                  <td>
                    <span className="ag-id">{text(row.no)}</span>
                  </td>
                  <td className="ag-strong">{text(row.customer)}</td>
                  <td>{date(row.date)}</td>
                  <td>{text(row.payMode)}</td>
                  <td className="ag-r ag-num ag-strong">{money(totalsOf(row).total)}</td>
                  <td>
                    <Pill value={text(row.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ================================================================== */
/* Stock overview                                                      */
/* ================================================================== */

export function StockOverview({ api, go }: ScreenProps) {
  const { store } = api;
  const products = store.products ?? [];
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const order = { "Out of stock": 0, Low: 1, "In stock": 2 } as Record<string, number>;
  const rows = products
    .filter((p) => (tab === "All" || stockState(p) === tab) && text(p.name).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => order[stockState(a)] - order[stockState(b)]);

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>Stock overview</h1>
          <p>Stock in hand for every product, with low and zero stock on top.</p>
        </div>
        <div className="ag-actions ag-noprint">
          <PrintPageButton />
          <button className="ag-btn ag-btn-soft" onClick={() => go("stock-adjustments", true)}>
            Adjust stock
          </button>
          <button className="ag-btn ag-btn-primary" onClick={() => go("purchase-orders", true)}>
            <Plus size={17} /> New purchase order
          </button>
        </div>
      </header>
      <Stats
        stats={[
          { label: "Stock value at cost", value: moneyShort(sum(products, (p) => num(p.stock) * num(p.purchasePrice))) },
          { label: "At reorder level", value: String(products.filter((p) => stockState(p) === "Low").length), tone: "warn" },
          { label: "Out of stock", value: String(products.filter((p) => stockState(p) === "Out of stock").length), tone: "bad" },
        ]}
      />
      <section className="ag-card ag-table-card">
        <div className="ag-toolbar">
          <div className="ag-tabs" role="tablist" aria-label="Filter by stock level">
            {["All", "Out of stock", "Low", "In stock"].map((value) => (
              <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "ag-on" : ""} onClick={() => setTab(value)}>
                {value} <span>{value === "All" ? products.length : products.filter((p) => stockState(p) === value).length}</span>
              </button>
            ))}
          </div>
          <label className="ag-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock" aria-label="Search stock" />
          </label>
        </div>
        {rows.length === 0 ? (
          <Empty title="Nothing matches">Try a different word, or choose another filter.</Empty>
        ) : (
          <div className="ag-table-scroll">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Kept at</th>
                  <th className="ag-r">In stock</th>
                  <th className="ag-r">Reorder level</th>
                  <th>Next expiry</th>
                  <th className="ag-r">Value at cost</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const next = pickBatch(store, text(product.name));
                  return (
                    <tr key={product.id} onClick={() => go("products")}>
                      <td>
                        <span className="ag-product">
                          <ProductMark product={product} />
                          <span className="ag-two">
                            <span className="ag-strong">{text(product.name)}</span>
                            <small>
                              {productSubline(product)}, {text(product.packSize)}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td>{text(product.rack) || "—"}</td>
                      <td className="ag-r ag-num ag-strong">
                        {num(product.stock)} <small className="ag-dim">{text(product.unit).toLowerCase()}s</small>
                      </td>
                      <td className="ag-r ag-num">{num(product.reorder)}</td>
                      <td>{next ? <ExpiryCell value={next.expiryDate} /> : <span className="ag-dim">No live batch</span>}</td>
                      <td className="ag-r ag-num">{money(num(product.stock) * num(product.purchasePrice))}</td>
                      <td>
                        <Pill value={stockState(product)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ================================================================== */
/* Dues and ledger                                                     */
/* ================================================================== */

export function Dues({ api, go, ui }: ScreenProps) {
  const { store } = api;
  const customers = (store.customers ?? []).filter((c) => num(c.balance) > 0).sort((a, b) => num(b.balance) - num(a.balance));
  const suppliers = (store.suppliers ?? []).filter((s) => num(s.balance) > 0).sort((a, b) => num(b.balance) - num(a.balance));
  const [picked, setPicked] = useState<{ side: "customer" | "supplier"; name: string } | null>(
    customers[0] ? { side: "customer", name: text(customers[0].name) } : null,
  );

  const statement = useMemo(
    () => (picked ? [...statementEntries(store, picked.side, picked.name)].reverse() : []),
    [picked, store],
  );

  const list = (side: "customer" | "supplier", rows: Row[]) =>
    rows.length === 0 ? (
      <Empty title="No dues">{side === "customer" ? "Every customer has paid in full." : "You have paid every supplier in full."}</Empty>
    ) : (
      <ul className="ag-party-list">
        {rows.map((row) => {
          const over = side === "customer" && num(row.creditLimit) > 0 && num(row.balance) > num(row.creditLimit);
          return (
            <li key={row.id}>
              <button className={picked?.side === side && picked.name === row.name ? "ag-on" : ""} onClick={() => setPicked({ side, name: text(row.name) })}>
                <span className="ag-two ag-grow">
                  <span className="ag-strong">{text(row.name)}</span>
                  <small>{side === "customer" ? `${text(row.village) || text(row.type)}, ${num(row.creditDays)} days credit` : `${text(row.city)}, ${num(row.creditDays)} days credit`}</small>
                </span>
                {over && <Pill value="Over limit" tone="bad" />}
                <b className="ag-num">{money(row.balance)}</b>
              </button>
            </li>
          );
        })}
      </ul>
    );

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>Dues and ledger</h1>
          <p>Who owes you, and whom you owe. Choose a name to see its statement.</p>
        </div>
        <div className="ag-actions">
          <button className="ag-btn ag-btn-soft" onClick={() => go("supplier-payments", true)}>
            Pay a supplier
          </button>
          <button className="ag-btn ag-btn-primary" onClick={() => go("receipts", true)}>
            <Plus size={17} /> Record a receipt
          </button>
        </div>
      </header>
      <div className="ag-two-col">
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>Customers owe you</h2>
            <b className="ag-num ag-tone-good">{money(sum(customers, (c) => num(c.balance)))}</b>
          </header>
          {list("customer", customers)}
        </section>
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>You owe suppliers</h2>
            <b className="ag-num ag-tone-warn">{money(sum(suppliers, (s) => num(s.balance)))}</b>
          </header>
          {list("supplier", suppliers)}
        </section>
      </div>
      {picked && (
        <section className="ag-card ag-table-card">
          <header className="ag-card-head ag-card-head-pad">
            <h2>Statement for {picked.name}</h2>
            <button className="ag-btn ag-btn-soft" onClick={() => ui.print(statementDoc(store, picked.side, picked.name))}>
              <Printer size={16} /> Print statement
            </button>
          </header>
          {statement.length === 0 ? (
            <Empty title="No entries yet">This balance was entered as an opening balance.</Empty>
          ) : (
            <div className="ag-table-scroll">
              <table className="ag-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Entry</th>
                    <th className="ag-r">{picked.side === "customer" ? "Billed" : "Bill amount"}</th>
                    <th className="ag-r">{picked.side === "customer" ? "Received or returned" : "Paid or returned"}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map((entry, index) => (
                    <tr key={index}>
                      <td>{date(entry.date)}</td>
                      <td className="ag-strong">{entry.what}</td>
                      <td className="ag-r ag-num">{entry.added ? money(entry.added) : ""}</td>
                      <td className="ag-r ag-num ag-tone-good">{entry.settled ? money(entry.settled) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

/* ================================================================== */
/* Cash and bank book                                                  */
/* ================================================================== */

export function Cashbook({ api, go }: ScreenProps) {
  const { store } = api;
  const [tab, setTab] = useState("All");
  const entries = useMemo(
    () =>
      [
        ...(store.receipts ?? []).map((r) => ({ id: r.id, date: text(r.date), what: `Received from ${text(r.customer)}`, ref: text(r.no), mode: text(r.mode), moneyIn: num(r.amount), moneyOut: 0 })),
        ...(store["supplier-payments"] ?? []).map((r) => ({ id: r.id, date: text(r.date), what: `Paid to ${text(r.supplier)}`, ref: text(r.no), mode: text(r.mode), moneyIn: 0, moneyOut: num(r.amount) })),
        ...(store["cash-advances"] ?? []).map((r) => ({ id: r.id, date: text(r.date), what: `Cash lent to ${text(r.customer)}`, ref: text(r.no), mode: text(r.mode), moneyIn: 0, moneyOut: num(r.amount) })),
        ...(store.expenses ?? []).map((r) => ({ id: r.id, date: text(r.date), what: `${text(r.category)}${r.paidTo ? `, ${text(r.paidTo)}` : ""}`, ref: text(r.no), mode: text(r.mode), moneyIn: 0, moneyOut: num(r.amount) })),
      ]
        .filter((e) => tab === "All" || (tab === "Cash" ? e.mode === "Cash" : e.mode !== "Cash"))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [store, tab],
  );
  const totalIn = entries.reduce((s, e) => s + e.moneyIn, 0);
  const totalOut = entries.reduce((s, e) => s + e.moneyOut, 0);

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>Cash and bank book</h1>
          <p>Built from customer receipts, supplier payments and expenses. Nothing is typed here twice.</p>
        </div>
        <div className="ag-actions ag-noprint">
          <PrintPageButton />
          <button className="ag-btn ag-btn-primary" onClick={() => go("expenses", true)}>
            <Plus size={17} /> New expense
          </button>
        </div>
      </header>
      <Stats
        stats={[
          { label: "Money in", value: money(totalIn), tone: "good" },
          { label: "Money out", value: money(totalOut), tone: "warn" },
          { label: "Net movement", value: money(totalIn - totalOut), note: totalIn - totalOut < 0 ? "More went out than came in" : "More came in than went out" },
        ]}
      />
      <section className="ag-card ag-table-card">
        <div className="ag-toolbar">
          <div className="ag-tabs" role="tablist" aria-label="Filter by cash or bank">
            {["All", "Cash", "Bank and UPI"].map((value) => (
              <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "ag-on" : ""} onClick={() => setTab(value)}>
                {value}
              </button>
            ))}
          </div>
        </div>
        {entries.length === 0 ? (
          <Empty title="No entries">Receipts, payments and expenses appear here as you save them.</Empty>
        ) : (
          <div className="ag-table-scroll">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entry</th>
                  <th>Number</th>
                  <th>Mode</th>
                  <th className="ag-r">Money in</th>
                  <th className="ag-r">Money out</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{date(entry.date)}</td>
                    <td className="ag-strong">{entry.what}</td>
                    <td>
                      <span className="ag-id">{entry.ref}</span>
                    </td>
                    <td>{entry.mode}</td>
                    <td className="ag-r ag-num ag-tone-good">{entry.moneyIn ? money(entry.moneyIn) : ""}</td>
                    <td className="ag-r ag-num">{entry.moneyOut ? money(entry.moneyOut) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ================================================================== */
/* GST summary                                                         */
/* ================================================================== */

const byRate = (rows: Row[]) => {
  const map = new Map<number, { taxable: number; tax: number }>();
  rows.forEach((row) =>
    linesOf(row).forEach((line) => {
      const slab = map.get(num(line.gst)) ?? { taxable: 0, tax: 0 };
      slab.taxable += lineTaxable(line);
      slab.tax += lineTax(line);
      map.set(num(line.gst), slab);
    }),
  );
  return map;
};

export function GstSummary({ api }: ScreenProps) {
  const { store } = api;
  const sales = byRate(live(store["sales-invoices"] ?? []));
  const purchases = byRate(store["purchase-bills"] ?? []);
  const rates = [...new Set([...sales.keys(), ...purchases.keys()])].sort((a, b) => a - b);
  const output = [...sales.values()].reduce((s, v) => s + v.tax, 0);
  const input = [...purchases.values()].reduce((s, v) => s + v.tax, 0);
  const net = output - input;

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>GST summary</h1>
          <p>Worked out from your sales invoices and purchase bills. Share it with your accountant when filing.</p>
        </div>
        <PrintPageButton />
      </header>
      <Stats
        stats={[
          { label: "GST collected on sales", value: money(Math.round(output)) },
          { label: "GST paid on purchases", value: money(Math.round(input)), note: "Input tax credit" },
          net >= 0
            ? { label: "GST to pay", value: money(Math.round(net)), tone: "warn" }
            : { label: "Credit carried forward", value: money(Math.round(-net)), tone: "good" },
        ]}
      />
      <section className="ag-card ag-table-card">
        <div className="ag-table-scroll">
          <table className="ag-table">
            <thead>
              <tr>
                <th>GST rate</th>
                <th className="ag-r">Taxable sales</th>
                <th className="ag-r">CGST</th>
                <th className="ag-r">SGST</th>
                <th className="ag-r">Taxable purchases</th>
                <th className="ag-r">Input GST</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => {
                const s = sales.get(rate) ?? { taxable: 0, tax: 0 };
                const p = purchases.get(rate) ?? { taxable: 0, tax: 0 };
                return (
                  <tr key={rate}>
                    <td className="ag-strong">{rate}%</td>
                    <td className="ag-r ag-num">{money(Math.round(s.taxable))}</td>
                    <td className="ag-r ag-num">{money(Math.round(s.tax / 2))}</td>
                    <td className="ag-r ag-num">{money(Math.round(s.tax / 2))}</td>
                    <td className="ag-r ag-num">{money(Math.round(p.taxable))}</td>
                    <td className="ag-r ag-num">{money(Math.round(p.tax))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="ag-table-foot">Sales are treated as within the state, so tax is split equally into CGST and SGST.</footer>
      </section>
    </>
  );
}

/* ================================================================== */
/* Reports                                                             */
/* ================================================================== */

export function Reports({ api }: ScreenProps) {
  const { store } = api;
  const invoices = live(store["sales-invoices"] ?? []);
  const products = store.products ?? [];
  const find = (name: string) => products.find((p) => p.name === name);

  const sold = new Map<string, { qty: number; value: number; cost: number }>();
  invoices.forEach((row) =>
    linesOf(row).forEach((line) => {
      const entry = sold.get(line.product) ?? { qty: 0, value: 0, cost: 0 };
      entry.qty += num(line.qty);
      entry.value += lineTaxable(line);
      entry.cost += num(line.qty) * num(find(line.product)?.purchasePrice);
      sold.set(line.product, entry);
    }),
  );
  const salesValue = [...sold.values()].reduce((s, v) => s + v.value, 0);
  const cost = [...sold.values()].reduce((s, v) => s + v.cost, 0);
  const discounts = sum(invoices, (r) => num(r.discount));
  const expenses = sum(store.expenses ?? [], (r) => num(r.amount));
  const gross = salesValue - discounts - cost;
  const netProfit = gross - expenses;

  const categories = CATEGORIES.slice(0, 3).map((category) => ({
    category,
    value: [...sold.entries()].filter(([name]) => find(name)?.category === category).reduce((s, [, v]) => s + v.value, 0),
  }));
  const top = [...sold.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 6);
  const modes = new Map<string, number>();
  invoices.forEach((row) => modes.set(text(row.payMode), (modes.get(text(row.payMode)) ?? 0) + totalsOf(row).total));
  const modeTotal = Math.max(1, [...modes.values()].reduce((s, v) => s + v, 0));

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>Reports</h1>
          <p>Worked out from every invoice, purchase price and expense saved so far.</p>
        </div>
        <PrintPageButton />
      </header>
      <div className="ag-two-col">
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>Profit and loss</h2>
          </header>
          <dl className="ag-ledger">
            <div>
              <dt>Sales before GST</dt>
              <dd>{money(Math.round(salesValue))}</dd>
            </div>
            <div>
              <dt>Less discounts given</dt>
              <dd>{money(discounts)}</dd>
            </div>
            <div>
              <dt>Less cost of goods sold</dt>
              <dd>{money(Math.round(cost))}</dd>
            </div>
            <div className="ag-ledger-sub">
              <dt>Gross profit</dt>
              <dd>{money(Math.round(gross))}</dd>
            </div>
            <div>
              <dt>Less shop expenses</dt>
              <dd>{money(expenses)}</dd>
            </div>
            <div className={`ag-ledger-total ${netProfit < 0 ? "ag-tone-bad" : "ag-tone-good"}`}>
              <dt>{netProfit < 0 ? "Net loss" : "Net profit"}</dt>
              <dd>{money(Math.abs(Math.round(netProfit)))}</dd>
            </div>
          </dl>
          <p className="ag-footnote">Cost of goods uses each product's current purchase price.</p>
        </section>
        <div className="ag-dash-side">
          <section className="ag-card">
            <header className="ag-card-head">
              <h2>Sales by category</h2>
            </header>
            <ul className="ag-split">
              {categories.map((entry) => (
                <li key={entry.category}>
                  <span>
                    <b>{entry.category}</b>
                    <small>{salesValue ? Math.round((entry.value / salesValue) * 100) : 0}% of sales</small>
                  </span>
                  <span className={`ag-meter ag-meter-${entry.category.toLowerCase()}`}>
                    <i style={{ width: `${salesValue ? (entry.value / salesValue) * 100 : 0}%` }} />
                  </span>
                  <b className="ag-num">{moneyShort(entry.value)}</b>
                </li>
              ))}
            </ul>
          </section>
          <section className="ag-card">
            <header className="ag-card-head">
              <h2>How customers paid</h2>
            </header>
            <ul className="ag-split">
              {[...modes.entries()].sort((a, b) => b[1] - a[1]).map(([mode, value]) => (
                <li key={mode}>
                  <span>
                    <b>{mode}</b>
                    <small>{Math.round((value / modeTotal) * 100)}% of billing</small>
                  </span>
                  <span className="ag-meter">
                    <i style={{ width: `${(value / modeTotal) * 100}%` }} />
                  </span>
                  <b className="ag-num">{moneyShort(value)}</b>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <section className="ag-card ag-table-card">
        <header className="ag-card-head ag-card-head-pad">
          <h2>Best sellers</h2>
        </header>
        <div className="ag-table-scroll">
          <table className="ag-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="ag-r">Quantity sold</th>
                <th className="ag-r">Sales before GST</th>
                <th className="ag-r">Margin</th>
              </tr>
            </thead>
            <tbody>
              {top.map(([name, entry]) => (
                <tr key={name}>
                  <td>
                    <span className="ag-product">
                      <ProductMark product={find(name)} />
                      <span className="ag-strong">{name}</span>
                    </span>
                  </td>
                  <td className="ag-r ag-num">{entry.qty}</td>
                  <td className="ag-r ag-num">{money(Math.round(entry.value))}</td>
                  <td className="ag-r ag-num">{entry.value ? `${Math.round(((entry.value - entry.cost) / entry.value) * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
