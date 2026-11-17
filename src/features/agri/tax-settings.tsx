import { useMemo, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import type { ScreenProps } from "./shell";
import type { Row } from "./types";

type TaxPart = { id: string; name: string; rate: number; type: string };
type TaxGroup = { id: string; name: string; components: string[] };

const defaultParts: TaxPart[] = [
  { id: "igst-0", name: "IGST@0%", rate: 0, type: "IGST" },
  { id: "sgst-0", name: "SGST@0%", rate: 0, type: "SGST" },
  { id: "cgst-0", name: "CGST@0%", rate: 0, type: "CGST" },
  { id: "igst-025", name: "IGST@0.25%", rate: 0.25, type: "IGST" },
  { id: "sgst-0125", name: "SGST@0.125%", rate: 0.125, type: "SGST" },
  { id: "cgst-0125", name: "CGST@0.125%", rate: 0.125, type: "CGST" },
  { id: "igst-3", name: "IGST@3%", rate: 3, type: "IGST" },
  { id: "sgst-15", name: "SGST@1.5%", rate: 1.5, type: "SGST" },
  { id: "cgst-15", name: "CGST@1.5%", rate: 1.5, type: "CGST" },
  { id: "igst-5", name: "IGST@5%", rate: 5, type: "IGST" },
  { id: "sgst-25", name: "SGST@2.5%", rate: 2.5, type: "SGST" },
  { id: "cgst-25", name: "CGST@2.5%", rate: 2.5, type: "CGST" },
  { id: "igst-12", name: "IGST@12%", rate: 12, type: "IGST" },
  { id: "sgst-6", name: "SGST@6%", rate: 6, type: "SGST" },
  { id: "cgst-6", name: "CGST@6%", rate: 6, type: "CGST" },
  { id: "igst-18", name: "IGST@18%", rate: 18, type: "IGST" },
  { id: "sgst-9", name: "SGST@9%", rate: 9, type: "SGST" },
  { id: "cgst-9", name: "CGST@9%", rate: 9, type: "CGST" },
];

const id = () => `tax-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const asParts = (rows: Row[]): TaxPart[] => rows.map((r) => ({ id: String(r.id), name: String(r.name ?? ""), rate: Number(r.rate ?? 0), type: String(r.type ?? "Other") }));
const asGroups = (rows: Row[]): TaxGroup[] => rows.map((r) => ({ id: String(r.id), name: String(r.name ?? ""), components: Array.isArray(r.components) ? r.components.map(String) : [] }));

export function TaxSettings({ api, notify }: ScreenProps) {
  const { store } = api;
  const [partDraft, setPartDraft] = useState<TaxPart | null>(null);
  const [groupDraft, setGroupDraft] = useState<TaxGroup | null>(null);
  const [saved, setSaved] = useState(false);
  const settings: Row = store["tax-settings"]?.[0] ?? { id: "tax-settings-main", enableGst: true, enableHsn: true, reverseCharge: false, placeOfSupply: true, composite: false, tcs: false };
  const parts = useMemo(() => store["tax-components"]?.length ? asParts(store["tax-components"]) : defaultParts, [store]);
  const groups = useMemo(() => {
    if (store["tax-groups"]?.length) return asGroups(store["tax-groups"]);
    const rates = [0, 0.25, 3, 5, 12, 18];
    return rates.map((rate) => {
      const sg = parts.filter((p) => p.type === "SGST" && p.rate === rate / 2);
      const cg = parts.filter((p) => p.type === "CGST" && p.rate === rate / 2);
      return { id: `default-group-${rate}`, name: `GST@${rate}%`, components: [...sg, ...cg].map((p) => p.id) };
    });
  }, [store, parts]);

  const persistRows = (module: string, rows: Array<TaxPart | TaxGroup>) => {
    const current = store[module] ?? [];
    rows.forEach((row) => {
      const savedRow: Row = { ...row, id: row.id };
      if (current.some((r) => r.id === row.id)) api.update(module, savedRow, "Tax configuration updated");
      else api.create(module, savedRow);
    });
    current.filter((r) => !rows.some((row) => row.id === r.id)).forEach((r) => api.remove(module, r.id));
  };

  const saveSettings = () => {
    const row: Row = { ...settings, id: "tax-settings-main" };
    if (store["tax-settings"]?.length) api.update("tax-settings", row, "GST settings updated");
    else api.create("tax-settings", row);
    setSaved(true);
    notify("GST settings saved");
  };

  const savePart = () => {
    if (!partDraft?.name.trim() || !Number.isFinite(partDraft.rate) || partDraft.rate < 0) return;
    const next = [...parts.filter((p) => p.id !== partDraft.id), partDraft];
    persistRows("tax-components", next);
    setPartDraft(null);
    notify("Tax rate saved");
  };
  const saveGroup = () => {
    if (!groupDraft?.name.trim() || !groupDraft.components.length) return;
    const next = [...groups.filter((g) => g.id !== groupDraft.id), groupDraft];
    persistRows("tax-groups", next);
    setGroupDraft(null);
    notify("Tax group saved");
  };
  const toggleSetting = (key: string) => {
    const next = { ...settings, [key]: !Boolean(settings[key]) } as Row;
    if (store["tax-settings"]?.length) api.update("tax-settings", next, "GST setting changed");
    else api.create("tax-settings", next);
  };

  return (
    <div className="ag-tax-page">
      <header className="ag-tax-head">
        <div><h1>Taxes &amp; GST</h1><p>Configure GST registration, tax defaults and invoice tax behaviour.</p></div>
        <div className="ag-tax-head-actions"><button className="ag-btn ag-btn-primary" onClick={saveSettings}>Save settings</button><button className="ag-icon-btn" aria-label="Close tax settings" onClick={() => go("gst")}><X size={18}/></button></div>
      </header>

      <div className="ag-tax-grid">
        <section className="ag-tax-panel ag-tax-panel-settings">
          <header><span className="ag-tax-icon"><ShieldCheck size={20}/></span><div><h2>GST Settings</h2><p>Control tax behaviour for your shop</p></div></header>
          <div className="ag-tax-options">
            {[
              ["enableGst", "Enable GST", "Apply GST to sales and purchases"],
              ["enableHsn", "Enable HSN/SAC Code", "Show HSN/SAC details on items and invoices"],
              ["reverseCharge", "Reverse Charge", "Enable reverse charge transactions"],
              ["placeOfSupply", "Enable Place of Supply", "Use state-wise tax calculation"],
              ["composite", "Composite Scheme", "Use composition scheme settings"],
              ["tcs", "Enable TCS", "Apply tax collected at source where applicable"],
            ].map(([key, title, note]) => <label className="ag-tax-toggle" key={key}>
              <input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggleSetting(key)}/>
              <span><b>{title}</b><small>{note}</small></span><i title={note}>ⓘ</i>
            </label>)}
          </div>
        </section>

        <section className="ag-tax-panel ag-tax-panel-rates">
          <header><span className="ag-tax-icon"><b>%</b></span><div><h2>Tax Rates</h2><p>Manage IGST, CGST and SGST rates</p></div><button className="ag-tax-add" onClick={() => setPartDraft({id:id(),name:"",rate:0,type:"Other"})}><Plus size={16}/> Add Rate</button></header>
          <div className="ag-tax-table-head"><b>Tax Rate</b><b>Components</b><b>Rate</b><span/></div>
          <div className="ag-tax-list">
            {groups.map((group) => {
              const components = group.components.map((key) => parts.find((p) => p.id === key)).filter(Boolean) as TaxPart[];
              const total = components.reduce((n,p) => n + p.rate, 0);
              return <div className="ag-tax-rate-row" key={group.id}>
                <div><b className="ag-tax-rate-name">{group.name.replace("GST@", "IGST@")}</b><small>{components.map(p => p.name).join(" + ") || "No components selected"}</small></div>
                <div className="ag-tax-component-preview">{components.map(p => <small key={p.id}>{p.name}</small>)}</div>
                <b className="ag-tax-rate-value">{total}%</b>
                <div className="ag-tax-row-actions"><button aria-label="Edit tax group" onClick={() => setGroupDraft(group)}><Pencil size={15}/></button><button aria-label="Delete tax group" onClick={() => { if(window.confirm("Delete this tax group?")) persistRows("tax-groups", groups.filter(g => g.id !== group.id)); }}><Trash2 size={15}/></button></div>
              </div>;
            })}
          </div>
        </section>

        <section className="ag-tax-panel ag-tax-panel-groups">
          <header><span className="ag-tax-icon"><span>⌖</span></span><div><h2>Tax Group</h2><p>Combined state tax groups</p></div><button className="ag-tax-add" onClick={() => setGroupDraft({id:id(),name:"",components:[]})}><Plus size={16}/> Add Group</button></header>
          <div className="ag-tax-table-head"><b>Group Name</b><b>Components</b><span/></div>
          <div className="ag-tax-list">
            {groups.map(group => <div className="ag-tax-group-row" key={group.id}>
              <b>{group.name}</b><div className="ag-tax-component-preview">{group.components.map(key => parts.find(p => p.id === key)).filter(Boolean).map(p => <small key={p!.id}>{p!.name}</small>)}</div>
              <div className="ag-tax-row-actions"><button aria-label="Edit tax group" onClick={() => setGroupDraft(group)}><Pencil size={15}/></button><button aria-label="Delete tax group" onClick={() => { if(window.confirm("Delete this tax group?")) persistRows("tax-groups", groups.filter(g => g.id !== group.id)); }}><Trash2 size={15}/></button></div>
            </div>)}
          </div>
        </section>
      </div>

      {partDraft && <div className="ag-tax-modal-backdrop" role="presentation" onMouseDown={e => {if(e.target===e.currentTarget)setPartDraft(null);}}>
        <section className="ag-tax-modal" role="dialog" aria-modal="true" aria-labelledby="ag-tax-rate-title">
          <button className="ag-tax-modal-close" onClick={() => setPartDraft(null)} aria-label="Close"><X/></button><h2 id="ag-tax-rate-title">{parts.some(p=>p.id===partDraft.id)?"Edit Tax Rate":"Add Tax Rate"}</h2>
          <input placeholder="Tax Name" value={partDraft.name} onChange={e=>setPartDraft({...partDraft,name:e.target.value})}/>
          <div className="ag-tax-form-row"><input type="number" min="0" step="0.001" placeholder="Rate" value={partDraft.rate} onChange={e=>setPartDraft({...partDraft,rate:Number(e.target.value)})}/><select value={partDraft.type} onChange={e=>setPartDraft({...partDraft,type:e.target.value})}><option>Other</option><option>SGST</option><option>CGST</option><option>IGST</option></select></div>
          <footer><button className="ag-btn ag-btn-soft" onClick={()=>setPartDraft(null)}>Cancel</button><button className="ag-btn ag-btn-primary" onClick={savePart}>Save</button></footer>
        </section>
      </div>}

      {groupDraft && <div className="ag-tax-modal-backdrop" role="presentation" onMouseDown={e => {if(e.target===e.currentTarget)setGroupDraft(null);}}>
        <section className="ag-tax-modal ag-tax-group-modal" role="dialog" aria-modal="true" aria-labelledby="ag-tax-group-title">
          <button className="ag-tax-modal-close" onClick={()=>setGroupDraft(null)} aria-label="Close"><X/></button><h2 id="ag-tax-group-title">{groups.some(g=>g.id===groupDraft.id)?"Edit Tax Group":"Add Tax Group"}</h2>
          <label className="ag-tax-floating-label">Enter Group Name<input autoFocus placeholder="Group name" value={groupDraft.name} onChange={e=>setGroupDraft({...groupDraft,name:e.target.value})}/></label>
          <b className="ag-tax-select-title">Select Taxes</b>
          <div className="ag-tax-check-list">{parts.map(part=><label key={part.id}><span>{part.name}</span><small>{part.rate}%</small><input type="checkbox" checked={groupDraft.components.includes(part.id)} onChange={e=>setGroupDraft({...groupDraft,components:e.target.checked?[...groupDraft.components,part.id]:groupDraft.components.filter(x=>x!==part.id)})}/></label>)}</div>
          <footer><button className="ag-btn ag-btn-soft" onClick={()=>setGroupDraft(null)}>Cancel</button><button className="ag-btn ag-btn-primary" onClick={saveGroup}>Save</button></footer>
        </section>
      </div>}
    </div>
  );
}
