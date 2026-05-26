export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Get environment variables from runtime injection or import.meta.env
function getEnvVar(key: string): string {
  // First try window.__ENV__ (injected at runtime by server)
  if (typeof window !== "undefined" && (window as any).__ENV__?.[key]) {
    return (window as any).__ENV__[key];
  }
  // Fallback to import.meta.env (for development)
  return import.meta.env[key] || "";
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = getEnvVar("VITE_OAUTH_PORTAL_URL");
  const appId = getEnvVar("VITE_APP_ID");
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
