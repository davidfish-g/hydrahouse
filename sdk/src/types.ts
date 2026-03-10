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

export type Network = "preprod" | "preview" | "mainnet";

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

export interface HeadConfig {
  contestation_period_secs: number;
}

export interface HeadDetail {
  head_id: string;
  network: string;
  status: HeadStatus;
  participant_count: number;
  config: HeadConfig;
  ws_url: string;
  participants: Participant[];
  created_at: string;
  closed_at: string | null;
}

export interface CreateAccountResponse {
  account_id: string;
  api_key: string;
}

export interface ListHeadsResponse {
  heads: HeadSummary[];
}

export interface CreateHeadRequest {
  network: Network;
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

export interface TransferResponse {
  status: "submitted";
  from: number;
  to: number;
  lovelace: number;
  fee: number;
  hydra_response: unknown;
}

export interface DepositRequest {
  slot: number;
}

export interface DepositResponse {
  status: string;
  tx_id: string;
  slot: number;
  lovelace: number;
  message: string;
}

export interface DecommitRequest {
  slot: number;
  lovelace: number;
}

export interface DecommitResponse {
  status: string;
  slot: number;
  lovelace: number;
  utxo_ref: string;
  message: string;
  hydra_response: unknown;
}

export interface CloseHeadResponse {
  head_id: string;
  status: string;
}

export interface AbortHeadResponse {
  head_id: string;
  status: string;
}

export interface SubmitTxResponse {
  status: "submitted";
  hydra_response: unknown;
}

export interface SnapshotResponse {
  head_id: string;
  utxo: unknown;
}

export interface HydraHouseClientOptions {
  baseUrl: string;
  apiKey?: string;
}
