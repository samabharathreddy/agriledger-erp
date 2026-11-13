import { Plus, Printer, Search, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { daysUntil, money, nextNumber, num, text, totalsOf, uid } from "./format";
import { actionsFor } from "./actions";
import { buildDoc, listDoc } from "./print";
import type { ScreenProps } from "./shell";
import type { AgriStore } from "./store";
import type { Field, Line, ModuleDef, Row, Section } from "./types";
import { Cell, Drawer, Empty, FieldControl, RowMenu, Stats } from "./ui";

type Values = Record<string, unknown>;

const visibleSections = (sections: Section[], values: Values) =>
  sections.filter((section) => !section.showIf || section.showIf(values));

const visibleFields = (section: Section, values: Values) =>
  section.fields.filter((field) => !field.showIf || field.showIf(values));

const blankValues = (module: ModuleDef, rows: Row[]): Values => {
  const values: Values = {};
  (module.sections ?? []).forEach((section) =>
    section.fields.forEach((field) => {
      if (field.initial !== undefined) values[field.key] = field.initial;
      else if (field.type === "lines") values[field.key] = [];
      else if (field.type === "toggle") values[field.key] = false;
      else values[field.key] = "";
    }),
  );
  if (module.idPrefix && module.numberKey) values[module.numberKey] = nextNumber(rows, module.numberKey, module.idPrefix);
  return values;
};

/** Checks only the fields that are on screen, so hidden category fields never block saving. */
const validate = (module: ModuleDef, values: Values): Record<string, string> => {
  const errors: Record<string, string> = {};
  visibleSections(module.sections ?? [], values).forEach((section) =>
    visibleFields(section, values).forEach((field: Field) => {
      const value = values[field.key];
      if (field.type === "lines") {
        const lines = Array.isArray(value) ? (value as Line[]) : [];
        if (field.required && lines.length === 0) errors[field.key] = "Add at least one item.";
        else if (lines.some((line) => !line.product)) errors[field.key] = "Choose a product on every line, or remove the empty line.";
        else if (lines.some((line) => num(line.qty) <= 0)) errors[field.key] = "Quantity must be more than zero on every line.";
        return;
      }
      if (field.required && text(value).trim() === "") errors[field.key] = `Enter the ${field.label.toLowerCase()}.`;
      else if (field.required && field.type === "money" && num(value) <= 0) errors[field.key] = "Enter an amount more than zero.";
    }),
  );
  if ((module.id === "sales-invoices" || module.id === "purchase-bills") && num(values.paid) > totalsOf(values).total) {
    errors.paid = `This is more than the bill total of ${money(totalsOf(values).total)}.`;
  }
  if (text(values.aadhaarNo) && text(values.aadhaarNo).replace(/\D/g, "").length !== 12) {
    errors.aadhaarNo = "An Aadhaar number has 12 digits.";
  }
  if (module.id === "products" && num(values.mrp) > 0 && num(values.sellPrice) > num(values.mrp)) {
    errors.sellPrice = "Selling price is above MRP. Selling above MRP is not allowed.";
  }
  if (text(values.expiryDate) && text(values.mfgDate) && daysUntil(values.expiryDate, text(values.mfgDate)) <= 0) {
    errors.expiryDate = "Expiry date must be after the manufacturing date.";
  }
  return errors;
};

function FormBody({
  module,
  values,
  errors,
  onChange,
  api,
}: {
  module: ModuleDef;
  values: Values;
  errors: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  api: AgriStore;
}) {
  return (
    <>
      {visibleSections(module.sections ?? [], values).map((section) => (
        <section className="ag-form-section" key={section.title}>
          <header>
            <h3>{section.title}</h3>
            {section.description && <p>{section.description}</p>}
          </header>
          <div className="ag-form-grid">
            {visibleFields(section, values).map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={values[field.key]}
                error={errors[field.key]}
                store={api.store}
                onChange={(value) => onChange(field.key, value)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* List + add/edit drawer                                              */
/* ------------------------------------------------------------------ */

export interface RecordsScreenProps extends ScreenProps {
  module: ModuleDef;
  /** Set by the shell when another screen asks for "new record" straight away. */
  openNew?: boolean;
  onOpened?: () => void;
  /** Extra filter from a wrapping screen, e.g. the date range on Sales invoices. */
  filter?: (row: Row) => boolean;
  /** Shown in place of the standard stats strip. */
  above?: ReactNode;
  /** Extra controls placed in the toolbar, before the search box. */
  toolbarExtra?: ReactNode;
  /** Replaces the "New …" button in the page head. */
  primary?: { label: string; onClick: () => void };
  /** When given, clicking a row opens this instead of the edit form. */
  onRowOpen?: (row: Row) => void;
  /** Open the edit form for this record id as soon as the screen shows. */
  openEditId?: string;
  /** Words describing the active outer filter, printed on the list. */
  filterLabel?: string;
}

/** Collapse duplicate product catalogue rows for display only. Original records stay saved. */
const uniqueProductRows = (rows: Row[]): Row[] => {
  const groups = new Map<string, Row[]>();
  rows.forEach((row) => {
    const name = text(row.name).trim().replace(/\\s+/g, " ").toLocaleLowerCase();
    const pack = text(row.packSize).trim().replace(/\\s+/g, " ").toLocaleLowerCase();
    const unit = text(row.unit).trim().toLocaleLowerCase();
    const category = text(row.category).trim().toLocaleLowerCase();
    const key = [name, pack, unit, category].join("::");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const first = group[0];
    const brands = [...new Set(group.map((row) => text(row.brand).trim()).filter(Boolean))];
    return {
      ...first,
      stock: group.reduce((total, row) => total + num(row.stock), 0),
      brand: brands.join(", "),
      duplicateCount: group.length,
      duplicateProductIds: group.map((row) => row.id),
    };
  });
};

export function RecordsScreen(props: RecordsScreenProps) {
  const { module, api, notify, go, ui, openNew, prefill, onOpened, filter, above, toolbarExtra, primary, onRowOpen, openEditId, filterLabel } = props;
  const savedRows = api.store[module.id] ?? [];\n  // Group duplicate product names in the catalogue without deleting or merging source records.\n  const rows = module.id === "products" ? uniqueProductRows(savedRows) : savedRows;
  const columns = module.columns ?? [];
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const [editing, setEditing] = useState<{ values: Values; isNew: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Click a column heading to sort by it; click again to reverse. */
  const [sort, setSort] = useState<{ key: string; down: boolean } | null>(null);

  // Opened from a shortcut elsewhere (for example "Receive payment" on an invoice).
  // Values handed over by that screen are laid over the blank form.
  useEffect(() => {
    if (!openNew) return;
    const blank = blankValues(module, api.store[module.id] ?? []);
    const given = Object.fromEntries(Object.entries(prefill ?? {}).filter(([, value]) => value !== undefined));
    setErrors({});
    setEditing({ values: { ...blank, ...given }, isNew: true });
    onOpened?.();
    // Runs only when the shortcut flag flips; the other values are read once on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew]);

  useEffect(() => {
    const target = openEditId ? (api.store[module.id] ?? []).find((row) => row.id === openEditId) : undefined;
    if (target) setEditing({ values: { ...blankValues(module, []), ...target }, isNew: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditId]);

  const searchKeys = module.searchKeys ?? columns.map((column) => column.key);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (filter && !filter(row)) return false;
      if (module.tabs && tab !== "All" && text(row[module.tabs.key]) !== tab) return false;
      if (!needle) return true;
      return searchKeys.some((key) => text(row[key]).toLowerCase().includes(needle));
    });
    // Anything with an expiry date is most useful soonest-first.
    if (sort) {
      const column = columns.find((entry) => entry.key === sort.key);
      const value = (row: Row): number | string =>
        column?.kind === "linesTotal" ? totalsOf(row).total
        : column?.kind === "due" ? Math.max(0, totalsOf(row).total - num(row.paid))
        : column?.kind === "money" || column?.kind === "number" ? num(row[sort.key])
        : text(row[sort.key]).toLowerCase();
      return [...list].sort((a, b) => {
        const [x, y] = [value(a), value(b)];
        const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort.down ? -order : order;
      });
    }
    const expiryKey = columns.find((column) => column.kind === "expiry")?.key;
    return expiryKey ? [...list].sort((a, b) => daysUntil(a[expiryKey]) - daysUntil(b[expiryKey])) : list;
  }, [rows, query, tab, module.tabs, searchKeys, columns, filter, sort]);

  // Tab counts follow the outer filter, so "Paid 12" means 12 in the chosen period.
  const scoped = filter ? rows.filter(filter) : rows;
  const hasLines = (module.sections ?? []).some((section) => section.fields.some((field) => field.type === "lines"));
  const totals = editing ? totalsOf(editing.values) : null;

  const startNew = () => {
    setErrors({});
    setConfirmDelete(false);
    setEditing({ values: blankValues(module, rows), isNew: true });
  };
  const startEdit = (row: Row) => {
    setErrors({});
    setConfirmDelete(false);
    setEditing({ values: { ...blankValues(module, rows), ...row }, isNew: false });
  };
  const close = () => setEditing(null);

  const save = () => {
    if (!editing) return;
    const found = validate(module, editing.values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // Paid, Partial, Credit and Unpaid follow from the money, so they are never typed wrongly.
    if ((module.id === "sales-invoices" || module.id === "purchase-bills") && editing.values.status !== "Cancelled") {
      const total = totalsOf(editing.values).total;
      const paid = num(editing.values.paid);
      editing.values.status = paid >= total && total > 0 ? "Paid" : paid > 0 ? "Partial" : module.id === "sales-invoices" ? "Credit" : "Unpaid";
    }
    if (editing.isNew) {
      api.create(module.id, { ...editing.values, id: uid() });
      notify(`${capital(module.singular)} saved`);
    } else {
      api.update(module.id, editing.values as Row);
      notify(`${capital(module.singular)} updated`);
    }
    close();
  };

  const remove = () => {
    if (!editing || editing.isNew) return;
    api.remove(module.id, text(editing.values.id));
    notify(`${capital(module.singular)} deleted`);
    close();
  };

  const titleKey = module.numberKey ?? columns[0]?.key ?? "id";

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>{module.title}</h1>
          <p>{module.description}</p>
        </div>
        <button className="ag-btn ag-btn-primary" onClick={primary ? primary.onClick : startNew}>
          <Plus size={17} /> {primary ? primary.label : `New ${module.singular}`}
        </button>
      </header>

      {above ?? (module.stats && <Stats stats={module.stats(rows, api.store)} />)}

      <section className="ag-card ag-table-card">
        <div className="ag-toolbar">
          {module.tabs && (
            <div className="ag-tabs" role="tablist" aria-label={`Filter ${module.title.toLowerCase()}`}>
              {["All", ...module.tabs.values].map((value) => {
                const count = value === "All" ? scoped.length : scoped.filter((row) => text(row[module.tabs!.key]) === value).length;
                return (
                  <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "ag-on" : ""} onClick={() => setTab(value)}>
                    {value} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="ag-toolbar-end">
            {toolbarExtra}
            <label className="ag-search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${module.title.toLowerCase()}`} aria-label={`Search ${module.title.toLowerCase()}`} />
            </label>
            <button
              className="ag-btn ag-btn-soft ag-btn-icon"
              title="Print this list"
              aria-label="Print this list"
              disabled={filtered.length === 0}
              onClick={() => ui.print(listDoc(module, filtered, [filterLabel, tab !== "All" ? tab : "", query ? `matching “${query}”` : ""].filter(Boolean).join(", ") || undefined))}
            >
              <Printer size={17} />
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Empty
            title={rows.length === 0 ? `No ${module.title.toLowerCase()} yet` : "Nothing matches"}
            action={
              rows.length === 0 ? (
                <button className="ag-btn ag-btn-primary" onClick={startNew}>
                  <Plus size={17} /> New {module.singular}
                </button>
              ) : (
                <button
                  className="ag-btn ag-btn-soft"
                  onClick={() => {
                    setQuery("");
                    setTab("All");
                  }}
                >
                  Clear search and filter
                </button>
              )
            }
          >
            {rows.length === 0 ? `Add your first ${module.singular} to see it here.` : "Try a different word, or clear the filter."}
          </Empty>
        ) : (
          <div className="ag-table-scroll">
            <table className="ag-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className={isRight(column.kind) ? "ag-r" : ""} aria-sort={sort?.key === column.key ? (sort.down ? "descending" : "ascending") : undefined}>
                      <button className="ag-sort" onClick={() => setSort((current) => (current?.key === column.key ? (current.down ? null : { key: column.key, down: true }) : { key: column.key, down: false }))}>
                        {column.label}
                        <i aria-hidden="true">{sort?.key === column.key ? (sort.down ? "▼" : "▲") : ""}</i>
                      </button>
                    </th>
                  ))}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className={row.status === "Cancelled" ? "ag-row-void" : ""} onClick={() => (onRowOpen ? onRowOpen(row) : startEdit(row))}>
                    {columns.map((column) => (
                      <td key={column.key} className={isRight(column.kind) ? "ag-r" : ""}>
                        <Cell column={column} row={row} store={api.store} />
                      </td>
                    ))}
                    <td className="ag-row-action">
                      <RowMenu
                        label={`Actions for ${text(row[titleKey])}`}
                        actions={actionsFor(module.id, row, { api, go, notify, ui, edit: () => startEdit(row), open: onRowOpen ? () => onRowOpen(row) : undefined })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="ag-table-foot">
          Showing {filtered.length} of {rows.length}. Use the three dots at the end of a row for print and other actions.
        </footer>
      </section>

      {editing && (
        <Drawer
          wide={hasLines}
          title={editing.isNew ? `New ${module.singular}` : `Edit ${module.singular}`}
          subtitle={editing.isNew ? undefined : text(editing.values[titleKey])}
          onClose={close}
          footer={
            <>
              {!editing.isNew &&
                (confirmDelete ? (
                  <span className="ag-confirm">
                    Delete this {module.singular}? It cannot be undone.
                    <button className="ag-btn ag-btn-danger" onClick={remove}>
                      Delete
                    </button>
                    <button className="ag-btn ag-btn-soft" onClick={() => setConfirmDelete(false)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button className="ag-btn ag-btn-ghost-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={16} /> Delete
                  </button>
                ))}
              {!editing.isNew && !confirmDelete && buildDoc(module.id, editing.values as Row, api.store) && (
                <button className="ag-btn ag-btn-soft" onClick={() => ui.print(buildDoc(module.id, editing.values as Row, api.store)!)}>
                  <Printer size={16} /> Print
                </button>
              )}
              <span className="ag-grow" />
              {hasLines && totals && !confirmDelete && (
                <span className="ag-foot-total">
                  Total <b>{money(totals.total)}</b>
                </span>
              )}
              {!confirmDelete && (
                <>
                  <button className="ag-btn ag-btn-soft" onClick={close}>
                    Cancel
                  </button>
                  <button className="ag-btn ag-btn-primary" onClick={save}>
                    Save {module.singular}
                  </button>
                </>
              )}
            </>
          }
        >
          {Object.keys(errors).length > 0 && (
            <p className="ag-form-alert" role="alert">
              {Object.keys(errors).length === 1 ? "One field needs attention before this can be saved." : `${Object.keys(errors).length} fields need attention before this can be saved.`}
            </p>
          )}
          <FormBody
            module={module}
            values={editing.values}
            errors={errors}
            api={api}
            onChange={(key, value) => setEditing((current) => (current ? { ...current, values: { ...current.values, [key]: value } } : current))}
          />
        </Drawer>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Single settings form (shop profile)                                 */
/* ------------------------------------------------------------------ */

export function FormScreen({ module, api, notify }: { module: ModuleDef; api: AgriStore; notify: (message: string) => void }) {
  const saved = (api.store[module.id] ?? [])[0];
  const [values, setValues] = useState<Values>({ ...blankValues(module, []), ...saved });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(values) !== JSON.stringify({ ...blankValues(module, []), ...saved });

  const save = () => {
    const found = validate(module, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    api.update(module.id, values as Row);
    notify(`${capital(module.singular)} saved`);
  };

  return (
    <>
      <header className="ag-page-head">
        <div>
          <h1>{module.title}</h1>
          <p>{module.description}</p>
        </div>
        <button className="ag-btn ag-btn-primary" disabled={!dirty} onClick={save}>
          Save {module.singular}
        </button>
      </header>
      <div className="ag-card ag-form-page">
        <FormBody module={module} values={values} errors={errors} api={api} onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))} />
      </div>
    </>
  );
}

const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const isRight = (kind: string | undefined) => kind === "money" || kind === "number" || kind === "linesTotal" || kind === "due";
