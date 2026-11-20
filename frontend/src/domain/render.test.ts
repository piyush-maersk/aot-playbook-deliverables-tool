import { describe, expect, it } from "vitest";
import libJson from "../../../backend/app/template_library/work_package_templates.json";
import { newWorkPackage } from "./factory";
import { buildAppendix, buildRequirements, buildScope, fileName, remapAppendixRefs, TO_BE_PROVIDED } from "./render";
import type { TemplateLibrary } from "./templates";
import type { Overview, ProjectDetails } from "./types";

const lib = libJson as unknown as TemplateLibrary;
const tpl = (code: string) => lib.templates.find((t) => t.code === code)!;
const overview = { projectDetails: {}, businessMilestones: {}, engineeringMilestones: {}, floorLayoutDocumentId: "", projectContext: "" } as unknown as Overview;

describe("work package rendering (master prompt B3–B11)", () => {
  it("renumbers requirements after EXCLUDE and appends TAILOR sentences", () => {
    const wp = newWorkPackage(lib, { id: "WP-01", mode: "SEPARATE", codes: ["T1"] });
    wp.requirements.find((r) => r.originalId === "FR-02")!.action = "EXCLUDE";
    const fr03 = wp.requirements.find((r) => r.originalId === "FR-03")!;
    fr03.action = "TAILOR";
    fr03.tailoring = "the site connects to the SOTI cloud.";
    const rows = buildRequirements(wp, lib, "FR");
    expect(rows.map((r) => r.id)).toEqual(["FR-01", "FR-02", "FR-03", "FR-04", "FR-05", "FR-06", "FR-07"]);
    expect(rows[1]!.text).toMatch(/For this project, the site connects to the SOTI cloud\.$/);
  });

  it("uses template codes and sub-headers in COMBINED mode", () => {
    const wp = newWorkPackage(lib, { id: "WP-01", mode: "COMBINED", codes: ["T4", "T1"], combinedTitle: "IT-OT Automation" });
    const rows = buildRequirements(wp, lib, "TR");
    expect(rows[0]).toEqual({ id: "", text: "WAN & Perimeter", header: true });
    expect(rows[1]!.id).toBe("TR-WAN-01");
    expect(rows.find((r) => r.header && r.text === "LAN Active Network")).toBeTruthy();
    const standards = buildScope(wp, lib).find((r) => r.label === "Standards")!;
    expect(standards.lines).toEqual([lib.combinedStandards]);
  });

  it("rewrites template appendix letters to canonical letters", () => {
    expect(remapAppendixRefs("as defined in Appendix A.", tpl("T1"))).toBe("as defined in Appendix C.");
    expect(remapAppendixRefs("(Appx B)", tpl("T4"))).toBe("(Appx A)");
    expect(remapAppendixRefs("see Appendices A and B.", tpl("T6"))).toBe("see Appendices A and B.");
    expect(remapAppendixRefs("per Appendices A and C.", tpl("T6"))).toBe("per Appendices A and F.");
  });

  it("builds the file name per B3", () => {
    const wp = newWorkPackage(lib, { id: "WP-01", mode: "SEPARATE", codes: ["T1"] });
    const d = { customerName: "On Running", fbmId: "4661" } as ProjectDetails;
    expect(fileName(wp, lib, d)).toBe("On_Running_4661_WAN_Perimeter_Work_Package_v1.0.docx");
    expect(fileName(wp, lib, {} as ProjectDetails)).toBe("TBC_TBC_WAN_Perimeter_Work_Package_v1.0.docx");
  });

  it("marks Appendix H as referenced for T7 TR-08 without inventing scope text", () => {
    const wp = newWorkPackage(lib, { id: "WP-01", mode: "SEPARATE", codes: ["T7"] });
    const h = buildAppendix(wp, lib, overview, []).find((a) => a.letter === "H")!;
    expect(h.scope).toBe("");
    expect(h.placeholder).toBe(TO_BE_PROVIDED);
  });
});
