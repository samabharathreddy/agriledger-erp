import { Check, Menu, Palette, RotateCcw, ShoppingCart, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { daysUntil, num, stampText, text } from "./format";
import { NAV, moduleById } from "./modules";
import { PrintSheet } from "./print";
import type { PrintDoc } from "./print";
import { FormScreen, RecordsScreen } from "./record-screen";
import { SaleBill } from "./sale";
import { Cashbook, Dashboard, Dues, GstSummary, Reports, StockOverview } from "./screens";
import { Customers, SalesInvoices } from "./screens2";
import { SeasonSettlement } from "./screens3";\nimport { TaxSettings } from "./tax-settings";
import type { Go, ScreenProps, Ui } from "./shell";
import type { HistoryEntry } from "./store";
import { useAgriStore } from "./store";
import type { Row } from "./types";
import { Modal } from "./ui";

type PageProps = ScreenProps & { openNew?: boolean; onOpened?: () => void };

/** Screens that are hand-built instead of being drawn from a module's field list. */
const CUSTOM: Record<string, (props: PageProps) => React.ReactNode> = {
  dashboard: Dashboard,
  "new-sale": SaleBill,
  "sales-invoices": SalesInvoices,
  customers: Customers,
  season: SeasonSettlement,
  stock: StockOverview,
  dues: Dues,
  cashbook: Cashbook,
  gst: GstSummary,
  "tax-settings": TaxSettings,
  reports: Reports,
};

/** Colour themes. The names match the `data-ag-theme` blocks in agri.css. */
const THEMES = [
  { id: "leaf", label: "Leaf green" },
  { id: "indigo", label: "Indigo" },
  { id: "teal", label: "Teal" },
  { id: "maroon", label: "Maroon" },
  { id: "forest", label: "Forest" },
];
// The "-v2" suffix makes the new default (Leaf green) show once for everyone.
const THEME_KEY = "agriledger-theme-v2";

interface Confirm {
  title: string;
  body: string;
  action: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function AgriApp() {
  const api = useAgriStore();
  const [activeId, setActiveId] = useState("dashboard");
  const [visit, setVisit] = useState(0);
  const [openNew, setOpenNew] = useState(false);
  const [prefill, setPrefill] = useState<Record<string, unknown> | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState("leaf");
  const [themeOpen, setThemeOpen] = useState(false);
  const [sheet, setSheet] = useState<PrintDoc[] | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [history, setHistory] = useState<{ row: Row; title: string } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const go = useCallback<Go>((moduleId, startNew = false, values) => {
    setActiveId(moduleId);
    setOpenNew(startNew);
    setPrefill(values);
    // A new visit number remounts the screen, so a prefilled form always opens fresh.
    setVisit((count) => count + 1);
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // The theme is remembered per browser and applied on the page root, so
  // pop-ups drawn outside the app frame (print sheet, menus) follow it too.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved && THEMES.some((option) => option.id === saved)) setTheme(saved);
    } catch {
      // Storage can be blocked; the default theme is used.
    }
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-ag-theme", theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Not saved; the choice still applies for this visit.
    }
  }, [theme]);

  const ui = useMemo<Ui>(
    () => ({
      print: (doc) => setSheet(Array.isArray(doc) ? doc : [doc]),
      confirm: (options) => setConfirm(options),
      history: (row, title) => setHistory({ row, title }),
    }),
    [],
  );

  // Small counts beside menu items, so problems are visible from any screen.
  const badges = useMemo(() => {
    const batches = api.store.batches ?? [];
    const products = api.store.products ?? [];
    const licences = api.store.licences ?? [];
    return {
      batches: batches.filter((b) => num(b.qty) > 0 && daysUntil(b.expiryDate) <= 60).length,
      stock: products.filter((p) => num(p.stock) <= num(p.reorder)).length,
      licences: licences.filter((l) => l.expiryDate && daysUntil(l.expiryDate) <= 60).length,
      estimates: (api.store.estimates ?? []).filter((e) => e.status === "Open").length,
    } as Record<string, number>;
  }, [api.store]);

  const active = moduleById(activeId);
  const shop = (api.store.shop ?? [])[0];
  const Custom = CUSTOM[active.id];
  const page: PageProps = { api, go, notify, ui, prefill, openNew, onOpened: () => setOpenNew(false) };
  const entries = history && Array.isArray(history.row.history) ? (history.row.history as HistoryEntry[]) : [];

  return (
    <div className="ag-app">
      <aside className={`ag-side ${menuOpen ? "ag-side-open" : ""}`}>
        <div className="ag-brand">
          <span className="ag-brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="ag-two">
            <b>AgriLedger</b>
            <small>{text(shop?.shopName) || "Your shop"}</small>
          </span>
          <button className="ag-icon-btn ag-side-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Screens">
          {NAV.map((group) => (
            <div className="ag-nav-group" key={group.label || "home"}>
              {group.label && <h2>{group.label}</h2>}
              {group.modules.map((id) => {
                const module = moduleById(id);
                const Icon = module.icon;
                return (
                  <button key={id} className={activeId === id ? "ag-on" : ""} aria-current={activeId === id ? "page" : undefined} onClick={() => go(id)}>
                    <Icon size={17} />
                    <span>{module.title}</span>
                    {badges[id] > 0 && <em>{badges[id]}</em>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="ag-side-foot">
          <span className="ag-avatar">{text(shop?.owner).slice(0, 1) || "A"}</span>
          <span className="ag-two ag-grow">
            <b>{text(shop?.owner) || "Shop owner"}</b>
            <small>Owner</small>
          </span>
          <div className="ag-theme">
            <button className="ag-icon-btn" aria-label="Change colours" title="Change colours" aria-expanded={themeOpen} onClick={() => setThemeOpen((open) => !open)}>
              <Palette size={19} />
            </button>
            {themeOpen && (
              <ul className="ag-theme-list">
                {THEMES.map((option) => (
                  <li key={option.id}>
                    <button
                      className={theme === option.id ? "ag-on" : ""}
                      onClick={() => {
                        setTheme(option.id);
                        setThemeOpen(false);
                      }}
                    >
                      <i className={`ag-swatch ag-swatch-${option.id}`} />
                      {option.label}
                      {theme === option.id && <Check size={15} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            className="ag-icon-btn"
            title="Restore the sample data"
            aria-label="Restore the sample data"
            onClick={() =>
              setConfirm({
                title: "Restore the sample data?",
                body: "Everything you have entered in this browser is replaced by the sample shop.",
                action: "Restore",
                danger: true,
                onConfirm: () => {
                  api.resetToSample();
                  notify("Sample data restored");
                },
              })
            }
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </aside>
      {menuOpen && <button className="ag-scrim ag-scrim-menu" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className="ag-main">
        <header className="ag-top">
          <button className="ag-icon-btn ag-menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu size={20} />
          </button>
          <b className="ag-top-title">{active.title}</b>
          <span className="ag-grow" />
          {activeId !== "new-sale" && (
            <button className="ag-btn ag-btn-primary ag-top-sale" onClick={() => go("new-sale")}>
              <ShoppingCart size={17} /> <span>New sale</span>
            </button>
          )}
        </header>

        <main className="ag-content" ref={mainRef}>
          {!api.ready ? (
            <p className="ag-loading">Opening your shop…</p>
          ) : (
            <div className="ag-page" key={`${active.id}-${visit}`}>
              {Custom ? (
                <Custom {...page} />
              ) : active.kind === "form" ? (
                <FormScreen module={active} api={api} notify={notify} />
              ) : (
                <RecordsScreen module={active} {...page} />
              )}
            </div>
          )}
        </main>
      </div>

      {sheet && sheet.length > 0 && <PrintSheet docs={sheet} store={api.store} notify={notify} onClose={() => setSheet(null)} />}

      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="ag-btn ag-btn-soft" onClick={() => setConfirm(null)}>
                Keep it
              </button>
              <button
                className={`ag-btn ${confirm.danger ? "ag-btn-danger" : "ag-btn-primary"}`}
                onClick={() => {
                  confirm.onConfirm();
                  setConfirm(null);
                }}
              >
                {confirm.action}
              </button>
            </>
          }
        >
          <p>{confirm.body}</p>
        </Modal>
      )}

      {history && (
        <Modal title={`History of ${history.title}`} onClose={() => setHistory(null)}>
          {entries.length === 0 ? (
            <p>Nothing has been recorded for this entry yet. Changes made from now on are listed here.</p>
          ) : (
            <ol className="ag-history">
              {[...entries].reverse().map((entry, index) => (
                <li key={index}>
                  <b>{entry.what}</b>
                  <small>{stampText(entry.at)}</small>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}

      {toast && (
        <div className="ag-toast" role="status">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
