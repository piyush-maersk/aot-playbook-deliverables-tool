// Module registry (blueprint 10.2). Adding a module = add an entry + its views; routes and the
// project landing cards are generated from this list.
export interface ModuleDef {
  key: "milestonePlan" | "workPackages" | "checklists";
  label: string;
  path: string;
  idPrefix: string;
  statuses: readonly string[];
  description: string;
  available: boolean;
}

export const MODULES: ModuleDef[] = [
  {
    key: "milestonePlan", label: "Milestone Plan", path: "milestones", idPrefix: "MP",
    statuses: ["0%", "25%", "50%", "75%", "100%"],
    description: "Activities per phase and milestone (MS0 – MS6), owners, dates and status – based on the AOT Milestone Plan workbook.",
    available: true,
  },
  {
    key: "workPackages", label: "Work Packages", path: "work-packages", idPrefix: "WP",
    statuses: ["Draft", "In Review", "Approved", "Issued"],
    description: "Governed 4-page work packages (Project Overview, Requirements, Deliverables, Appendix) built from templates T1 – T8.",
    available: true,
  },
  {
    key: "checklists", label: "Checklists", path: "checklists", idPrefix: "CL",
    statuses: ["Open", "In Progress", "Complete"],
    description: "Checklist templates and items are not defined yet. This module is reserved for a later release.",
    available: false,
  },
];
