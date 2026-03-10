const methodColors: Record<string, string> = {
  GET: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  POST: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  DELETE: "text-red-400 bg-red-500/10 border-red-500/20",
};

interface Endpoint {
  method: string;
  path: string;
  summary: string;
  description: string;
  auth: boolean;
  tag: string;
}

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/healthz",
    summary: "Health check",
    description: "Returns service health status.",
    auth: false,
    tag: "System",
  },
  {
    method: "POST",
    path: "/v1/accounts",
    summary: "Create a new account",
    description:
      "Creates a new account with an API key. The API key is returned once and cannot be retrieved again.",
    auth: false,
    tag: "Accounts",
  },
  {
    method: "POST",
    path: "/v1/heads",
    summary: "Create a new Hydra head",
    description:
      "Provisions a new Hydra head with the specified number of participants. If auto-funding is enabled, node wallets are automatically funded before containers start.",
    auth: true,
    tag: "Heads",
  },
  {
    method: "GET",
    path: "/v1/heads",
    summary: "List your Hydra heads",
    description: "Returns all heads belonging to the authenticated account.",
    auth: true,
    tag: "Heads",
  },
  {
    method: "GET",
    path: "/v1/heads/{id}",
    summary: "Get head details",
    description:
      "Returns full details including participants, config, and WebSocket URL.",
    auth: true,
    tag: "Heads",
  },
  {
    method: "DELETE",
    path: "/v1/heads/{id}",
    summary: "Abort a head",
    description:
      "Aborts a head and tears down all associated resources. Valid for heads before fanned-out state.",
    auth: true,
    tag: "Heads",
  },
  {
    method: "POST",
    path: "/v1/heads/{id}/close",
    summary: "Close an open head",
    description:
      "Initiates the close process. After the contestation period, the head can be finalized (fanned out).",
    auth: true,
    tag: "Heads",
  },
  {
    method: "POST",
    path: "/v1/heads/{id}/deposit",
    summary: "Deposit ADA into an open head",
    description:
      "Incremental deposit. Queries Blockfrost for UTxOs at the participant's address and creates a deposit transaction via the hydra-node.",
    auth: true,
    tag: "Transactions",
  },
  {
    method: "POST",
    path: "/v1/heads/{id}/transfer",
    summary: "Transfer ADA between participants on L2",
    description:
      "Builds, signs, and submits an L2 ADA transfer between two participants. The head must be open.",
    auth: true,
    tag: "Transactions",
  },
  {
    method: "POST",
    path: "/v1/heads/{id}/tx",
    summary: "Submit L2 transaction",
    description:
      "Submits a signed Cardano transaction (CBOR hex) to the L2 head via the hydra-node.",
    auth: true,
    tag: "Transactions",
  },
  {
    method: "GET",
    path: "/v1/heads/{id}/snapshot",
    summary: "Get L2 UTxO snapshot",
    description:
      "Returns the current UTxO set inside the L2 head. The head must be open.",
    auth: true,
    tag: "Transactions",
  },
  {
    method: "GET",
    path: "/v1/heads/{id}/ws",
    summary: "WebSocket proxy to hydra-node",
    description:
      "Upgrades to a WebSocket connection that proxies all messages bidirectionally to the hydra-node. Receives real-time events: HeadIsInitializing, Committed, HeadIsOpen, SnapshotConfirmed, TxValid, TxInvalid, HeadIsClosed, ReadyToFanout, HeadIsFinalized, HeadIsAborted.",
    auth: false,
    tag: "WebSocket",
  },
];

const tagOrder = ["System", "Accounts", "Heads", "Transactions", "WebSocket"];

function groupByTag(eps: Endpoint[]): [string, Endpoint[]][] {
  const map = new Map<string, Endpoint[]>();
  for (const ep of eps) {
    const arr = map.get(ep.tag) ?? [];
    arr.push(ep);
    map.set(ep.tag, arr);
  }
  return tagOrder.filter((t) => map.has(t)).map((t) => [t, map.get(t)!]);
}

export default function ApiReference() {
  const grouped = groupByTag(endpoints);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">API Reference</h1>
      <p className="text-slate-400 mb-2">
        REST API endpoints. Authenticate with{" "}
        <code className="text-indigo-300 text-xs bg-slate-900 px-1.5 py-0.5 rounded">
          Authorization: Bearer &lt;api_key&gt;
        </code>{" "}
        except where noted.
      </p>
      <p className="text-slate-500 text-sm mb-8">
        Base URL:{" "}
        <code className="text-slate-400 text-xs bg-slate-900 px-1.5 py-0.5 rounded">
          https://api.hydrahouse.io
        </code>
      </p>

      <div className="space-y-8">
        {grouped.map(([tag, eps]) => (
          <div key={tag}>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              {tag}
            </h2>
            <div className="space-y-3">
              {eps.map((ep, i) => (
                <div
                  key={`${ep.method}-${ep.path}-${i}`}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        methodColors[ep.method] ?? "text-slate-400 bg-slate-800 border-slate-600"
                      }`}
                    >
                      {ep.method}
                    </span>
                    <code className="text-sm text-slate-200 font-mono">
                      {ep.path}
                    </code>
                    {ep.auth && (
                      <svg
                        className="w-3.5 h-3.5 text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-label="Requires authentication"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-300 mb-1">
                    {ep.summary}
                  </p>
                  <p className="text-xs text-slate-500">{ep.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Auth info */}
      <div className="mt-10 bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-200">
            Authentication
          </h3>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Endpoints marked with{" "}
          <svg className="w-3 h-3 text-amber-400 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>{" "}
          require a bearer token. Use your API key (prefixed with{" "}
          <code className="text-indigo-300 text-xs bg-slate-900 px-1.5 py-0.5 rounded">
            hh_sk_
          </code>
          ) in the <code className="text-indigo-300 text-xs bg-slate-900 px-1.5 py-0.5 rounded">Authorization</code> header.
        </p>
      </div>
    </div>
  );
}
