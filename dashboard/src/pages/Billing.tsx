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
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-100 mb-6">Billing</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        {/* Balance */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Balance</h3>
          <p className="text-3xl font-bold text-slate-100">
            {formatDollars(account?.balance_cents ?? 0)}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Head open: $5.00 &middot; API request: $0.01
          </p>
        </section>

        {/* Top Up */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Add funds</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_AMOUNTS.map((cents) => (
              <button
                key={cents}
                onClick={() => handleTopUp(cents, cents)}
                disabled={topUpLoading !== null}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {topUpLoading === cents ? "..." : formatDollars(cents)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                min="5"
                step="1"
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleCustomTopUp}
              disabled={topUpLoading !== null}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {topUpLoading === "custom" ? "..." : "Top up"}
            </button>
          </div>
        </section>

        {/* Usage */}
        {usage && Object.keys(usage.usage).length > 0 && (
          <section className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Usage</h3>
            <ul className="space-y-2 text-sm">
              {Object.entries(usage.usage).map(([metric, total]) => (
                <li key={metric} className="flex justify-between text-slate-300">
                  <span className="capitalize">{metric.replace(/_/g, " ")}</span>
                  <span className="font-mono">{total}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Transaction History */}
        {transactions.length > 0 && (
          <section className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Transaction history</h3>
            <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center text-slate-300">
                  <div>
                    <span>{tx.description}</span>
                    <span className="text-slate-500 ml-2 text-xs">
                      {new Date(tx.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className={tx.amount_cents >= 0 ? "text-green-400 font-mono" : "text-red-400 font-mono"}>
                    {tx.amount_cents >= 0 ? "+" : ""}{formatDollars(tx.amount_cents)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
