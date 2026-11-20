import { Fragment, type ReactNode } from "react";
import { useDocuments } from "../../../api/queries";
import { Badge, Card } from "../../../components/ui";
import {
  buildAppendix, buildRequirements, buildScope, DETAIL_ROWS, documentTitle, ENGINEERING_GROUPS, fileName, fmtDate, orTbc,
  remainingPlaceholders, requirementDecisions,
} from "../../../domain/render";
import type { TemplateLibrary } from "../../../domain/templates";
import { useLayoutUrl } from "../../overview/useLayoutUrl";
import { useWorkPackage } from "../useWorkPackage";

const Ph = ({ v }: { v: string }) => (/^\[.*\]$/.test(v) ? <span className="placeholder">{v}</span> : <>{v}</>);

function DocPage({ children, page }: { children: ReactNode; page: number }) {
  return (
    <div className="doc-page">
      <div className="doc-head"><img src="/maersk-logo.png" alt="Maersk" /><span className="muted">Page {page} of 4</span></div>
      {children}
      <footer><span>Classification: Internal</span><span>Page {page} of 4</span></footer>
    </div>
  );
}

export function PreviewStep({ wpId, projectId, lib }: { wpId: string; projectId: string; lib: TemplateLibrary }) {
  const { wp, doc } = useWorkPackage(wpId);
  const docs = useDocuments(projectId);
  const overview = doc?.artefacts.overview;
  const layoutUrl = useLayoutUrl(projectId, overview?.floorLayoutDocumentId ?? "");
  if (!wp || !overview) return null;
  const d = overview.projectDetails;
  const bm = overview.businessMilestones;
  const em = overview.engineeringMilestones;
  const gaps = remainingPlaceholders(wp, lib, overview, docs.data ?? []);
  const decisions = requirementDecisions(wp, lib);
  const appendix = buildAppendix(wp, lib, overview, docs.data ?? []);
  // B7: the Page 1 engineering table shows MS1.1 – MS5; MS6 appears only in the Deliverables table.
  const groups = ENGINEERING_GROUPS.map((g) => ({ ...g, items: g.items.filter(([k]) => k !== "MS6") }));

  return (
    <>
      <Card title="Generation check" actions={<Badge tone={gaps.length ? "amber" : "green"}>{gaps.length} placeholders remaining</Badge>}>
        <div className="muted" style={{ fontSize: "0.85rem" }}>File name: <strong>{fileName(wp, lib, d)}</strong> · Template library {wp.templateLibraryVersion}</div>
        <div className="grid cols-2 mt">
          <div>
            <h4>Remaining placeholders</h4>
            {gaps.length === 0 ? <div className="muted">None – all template fields are filled.</div> : (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", maxHeight: 260, overflow: "auto" }}>
                {gaps.map((g, i) => <li key={i}><strong>{g.section}:</strong> {g.item} <span className="placeholder" style={{ color: "#b06b00" }}>{g.value}</span></li>)}
              </ul>
            )}
          </div>
          <div>
            <h4>Requirement decisions</h4>
            <div className="table-wrap" style={{ maxHeight: 260 }}>
              <table className="data">
                <thead><tr><th>Final ID</th><th>Original ID</th><th>Action</th><th>Source</th></tr></thead>
                <tbody>
                  {decisions.filter((r) => r.action !== "KEEP").map((r, i) => <tr key={i}><td>{r.finalId}</td><td>{r.template} {r.originalId}</td><td>{r.action}</td><td>{r.source}</td></tr>)}
                  {decisions.every((r) => r.action === "KEEP") && <tr><td colSpan={4} className="muted">All requirements KEEP (template text verbatim).</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      <DocPage page={1}>
        <h1 className="doc-title">{documentTitle(wp, lib)}</h1>
        <h3>Document Control</h3>
        <table><tbody><tr>
          <td className="label">Version No.</td><td><Ph v={orTbc(wp.documentControl.version)} /></td>
          <td className="label">WP Issue Date</td><td><Ph v={fmtDate(wp.documentControl.issueDate)} /></td>
          <td className="label">AOT Engineer Owner</td><td><Ph v={orTbc(wp.documentControl.aotEngineerOwner)} /></td>
        </tr></tbody></table>
        <h3>Project Overview & Warehouse Details</h3>
        {layoutUrl ? <img className="layout-img" src={layoutUrl} alt="Floor layout" /> : <p><span className="placeholder">[Insert floor layout]</span></p>}
        <table>
          <tbody>
            {DETAIL_ROWS.map((row, i) => (
              <tr key={i}>{row.map(([k, label]) => <Fragment key={k}><td className="label">{label}</td><td><Ph v={orTbc(d[k])} /></td></Fragment>)}</tr>
            ))}
            <tr><td className="label">Additional Comments</td><td colSpan={5}>{d.additionalComments}</td></tr>
          </tbody>
        </table>
        <h3>Project Timelines</h3>
        <p><strong>Business Milestones:</strong></p>
        <table><tbody><tr>
          <td>LOI/ Award: <Ph v={fmtDate(bm.loiAward)} /></td><td>Site access: <Ph v={fmtDate(bm.siteAccess)} /></td>
          <td>GLD: <Ph v={fmtDate(bm.gld)} /></td><td>BAU: <Ph v={fmtDate(bm.bau)} /></td>
        </tr></tbody></table>
        <p><strong>Engineering Milestones:</strong></p>
        <table>
          <thead><tr>{groups.map((g) => <th key={g.label} colSpan={2}>{g.label}</th>)}</tr></thead>
          <tbody><tr>
            {groups.map((g) => (
              <Fragment key={g.label}>
                <td>{g.items.map(([, l]) => <div key={l}>{l}</div>)}</td>
                <td>{g.items.map(([k]) => <div key={k}><Ph v={fmtDate(em[k])} /></div>)}</td>
              </Fragment>
            ))}
          </tr></tbody>
        </table>
        <h2>1. Scope of Work</h2>
        <table>
          <thead><tr><th style={{ width: "20%" }}>Classification</th><th>Description</th></tr></thead>
          <tbody>{buildScope(wp, lib).map((r) => <tr key={r.label}><td className="label">{r.label}</td><td>{r.lines.join("\n")}</td></tr>)}</tbody>
        </table>
      </DocPage>

      <DocPage page={2}>
        <h2>2. Requirements</h2>
        {(["FR", "TR"] as const).map((kind) => (
          <Fragment key={kind}>
            <h3>{kind === "FR" ? "2.1 Functional Requirements" : "2.2 Technical Requirements"}</h3>
            <table>
              <thead><tr><th style={{ width: "15%" }}>ID</th><th>Requirement</th></tr></thead>
              <tbody>
                {buildRequirements(wp, lib, kind).map((r, i) => r.header
                  ? <tr key={i} className="sub"><td colSpan={2}>{r.text}</td></tr>
                  : <tr key={i}><td className="label">{r.id}</td><td>{r.text}</td></tr>)}
              </tbody>
            </table>
          </Fragment>
        ))}
      </DocPage>

      <DocPage page={3}>
        <h2>3. Deliverables</h2>
        <table>
          <thead><tr><th style={{ width: "12%" }}>Milestone</th><th style={{ width: "20%" }}>Phase</th><th style={{ width: "53%" }}>Task / Deliverables</th><th style={{ width: "15%" }}>Deadline</th></tr></thead>
          <tbody>
            {lib.deliverables.map((row) => (
              <tr key={row.milestoneKey}>
                <td>{row.milestone}</td><td>{row.phase}</td><td>{row.items.map((i) => `• ${i}`).join("\n")}</td><td><Ph v={fmtDate(em[row.milestoneKey])} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocPage>

      <DocPage page={4}>
        <h2>4. Appendix</h2>
        {appendix.map((a) => (
          <Fragment key={a.letter}>
            <h3>{a.number} Appendix {a.letter}: {a.title}</h3>
            {a.scope && <p><em>Scope: {a.scope}</em></p>}
            {a.letter === "A" && wp.bom.length > 0 ? (
              <>
                <table>
                  <thead><tr><th style={{ width: "6%" }}>#</th><th style={{ width: "22%" }}>Category</th><th style={{ width: "34%" }}>Hardware Name</th><th style={{ width: "26%" }}>Model / Part Number</th><th style={{ width: "12%" }}>Quantity</th></tr></thead>
                  <tbody>{wp.bom.map((b, i) => <tr key={b.id}><td>{i + 1}</td><td>{b.category || "–"}</td><td>{b.hardwareName}</td><td>{b.model || "–"}</td><td>{b.quantity}</td></tr>)}</tbody>
                </table>
                {wp.stationDistribution.length > 0 && (
                  <table>
                    <thead><tr><th>Area / Station Type</th><th>Quantity</th></tr></thead>
                    <tbody>{wp.stationDistribution.map((s, i) => <tr key={i}><td>{s.area}</td><td>{s.quantity}</td></tr>)}</tbody>
                  </table>
                )}
                {wp.appendixContent.A && <p style={{ whiteSpace: "pre-wrap" }}>{wp.appendixContent.A}</p>}
              </>
            ) : a.placeholder ? (
              <p><Ph v={a.placeholder} /></p>
            ) : (
              a.body.map((line, i) => <p key={i} style={{ whiteSpace: "pre-wrap", margin: "0 0 4px" }}>{line}</p>)
            )}
          </Fragment>
        ))}
      </DocPage>
    </>
  );
}
