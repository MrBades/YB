/**
 * Unified API Client Configuration
 * Allows developers to update base URLs in one place.
 */

// If there's an API URL configured in environment, use it. Otherwise default to empty string (same host).
export const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || '';

/**
 * Normalizes and resolves the path with the configured API_BASE_URL
 */
export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
}

/**
 * Unified fetch wrapper that prepends the base URL to standard requests
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  return fetch(url, options);
}
