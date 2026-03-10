use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;

pub async fn openapi_spec() -> impl IntoResponse {
    let spec = serde_json::json!({
        "openapi": "3.0.3",
        "info": {
            "title": "HydraHouse API",
            "version": "0.1.0",
            "description": "Managed Hydra Head orchestration platform for Cardano. Provides a REST + WebSocket API for creating, managing, and interacting with Hydra L2 heads."
        },
        "servers": [
            { "url": "http://localhost:3000", "description": "Local development" }
        ],
        "paths": {
            "/healthz": {
                "get": {
                    "summary": "Health check",
                    "operationId": "healthz",
                    "tags": ["System"],
                    "responses": {
                        "200": {
                            "description": "Service is healthy",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "status": { "type": "string", "example": "ok" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/v1/accounts": {
                "post": {
                    "summary": "Create a new account",
                    "operationId": "createAccount",
                    "tags": ["Accounts"],
                    "description": "Creates a new account with an API key. The API key is returned once and cannot be retrieved again.",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "email": { "type": "string", "format": "email", "nullable": true }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Account created",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "account_id": { "type": "string", "format": "uuid" },
                                            "api_key": { "type": "string", "description": "Store this securely — it cannot be retrieved again", "example": "hh_sk_abc123..." }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/v1/heads": {
                "post": {
                    "summary": "Create a new Hydra head",
                    "operationId": "createHead",
                    "tags": ["Heads"],
                    "description": "Provisions a new Hydra head with the specified number of participants. If auto-funding is enabled, node wallets are automatically funded before containers start.",
                    "security": [{ "bearerAuth": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/CreateHeadRequest" },
                                    "example": {
                                    "network": "preprod",
                                    "participants": 2,
                                    "config": { "contestation_period_secs": 300, "deposit_period_secs": 120 }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Head created and provisioning started",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/HeadDetail" }
                                }
                            }
                        },
                        "400": { "$ref": "#/components/responses/BadRequest" },
                        "401": { "$ref": "#/components/responses/Unauthorized" }
                    }
                },
                "get": {
                    "summary": "List your Hydra heads",
                    "operationId": "listHeads",
                    "tags": ["Heads"],
                    "security": [{ "bearerAuth": [] }],
                    "responses": {
                        "200": {
                            "description": "List of heads",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "heads": {
                                                "type": "array",
                                                "items": { "$ref": "#/components/schemas/HeadSummary" }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "401": { "$ref": "#/components/responses/Unauthorized" }
                    }
                }
            },
            "/v1/heads/{id}": {
                "get": {
                    "summary": "Get head details",
                    "operationId": "getHead",
                    "tags": ["Heads"],
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "$ref": "#/components/parameters/HeadId" }],
                    "responses": {
                        "200": {
                            "description": "Head details with participants",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/HeadDetail" }
                                }
                            }
                        },
                        "401": { "$ref": "#/components/responses/Unauthorized" },
                        "404": { "$ref": "#/components/responses/NotFound" }
                    }
                },
                "delete": {
                    "summary": "Abort a head",
                    "operationId": "abortHead",
                    "tags": ["Heads"],
                    "description": "Aborts a head and tears down all associated resources. Only valid for heads in provisioning, initializing, committing, or open states.",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "$ref": "#/components/parameters/HeadId" }],
                    "responses": {
                        "200": {
                            "description": "Head aborted",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/StatusResponse" }
                                }
                            }
                        },
                        "400": { "$ref": "#/components/responses/BadRequest" },
                        "401": { "$ref": "#/components/responses/Unauthorized" }
                    }
                }
            },
            "/v1/heads/{id}/close": {
                "post": {
                    "summary": "Close an open head",
                    "operationId": "closeHead",
                    "tags": ["Heads"],
                    "description": "Initiates the close process for an open head. After the contestation period, the head can be finalized (fanned out).",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "$ref": "#/components/parameters/HeadId" }],
                    "responses": {
                        "200": {
                            "description": "Head closing initiated",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/StatusResponse" }
                                }
                            }
                        },
                        "400": { "$ref": "#/components/responses/BadRequest" },
                        "401": { "$ref": "#/components/responses/Unauthorized" }
                    }
                }
            },
            "/v1/heads/{id}/deposit": {
                "post": {
                    "summary": "Deposit ADA into an open head",
                    "operationId": "deposit",
                    "tags": ["Transactions"],
                    "description": "Incremental deposit (Hydra v1.2.0+). Queries Blockfrost for UTxOs sent to the participant's Cardano address and creates a deposit transaction via the hydra-node. The deposit is submitted to L1; once confirmed, the funds appear on L2. The head must be in 'open' state.",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "$ref": "#/components/parameters/HeadId" }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/DepositRequest" },
                                "example": { "slot": 0 }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Deposit transaction submitted to L1",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "status": { "type": "string", "example": "submitted" },
                                            "tx_id": { "type": "string" },
                                            "slot": { "type": "integer" },
                                            "lovelace": { "type": "integer" },
                                            "message": { "type": "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "400": { "$ref": "#/components/responses/BadRequest" },
                        "401": { "$ref": "#/components/responses/Unauthorized" }
                    }
                }
            },
            "/v1/heads/{id}/transfer": {
                "post": {
                    "summary": "Transfer ADA between participants on L2",
                    "operationId": "transfer",
                    "tags": ["Transactions"],
                    "description": "Builds, signs, and submits an L2 ADA transfer between two participants. In the custodial model, HydraHouse holds all signing keys. The head must be in 'open' state.",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "$ref": "#/components/parameters/HeadId" }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/TransferRequest" },
                                "example": { "from": 0, "to": 1, "lovelace": 5000000 }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Transfer submitted to L2",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "status": { "type": "string", "example": "submitted" },
                                            "from": { "type": "integer" },
                                            "to": { "type": "integer" },
                                            "lovelace": { "type": "integer" },
                                            "fee": { "type": "integer" },
                                            "hydra_response": { "type": "object" }
                                        }
                                    }
                                }
                            }
                        },
                        "400": { "$ref": "#/components/responses/BadRequest" },
                        "401": { "$ref": "#/components/responses/Unauthorized" }
                    }
                }
            },
            "/v1/heads/{id}/tx": {
                "post": {
                    "summary": "Submit L2 transaction",
                    "operationId": "submitTx",
                    "tags": ["Transactions"],
                    "description": "Submits a signed Cardano transaction to the L2 head via the hydra-node. The head must be in 'open' state.",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "$ref": "#/components/parameters/HeadId" }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["cborHex"],
                                    "properties": {
                                        "cborHex": {
                                            "type": "string",
                                            "description": "Hex-encoded CBOR of a signed Cardano transaction"
                                        }
                                    }
                                },
                                "example": { "cborHex": "84a400..." }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Transaction submitted to L2",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "status": { "type": "string", "example": "submitted" },
                                            "hydra_response": { "type": "object" }
                                        }
                                    }
                                }
                            }
                        },
                        "400": { "$ref": "#/components/responses/BadRequest" },
                        "401": { "$ref": "#/components/responses/Unauthorized" }
                    }
                }
            },
            "/v1/heads/{id}/snapshot": {
                "get": {
                    "summary": "Get L2 UTxO snapshot",
                    "operationId": "getSnapshot",
                    "tags": ["Transactions"],
                    "description": "Returns the current UTxO set inside the L2 head. The head must be in 'open' state.",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [{ "$ref": "#/components/parameters/HeadId" }],
                    "responses": {
                        "200": {
                            "description": "Current L2 UTxO snapshot",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "head_id": { "type": "string", "format": "uuid" },
                                            "utxo": {
                                                "type": "object",
                                                "description": "Map of UTxO references to outputs",
                                                "additionalProperties": true
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "400": { "$ref": "#/components/responses/BadRequest" },
                        "401": { "$ref": "#/components/responses/Unauthorized" }
                    }
                }
            },
            "/v1/heads/{id}/ws": {
                "get": {
                    "summary": "WebSocket proxy to hydra-node",
                    "operationId": "wsProxy",
                    "tags": ["WebSocket"],
                    "description": "Upgrades to a WebSocket connection that proxies all messages bidirectionally to the underlying hydra-node. Compatible with MeshJS HydraProvider and other Hydra WebSocket clients. Receives real-time events: HeadIsInitializing, Committed, HeadIsOpen, SnapshotConfirmed, TxValid, TxInvalid, HeadIsClosed, ReadyToFanout, HeadIsFinalized, HeadIsAborted.",
                    "parameters": [{ "$ref": "#/components/parameters/HeadId" }],
                    "responses": {
                        "101": { "description": "WebSocket upgrade successful" }
                    }
                }
            }
        },
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "API key prefixed with hh_sk_"
                }
            },
            "parameters": {
                "HeadId": {
                    "name": "id",
                    "in": "path",
                    "required": true,
                    "schema": { "type": "string", "format": "uuid" },
                    "description": "Hydra head UUID"
                }
            },
            "responses": {
                "BadRequest": {
                    "description": "Bad request",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/Error" }
                        }
                    }
                },
                "Unauthorized": {
                    "description": "Missing or invalid API key",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/Error" }
                        }
                    }
                },
                "NotFound": {
                    "description": "Resource not found",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/Error" }
                        }
                    }
                }
            },
            "schemas": {
                "Error": {
                    "type": "object",
                    "properties": {
                        "error": { "type": "string" }
                    }
                },
                "CreateHeadRequest": {
                    "type": "object",
                    "required": ["network"],
                    "properties": {
                        "network": {
                            "type": "string",
                            "enum": ["preprod", "preview", "mainnet"]
                        },
                        "participants": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 10,
                            "default": 2
                        },
                        "config": { "$ref": "#/components/schemas/HeadConfig" }
                    }
                },
                "HeadConfig": {
                    "type": "object",
                    "properties": {
                        "contestation_period_secs": {
                            "type": "integer",
                            "default": 300,
                            "description": "Contestation period in seconds before head can be finalized after closing"
                        },
                        "deposit_period_secs": {
                            "type": "integer",
                            "default": 120,
                            "description": "Deposit period in seconds — how long after creation before a deposit becomes active for L2 inclusion"
                        }
                    }
                },
                "DepositRequest": {
                    "type": "object",
                    "required": ["slot"],
                    "properties": {
                        "slot": {
                            "type": "integer",
                            "description": "Participant slot index to deposit funds for"
                        }
                    }
                },
                "TransferRequest": {
                    "type": "object",
                    "required": ["from", "to", "lovelace"],
                    "properties": {
                        "from": {
                            "type": "integer",
                            "description": "Sender participant slot index"
                        },
                        "to": {
                            "type": "integer",
                            "description": "Receiver participant slot index"
                        },
                        "lovelace": {
                            "type": "integer",
                            "description": "Amount of lovelace to transfer",
                            "minimum": 1
                        }
                    }
                },
                "HeadSummary": {
                    "type": "object",
                    "properties": {
                        "head_id": { "type": "string", "format": "uuid" },
                        "network": { "type": "string" },
                        "status": { "$ref": "#/components/schemas/HeadStatus" },
                        "participant_count": { "type": "integer" },
                        "created_at": { "type": "string", "format": "date-time" },
                        "closed_at": { "type": "string", "format": "date-time", "nullable": true }
                    }
                },
                "HeadDetail": {
                    "type": "object",
                    "properties": {
                        "head_id": { "type": "string", "format": "uuid" },
                        "network": { "type": "string" },
                        "status": { "$ref": "#/components/schemas/HeadStatus" },
                        "participant_count": { "type": "integer" },
                        "config": { "$ref": "#/components/schemas/HeadConfig" },
                        "ws_url": { "type": "string", "description": "WebSocket URL for real-time head events" },
                        "participants": {
                            "type": "array",
                            "items": { "$ref": "#/components/schemas/Participant" }
                        },
                        "created_at": { "type": "string", "format": "date-time" },
                        "closed_at": { "type": "string", "format": "date-time", "nullable": true }
                    }
                },
                "Participant": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string", "format": "uuid" },
                        "slot_index": { "type": "integer" },
                        "cardano_address": { "type": "string", "nullable": true, "description": "Bech32 Cardano address (addr_test1v...)" },
                        "commit_status": { "type": "string" }
                    }
                },
                "HeadStatus": {
                    "type": "string",
                    "enum": ["requested", "provisioning", "initializing", "committing", "open", "closing", "closed", "fanned_out", "aborted"]
                },
                "StatusResponse": {
                    "type": "object",
                    "properties": {
                        "head_id": { "type": "string", "format": "uuid" },
                        "status": { "$ref": "#/components/schemas/HeadStatus" }
                    }
                }
            }
        }
    });

    (StatusCode::OK, Json(spec))
}
