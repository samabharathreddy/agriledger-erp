import { useMemo, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, X, Percent, Layers } from "lucide-react";
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

const makeId = () => `tax-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const asParts = (rows: Row[]): TaxPart[] => rows.map((r) => ({ id: String(r.id), name: String(r.name ?? ""), rate: Number(r.rate ?? 0), type: String(r.type ?? "Other") }));
const asGroups = (rows: Row[]): TaxGroup[] => rows.map((r) => ({ id: String(r.id), name: String(r.name ?? ""), components: Array.isArray(r.components) ? r.components.map(String) : [] }));

export function TaxSettings({ api, go, notify, ui }: ScreenProps) {
  const { store } = api;
  const [partDraft, setPartDraft] = useState<TaxPart | null>(null);
  const [groupDraft, setGroupDraft] = useState<TaxGroup | null>(null);
  const [taxDrawer, setTaxDrawer] = useState<"rates" | "groups" | null>(null);
  const settings: Row = store["tax-settings"]?.[0] ?? { id: "tax-settings-main", enableGst: true, enableHsn: true, reverseCharge: false, placeOfSupply: true, composite: false, tcs: false };
  const parts = useMemo(() => store["tax-components"]?.length ? asParts(store["tax-components"]) : defaultParts, [store]);
  const groups = useMemo(() => {
    if (store["tax-groups"]?.length) return asGroups(store["tax-groups"]);
    return [0, 0.25, 3, 5, 12, 18].map((rate) => {
      const components = parts.filter((p) => (p.type === "SGST" || p.type === "CGST") && p.rate === rate / 2);
      return { id: `default-group-${rate}`, name: `GST@${rate}%`, components: components.map((p) => p.id) };
    });
  }, [store, parts]);

  const persistRows = (module: string, rows: Array<TaxPart | TaxGroup>) => {
    api.replace(module, rows.map((row) => ({ ...row, id: row.id } as Row)));
  };
  const saveSettings = () => {
    const row: Row = { ...settings, id: "tax-settings-main" };
    if (store["tax-settings"]?.length) api.update("tax-settings", row, "GST settings updated");
    else api.create("tax-settings", row);
    notify("GST settings saved");
  };
  const savePart = () => {
    if (!partDraft?.name.trim() || !Number.isFinite(partDraft.rate) || partDraft.rate < 0) {
      notify("Enter a valid tax name and rate");
      return;
    }
    persistRows("tax-components", [...parts.filter((p) => p.id !== partDraft.id), partDraft]);
    setPartDraft(null);
    notify("Tax rate saved");
  };
  const deletePart = (part: TaxPart) => ui.confirm({
    title: "Delete tax rate?",
    body: `Delete ${part.name}? Existing bills will not be changed.`,
    action: "Delete",
    danger: true,
    onConfirm: () => {
      persistRows("tax-components", parts.filter((p) => p.id !== part.id));
      persistRows("tax-groups", groups.map(g => ({ ...g, components: g.components.filter(id => id !== part.id) })));
      notify("Tax rate deleted");
    },
  });
  const saveGroup = () => {
    if (!groupDraft?.name.trim() || !groupDraft.components.length) {
      notify("Enter a group name and select at least one tax");
      return;
    }
    persistRows("tax-groups", [...groups.filter((g) => g.id !== groupDraft.id), groupDraft]);
    setGroupDraft(null);
    notify("Tax group saved");
  };
  const deleteGroup = (group: TaxGroup) => ui.confirm({
    title: "Delete tax group?",
    body: `Delete ${group.name}? Existing bills will not be changed.`,
    action: "Delete",
    danger: true,
    onConfirm: () => {
      persistRows("tax-groups", groups.filter(g => g.id !== group.id));
      notify("Tax group deleted");
    },
  });
  const toggleSetting = (key: string) => {
    const next = { ...settings, [key]: !Boolean(settings[key]) } as Row;
    if (store["tax-settings"]?.length) api.update("tax-settings", next, "GST setting changed");
    else api.create("tax-settings", next);
  };

  return (
    <div className="ag-tax-page">
      <header className="ag-tax-head">
        <div><h1>Taxes &amp; GST</h1><p>Configure GST registration, tax defaults and invoice tax behaviour.</p></div>
        <div className="ag-tax-head-actions"><button type="button" className="ag-btn ag-btn-primary" onClick={saveSettings}>Save settings</button><button type="button" className="ag-icon-btn" aria-label="Close" onClick={() => go("gst")}><X size={18}/></button></div>
      </header>

      <div className="ag-tax-main-layout">
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

        <section className="ag-tax-list-home">
          <div className="ag-tax-list-heading"><div><h2>Tax List</h2><p>Manage tax rates and combined tax groups</p></div><span>{parts.length} rates · {groups.length} groups</span></div>
          <button type="button" className="ag-tax-launch-row ag-tax-launch-rates" onClick={() => setTaxDrawer("rates")}>
            <span className="ag-tax-launch-icon"><Percent size={20}/></span><span><b>Tax Rates</b><small>Manage IGST, CGST, SGST and other tax rates</small></span><strong>Open <span>›</span></strong>
          </button>
          <button type="button" className="ag-tax-launch-row ag-tax-launch-groups" onClick={() => setTaxDrawer("groups")}>
            <span className="ag-tax-launch-icon"><Layers size={20}/></span><span><b>Tax Groups</b><small>Combine tax components into GST groups</small></span><strong>Open <span>›</span></strong>
          </button>
        </section>
      </div>

      {taxDrawer && <div className="ag-tax-drawer-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setTaxDrawer(null); }}>
        <aside className="ag-tax-drawer" role="dialog" aria-modal="true" aria-label={taxDrawer === "rates" ? "Tax Rates" : "Tax Groups"}>
          <header className="ag-tax-drawer-head">
            <div><h2>{taxDrawer === "rates" ? "Tax Rates" : "Tax Groups"}</h2><p>{taxDrawer === "rates" ? "Manage IGST, CGST, SGST and other tax rates" : "Manage combined state tax groups"}</p></div>
            <button type="button" className="ag-icon-btn" aria-label="Close panel" onClick={() => setTaxDrawer(null)}><X size={19}/></button>
          </header>
          <div className="ag-tax-drawer-tabs">
            <button type="button" className={taxDrawer === "rates" ? "ag-on" : ""} onClick={() => setTaxDrawer("rates")}>Tax Rates</button>
            <button type="button" className={taxDrawer === "groups" ? "ag-on" : ""} onClick={() => setTaxDrawer("groups")}>Tax Groups</button>
          </div>
          {taxDrawer === "rates" ? <>
            <div className="ag-tax-drawer-toolbar"><span>{parts.length} tax components</span><button type="button" className="ag-tax-add" onClick={() => setPartDraft({id:makeId(),name:"",rate:0,type:"Other"})}><Plus size={16}/> Add Rate</button></div>
            <div className="ag-tax-drawer-table">
              <div className="ag-tax-table-head ag-tax-rate-columns"><b>Tax Name</b><b>Tax Type</b><b>Rate</b><span/></div>
              {parts.map(part => <div className="ag-tax-rate-row ag-tax-rate-columns" key={part.id}>
                <b className="ag-tax-rate-name">{part.name}</b><span className="ag-tax-type-pill">{part.type}</span><b className="ag-tax-rate-value">{part.rate}%</b>
                <div className="ag-tax-row-actions"><button type="button" aria-label={`Edit ${part.name}`} onClick={() => setPartDraft(part)}><Pencil size={15}/></button><button type="button" aria-label={`Delete ${part.name}`} onClick={() => deletePart(part)}><Trash2 size={15}/></button></div>
              </div>)}
            </div>
          </> : <>
            <div className="ag-tax-drawer-toolbar"><span>{groups.length} tax groups</span><button type="button" className="ag-tax-add ag-tax-add-purple" onClick={() => setGroupDraft({id:makeId(),name:"",components:[]})}><Plus size={16}/> Add Group</button></div>
            <div className="ag-tax-drawer-table">
              <div className="ag-tax-table-head ag-tax-group-columns"><b>Group Name</b><b>Components</b><span/></div>
              {groups.map(group => <div className="ag-tax-group-row ag-tax-group-columns" key={group.id}>
                <b>{group.name}</b><div className="ag-tax-component-preview">{group.components.map(key => parts.find(p => p.id === key)).filter(Boolean).map(p => <small key={p!.id}>{p!.name}</small>)}</div>
                <div className="ag-tax-row-actions"><button type="button" aria-label={`Edit ${group.name}`} onClick={() => setGroupDraft(group)}><Pencil size={15}/></button><button type="button" aria-label={`Delete ${group.name}`} onClick={() => deleteGroup(group)}><Trash2 size={15}/></button></div>
              </div>)}
            </div>
          </>}
        </aside>
      </div>}

      {partDraft && <div className="ag-tax-modal-backdrop" role="presentation" onMouseDown={e => {if(e.target===e.currentTarget)setPartDraft(null);}}>
        <section className="ag-tax-modal" role="dialog" aria-modal="true" aria-labelledby="ag-tax-rate-title">
          <button type="button" className="ag-tax-modal-close" onClick={() => setPartDraft(null)} aria-label="Close"><X/></button><h2 id="ag-tax-rate-title">{parts.some(p=>p.id===partDraft.id)?"Edit Tax Rate":"Add Tax Rate"}</h2>
          <label className="ag-tax-field-label">Tax Name<input autoFocus placeholder="e.g. IGST@18%" value={partDraft.name} onChange={e=>setPartDraft({...partDraft,name:e.target.value})}/></label>
          <div className="ag-tax-form-row"><label className="ag-tax-field-label">Rate (%)<input type="number" min="0" step="0.001" placeholder="Rate" value={partDraft.rate} onChange={e=>setPartDraft({...partDraft,rate:Number(e.target.value)})}/></label><label className="ag-tax-field-label">Tax Type<select value={partDraft.type} onChange={e=>setPartDraft({...partDraft,type:e.target.value})}><option>Other</option><option>SGST</option><option>CGST</option><option>IGST</option></select></label></div>
          <footer><button type="button" className="ag-btn ag-btn-soft" onClick={()=>setPartDraft(null)}>Cancel</button><button type="button" className="ag-btn ag-btn-primary" onClick={savePart}>Save</button></footer>
        </section>
      </div>}

      {groupDraft && <div className="ag-tax-modal-backdrop" role="presentation" onMouseDown={e => {if(e.target===e.currentTarget)setGroupDraft(null);}}>
        <section className="ag-tax-modal ag-tax-group-modal" role="dialog" aria-modal="true" aria-labelledby="ag-tax-group-title">
          <button type="button" className="ag-tax-modal-close" onClick={()=>setGroupDraft(null)} aria-label="Close"><X/></button><h2 id="ag-tax-group-title">{groups.some(g=>g.id===groupDraft.id)?"Edit Tax Group":"Add Tax Group"}</h2>
          <label className="ag-tax-field-label">Group Name<input autoFocus placeholder="e.g. GST@18%" value={groupDraft.name} onChange={e=>setGroupDraft({...groupDraft,name:e.target.value})}/></label>
          <b className="ag-tax-select-title">Select Taxes</b>
          <div className="ag-tax-check-list">{parts.map(part=><label key={part.id}><span>{part.name}</span><small>{part.rate}%</small><input type="checkbox" checked={groupDraft.components.includes(part.id)} onChange={e=>setGroupDraft({...groupDraft,components:e.target.checked?[...groupDraft.components,part.id]:groupDraft.components.filter(x=>x!==part.id)})}/></label>)}</div>
          <footer><button type="button" className="ag-btn ag-btn-soft" onClick={()=>setGroupDraft(null)}>Cancel</button><button type="button" className="ag-btn ag-btn-primary" onClick={saveGroup}>Save</button></footer>
        </section>
      </div>}
    </div>
  );
}
