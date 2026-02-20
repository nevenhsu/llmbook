// Typed API error with status code
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Generic typed fetch wrapper
export async function apiFetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(input, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message: string;
    try {
      const data = await res.json();
      message = data.error || `HTTP ${res.status}`;
    } catch {
      message = (await res.text()) || `HTTP ${res.status}`;
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

// POST helper with JSON body
export function apiPost<T>(url: string, body: unknown): Promise<T> {
  return apiFetchJson<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// PATCH helper with JSON body
export function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return apiFetchJson<T>(url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// DELETE helper — body is optional; returns undefined if no JSON response
export async function apiDelete<T = void>(url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: "DELETE" };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let message: string;
    try {
      const data = await res.json();
      message = data.error || `HTTP ${res.status}`;
    } catch {
      message = (await res.text()) || `HTTP ${res.status}`;
    }
    throw new ApiError(message, res.status);
  }
  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

// PUT helper with JSON body
export function apiPut<T>(url: string, body: unknown): Promise<T> {
  return apiFetchJson<T>(url, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
