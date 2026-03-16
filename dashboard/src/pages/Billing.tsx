import { useState, useEffect } from "react";
import {
  getAccount,
  getUsage,
  getBalanceHistory,
  createTopUp,
  type AccountInfo,
  type UsageResponse,
  type BalanceTransaction,
} from "../api";

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000]; // cents

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Billing() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState<number | "custom" | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [acc, use_, hist] = await Promise.all([
          getAccount(),
          getUsage(),
          getBalanceHistory(),
        ]);
        if (!cancelled) {
          setAccount(acc);
          setUsage(use_);
          setTransactions(hist.transactions);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleTopUp(amountCents: number, key: number | "custom") {
    setTopUpLoading(key);
    setError(null);
    try {
      const base = window.location.origin;
      const { url } = await createTopUp(
        amountCents,
        `${base}/billing?success=1`,
        `${base}/billing`,
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Top-up failed");
      setTopUpLoading(null);
    }
  }

  function handleCustomTopUp() {
    const dollars = parseFloat(customAmount);
    if (isNaN(dollars) || dollars < 5) {
      setError("Minimum top-up is $5.00");
      return;
    }
    handleTopUp(Math.round(dollars * 100), "custom");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Billing</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Balance card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6 max-w-4xl">
        <div className="h-0.5 bg-gradient-to-r from-primary to-emerald-400" />
        <div className="p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Current Balance</p>
          <p className="text-5xl font-bold text-gray-900">
            {formatDollars(account?.balance_cents ?? 0)}
          </p>
          <div className="flex gap-4 mt-3">
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Head open: $5.00</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">API request: $0.01</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Left column */}
        <div className="space-y-6">
          {/* Add Funds */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Add Funds</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {PRESET_AMOUNTS.map((cents) => (
                <button
                  key={cents}
                  onClick={() => {
                    setSelectedPreset(cents);
                    handleTopUp(cents, cents);
                  }}
                  disabled={topUpLoading !== null}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                    selectedPreset === cents
                      ? "border-primary bg-primary-light text-primary"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  } disabled:opacity-50`}
                >
                  {topUpLoading === cents ? "..." : formatDollars(cents)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="5"
                  step="1"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <button
                onClick={handleCustomTopUp}
                disabled={topUpLoading !== null}
                className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-gray-200 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {topUpLoading === "custom" ? "..." : "Top up"}
              </button>
            </div>
          </section>

          {/* Transaction History */}
          {transactions.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Transaction History</h3>
              <div className="space-y-0 max-h-64 overflow-y-auto">
                {transactions.map((tx, i) => (
                  <div key={tx.id} className={`flex justify-between items-center py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                    <div>
                      <span className="text-sm text-gray-700">{tx.description}</span>
                      <span className="text-gray-400 ml-2 text-xs">
                        {new Date(tx.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span className={`font-mono text-sm ${tx.amount_cents >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {tx.amount_cents >= 0 ? "+" : ""}{formatDollars(tx.amount_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Usage */}
          {usage && Object.keys(usage.usage).length > 0 && (
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Usage</h3>
              <ul className="space-y-3 text-sm">
                {Object.entries(usage.usage).map(([metric, total]) => (
                  <li key={metric} className="flex justify-between text-gray-700">
                    <span className="capitalize">{metric.replace(/_/g, " ")}</span>
                    <span className="font-mono text-gray-900">{total}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
