import { useQuery } from "@tanstack/react-query";
import type { TemplateLibrary } from "../domain/templates";
import type { ProjectListItem, SourceDocument } from "../domain/types";
import { api } from "./client";

export const useTemplateLibrary = () =>
  useQuery({ queryKey: ["templates", "work-packages"], queryFn: () => api<TemplateLibrary>("/templates/work-packages"), staleTime: Infinity });

export const useProjects = () => useQuery({ queryKey: ["projects"], queryFn: () => api<ProjectListItem[]>("/projects") });

export interface PortfolioSummary {
  projects: number;
  byStatus: Record<string, number>;
  workPackages: { count: number; avgCompleteness: number; byStatus: Record<string, number> };
  milestonePlan: { avgProgress: number; overdue: number };
  checklists: { count: number };
}

export const usePortfolioSummary = () =>
  useQuery({ queryKey: ["reports", "summary"], queryFn: () => api<PortfolioSummary>("/reports/summary") });

export const useDocuments = (projectId: string) =>
  useQuery({
    queryKey: ["documents", projectId],
    queryFn: () => api<SourceDocument[]>(`/projects/${projectId}/documents`),
    enabled: !!projectId,
  });

export interface AuditEntry {
  ts: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
}

export const useAudit = (projectId: string) =>
  useQuery({ queryKey: ["audit", projectId], queryFn: () => api<AuditEntry[]>(`/projects/${projectId}/audit`) });
