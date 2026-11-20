import { Badge, Card, Field, TextInput } from "../../../components/ui";
import { COMBINED_SCOPE_KEY, emptyScope, syncTemplates } from "../../../domain/factory";
import { TEMPLATE_TYPICAL_USE, type TemplateLibrary } from "../../../domain/templates";
import { useWorkPackage } from "../useWorkPackage";

export function SetupStep({ wpId, lib }: { wpId: string; lib: TemplateLibrary }) {
  const { wp, updateWp, readOnly } = useWorkPackage(wpId);
  if (!wp) return null;

  const toggle = (code: string) => {
    const on = wp.templateCodes.includes(code);
    if (wp.mode === "SEPARATE") {
      if (on) return;
      const decided = wp.requirements.some((r) => r.action !== "KEEP" || r.tailoring);
      if (decided && !confirm("Switching template discards the requirement decisions of the current template. Continue?")) return;
      updateWp((w) => syncTemplates(w, lib, [code]));
      return;
    }
    if (on) {
      const decided = wp.requirements.some((r) => r.templateCode === code && (r.action !== "KEEP" || r.tailoring));
      if (decided && !confirm(`Remove ${code}? Its requirement decisions will be discarded.`)) return;
    }
    updateWp((w) => syncTemplates(w, lib, on ? w.templateCodes.filter((c) => c !== code) : [...w.templateCodes, code]));
  };

  const setMode = (mode: "SEPARATE" | "COMBINED") => {
    if (mode === wp.mode) return;
    if (mode === "SEPARATE" && wp.templateCodes.length > 1) {
      alert("SEPARATE mode holds exactly one template. Remove templates until one is left, or create separate work packages from the list.");
      return;
    }
    updateWp((w) => {
      w.mode = mode;
      if (mode === "COMBINED") w.scope[COMBINED_SCOPE_KEY] ??= emptyScope();
    });
  };

  return (
    <>
      <Card title="A1 · Generation mode">
        <div className="chip-select">
          {(["SEPARATE", "COMBINED"] as const).map((m) => (
            <div key={m} className={`opt ${wp.mode === m ? "on" : ""}`} onClick={() => !readOnly && setMode(m)}>
              <strong>{m}</strong>
              <small>{m === "SEPARATE" ? "One complete work package for one template." : "One work package merging all selected templates; FR/TR IDs use the template code (FR-WAN-01…)."}</small>
            </div>
          ))}
        </div>
        {wp.mode === "COMBINED" && (
          <Field label="COMBINED_TITLE" className="mt" hint="Used in the title and the file name">
            <TextInput value={wp.combinedTitle} disabled={readOnly} onChange={(v) => updateWp((w) => { w.combinedTitle = v; })} />
          </Field>
        )}
      </Card>
      <Card title="A2 · Selected Page-2 templates" actions={<Badge tone="grey">Processed in order T1 → T8</Badge>}>
        <div className="chip-select">
          {lib.templates.map((t) => {
            const on = wp.templateCodes.includes(t.code);
            return (
              <div key={t.code} className={`opt ${on ? "on" : ""}`} onClick={() => !readOnly && toggle(t.code)}>
                <div className="row between"><strong>{t.code} · {t.name}</strong><input type="checkbox" readOnly checked={on} /></div>
                <small>{TEMPLATE_TYPICAL_USE[t.code]}</small>
                <div className="muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>Source: {t.sourceFile}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
