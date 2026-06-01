/**
 * Unified API Client Configuration
 * Allows developers to update base URLs in one place.
 */

// DJANGO_API_BASE_URL: Your Django backend hosted on Vercel
const rawUrl = import.meta.env.VITE_DJANGO_API_URL;
export const DJANGO_API_BASE_URL = (
  typeof rawUrl === 'string' &&
  rawUrl.trim() !== '' &&
  rawUrl !== 'undefined' &&
  rawUrl !== 'null' &&
  !rawUrl.includes('undefined') &&
  !rawUrl.includes('null')
) ? rawUrl.trim() : '';

export const API_ENDPOINTS = {
    TOKEN: `${DJANGO_API_BASE_URL}/api/token/`,
    AUTH_PIN_LOGIN: `${DJANGO_API_BASE_URL}/api/auth/pin-login`,
    AUTH_REGISTER: `${DJANGO_API_BASE_URL}/api/auth/register-onboarding`,
    // ... add more as needed
};

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
 * Unified fetch wrapper that prepends the Django API URL to requests.
 * Directs all ledger operations, auth checks, backups, and staff flows directly to the Django REST server.
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getDjangoApiUrl(path);
  return fetch(url, options);
}

/**
 * Fetch wrapper for Node server endpoints.
 */
export async function nodeFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(path, options);
}

/**
 * Wrapper for direct communications with Django Rest API endpoints
 */
export async function djangoFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getDjangoApiUrl(path);
  return fetch(url, options);
}

