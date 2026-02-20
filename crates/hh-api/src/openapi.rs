use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;

pub async fn openapi_spec() -> impl IntoResponse {
    let spec = serde_json::json!({
        "openapi": "3.0.3",
        "info": {
            "title": "HydraHouse API",
            "version": "0.1.0",
            "description": "Managed Hydra Head orchestration platform for Cardano"
        },
        "servers": [
            { "url": "http://localhost:3000", "description": "Local development" }
        ],
        "paths": {
            "/healthz": {
                "get": {
                    "summary": "Health check",
                    "operationId": "healthz",
                    "responses": {
                        "200": { "description": "Service is healthy" }
                    }
                }
            },
            "/v1/heads": {
                "post": {
                    "summary": "Create a new Hydra head",
                    "operationId": "createHead",
                    "security": [{ "bearerAuth": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/CreateHeadRequest" }
                            }
                        }
                    },
                    "responses": {
                        "200": { "description": "Head created and provisioning started" },
                        "400": { "description": "Invalid request" },
                        "401": { "description": "Unauthorized" }
                    }
                },
                "get": {
                    "summary": "List your Hydra heads",
                    "operationId": "listHeads",
                    "security": [{ "bearerAuth": [] }],
                    "responses": {
                        "200": { "description": "List of heads" }
                    }
                }
            },
            "/v1/heads/{id}": {
                "get": {
                    "summary": "Get head details",
                    "operationId": "getHead",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [
                        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
                    ],
                    "responses": {
                        "200": { "description": "Head details" },
                        "404": { "description": "Head not found" }
                    }
                },
                "delete": {
                    "summary": "Abort a head",
                    "operationId": "abortHead",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [
                        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
                    ],
                    "responses": {
                        "200": { "description": "Head aborted" },
                        "400": { "description": "Cannot abort head in current state" }
                    }
                }
            },
            "/v1/heads/{id}/close": {
                "post": {
                    "summary": "Close an open head",
                    "operationId": "closeHead",
                    "security": [{ "bearerAuth": [] }],
                    "parameters": [
                        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
                    ],
                    "responses": {
                        "200": { "description": "Head closing initiated" },
                        "400": { "description": "Cannot close head in current state" }
                    }
                }
            },
            "/v1/heads/{id}/ws": {
                "get": {
                    "summary": "WebSocket proxy to hydra-node",
                    "operationId": "wsProxy",
                    "description": "Upgrades to WebSocket. Proxies all messages bidirectionally to the underlying hydra-node. Compatible with MeshJS HydraProvider and other Hydra WebSocket clients.",
                    "parameters": [
                        { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
                    ],
                    "responses": {
                        "101": { "description": "WebSocket upgrade" }
                    }
                }
            }
        },
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "API key (hh_sk_...)"
                }
            },
            "schemas": {
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
                            "minimum": 2,
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
                            "default": 300
                        },
                        "fund_lovelace": {
                            "type": "integer",
                            "default": 10000000
                        }
                    }
                }
            }
        }
    });

    (StatusCode::OK, Json(spec))
}
