import { ArrowDownRight, ArrowLeft, ArrowUpRight, Banknote, HandCoins, MapPin, Pencil, Phone, Printer, ShoppingCart, Sprout } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, date, daysUntil, dueOf, lineTax, lineTaxable, linesOf, live, maskAadhaar, money, moneyShort, num, seasonOf, sum, text, todayIso, totalsOf } from "./format";
import { PAY_MODES, moduleById } from "./modules";
import { buildDoc, statementDoc, statementEntries } from "./print";
import { RecordsScreen } from "./record-screen";
import type { ScreenProps } from "./shell";
import type { Row } from "./types";
import { Empty, Modal, Pill } from "./ui";

interface PageProps extends ScreenProps {
  openNew?: boolean;
  onOpened?: () => void;
}

/* ================================================================== */
/* Sales invoices                                                      */
/* ================================================================== */

const PERIODS = ["Today", "This week", "This month", "Last month", "This year", "All time", "Custom"];

/** First and last day of a named period, as ISO dates. Weeks start on Monday. */
const rangeOf = (period: string, today: string): [string, string] => {
  const [y, m, d] = today.split("-").map(Number);
  const iso = (when: Date) => `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  switch (period) {
    case "Today":
      return [today, today];
    case "This week": {
      const weekdayIndex = (new Date(y, m - 1, d).getDay() + 6) % 7;
      return [addDays(today, -weekdayIndex), addDays(today, 6 - weekdayIndex)];
    }
    case "This month":
      return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    case "Last month":
      return [iso(new Date(y, m - 2, 1)), iso(new Date(y, m - 1, 0))];
    case "This year":
      // The Indian financial year runs from 1 April to 31 March.
      return m >= 4 ? [`${y}-04-01`, `${y + 1}-03-31`] : [`${y - 1}-04-01`, `${y}-03-31`];
    default:
      return ["0000-01-01", "9999-12-31"];
  }
};

export function SalesInvoices(props: PageProps) {
  const { api, go } = props;
  const today = todayIso();
  const [period, setPeriod] = useState("This month");
  const [custom, setCustom] = useState<[string, string]>([addDays(today, -30), today]);
  const [payMode, setPayMode] = useState("All");
  const [saleType, setSaleType] = useState("All");

  const [from, to] = period === "Custom" ? custom : rangeOf(period, today);
  const filter = useCallback(
    (row: Row) =>
      text(row.date) >= from && text(row.date) <= to && (payMode === "All" || row.payMode === payMode) && (saleType === "All" || row.saleType === saleType),
    [from, to, payMode, saleType],
  );

  const all = api.store["sales-invoices"] ?? [];
  const rows = live(all.filter(filter));
  const total = sum(rows, (r) => totalsOf(r).total);
  const received = sum(rows, (r) => Math.min(num(r.paid), totalsOf(r).total));
  const balance = sum(rows, dueOf);

  // Compare with the period of the same length just before this one.
  const length = period === "All time" ? 0 : daysUntil(to, from) + 1;
  const before = length
    ? sum(live(all).filter((r) => text(r.date) >= addDays(from, -length) && text(r.date) < from && (payMode === "All" || r.payMode === payMode) && (saleType === "All" || r.saleType === saleType)), (r) => totalsOf(r).total)
    : 0;
  const change = before > 0 ? Math.round(((total - before) / before) * 100) : null;

  const byMode = [...PAY_MODES, "Credit"].map((mode) => ({ mode, value: sum(rows.filter((r) => r.payMode === mode), (r) => totalsOf(r).total) })).filter((entry) => entry.value > 0);
  const label = period === "Custom" || period === "All time" ? (period === "All time" ? "All time" : `${date(from)} to ${date(to)}`) : `${period}, ${date(from)} to ${date(to)}`;

  const above = (
    <section className="ag-sales-summary">
      <div className="ag-sales-total">
        <span>Total sales</span>
        <b>{money(total)}</b>
        <small>
          {rows.length} {rows.length === 1 ? "invoice" : "invoices"}
          {change !== null && (
            <em className={change >= 0 ? "ag-up" : "ag-down"}>
              {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {Math.abs(change)}% vs the period before
            </em>
          )}
        </small>
      </div>
      <div className="ag-sales-part">
        <span>Received</span>
        <b className="ag-tone-good">{money(received)}</b>
        <span className="ag-meter ag-meter-good">
          <i style={{ width: `${total ? (received / total) * 100 : 0}%` }} />
        </span>
      </div>
      <div className="ag-sales-part">
        <span>Balance to collect</span>
        <b className={balance > 0 ? "ag-tone-bad" : ""}>{money(balance)}</b>
        <span className="ag-meter ag-meter-bad">
          <i style={{ width: `${total ? (balance / total) * 100 : 0}%` }} />
        </span>
      </div>
      <ul className="ag-sales-modes">
        {byMode.length === 0 && <li>No sales in this period</li>}
        {byMode.map((entry) => (
          <li key={entry.mode}>
            <span>{entry.mode}</span>
            <b className="ag-num">{moneyShort(entry.value)}</b>
          </li>
        ))}
      </ul>
    </section>
  );

  const toolbarExtra = (
    <>
      <select aria-label="Period" className="ag-filter" value={period} onChange={(event) => setPeriod(event.target.value)}>
        {PERIODS.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      {period === "Custom" && (
        <span className="ag-daterange">
          <input type="date" aria-label="From date" value={custom[0]} max={custom[1]} onChange={(event) => setCustom([event.target.value, custom[1]])} />
          <span>to</span>
          <input type="date" aria-label="To date" value={custom[1]} min={custom[0]} onChange={(event) => setCustom([custom[0], event.target.value])} />
        </span>
      )}
      <select aria-label="Paid by" className="ag-filter" value={payMode} onChange={(event) => setPayMode(event.target.value)}>
        <option value="All">Any payment</option>
        {[...PAY_MODES, "Credit"].map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <select aria-label="Sale type" className="ag-filter" value={saleType} onChange={(event) => setSaleType(event.target.value)}>
        <option value="All">Retail and wholesale</option>
        <option>Retail</option>
        <option>Wholesale</option>
      </select>
    </>
  );

  return (
    <RecordsScreen
      {...props}
      module={moduleById("sales-invoices")}
      filter={filter}
      filterLabel={label}
      above={above}
      toolbarExtra={toolbarExtra}
      primary={{ label: "New sale", onClick: () => go("new-sale") }}
    />
  );
}

/* ================================================================== */
/* Customers: overview, then one dashboard per customer                */
/* ================================================================== */

export function Customers(props: PageProps) {
  const { api } = props;
  const [openId, setOpenId] = useState(text(props.prefill?.openId));
  const [editId, setEditId] = useState("");
  // The edit request is used once; clearing it stops the form reopening later.
  useEffect(() => {
    if (!editId) return;
    const timer = window.setTimeout(() => setEditId(""), 0);
    return () => window.clearTimeout(timer);
  }, [editId]);
  const customers = api.store.customers ?? [];
  const invoices = live(api.store["sales-invoices"] ?? []);
  const today = todayIso();
  const picked = customers.find((row) => row.id === openId);

  const bought = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((row) => map.set(text(row.customer), (map.get(text(row.customer)) ?? 0) + totalsOf(row).total));
    return map;
  }, [invoices]);

  if (picked) {
    return (
      <CustomerDashboard
        {...props}
        customer={picked}
        onBack={() => setOpenId("")}
        onEdit={() => {
          setEditId(picked.id);
          setOpenId("");
        }}
      />
    );
  }

  const named = customers.filter((c) => c.name !== "Walk-in customer");
  const debtors = named.filter((c) => num(c.balance) > 0).sort((a, b) => num(b.balance) - num(a.balance));
  const topBuyers = [...named].sort((a, b) => (bought.get(text(b.name)) ?? 0) - (bought.get(text(a.name)) ?? 0)).filter((c) => bought.get(text(c.name)));
  const active = named.filter((c) => invoices.some((r) => r.customer === c.name && daysUntil(r.date, today) >= -30)).length;
  const overLimit = named.filter((c) => num(c.creditLimit) > 0 && num(c.balance) > num(c.creditLimit)).length;
  const totalDue = sum(named, (c) => num(c.balance));
  const peak = Math.max(1, ...topBuyers.slice(0, 5).map((c) => bought.get(text(c.name)) ?? 0));

  const above = (
    <>
      <div className="ag-kpis">
        <div className="ag-kpi ag-kpi-blue">
          <span className="ag-kpi-label">Customers</span>
          <b>{named.length}</b>
          <small>
            {named.filter((c) => c.type === "Farmer").length} farmers, {named.filter((c) => c.type === "Dealer").length} dealers
          </small>
        </div>
        <div className="ag-kpi ag-kpi-violet">
          <span className="ag-kpi-label">Bought in the last 30 days</span>
          <b>{active}</b>
          <small>{named.length - active} have not bought this month</small>
        </div>
        <div className="ag-kpi ag-kpi-green">
          <span className="ag-kpi-label">Total to collect</span>
          <b>{money(totalDue)}</b>
          <small>{debtors.length} customers owe you</small>
        </div>
        <div className="ag-kpi ag-kpi-amber">
          <span className="ag-kpi-label">Over their credit limit</span>
          <b>{overLimit}</b>
          <small>{overLimit ? "stop credit until they pay" : "everyone is within limit"}</small>
        </div>
      </div>
      <div className="ag-two-col">
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>Highest dues</h2>
          </header>
          {debtors.length === 0 ? (
            <Empty title="No customer owes you" />
          ) : (
            <ul className="ag-mini">
              {debtors.slice(0, 5).map((c) => {
                const used = num(c.creditLimit) > 0 ? Math.min(100, (num(c.balance) / num(c.creditLimit)) * 100) : 0;
                return (
                  <li key={c.id}>
                    <button className="ag-mini-open" onClick={() => setOpenId(c.id)}>
                      <span className="ag-avatar ag-avatar-soft">{text(c.name).slice(0, 1)}</span>
                      <span className="ag-two ag-grow">
                        <b>{text(c.name)}</b>
                        <small>{num(c.creditLimit) > 0 ? `${Math.round(used)}% of ${money(c.creditLimit)} limit used` : "no credit limit set"}</small>
                      </span>
                      <b className="ag-num">{money(c.balance)}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>Top buyers</h2>
          </header>
          {topBuyers.length === 0 ? (
            <Empty title="No sales yet" />
          ) : (
            <ul className="ag-split">
              {topBuyers.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <button className="ag-link ag-link-plain" onClick={() => setOpenId(c.id)}>
                    <b>{text(c.name)}</b>
                    <small>{text(c.village) || text(c.type)}</small>
                  </button>
                  <span className="ag-meter ag-meter-primary">
                    <i style={{ width: `${((bought.get(text(c.name)) ?? 0) / peak) * 100}%` }} />
                  </span>
                  <b className="ag-num">{moneyShort(bought.get(text(c.name)))}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );

  return (
    <RecordsScreen
      {...props}
      module={moduleById("customers")}
      above={above}
      onRowOpen={(row) => setOpenId(row.id)}
      openEditId={editId}
    />
  );
}

function CustomerDashboard({ customer, onBack, onEdit, api, go, ui }: PageProps & { customer: Row; onBack: () => void; onEdit: () => void }) {
  const { store } = api;
  const today = todayIso();
  const name = text(customer.name);
  const [showCard, setShowCard] = useState(false);
  const invoices = (store["sales-invoices"] ?? []).filter((row) => row.customer === name);
  const billed = live(invoices);
  const receipts = (store.receipts ?? []).filter((row) => row.customer === name);
  const lent = (store["cash-advances"] ?? []).filter((row) => row.customer === name);

  const lifetime = sum(billed, (r) => totalsOf(r).total);
  const paid = sum(receipts, (r) => num(r.amount));
  const cashLent = sum(lent, (r) => num(r.amount));
  const balance = num(customer.balance);
  const limit = num(customer.creditLimit);
  const used = limit > 0 ? Math.min(100, (balance / limit) * 100) : 0;
  const last = [...billed].sort((a, b) => (text(a.date) < text(b.date) ? 1 : -1))[0];
  const firstBill = [...billed].sort((a, b) => (text(a.date) < text(b.date) ? -1 : 1))[0];

  // The ledger: every entry that raised or lowered the due, with the balance after it.
  const entries = statementEntries(store, "customer", name);
  const opening = balance - entries.reduce((s, e) => s + e.added - e.settled, 0);
  let running = opening;
  const ledger = entries.map((entry) => {
    running += entry.added - entry.settled;
    return { ...entry, balance: running };
  });

  // How old the unpaid bills are. Old dues are the ones to chase first.
  const ageing = [
    { label: "0 to 30 days", from: 0, to: 30 },
    { label: "31 to 60 days", from: 31, to: 60 },
    { label: "61 to 90 days", from: 61, to: 90 },
    { label: "Over 90 days", from: 91, to: 99999 },
  ].map((bucket) => ({
    ...bucket,
    value: sum(billed.filter((r) => { const age = -daysUntil(r.date, today); return age >= bucket.from && age <= bucket.to; }), dueOf),
  }));
  const overdue = billed.filter((r) => dueOf(r) > 0 && -daysUntil(r.date, today) > num(customer.creditDays)).length;

  // Season by season: what was bought and what was paid.
  const seasons = [...new Set([...billed.map((r) => seasonOf(text(r.date))), ...receipts.map((r) => seasonOf(text(r.date)))])]
    .map((season) => ({
      season,
      bought: sum(billed.filter((r) => seasonOf(text(r.date)) === season), (r) => totalsOf(r).total),
      paid: sum(receipts.filter((r) => seasonOf(text(r.date)) === season), (r) => num(r.amount)),
      latest: [...billed, ...receipts].filter((r) => seasonOf(text(r.date)) === season).map((r) => text(r.date)).sort().pop() ?? "",
    }))
    .sort((a, b) => (a.latest < b.latest ? 1 : -1));

  const items = new Map<string, { qty: number; value: number }>();
  billed.forEach((row) =>
    linesOf(row).forEach((line) => {
      const entry = items.get(line.product) ?? { qty: 0, value: 0 };
      entry.qty += num(line.qty);
      entry.value += lineTaxable(line) + lineTax(line);
      items.set(line.product, entry);
    }),
  );
  const favourites = [...items.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 5);
  const favPeak = Math.max(1, ...favourites.map(([, v]) => v.value));

  const details: [string, string][] = [
    ["Mobile", text(customer.phone)],
    ["Father's or husband's name", text(customer.fatherName)],
    ["Village or town", text(customer.village)],
    ["Mandal", text(customer.mandal)],
    ["District", text(customer.district)],
    ["Land held", customer.landAcres ? `${num(customer.landAcres)} acres` : ""],
    ["Main crops", text(customer.crops)],
    ["GSTIN", text(customer.gstin)],
    ["Customer since", firstBill ? date(firstBill.date) : ""],
    ["Last bought", last ? `${date(last.date)} (${-daysUntil(last.date, today)} days ago)` : ""],
    ["Days allowed to pay", num(customer.creditDays) ? `${num(customer.creditDays)} days` : "Cash only"],
    ["Last season settlement", customer.lastSettled ? date(customer.lastSettled) : ""],
  ];

  return (
    <>
      <button className="ag-link ag-back ag-noprint" onClick={onBack}>
        <ArrowLeft size={15} /> All customers
      </button>

      <header className="ag-profile">
        {customer.photo ? <img className="ag-profile-photo" src={text(customer.photo)} alt={`Photo of ${name}`} /> : <span className="ag-avatar ag-avatar-lg">{name.slice(0, 1)}</span>}
        <div className="ag-grow">
          <h1>
            {name} <Pill value={text(customer.type)} tone="plain" />
            {customer.status === "Blocked" && <Pill value="Blocked" />}
          </h1>
          <p>
            {customer.phone ? (
              <span>
                <Phone size={14} /> {text(customer.phone)}
              </span>
            ) : null}
            {customer.village ? (
              <span>
                <MapPin size={14} /> {[customer.village, customer.mandal, customer.district].map(text).filter(Boolean).join(", ")}
              </span>
            ) : null}
            {customer.type === "Farmer" && (customer.landAcres || customer.crops) ? (
              <span>
                <Sprout size={14} /> {customer.landAcres ? `${num(customer.landAcres)} acres` : ""}
                {customer.landAcres && customer.crops ? ", " : ""}
                {text(customer.crops)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="ag-actions ag-noprint">
          <button className="ag-btn ag-btn-primary" onClick={() => go("new-sale", false, { customer: name })}>
            <ShoppingCart size={16} /> New sale
          </button>
          <button className="ag-btn ag-btn-soft" disabled={balance <= 0} onClick={() => go("receipts", true, { customer: name, amount: balance })}>
            <HandCoins size={16} /> Receive payment
          </button>
          <button className="ag-btn ag-btn-soft" onClick={() => go("cash-advances", true, { customer: name })}>
            <Banknote size={16} /> Lend cash
          </button>
          <button className="ag-btn ag-btn-soft" disabled={balance <= 0} onClick={() => go("season", false, { customer: name })}>
            <Sprout size={16} /> Settle season
          </button>
          <button className="ag-btn ag-btn-soft" onClick={() => ui.print(statementDoc(store, "customer", name))}>
            <Printer size={16} /> Statement
          </button>
          <button className="ag-btn ag-btn-soft" onClick={onEdit}>
            <Pencil size={16} /> Edit
          </button>
        </div>
      </header>

      {/* ---------- Money at a glance ---------- */}
      <div className="ag-kpis">
        <div className="ag-kpi ag-kpi-blue">
          <span className="ag-kpi-label">Total bought</span>
          <b>{money(lifetime)}</b>
          <small>
            {billed.length} {billed.length === 1 ? "bill" : "bills"}, average {money(billed.length ? Math.round(lifetime / billed.length) : 0)}
          </small>
        </div>
        <div className="ag-kpi ag-kpi-green">
          <span className="ag-kpi-label">Total paid</span>
          <b>{money(paid)}</b>
          <small>
            {receipts.length} {receipts.length === 1 ? "receipt" : "receipts"}
            {lifetime + cashLent > 0 ? `, ${Math.round((paid / (lifetime + cashLent)) * 100)}% of what was owed` : ""}
          </small>
        </div>
        <div className={`ag-kpi ${balance > 0 ? "ag-kpi-red" : "ag-kpi-green"}`}>
          <span className="ag-kpi-label">Due now</span>
          <b>{money(balance)}</b>
          <small>
            {customer.promiseDate && balance > 0
              ? `promised by ${date(customer.promiseDate)}${daysUntil(customer.promiseDate) < 0 ? `, ${-daysUntil(customer.promiseDate)} days late` : ""}`
              : overdue
                ? `${overdue} ${overdue === 1 ? "bill is" : "bills are"} past ${num(customer.creditDays)} days`
                : balance > 0
                  ? "all within the credit period"
                  : "nothing to collect"}
          </small>
        </div>
        <div className="ag-kpi ag-kpi-amber">
          <span className="ag-kpi-label">Credit limit</span>
          <b>{limit > 0 ? money(limit) : "Cash only"}</b>
          {limit > 0 ? (
            <>
              <span className={`ag-meter ${used >= 100 ? "ag-meter-bad" : "ag-meter-primary"}`}>
                <i style={{ width: `${used}%` }} />
              </span>
              <small>
                {Math.round(used)}% used, {money(Math.max(0, limit - balance))} left
              </small>
            </>
          ) : (
            <small>no credit allowed</small>
          )}
        </div>
      </div>

      {/* ---------- Details and the make-up of the due ---------- */}
      <div className="ag-two-col">
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>Customer details</h2>
          </header>
          <dl className="ag-details">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || <span className="ag-dim">Not entered</span>}</dd>
              </div>
            ))}
            <div>
              <dt>Aadhaar</dt>
              <dd>
                {maskAadhaar(customer.aadhaarNo) || <span className="ag-dim">Not entered</span>}
                {customer.aadhaarPhoto ? (
                  <button className="ag-link ag-noprint" onClick={() => setShowCard(true)}>
                    View card
                  </button>
                ) : null}
              </dd>
            </div>
          </dl>
          {(!customer.photo || !customer.aadhaarNo) && (
            <button className="ag-link ag-card-foot ag-noprint" onClick={onEdit}>
              Add {!customer.photo ? "photo" : ""}
              {!customer.photo && !customer.aadhaarNo ? " and " : ""}
              {!customer.aadhaarNo ? "Aadhaar" : ""}
            </button>
          )}
        </section>

        <div className="ag-dash-side">
          <section className="ag-card">
            <header className="ag-card-head">
              <h2>How the due of {money(balance)} is made up</h2>
            </header>
            <ul className="ag-ageing">
              {ageing.map((bucket, index) => (
                <li key={bucket.label} className={bucket.value > 0 ? `ag-age-${index}` : ""}>
                  <span>Bills {bucket.label.toLowerCase()} old</span>
                  <b className="ag-num">{money(bucket.value)}</b>
                </li>
              ))}
            </ul>
            <dl className="ag-ledger ag-ledger-tight">
              <div>
                <dt>Cash lent in hand, all time</dt>
                <dd>{money(cashLent)}</dd>
              </div>
              {opening !== 0 && (
                <div>
                  <dt>Opening balance when the account was added</dt>
                  <dd>{money(opening)}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="ag-card ag-table-card">
            <header className="ag-card-head ag-card-head-pad">
              <h2>Season by season</h2>
            </header>
            {seasons.length === 0 ? (
              <Empty title="No purchases yet" />
            ) : (
              <table className="ag-table">
                <thead>
                  <tr>
                    <th>Season</th>
                    <th className="ag-r">Bought</th>
                    <th className="ag-r">Paid</th>
                    <th className="ag-r">Paid %</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((entry) => (
                    <tr key={entry.season}>
                      <td className="ag-strong">{entry.season}</td>
                      <td className="ag-r ag-num">{money(entry.bought)}</td>
                      <td className="ag-r ag-num ag-tone-good">{money(entry.paid)}</td>
                      <td className="ag-r ag-num">{entry.bought ? `${Math.min(999, Math.round((entry.paid / entry.bought) * 100))}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>

      {/* ---------- Ledger ---------- */}
      <section className="ag-card ag-table-card">
        <header className="ag-card-head ag-card-head-pad">
          <div>
            <h2>Ledger</h2>
            <p className="ag-card-sub">Every bill, payment, cash advance and settlement, with the balance after each. Newest first.</p>
          </div>
          <button className="ag-btn ag-btn-soft ag-noprint" onClick={() => ui.print(statementDoc(store, "customer", name))}>
            <Printer size={16} /> Print ledger
          </button>
        </header>
        {ledger.length === 0 ? (
          <Empty title="No entries yet">{balance > 0 ? "The due was entered as an opening balance." : "Bills and payments appear here as you save them."}</Empty>
        ) : (
          <div className="ag-table-scroll ag-table-short">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th className="ag-r">Added to due</th>
                  <th className="ag-r">Received or reduced</th>
                  <th className="ag-r">Balance</th>
                </tr>
              </thead>
              <tbody>
                {[...ledger].reverse().map((entry, index) => (
                  <tr key={index}>
                    <td>{date(entry.date)}</td>
                    <td className="ag-strong">{entry.what}</td>
                    <td className="ag-r ag-num">{entry.added ? money(entry.added) : ""}</td>
                    <td className="ag-r ag-num ag-tone-good">{entry.settled ? money(entry.settled) : ""}</td>
                    <td className={`ag-r ag-num ag-strong ${entry.balance > 0 ? "ag-tone-bad" : ""}`}>{money(Math.round(entry.balance))}</td>
                  </tr>
                ))}
                {opening !== 0 && (
                  <tr>
                    <td />
                    <td className="ag-dim">Opening balance</td>
                    <td />
                    <td />
                    <td className="ag-r ag-num">{money(Math.round(opening))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Bills and buying habits ---------- */}
      <div className="ag-two-col">
        <section className="ag-card ag-table-card">
          <header className="ag-card-head ag-card-head-pad">
            <h2>Bills</h2>
            <small>Click a bill to print it</small>
          </header>
          {invoices.length === 0 ? (
            <Empty title="No bills yet" />
          ) : (
            <div className="ag-table-scroll ag-table-short">
              <table className="ag-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th className="ag-r">Amount</th>
                    <th className="ag-r">Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((row) => (
                    <tr key={row.id} className={row.status === "Cancelled" ? "ag-row-void" : ""} onClick={() => ui.print(buildDoc("sales-invoices", row, store)!)}>
                      <td>
                        <span className="ag-id">{text(row.no)}</span>
                      </td>
                      <td>{date(row.date)}</td>
                      <td className="ag-r ag-num ag-strong">{money(totalsOf(row).total)}</td>
                      <td className={`ag-r ag-num ${dueOf(row) > 0 ? "ag-tone-bad" : ""}`}>{dueOf(row) > 0 ? money(dueOf(row)) : "Nil"}</td>
                      <td>
                        <Pill value={text(row.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="ag-card">
          <header className="ag-card-head">
            <h2>What they buy most</h2>
          </header>
          {favourites.length === 0 ? (
            <Empty title="No purchases yet" />
          ) : (
            <ul className="ag-split">
              {favourites.map(([product, entry]) => (
                <li key={product}>
                  <span>
                    <b>{product}</b>
                    <small>{entry.qty} bought</small>
                  </span>
                  <span className="ag-meter ag-meter-primary">
                    <i style={{ width: `${(entry.value / favPeak) * 100}%` }} />
                  </span>
                  <b className="ag-num">{moneyShort(entry.value)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showCard && (
        <Modal title={`Aadhaar card of ${name}`} onClose={() => setShowCard(false)}>
          <img className="ag-card-image" src={text(customer.aadhaarPhoto)} alt={`Aadhaar card of ${name}`} />
          <p>Number: {maskAadhaar(customer.aadhaarNo) || "not entered"}</p>
        </Modal>
      )}
    </>
  );
}
