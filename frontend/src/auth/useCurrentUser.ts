import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: "Admin" | "Lead" | "Contributor" | "Viewer";
}

/** GET /me – server-side identity and role (used for role guards). */
export function useCurrentUser() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<CurrentUser>("/me"), staleTime: 5 * 60_000 });
}

export const canEdit = (u?: CurrentUser) => !!u && u.role !== "Viewer";
