/**
 * Unified API Client Configuration
 * Allows developers to update base URLs in one place.
 */

// EXPRESS_API_BASE_URL: Set to empty by default so it queries the current server hosting the React app
// (where server.ts runs user authentication, OTPs, session validation, backups, and security checks)
export const EXPRESS_API_BASE_URL = (import.meta.env.VITE_EXPRESS_API_URL as string) || '';

// DJANGO_API_BASE_URL: Your Django backend hosted on Vercel
export const DJANGO_API_BASE_URL = (import.meta.env.VITE_DJANGO_API_URL as string) || 'https://yb-alpha.vercel.app/';

/**
 * Normalizes and resolves paths for Express Node.js Server
 */
export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = EXPRESS_API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
}

/**
 * Normalizes and resolves paths for Django REST API Server
 */
export function getDjangoApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = DJANGO_API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
}

/**
 * Unified fetch wrapper that prepends the Django API URL or standard base to requests.
 * Directs all ledger operations, auth checks, backups, and staff flows directly to the Django REST server.
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getDjangoApiUrl(path);
  return fetch(url, options);
}

/**
 * Wrapper for direct communications with Django Rest API endpoints
 */
export async function djangoFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getDjangoApiUrl(path);
  return fetch(url, options);
}

