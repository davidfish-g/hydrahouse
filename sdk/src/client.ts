import type {
  CreateAccountResponse,
  ListHeadsResponse,
  HeadDetail,
  CreateHeadRequest,
  CloseHeadResponse,
  AbortHeadResponse,
  DepositRequest,
  DepositResponse,
  DecommitRequest,
  DecommitResponse,
  TransferRequest,
  TransferResponse,
  SubmitTxResponse,
  SnapshotResponse,
  HydraHouseClientOptions,
} from "./types.js";

export class HydraHouseError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`HydraHouse API error ${status}`);
    this.name = "HydraHouseError";
  }
}

export class HydraHouseClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(opts: HydraHouseClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
  }

  // ---- Account ----

  async createAccount(): Promise<CreateAccountResponse> {
    return this.request("POST", "/v1/accounts", { auth: false });
  }

  // ---- Heads ----

  async listHeads(): Promise<ListHeadsResponse> {
    return this.request("GET", "/v1/heads");
  }

  async getHead(id: string): Promise<HeadDetail> {
    return this.request("GET", `/v1/heads/${encodeURIComponent(id)}`);
  }

  async createHead(req: CreateHeadRequest): Promise<HeadDetail> {
    return this.request("POST", "/v1/heads", { body: req });
  }

  async closeHead(id: string): Promise<CloseHeadResponse> {
    return this.request("POST", `/v1/heads/${encodeURIComponent(id)}/close`);
  }

  async abortHead(id: string): Promise<AbortHeadResponse> {
    return this.request("DELETE", `/v1/heads/${encodeURIComponent(id)}`);
  }

  // ---- L2 Transactions ----

  /** Deposit funds from L1 into an open Hydra head (incremental commit). */
  async deposit(headId: string, req: DepositRequest): Promise<DepositResponse> {
    return this.request(
      "POST",
      `/v1/heads/${encodeURIComponent(headId)}/deposit`,
      { body: req },
    );
  }

  /** Transfer ADA between participants on L2 (custodial model). */
  async transfer(headId: string, req: TransferRequest): Promise<TransferResponse> {
    return this.request(
      "POST",
      `/v1/heads/${encodeURIComponent(headId)}/transfer`,
      { body: req },
    );
  }

  /** Withdraw (decommit) funds from L2 back to L1 for a participant. */
  async decommit(headId: string, req: DecommitRequest): Promise<DecommitResponse> {
    return this.request(
      "POST",
      `/v1/heads/${encodeURIComponent(headId)}/decommit`,
      { body: req },
    );
  }

  async submitTx(headId: string, cborHex: string): Promise<SubmitTxResponse> {
    return this.request(
      "POST",
      `/v1/heads/${encodeURIComponent(headId)}/tx`,
      { body: { cborHex } },
    );
  }

  async getSnapshot(headId: string): Promise<SnapshotResponse> {
    return this.request(
      "GET",
      `/v1/heads/${encodeURIComponent(headId)}/snapshot`,
    );
  }

  // ---- WebSocket ----

  connectWebSocket(headId: string): WebSocket {
    const wsBase = this.baseUrl
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:");
    const url = new URL(
      `/v1/heads/${encodeURIComponent(headId)}/ws`,
      wsBase,
    );
    if (this.apiKey) {
      url.searchParams.set("token", this.apiKey);
    }
    return new WebSocket(url.toString());
  }

  // ---- Internal ----

  private async request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const { body, auth = true } = opts;
    const headers: Record<string, string> = {};

    if (auth && this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new HydraHouseError(res.status, errorBody);
    }

    return (await res.json()) as T;
  }
}
