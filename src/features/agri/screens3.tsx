import { Printer, Sprout } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addDays, date, daysUntil, dueOf, live, money, moneyShort, nextNumber, num, seasonOf, sum, text, todayIso, totalsOf } from "./format";
import { PAY_MODES } from "./modules";
import { buildDoc, statementDoc } from "./print";
import type { ScreenProps } from "./shell";
import type { Row } from "./types";
import { Empty, Modal, Pill, Stats } from "./ui";

interface Form {
  customer: string;
  /** Interest per month, in percent, on bills older than the customer's credit days. */
  rate: number;
  received: number | null;
  mode: string;
  discount: number;
  writeOff: boolean;
  promiseDate: string;
  notes: string;
}

/**
 * Season settlement.
 *
 * Farmers buy on credit through the season and pay after harvest, often 70 to 80
 * percent of what they owe. This screen takes that payment and makes the shop
 * decide, in writing, what happens to the rest: carried forward to the next
 * season with a promised date, reduced by a discount, or written off.
 */
export function SeasonSettlement({ api, notify, ui, prefill }: ScreenProps) {
  const { store } = api;
  const today = todayIso();
  const customers = (store.customers ?? []).filter((c) => c.name !== "Walk-in customer");
  const invoices = live(store["sales-invoices"] ?? []);
  const settlements = store.settlements ?? [];

  // The current season and the three before it.
  const seasons = useMemo(() => [...new Set(Array.from({ length: 12 }, (_, i) => seasonOf(addDays(today, -i * 45))))].slice(0, 4), [today]);
  const [season, setSeason] = useState(seasons[0]);
  const [form, setForm] = useState<Form | null>(null);

  const open = (name: string) =>
    setForm({ customer: name, rate: 0, received: null, mode: "Cash", discount: 0, writeOff: false, promiseDate: addDays(today, 30), notes: "" });

  // Arriving from a customer's menu opens that customer's settlement straight away.
  useEffect(() => {
    const wanted = text(prefill?.customer);
    if (wanted && customers.some((c) => c.name === wanted && num(c.balance) > 0)) open(wanted);
    // Runs once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = customers
    .filter((c) => num(c.balance) > 0)
    .map((c) => {
      const own = invoices.filter((r) => r.customer === c.name);
      const inSeason = own.filter((r) => seasonOf(text(r.date)) === season);
      const unpaid = own.filter((r) => dueOf(r) > 0).sort((a, b) => (text(a.date) < text(b.date) ? -1 : 1));
      return {
        customer: c,
        billed: sum(inSeason, (r) => totalsOf(r).total),
        paid: sum((store.receipts ?? []).filter((r) => r.customer === c.name && seasonOf(text(r.date)) === season), (r) => num(r.amount)),
        oldest: unpaid[0],
      };
    })
    .sort((a, b) => num(b.customer.balance) - num(a.customer.balance));

  /* ---------- The settlement being typed ---------- */
  const party = form ? customers.find((c) => c.name === form.customer) : undefined;
  const due = num(party?.balance);
  // Interest is charged only on the days a bill has run past the customer's credit period.
  const interest = form && form.rate > 0
    ? Math.round(sum(invoices.filter((r) => r.customer === form.customer && dueOf(r) > 0), (r) => (dueOf(r) * (form.rate / 100) * Math.max(0, -daysUntil(r.date, today) - num(party?.creditDays))) / 30))
    : 0;
  const owed = due + interest;
  const received = form ? Math.min(owed, form.received ?? owed) : 0;
  const discount = form ? Math.min(owed - received, num(form.discount)) : 0;
  const remaining = Math.max(0, owed - received - discount);

  const save = (thenPrint: boolean) => {
    if (!form) return;
    const no = nextNumber(settlements, "no", "ST");
    const input = { no, date: today, season, customer: form.customer, interest, received, mode: form.mode, discount, writeOff: form.writeOff, promiseDate: form.promiseDate, notes: form.notes.trim() };
    api.settleSeason(input);
    notify(`Settlement ${no} saved`);
    if (thenPrint) {
      const writtenOff = form.writeOff ? remaining : 0;
      const doc = buildDoc("settlements", { id: no, ...input, dueBefore: due, writtenOff, carried: remaining - writtenOff, promiseDate: remaining - writtenOff > 0 ? form.promiseDate : "" }, store);
      if (doc) ui.print(doc);
    }
    setForm(null);
  };

  const promised = customers.filter((c) => c.promiseDate && num(c.balance) > 0);

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>Season settlement</h1>
          <p>Take the harvest payment from each farmer. If they pay only part, choose what happens to the rest so it is never forgotten.</p>
        </div>
        <div className="ag-actions ag-noprint">
          <select aria-label="Season" className="ag-filter" value={season} onChange={(event) => setSeason(event.target.value)}>
            {seasons.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </header>

      <Stats
        stats={[
          { label: "Still to collect", value: moneyShort(sum(customers, (c) => num(c.balance))), note: `${rows.length} customers`, tone: "warn" },
          { label: `Collected in settlements, ${season}`, value: moneyShort(sum(settlements.filter((s) => s.season === season), (s) => num(s.received))), tone: "good" },
          { label: "Carried forward with a promise date", value: moneyShort(sum(promised, (c) => num(c.balance))), note: `${promised.filter((c) => daysUntil(c.promiseDate) < 0).length} promises are overdue` },
          { label: "Discount and written off", value: moneyShort(sum(settlements, (s) => num(s.discount) + num(s.writtenOff))), tone: "bad" },
        ]}
      />

      <section className="ag-card ag-table-card">
        <header className="ag-card-head ag-card-head-pad">
          <h2>Customers with dues</h2>
        </header>
        {rows.length === 0 ? (
          <Empty title="No customer owes you">Every account is settled.</Empty>
        ) : (
          <div className="ag-table-scroll">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="ag-r">Billed in {season}</th>
                  <th className="ag-r">Paid in {season}</th>
                  <th className="ag-r">Due now</th>
                  <th>Oldest unpaid bill</th>
                  <th>Promised to pay by</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ customer, billed, paid, oldest }) => (
                  <tr key={customer.id} onClick={() => open(text(customer.name))}>
                    <td>
                      <span className="ag-two">
                        <span className="ag-strong">{text(customer.name)}</span>
                        <small>{[customer.village, customer.phone].map(text).filter(Boolean).join(", ")}</small>
                      </span>
                    </td>
                    <td className="ag-r ag-num">{money(billed)}</td>
                    <td className="ag-r ag-num ag-tone-good">{money(paid)}</td>
                    <td className="ag-r ag-num ag-strong ag-tone-bad">{money(customer.balance)}</td>
                    <td>
                      {oldest ? (
                        <span className="ag-two">
                          <span>{date(oldest.date)}</span>
                          <small>{-daysUntil(oldest.date, today)} days old</small>
                        </span>
                      ) : (
                        <span className="ag-dim">Opening balance or cash lent</span>
                      )}
                    </td>
                    <td>
                      {customer.promiseDate ? (
                        <span className="ag-two">
                          <span>{date(customer.promiseDate)}</span>
                          <small className={daysUntil(customer.promiseDate) < 0 ? "ag-tone-bad" : ""}>{daysUntil(customer.promiseDate) < 0 ? `${-daysUntil(customer.promiseDate)} days late` : `in ${daysUntil(customer.promiseDate)} days`}</small>
                        </span>
                      ) : (
                        <span className="ag-dim">No promise yet</span>
                      )}
                    </td>
                    <td className="ag-row-action ag-row-buttons">
                      <button
                        className="ag-icon-btn ag-icon-btn-quiet"
                        title="Print statement"
                        aria-label={`Print statement for ${text(customer.name)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          ui.print(statementDoc(store, "customer", text(customer.name)));
                        }}
                      >
                        <Printer size={16} />
                      </button>
                      <button className="ag-btn ag-btn-outline" onClick={(event) => { event.stopPropagation(); open(text(customer.name)); }}>
                        <Sprout size={15} /> Settle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ag-card ag-table-card">
        <header className="ag-card-head ag-card-head-pad">
          <h2>Settlements done</h2>
        </header>
        {settlements.length === 0 ? (
          <Empty title="No settlements yet">Each settlement you save is listed here with a slip you can print.</Empty>
        ) : (
          <div className="ag-table-scroll">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Settlement</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th className="ag-r">Was due</th>
                  <th className="ag-r">Received</th>
                  <th className="ag-r">Discount or write-off</th>
                  <th className="ag-r">Carried forward</th>
                  <th>Result</th>
                  <th aria-label="Print" />
                </tr>
              </thead>
              <tbody>
                {settlements.map((row: Row) => {
                  const base = num(row.dueBefore) + num(row.interest);
                  return (
                    <tr key={row.id} onClick={() => ui.print(buildDoc("settlements", row, store)!)}>
                      <td>
                        <span className="ag-two">
                          <span className="ag-id">{text(row.no)}</span>
                          <small>{text(row.season)}</small>
                        </span>
                      </td>
                      <td className="ag-strong">{text(row.customer)}</td>
                      <td>{date(row.date)}</td>
                      <td className="ag-r ag-num">{money(base)}</td>
                      <td className="ag-r ag-num ag-tone-good">
                        {money(row.received)} <small>{base ? Math.round((num(row.received) / base) * 100) : 0}%</small>
                      </td>
                      <td className="ag-r ag-num">{money(num(row.discount) + num(row.writtenOff))}</td>
                      <td className="ag-r ag-num ag-strong">{money(row.carried)}</td>
                      <td>
                        <Pill value={num(row.carried) > 0 ? "Carried forward" : num(row.writtenOff) > 0 ? "Written off" : "Settled in full"} tone={num(row.carried) > 0 ? "warn" : num(row.writtenOff) > 0 ? "bad" : "good"} />
                      </td>
                      <td className="ag-row-action">
                        <button className="ag-icon-btn ag-icon-btn-quiet" aria-label={`Print settlement ${text(row.no)}`}>
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {form && party && (
        <Modal
          title={`Settle ${form.customer}`}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="ag-btn ag-btn-soft" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="ag-btn ag-btn-outline" onClick={() => save(true)}>
                <Printer size={16} /> Save and print slip
              </button>
              <button className="ag-btn ag-btn-primary" onClick={() => save(false)}>
                Save settlement
              </button>
            </>
          }
        >
          <div className="ag-settle">
            <dl className="ag-settle-sum">
              <div>
                <dt>Due now</dt>
                <dd>{money(due)}</dd>
              </div>
              <div>
                <dt>Interest</dt>
                <dd>{money(interest)}</dd>
              </div>
              <div className="ag-settle-owed">
                <dt>To settle</dt>
                <dd>{money(owed)}</dd>
              </div>
            </dl>

            <label>
              <span>Interest for late payment, % a month</span>
              <input type="number" min="0" step="0.25" value={form.rate || ""} placeholder="0 for no interest" onChange={(event) => setForm({ ...form, rate: num(event.target.value) })} />
              <small>Charged only on days past this customer's {num(party.creditDays)} credit days.</small>
            </label>

            <label>
              <span>Amount received now</span>
              <input type="number" min="0" value={form.received ?? owed} onChange={(event) => setForm({ ...form, received: event.target.value === "" ? 0 : num(event.target.value) })} />
            </label>
            <div className="ag-sb-quick">
              {[70, 80, 100].map((percent) => (
                <button key={percent} onClick={() => setForm({ ...form, received: percent === 100 ? null : Math.round((owed * percent) / 100) })}>
                  {percent}% ({money(Math.round((owed * percent) / 100))})
                </button>
              ))}
            </div>

            <div className="ag-settle-pair">
              <label>
                <span>Received by</span>
                <select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}>
                  {PAY_MODES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Discount allowed</span>
                <input type="number" min="0" value={form.discount || ""} placeholder="0" onChange={(event) => setForm({ ...form, discount: num(event.target.value) })} />
              </label>
            </div>

            {remaining > 0 ? (
              <fieldset className="ag-settle-rest">
                <legend>
                  {money(remaining)} is still unpaid ({Math.round((remaining / owed) * 100)}%). What happens to it?
                </legend>
                <label className={!form.writeOff ? "ag-on" : ""}>
                  <input type="radio" name="settle-rest" checked={!form.writeOff} onChange={() => setForm({ ...form, writeOff: false })} />
                  <span>
                    <b>Carry forward to next season</b>
                    <small>It stays in the customer's due and shows on every new bill for them.</small>
                  </span>
                </label>
                {!form.writeOff && (
                  <label className="ag-settle-date">
                    <span>Promised to pay by</span>
                    <input type="date" min={today} value={form.promiseDate} onChange={(event) => setForm({ ...form, promiseDate: event.target.value })} />
                  </label>
                )}
                <label className={form.writeOff ? "ag-on" : ""}>
                  <input type="radio" name="settle-rest" checked={form.writeOff} onChange={() => setForm({ ...form, writeOff: true })} />
                  <span>
                    <b>Write it off</b>
                    <small>Use only when you are sure it will not be paid. It is removed from the due and counted as a loss.</small>
                  </span>
                </label>
              </fieldset>
            ) : (
              <p className="ag-settle-clear">This clears the account in full.</p>
            )}

            <label>
              <span>Note</span>
              <input value={form.notes} placeholder="For example: balance after cotton is sold" onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}
