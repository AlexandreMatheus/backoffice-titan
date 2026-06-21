/**
 * Automatic token refresh mechanism for the backoffice
 */

const BO_ACCESS_TOKEN_KEY = 'atlas_bo_access_token';
const BO_REFRESH_TOKEN_KEY = 'atlas_bo_refresh_token';

interface DecodedToken {
  exp: number;
  iat: number;
}

function getTokenExpirationTime(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as DecodedToken;
    return decoded.exp * 1000;
  } catch {
    return null;
  }
}

function getTimeUntilExpiration(token: string | null): number | null {
  const exp = getTokenExpirationTime(token);
  if (!exp) return null;
  return exp - Date.now();
}

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
}

let refreshInFlight: Promise<RefreshTokenResponse | null> | null = null;

export async function refreshAccessToken(): Promise<RefreshTokenResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function performRefresh(): Promise<RefreshTokenResponse | null> {
  try {
    const refreshToken = localStorage.getItem(BO_REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      localStorage.removeItem(BO_ACCESS_TOKEN_KEY);
      localStorage.removeItem(BO_REFRESH_TOKEN_KEY);
      return null;
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem(BO_ACCESS_TOKEN_KEY);
        localStorage.removeItem(BO_REFRESH_TOKEN_KEY);
        localStorage.removeItem('atlas_bo_user');
      }
      return null;
    }

    const data: RefreshTokenResponse = await response.json();

    localStorage.setItem(BO_ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(BO_REFRESH_TOKEN_KEY, data.refresh_token);

    return data;
  } catch {
    return null;
  }
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 min before expiry
const TICK_MS = 30 * 1000;

export function setupAutoRefresh(onTokenRefreshed?: (newToken: string) => void): () => void {
  let hasFailedOnce = false;

  const maybeRefresh = async () => {
    const token = localStorage.getItem(BO_ACCESS_TOKEN_KEY);
    if (!token) return;

    const timeLeft = getTimeUntilExpiration(token);
    if (timeLeft === null) return;

    if (timeLeft < REFRESH_BUFFER_MS) {
      const result = await refreshAccessToken();
      if (result && onTokenRefreshed) {
        onTokenRefreshed(result.access_token);
        hasFailedOnce = false;
      } else if (!hasFailedOnce) {
        hasFailedOnce = true;
      }
    }
  };

  void maybeRefresh();

  const intervalId = setInterval(() => {
    void maybeRefresh();
  }, TICK_MS);

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void maybeRefresh();
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
