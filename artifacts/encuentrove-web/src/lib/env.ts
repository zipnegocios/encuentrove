// Reads window.__ENV__ (injected by nginx at container start) then import.meta.env.
function getEnv(key: string): string {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = ((window as any).__ENV__ as Record<string, string> | undefined)?.[key];
    if (v) return v;
  }
  return (import.meta.env as Record<string, string>)[key] ?? '';
}

export const S3_BASE_URL = (): string => getEnv('VITE_S3_BASE_URL');
export const API_BASE_URL = (): string => getEnv('VITE_API_BASE_URL');

// Returns the base prefix for API calls:
// - If VITE_API_BASE_URL is set → use it as-is (e.g. for an external backend).
// - Otherwise use '' (empty) so paths like '/api/v1/...' are relative,
//   handled by the Vite proxy in dev and nginx proxy_pass in Docker.
export function apiBase(): string {
  return API_BASE_URL().replace(/\/$/, '');
}
