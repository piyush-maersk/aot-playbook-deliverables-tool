import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Loading } from "../components/ui";

function MaerskStar({ className }: { className?: string }) {
  // Seven-pointed star motif, drawn procedurally (decorative only).
  const pts = Array.from({ length: 14 }, (_, i) => {
    const r = i % 2 === 0 ? 50 : 20;
    const a = (Math.PI / 7) * i - Math.PI / 2;
    return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={pts} fill="#fff" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function LoginPage() {
  const { status, login, mode, error } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  if (status === "loading") return <Loading text="Checking your session…" />;
  if (status === "signedIn") return <Navigate to={from} replace />;

  return (
    <div className="login">
      <section className="art">
        <div>
          <div style={{ fontWeight: 700, letterSpacing: "0.08em", opacity: 0.9 }}>AUTOMATION & OPERATIONAL TECHNOLOGY</div>
          <h1 style={{ marginTop: "1.5rem" }}>AOT Playbook Deliverables</h1>
          <p style={{ fontSize: "1.05rem", maxWidth: 520 }}>
            One workspace to prepare and track every AOT deliverable of a project – Milestone Plan, Work Packages and Checklists –
            aligned with the governed AOT templates.
          </p>
          <ul>
            <li>Collect project information once and reuse it across deliverables</li>
            <li>Upload BRD, estimation and BOM files to pre-fill the templates</li>
            <li>Track progress of every project on one dashboard</li>
          </ul>
        </div>
        <small style={{ color: "#fff", opacity: 0.85 }}>Classification: Internal</small>
        <MaerskStar className="star" />
      </section>
      <section className="panel">
        <div className="box">
          <img src="/maersk-logo.png" alt="Maersk" />
          <div>
            <h2>Sign in</h2>
            <p className="muted">Use your Maersk Microsoft account to continue.</p>
          </div>
          <button className="ms-btn" onClick={() => void login()}>
            <MicrosoftLogo />
            {mode === "entra" ? "Sign in with Microsoft" : "Continue (local dev sign-in)"}
          </button>
          {mode === "dev" && (
            <div className="banner warn">
              Dev mode: Entra ID is not configured. Set VITE_AUTH_MODE=entra to enable Microsoft SSO.
            </div>
          )}
          {error && <div className="banner error">{error}</div>}
          <small className="muted">Single sign-on with Microsoft Entra ID. No passwords are stored by this application.</small>
        </div>
      </section>
    </div>
  );
}
