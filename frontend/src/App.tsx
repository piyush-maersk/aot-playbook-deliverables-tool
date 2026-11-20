import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Loading } from "./components/ui";
import { AppShell } from "./layout/AppShell";
import { ChecklistsView } from "./modules/checklists/ChecklistsView";
import { MilestonePlanView } from "./modules/milestones/MilestonePlanView";
import { ProjectInformation } from "./modules/overview/ProjectInformation";
import { WorkPackageEditor } from "./modules/workPackages/WorkPackageEditor";
import { WorkPackageList } from "./modules/workPackages/WorkPackageList";
import { ActivityView } from "./pages/ActivityView";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectPage } from "./pages/ProjectPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Loading text="Signing you in…" />;
  if (status !== "signedIn") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<HomePage />} />
              <Route path="projects/:projectId" element={<ProjectPage />}>
                <Route index element={<Navigate to="info" replace />} />
                <Route path="info" element={<ProjectInformation />} />
                <Route path="milestones" element={<MilestonePlanView />} />
                <Route path="work-packages" element={<WorkPackageList />} />
                <Route path="work-packages/:wpId" element={<WorkPackageEditor />} />
                <Route path="work-packages/:wpId/:step" element={<WorkPackageEditor />} />
                <Route path="checklists" element={<ChecklistsView />} />
                <Route path="activity" element={<ActivityView />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  );
}
