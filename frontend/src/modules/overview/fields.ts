import type { ProjectDetails } from "../../domain/types";

/** Labels are the exact Page 1 template labels; hints/examples come from the SOP (A4 table). */
export const DETAIL_FIELDS: { key: keyof ProjectDetails; label: string; hint: string; example?: string }[] = [
  { key: "customerName", label: "Customer Name", hint: "Customer / brand name", example: "On Running" },
  { key: "region", label: "Region", hint: "Maersk region", example: "APA" },
  { key: "siteAddress", label: "Site Address", hint: "Full warehouse address", example: "Noda, Chiba, Japan" },
  { key: "fbmId", label: "FbM ID", hint: "Project FbM ID", example: "4661" },
  { key: "location", label: "Location", hint: "City, Country", example: "Noda, Japan" },
  { key: "siteId", label: "Site ID", hint: "CL Site ID", example: "JPCBA05" },
  { key: "warehouseArea", label: "Warehouse area", hint: "Area in sqm", example: "32,000 sqm" },
  { key: "contractLength", label: "Contract length", hint: "Contract duration with unit", example: "1 year" },
  { key: "product", label: "Product", hint: "Product category", example: "Apparel / MCL" },
  { key: "operationType", label: "Operation Type", hint: "Type of operation", example: "Warehouse – B2B/B2C fulfilment" },
  { key: "workingHours", label: "Working hours", hint: "Operating hours with unit", example: "9 hours/day" },
  { key: "shifts", label: "Nº Shifts", hint: "Number of shifts", example: "1" },
  { key: "automation", label: "Automation", hint: "YES or NO" },
  { key: "automationType", label: "Automation Type", hint: "Automation in scope", example: "RFID tunnel, RFID table top" },
  { key: "dailyThroughput", label: "Daily Throughput", hint: "Units/orders per day – only if confirmed (never calculated)" },
  { key: "wms", label: "WMS", hint: "Warehouse management system", example: "MWMS" },
  { key: "wcs", label: "WCS", hint: "Warehouse control system", example: "MCS" },
  { key: "otherApp", label: "Other App", hint: "Other applications", example: "SOTI" },
];

export const BUSINESS_FIELDS = [
  { key: "loiAward", label: "LOI/ Award", hint: "Date the customer awarded the project / signed Letter of Intent" },
  { key: "siteAccess", label: "Site access", hint: "Date the team can physically access the site" },
  { key: "gld", label: "GLD", hint: "Go-Live Date" },
  { key: "bau", label: "BAU", hint: "Business as Usual – project handed over to operations" },
] as const;

export const ENGINEERING_FIELDS = [
  { key: "MS1.1", label: "MS1.1 – Prov. Requirements", group: "PLAN" },
  { key: "MS1.2", label: "MS1.2 – Prov. Suppliers", group: "PLAN" },
  { key: "MS1.3", label: "MS1.3 – Provision of Design", group: "PLAN" },
  { key: "MS2", label: "MS2 – FAT / Site Delivery", group: "EXECUTE" },
  { key: "MS3", label: "MS3 – Commissioning & Unit Testing", group: "EXECUTE" },
  { key: "MS4", label: "MS4 – Integration & UAT", group: "EXECUTE" },
  { key: "MS5", label: "MS5 – Hypercare", group: "CLOSE/ HYPERCARE" },
  { key: "MS6", label: "MS6 – Business as Usual Support", group: "CLOSE/ HYPERCARE" },
] as const;

export const FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(DETAIL_FIELDS.map((f) => [`projectDetails.${f.key}`, f.label])),
  "projectDetails.additionalComments": "Additional Comments",
  ...Object.fromEntries(BUSINESS_FIELDS.map((f) => [`businessMilestones.${f.key}`, f.label])),
};
