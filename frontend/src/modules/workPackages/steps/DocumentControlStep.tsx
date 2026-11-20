import { Badge, Card, Field, TextInput } from "../../../components/ui";
import { useWorkPackage } from "../useWorkPackage";

export function DocumentControlStep({ wpId }: { wpId: string }) {
  const { wp, updateWp, readOnly } = useWorkPackage(wpId);
  if (!wp) return null;
  const dc = wp.documentControl;
  return (
    <Card title="Document Control" actions={<Badge tone="grey">Page 1 · A3</Badge>}>
      <div className="grid cols-3">
        <Field label="Version No." hint="Increase (1.1, 1.2 …) for each re-issue">
          <TextInput value={dc.version} disabled={readOnly} onChange={(v) => updateWp((w) => { w.documentControl.version = v; })} />
        </Field>
        <Field label="WP Issue Date" hint="Rendered DD/MM/YYYY">
          <input type="date" value={dc.issueDate} disabled={readOnly} onChange={(e) => updateWp((w) => { w.documentControl.issueDate = e.target.value; })} />
        </Field>
        <Field label="AOT Engineer Owner" hint="Full name">
          <TextInput value={dc.aotEngineerOwner} disabled={readOnly} onChange={(v) => updateWp((w) => { w.documentControl.aotEngineerOwner = v; })} />
        </Field>
      </div>
    </Card>
  );
}
