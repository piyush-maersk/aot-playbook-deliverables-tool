import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setTokenProvider } from "../api/client";
import { AUTH_MODE, apiScopes, getMsal } from "./authConfig";

export interface AuthUser {
  name: string;
  email: string;
}

interface AuthState {
  status: "loading" | "signedOut" | "signedIn";
  user: AuthUser | null;
  mode: "dev" | "entra";
  error: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const DEV_KEY = "aot-dev-signed-in";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (AUTH_MODE === "dev") {
      setTokenProvider(async () => null);
      const signedIn = sessionStorage.getItem(DEV_KEY) === "1";
      setUser(signedIn ? { name: "Dev User", email: "dev.user@maersk.com" } : null);
      setStatus(signedIn ? "signedIn" : "signedOut");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const msal = await getMsal();
        const result = await msal.handleRedirectPromise();
        const account = result?.account ?? msal.getAllAccounts()[0] ?? null;
        if (account) msal.setActiveAccount(account);
        setTokenProvider(async () => {
          const active = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
          if (!active) return null;
          try {
            return (await msal.acquireTokenSilent({ scopes: apiScopes, account: active })).accessToken;
          } catch (e) {
            const { InteractionRequiredAuthError } = await import("@azure/msal-browser");
            if (e instanceof InteractionRequiredAuthError) await msal.acquireTokenRedirect({ scopes: apiScopes, account: active });
            throw e;
          }
        });
        if (cancelled) return;
        setUser(account ? { name: account.name ?? account.username, email: account.username } : null);
        setStatus(account ? "signedIn" : "signedOut");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    if (AUTH_MODE === "dev") {
      sessionStorage.setItem(DEV_KEY, "1");
      setUser({ name: "Dev User", email: "dev.user@maersk.com" });
      setStatus("signedIn");
      return;
    }
    const msal = await getMsal();
    await msal.loginRedirect({ scopes: ["openid", "profile", ...apiScopes] });
  }, []);

  const logout = useCallback(async () => {
    if (AUTH_MODE === "dev") {
      sessionStorage.removeItem(DEV_KEY);
      setUser(null);
      setStatus("signedOut");
      return;
    }
    const msal = await getMsal();
    await msal.logoutRedirect();
  }, []);

  const value = useMemo(() => ({ status, user, mode: AUTH_MODE, error, login, logout }), [status, user, error, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
