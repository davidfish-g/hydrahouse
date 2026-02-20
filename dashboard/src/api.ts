const BASE_URL = import.meta.env.VITE_API_URL ?? "";

function getApiKey(): string | null {
  return localStorage.getItem("hh_api_key");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const key = getApiKey();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  if (options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("hh_api_key");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// --- Types ---

export type HeadStatus =
  | "requested"
  | "provisioning"
  | "initializing"
  | "committing"
  | "open"
  | "closing"
  | "closed"
  | "fanned_out"
  | "aborted";

export interface HeadSummary {
  head_id: string;
  network: string;
  status: HeadStatus;
  participant_count: number;
  created_at: string;
  closed_at: string | null;
}

export interface Participant {
  id: string;
  slot_index: number;
  cardano_address: string | null;
  commit_status: string;
}

export interface HeadDetail {
  head_id: string;
  network: string;
  status: HeadStatus;
  participant_count: number;
  config: {
    contestation_period_secs: number;
    fund_lovelace: number;
  };
  ws_url: string;
  participants: Participant[];
  created_at: string;
  closed_at: string | null;
}

export interface CreateHeadRequest {
  network: string;
  participants: number;
  config?: {
    contestation_period_secs?: number;
  };
}

// --- API calls ---

export async function listHeads(): Promise<{ heads: HeadSummary[] }> {
  return request("/v1/heads");
}

export async function getHead(id: string): Promise<HeadDetail> {
  return request(`/v1/heads/${id}`);
}

export async function createHead(body: CreateHeadRequest): Promise<HeadDetail> {
  return request("/v1/heads", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function closeHead(id: string): Promise<{ head_id: string; status: string }> {
  return request(`/v1/heads/${id}/close`, { method: "POST" });
}

export async function abortHead(id: string): Promise<{ head_id: string; status: string }> {
  return request(`/v1/heads/${id}`, { method: "DELETE" });
}

export async function validateApiKey(): Promise<boolean> {
  try {
    await request("/v1/heads");
    return true;
  } catch {
    return false;
  }
}
