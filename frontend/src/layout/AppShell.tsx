import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useCurrentUser } from "../auth/useCurrentUser";
import { Badge, Button, initials } from "../components/ui";

export function AppShell() {
  const { user, logout, mode } = useAuth();
  const me = useCurrentUser();
  const name = me.data?.name ?? user?.name ?? "";
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand" style={{ textDecoration: "none" }}>
          <img src="/maersk-logo.png" alt="Maersk" />
          <span className="divider" />
          <span>AOT Playbook Deliverables</span>
        </NavLink>
        <nav>
          <NavLink to="/" end>Home</NavLink>
        </nav>
        <div className="spacer" />
        {mode === "dev" && <Badge tone="amber">Dev sign-in</Badge>}
        {me.data && <Badge>{me.data.role}</Badge>}
        <div className="row" title={me.data?.email ?? user?.email}>
          <span className="avatar" style={{ marginLeft: 0 }}>{initials(name || "?")}</span>
          <span style={{ fontWeight: 600, color: "var(--navy)" }}>{name}</span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void logout()}>Sign out</Button>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
