import type { Configuration, IPublicClientApplication } from "@azure/msal-browser";

export const AUTH_MODE: "dev" | "entra" = import.meta.env.VITE_AUTH_MODE === "entra" ? "entra" : "dev";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? "",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID ?? "organizations"}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI ?? window.location.origin,
    postLogoutRedirectUri: (import.meta.env.VITE_REDIRECT_URI ?? window.location.origin) + "/login",
  },
  cache: { cacheLocation: "sessionStorage" },
};

/** Scope exposed by the API app registration; the access token audience must match backend ENTRA_AUDIENCE. */
export const apiScopes = [import.meta.env.VITE_API_SCOPE ?? ""].filter(Boolean);

let pca: Promise<IPublicClientApplication> | null = null;

export function getMsal(): Promise<IPublicClientApplication> {
  if (!pca) {
    pca = import("@azure/msal-browser").then((m) => m.createStandardPublicClientApplication(msalConfig));
  }
  return pca;
}
