const BASE_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    localStorage.removeItem("hh_email");
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

export interface TransferRequest {
  from: number;
  to: number;
  lovelace: number;
}

export interface DepositRequest {
  slot: number;
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

export async function deposit(
  id: string,
  body: DepositRequest,
): Promise<{ status: string; tx_id: string; slot: number; lovelace: number; message: string }> {
  return request(`/v1/heads/${id}/deposit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function transferL2(
  headId: string,
  body: TransferRequest,
): Promise<{ status: string; from: number; to: number; lovelace: number; fee: number; hydra_response: unknown }> {
  return request(`/v1/heads/${headId}/transfer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function submitTx(
  headId: string,
  cborHex: string,
): Promise<{ status: string; hydra_response: unknown }> {
  return request(`/v1/heads/${headId}/tx`, {
    method: "POST",
    body: JSON.stringify({ cborHex }),
  });
}

export async function getSnapshot(
  headId: string,
): Promise<{ head_id: string; utxo: Record<string, unknown> }> {
  return request(`/v1/heads/${headId}/snapshot`);
}

export interface DecommitRequest {
  slot: number;
  lovelace: number;
}

export async function decommit(
  headId: string,
  body: DecommitRequest,
): Promise<{ status: string; slot: number; lovelace: number; utxo_ref: string; message: string; hydra_response: unknown }> {
  return request(`/v1/heads/${headId}/decommit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getHeadEvents(
  headId: string,
): Promise<{ events: HeadEvent[] }> {
  return request(`/v1/heads/${headId}/events`);
}

export interface HeadEvent {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
}

export interface CreateAccountRequest {
  email?: string;
}

export interface CreateAccountResponse {
  account_id: string;
  api_key: string;
  email: string | null;
  plan: string;
}

export async function createAccount(body: CreateAccountRequest = {}): Promise<CreateAccountResponse> {
  return request("/v1/accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- Google Auth ---

export interface GoogleAuthResponse {
  account_id: string;
  email: string;
  plan: string;
  is_new_account: boolean;
  username: string | null;
}

export async function googleAuth(idToken: string): Promise<GoogleAuthResponse> {
  const res = await fetch(`${BASE_URL}/v1/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// --- API Key Management ---

export interface ApiKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
}

export async function createApiKey(name: string): Promise<CreateApiKeyResponse> {
  return request("/v1/account/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function listApiKeys(): Promise<{ keys: ApiKeyInfo[] }> {
  return request("/v1/account/keys");
}

export async function deleteApiKey(id: string): Promise<{ deleted: boolean }> {
  return request(`/v1/account/keys/${id}`, { method: "DELETE" });
}

// --- Billing ---

export interface AccountInfo {
  account_id: string;
  plan: string;
  balance_cents: number;
  has_billing: boolean;
  username: string | null;
  email: string | null;
}

export interface UsageResponse {
  account_id: string;
  usage: Record<string, number>;
}

export interface BalanceTransaction {
  id: string;
  amount_cents: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export async function getAccount(): Promise<AccountInfo> {
  return request("/v1/account");
}

export async function updateUsername(username: string): Promise<{ username: string }> {
  return request("/v1/account/username", {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
}

export async function deleteAccount(): Promise<{ deleted: boolean }> {
  return request("/v1/account", { method: "DELETE" });
}

export async function getUsage(): Promise<UsageResponse> {
  return request("/v1/account/usage");
}

export async function getBalanceHistory(): Promise<{ transactions: BalanceTransaction[] }> {
  return request("/v1/account/balance/history");
}

export async function createTopUp(
  amountCents: number,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  return request("/v1/billing/topup", {
    method: "POST",
    body: JSON.stringify({
      amount_cents: amountCents,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });
}

// --- Passkey Auth ---

export interface PasskeyLoginBeginResponse {
  challenge_id: string;
  options: {
    publicKey: PublicKeyCredentialRequestOptionsJSON;
  };
}

interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string;
  rpId: string;
  timeout: number;
  userVerification: string;
  allowCredentials: Array<{ type: string; id: string }>;
}

export async function passkeyLoginBegin(): Promise<PasskeyLoginBeginResponse> {
  const res = await fetch(`${BASE_URL}/v1/auth/passkey/login/begin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export interface PasskeyLoginCompleteResponse {
  account_id: string;
  email: string | null;
  plan: string;
  username: string | null;
}

export async function passkeyLoginComplete(body: {
  challenge_id: string;
  raw_id: string;
  client_data_json: string;
  authenticator_data: string;
  signature: string;
}): Promise<PasskeyLoginCompleteResponse> {
  const res = await fetch(`${BASE_URL}/v1/auth/passkey/login/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function passkeySignupBegin(): Promise<PasskeyLoginBeginResponse & { options: any }> {
  const res = await fetch(`${BASE_URL}/v1/auth/passkey/signup/begin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function passkeySignupComplete(body: {
  challenge_id: string;
  credential: PublicKeyCredential;
  name?: string;
}): Promise<PasskeyLoginCompleteResponse> {
  const res = await fetch(`${BASE_URL}/v1/auth/passkey/signup/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function passkeyRegisterBegin(): Promise<{
  challenge_id: string;
  options: PublicKeyCredentialCreationOptions;
}> {
  return request("/v1/account/auth/passkey/register/begin", { method: "POST" });
}

export async function passkeyRegisterComplete(body: {
  challenge_id: string;
  credential: PublicKeyCredential;
  name?: string;
}): Promise<{ registered: boolean }> {
  return request("/v1/account/auth/passkey/register/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- Auth Methods ---

export interface AuthMethods {
  google: { email: string } | null;
  passkeys: Array<{ id: string; name: string; created_at: string }>;
}

export async function listAuthMethods(): Promise<AuthMethods> {
  return request("/v1/account/auth/methods");
}

export async function unlinkPasskey(id: string): Promise<{ deleted: boolean }> {
  return request(`/v1/account/auth/passkey/${id}`, { method: "DELETE" });
}

export async function unlinkGoogle(): Promise<{ deleted: boolean }> {
  return request("/v1/account/auth/google", { method: "DELETE" });
}

export async function linkGoogle(idToken: string): Promise<{ linked: boolean }> {
  return request("/v1/account/auth/google/link", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

// --- Helpers ---

export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
