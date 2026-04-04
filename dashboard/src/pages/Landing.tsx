import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  RefreshCw,
  Radio,
  Users,
  ArrowUpDown,
  Globe,
  ArrowRight,
  Github,
} from "lucide-react";

/*
 * Design tokens from DESIGN.md — "Algorithmic Elegance"
 * Section separation via background shifts, never borders.
 */
const SURFACE = "bg-[#f8f9ff]"; // base
const SURFACE_LOW = "bg-[#eef4ff]"; // secondary content
const TEXT = "text-[#121c28]"; // on-surface, never #000

/* ── NavBar ────────────────────────────────────────────────── */

function NavBar() {
  return (
    <nav className="sticky top-0 z-50 bg-[#f8f9ff]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex items-center gap-2.5"
        >
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#0A6E5C" opacity="0.08" />
            <line x1="16" y1="26" x2="16" y2="15" stroke="#0A6E5C" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M16 15 C14 12 10.5 10 8 8" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" fill="none" />
            <line x1="16" y1="15" x2="16" y2="6.5" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 15 C18 12 21.5 10 24 8" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="8" cy="8" r="2.5" fill="#10B981" />
            <circle cx="16" cy="6.5" r="2.5" fill="#10B981" />
            <circle cx="24" cy="8" r="2.5" fill="#10B981" />
          </svg>
          <span className={`text-base font-semibold ${TEXT} tracking-tight`}>HydraHouse</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-sm text-[#121c28]/60 hover:text-[#121c28] transition-colors">How It Works</a>
          <a href="#features" className="text-sm text-[#121c28]/60 hover:text-[#121c28] transition-colors">Features</a>
          <a href="#api" className="text-sm text-[#121c28]/60 hover:text-[#121c28] transition-colors">API</a>
          <a href="#pricing" className="text-sm text-[#121c28]/60 hover:text-[#121c28] transition-colors">Pricing</a>
          <a
            href="https://github.com/davidfish-g/hydrahouse"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#121c28]/60 hover:text-[#121c28] transition-colors"
          >
            <Github size={18} />
          </a>
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-white rounded-md bg-gradient-to-br from-[#006c49] to-[#10b981] hover:from-[#005a3d] hover:to-[#0ea572] transition-all"
          >
            Log In
          </Link>
        </div>
        <Link
          to="/login"
          className="md:hidden px-4 py-2 text-sm font-medium text-white rounded-md bg-gradient-to-br from-[#006c49] to-[#10b981]"
        >
          Log In
        </Link>
      </div>
    </nav>
  );
}

/* ── Hero ──────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className={`pt-20 pb-24 px-6 ${SURFACE}`}>
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 text-center lg:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-[#006c49] bg-[#10b981]/8 rounded-full font-[JetBrains_Mono,monospace]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
            Now on Cardano Preview, Preprod &amp; Mainnet
          </span>
          <h1 className={`text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight ${TEXT} leading-[1.1]`}>
            Hydra Heads
            <br />
            <span className="text-[#121c28]/35">as a Service</span>
          </h1>
          <p className="mt-6 text-[#121c28]/50 text-lg leading-relaxed max-w-lg mx-auto lg:mx-0">
            Spin up Cardano L2 Hydra heads with a single API call. We handle
            node provisioning, key management, peer networking, and lifecycle.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link
              to="/login"
              className="px-6 py-3 text-center text-sm font-medium text-white rounded-md bg-gradient-to-br from-[#006c49] to-[#10b981] hover:from-[#005a3d] hover:to-[#0ea572] transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)]"
            >
              Start Building
            </Link>
            <Link
              to="/docs"
              className="px-6 py-3 text-center text-sm font-medium text-[#006c49] rounded-md border border-[#006c49]/15 hover:bg-[#006c49]/4 transition-all"
            >
              Read the Docs
            </Link>
          </div>
        </div>

        {/* Terminal graphic */}
        <div className="flex-1 hidden lg:block">
          <div className="bg-[#27313e] rounded-lg overflow-hidden shadow-[0_20px_40px_rgba(18,28,40,0.12)]">
            <div className="flex items-center gap-1.5 px-4 py-3 bg-[#1e2730]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[11px] font-[JetBrains_Mono,monospace] text-[#f8f9ff]/30">terminal</span>
            </div>
            <pre className="p-5 text-[13px] leading-relaxed font-[JetBrains_Mono,monospace] overflow-x-auto">
              <code>
                <span className="text-[#f8f9ff]/30">{"# Create a Hydra head\n"}</span>
                <span className="text-[#f8f9ff]/70">{"curl -X POST "}</span>
                <span className="text-[#10b981]">{"/v1/heads"}</span>
                <span className="text-[#f8f9ff]/40">{" \\\n"}</span>
                <span className="text-[#f8f9ff]/70">{"  -H "}</span>
                <span className="text-[#febc2e]">{'"Authorization: Bearer hh_sk_..."'}</span>
                <span className="text-[#f8f9ff]/40">{" \\\n"}</span>
                <span className="text-[#f8f9ff]/70">{"  -d "}</span>
                <span className="text-[#10b981]">{"'{\n"}</span>
                <span className="text-[#10b981]">{"    "}</span>
                <span className="text-[#7dd3fc]">{'"network"'}</span>
                <span className="text-[#10b981]">{": "}</span>
                <span className="text-[#10b981]">{'"preprod"'}</span>
                <span className="text-[#f8f9ff]/30">{",\n"}</span>
                <span className="text-[#10b981]">{"    "}</span>
                <span className="text-[#7dd3fc]">{'"participants"'}</span>
                <span className="text-[#10b981]">{": "}</span>
                <span className="text-[#febc2e]">{"2"}</span>
                {"\n"}
                <span className="text-[#10b981]">{"  }'"}</span>
                {"\n\n"}
                <span className="text-[#f8f9ff]/30">{"// 201 Created\n"}</span>
                <span className="text-[#f8f9ff]/50">{"{\n"}</span>
                <span className="text-[#f8f9ff]/50">{"  "}</span>
                <span className="text-[#7dd3fc]">{'"id"'}</span>
                <span className="text-[#f8f9ff]/30">{": "}</span>
                <span className="text-[#10b981]">{'"hd_a1b2c3d4"'}</span>
                <span className="text-[#f8f9ff]/30">{",\n"}</span>
                <span className="text-[#f8f9ff]/50">{"  "}</span>
                <span className="text-[#7dd3fc]">{'"status"'}</span>
                <span className="text-[#f8f9ff]/30">{": "}</span>
                <span className="text-[#10b981]">{'"initializing"'}</span>
                <span className="text-[#f8f9ff]/30">{",\n"}</span>
                <span className="text-[#f8f9ff]/50">{"  "}</span>
                <span className="text-[#7dd3fc]">{'"ws_url"'}</span>
                <span className="text-[#f8f9ff]/30">{": "}</span>
                <span className="text-[#10b981]">{'"wss://api.hydrahouse.xyz/..."'}</span>
                {"\n"}
                <span className="text-[#f8f9ff]/50">{"}"}</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── How It Works ──────────────────────────────────────────── */

const STEPS = [
  {
    num: "01",
    title: "Create",
    desc: "POST /v1/heads with your desired network and participants. We provision nodes, generate keys, and initialize the head.",
    icon: Zap,
  },
  {
    num: "02",
    title: "Transact",
    desc: "Submit L2 transactions via REST or stream them over WebSocket. Near-instant finality, near-zero fees.",
    icon: RefreshCw,
  },
  {
    num: "03",
    title: "Close",
    desc: "Close the head when you're done. Funds fan out to L1, infrastructure tears down automatically.",
    icon: ArrowRight,
  },
];

const METRICS = [
  { value: "< 30s", label: "Head open time" },
  { value: "10", label: "Participants per head" },
  { value: "1", label: "API call to start" },
  { value: "24/7", label: "Lifecycle management" },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className={`py-24 px-6 scroll-mt-20 ${SURFACE_LOW}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#006c49] font-[JetBrains_Mono,monospace] mb-3 text-center">
          How It Works
        </p>
        <h2 className={`text-3xl sm:text-4xl font-bold ${TEXT} text-center mb-16`}>
          Three Simple Steps
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="bg-white rounded-lg p-6 shadow-[0_20px_40px_rgba(18,28,40,0.04)] hover:bg-[#f0f4ff] transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#006c49] to-[#10b981] flex items-center justify-center">
                  <s.icon size={18} className="text-white" />
                </div>
                <span className="text-xs font-bold text-[#121c28]/20 font-[JetBrains_Mono,monospace]">
                  {s.num}
                </span>
              </div>
              <h3 className={`text-lg font-semibold ${TEXT} mb-2`}>{s.title}</h3>
              <p className="text-sm text-[#121c28]/45 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Metrics strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          {METRICS.map((m) => (
            <div key={m.label} className="bg-white rounded-lg p-5 shadow-[0_20px_40px_rgba(18,28,40,0.04)]">
              <div className={`text-2xl font-bold ${TEXT} font-[JetBrains_Mono,monospace]`}>{m.value}</div>
              <div className="mt-1 text-xs text-[#121c28]/40">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ──────────────────────────────────────────────── */

const FEATURES = [
  {
    title: "One-Call Provisioning",
    desc: "Spin up a fully configured Hydra head with a single POST request. No node setup, no config files.",
    icon: Zap,
  },
  {
    title: "Full Lifecycle",
    desc: "Automatic state management from Init through Commit, Open, Close, and Fanout. We handle it all.",
    icon: RefreshCw,
  },
  {
    title: "Real-Time WebSocket",
    desc: "Stream transactions and state updates in real time through our WebSocket proxy to your Hydra node.",
    icon: Radio,
  },
  {
    title: "Multi-Party Heads",
    desc: "Create heads with up to 10 participants. We coordinate peer discovery and mutual commitment automatically.",
    icon: Users,
  },
  {
    title: "Incremental Deposits",
    desc: "Add or remove funds from an open head without closing it. Flexible liquidity management built in.",
    icon: ArrowUpDown,
  },
  {
    title: "Preview, Preprod & Mainnet",
    desc: "Test on Cardano preview or preprod with zero risk, then deploy to mainnet with the same API.",
    icon: Globe,
  },
];

function Features() {
  return (
    <section id="features" className={`py-24 px-6 scroll-mt-20 ${SURFACE}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#006c49] font-[JetBrains_Mono,monospace] mb-3 text-center">
          Features
        </p>
        <h2 className={`text-3xl sm:text-4xl font-bold ${TEXT} text-center mb-16`}>
          Everything You Need for L2 on Cardano
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-[#eef4ff] rounded-lg p-6 hover:bg-[#e4ecff] transition-colors"
            >
              <div className="w-10 h-10 rounded-md bg-white flex items-center justify-center mb-4 shadow-[0_20px_40px_rgba(18,28,40,0.04)]">
                <f.icon size={18} className="text-[#006c49]" />
              </div>
              <h3 className={`text-base font-semibold ${TEXT} mb-2`}>{f.title}</h3>
              <p className="text-sm text-[#121c28]/45 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Code Showcase (tabbed) ────────────────────────────────── */

const CODE_TABS = [
  {
    label: "Create Head",
    code: [
      { text: "$ ", color: "#f8f9ff30" },
      { text: "curl", color: "#f8f9ff" },
      { text: " -X POST ", color: "#f8f9ff70" },
      { text: "https://api.hydrahouse.xyz/v1/heads", color: "#10b981" },
      { text: " \\\n", color: "#f8f9ff30" },
      { text: "  -H ", color: "#f8f9ff70" },
      { text: '"Authorization: Bearer $HH_API_KEY"', color: "#febc2e" },
      { text: " \\\n", color: "#f8f9ff30" },
      { text: "  -d ", color: "#f8f9ff70" },
      { text: "'", color: "#10b981" },
      { text: '{"network":"preprod","participants":2}', color: "#10b981" },
      { text: "'", color: "#10b981" },
    ],
  },
  {
    label: "Deposit Funds",
    code: [
      { text: "$ ", color: "#f8f9ff30" },
      { text: "curl", color: "#f8f9ff" },
      { text: " -X POST ", color: "#f8f9ff70" },
      { text: "https://api.hydrahouse.xyz/v1/heads/{id}/deposit", color: "#10b981" },
      { text: " \\\n", color: "#f8f9ff30" },
      { text: "  -H ", color: "#f8f9ff70" },
      { text: '"Authorization: Bearer $HH_API_KEY"', color: "#febc2e" },
      { text: " \\\n", color: "#f8f9ff30" },
      { text: "  -d ", color: "#f8f9ff70" },
      { text: "'", color: "#10b981" },
      { text: '{"slot":0}', color: "#10b981" },
      { text: "'", color: "#10b981" },
    ],
  },
  {
    label: "Transfer L2",
    code: [
      { text: "$ ", color: "#f8f9ff30" },
      { text: "curl", color: "#f8f9ff" },
      { text: " -X POST ", color: "#f8f9ff70" },
      { text: "https://api.hydrahouse.xyz/v1/heads/{id}/transfer", color: "#10b981" },
      { text: " \\\n", color: "#f8f9ff30" },
      { text: "  -H ", color: "#f8f9ff70" },
      { text: '"Authorization: Bearer $HH_API_KEY"', color: "#febc2e" },
      { text: " \\\n", color: "#f8f9ff30" },
      { text: "  -d ", color: "#f8f9ff70" },
      { text: "'", color: "#10b981" },
      { text: '{"from":0,"to":1,"lovelace":5000000}', color: "#10b981" },
      { text: "'", color: "#10b981" },
    ],
  },
  {
    label: "WebSocket",
    code: [
      { text: "const ", color: "#c084fc" },
      { text: "ws ", color: "#f8f9ff" },
      { text: "= ", color: "#f8f9ff70" },
      { text: "new ", color: "#c084fc" },
      { text: "WebSocket", color: "#febc2e" },
      { text: "(\n", color: "#f8f9ff70" },
      { text: '  "wss://api.hydrahouse.xyz/v1/heads/{id}/ws"', color: "#10b981" },
      { text: "\n);\n\n", color: "#f8f9ff70" },
      { text: "ws", color: "#f8f9ff" },
      { text: ".", color: "#f8f9ff70" },
      { text: "onmessage ", color: "#7dd3fc" },
      { text: "= ", color: "#f8f9ff70" },
      { text: "(", color: "#f8f9ff70" },
      { text: "e", color: "#f8f9ff" },
      { text: ") ", color: "#f8f9ff70" },
      { text: "=> ", color: "#c084fc" },
      { text: "{\n", color: "#f8f9ff70" },
      { text: "  console", color: "#f8f9ff" },
      { text: ".", color: "#f8f9ff70" },
      { text: "log", color: "#7dd3fc" },
      { text: "(", color: "#f8f9ff70" },
      { text: "JSON", color: "#febc2e" },
      { text: ".", color: "#f8f9ff70" },
      { text: "parse", color: "#7dd3fc" },
      { text: "(", color: "#f8f9ff70" },
      { text: "e", color: "#f8f9ff" },
      { text: ".", color: "#f8f9ff70" },
      { text: "data", color: "#f8f9ff" },
      { text: "));\n", color: "#f8f9ff70" },
      { text: "};", color: "#f8f9ff70" },
    ],
  },
];

function CodeShowcase() {
  const [tab, setTab] = useState(0);
  const active = CODE_TABS[tab];

  return (
    <section id="api" className={`py-24 px-6 scroll-mt-20 ${SURFACE_LOW}`}>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#006c49] font-[JetBrains_Mono,monospace] mb-3">
            Developer Experience
          </p>
          <h2 className={`text-3xl sm:text-4xl font-bold ${TEXT} mb-6`}>
            One API Call to a Managed Hydra Head
          </h2>
          <Link
            to="/docs/api"
            className="text-[#006c49] hover:text-[#005a3d] text-sm font-medium transition-colors inline-flex items-center gap-1.5"
          >
            View full API reference <ArrowRight size={14} />
          </Link>
        </div>

        <div className="bg-[#27313e] rounded-lg overflow-hidden shadow-[0_20px_40px_rgba(18,28,40,0.12)]">
          {/* Tabs */}
          <div className="flex gap-0 bg-[#1e2730] overflow-x-auto">
            {CODE_TABS.map((t, i) => (
              <button
                key={t.label}
                onClick={() => setTab(i)}
                className={`px-4 py-3 text-xs font-[JetBrains_Mono,monospace] whitespace-nowrap transition-colors ${
                  i === tab
                    ? "text-[#10b981] bg-[#27313e] border-b-2 border-[#10b981]"
                    : "text-[#f8f9ff]/30 hover:text-[#f8f9ff]/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <pre className="p-5 text-[13px] leading-relaxed font-[JetBrains_Mono,monospace] overflow-x-auto min-h-[180px]">
            <code>
              {active.code.map((seg, i) => (
                <span key={i} style={{ color: seg.color }}>
                  {seg.text}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ───────────────────────────────────────────────── */

function Pricing() {
  return (
    <section id="pricing" className={`py-24 px-6 scroll-mt-20 ${SURFACE}`}>
      <div className="max-w-4xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#006c49] font-[JetBrains_Mono,monospace] mb-3 text-center">
          Pricing
        </p>
        <h2 className={`text-3xl sm:text-4xl font-bold ${TEXT} text-center mb-14`}>
          Pay as you go. Testnets Free Forever.
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Testnets */}
          <div className="relative bg-[#eef4ff] rounded-lg p-7">
            <span className="absolute -top-3 left-6 text-[10px] font-bold uppercase tracking-widest text-white bg-gradient-to-r from-[#006c49] to-[#10b981] px-3 py-1 rounded-sm">
              Testnets
            </span>
            <p className="text-xs font-semibold text-[#006c49] uppercase tracking-wider mb-6 mt-2 font-[JetBrains_Mono,monospace]">
              Preprod &amp; Preview
            </p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className={`text-5xl font-bold tracking-tight ${TEXT}`}>Free</span>
            </div>
            <p className="text-sm text-[#121c28]/35 mb-6">no limits, no credit card</p>
            <p className="text-xs text-[#121c28]/40 leading-relaxed">
              Full access to head creation, lifecycle management, deposits,
              transfers, and all API endpoints on preprod and preview.
            </p>
          </div>

          {/* Per Head */}
          <div className="bg-white rounded-lg p-7 shadow-[0_20px_40px_rgba(18,28,40,0.06)]">
            <p className="text-xs font-semibold text-[#006c49] uppercase tracking-wider mb-6 font-[JetBrains_Mono,monospace]">
              Mainnet — Per Head
            </p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className={`text-5xl font-bold tracking-tight ${TEXT}`}>$5</span>
              <span className="text-sm text-[#121c28]/35">/head</span>
            </div>
            <p className="text-sm text-[#121c28]/35 mb-6">one-time per head opened</p>
            <p className="text-xs text-[#121c28]/40 leading-relaxed">
              Provisioning, key generation, orchestration, and full lifecycle
              management through fanout.
            </p>
          </div>

          {/* Per Request */}
          <div className="bg-white rounded-lg p-7 shadow-[0_20px_40px_rgba(18,28,40,0.06)]">
            <p className="text-xs font-semibold text-[#006c49] uppercase tracking-wider mb-6 font-[JetBrains_Mono,monospace]">
              Mainnet — Per Request
            </p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className={`text-5xl font-bold tracking-tight ${TEXT}`}>$0.01</span>
              <span className="text-sm text-[#121c28]/35">/call</span>
            </div>
            <p className="text-sm text-[#121c28]/35 mb-6">per authenticated API call</p>
            <p className="text-xs text-[#121c28]/40 leading-relaxed">
              Deposits, transfers, withdrawals, snapshots, transaction
              submissions, and all other endpoints.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Open Source Banner ─────────────────────────────────────── */

function OpenSource() {
  return (
    <section className={`py-24 px-6 ${SURFACE_LOW}`}>
      <div className="max-w-3xl mx-auto text-center">
        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-[#006c49] to-[#10b981] flex items-center justify-center mx-auto mb-6">
          <Github size={24} className="text-white" />
        </div>
        <h2 className={`text-3xl sm:text-4xl font-bold ${TEXT} mb-4`}>
          HydraHouse is open source.
        </h2>
        <p className="text-[#121c28]/45 leading-relaxed max-w-lg mx-auto mb-8">
          Audit the code, run your own instance, or contribute. MIT licensed — built in the open for the Cardano ecosystem.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://github.com/davidfish-g/hydrahouse"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 text-center text-sm font-medium text-white rounded-md bg-gradient-to-br from-[#006c49] to-[#10b981] hover:from-[#005a3d] hover:to-[#0ea572] transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)] inline-flex items-center justify-center gap-2"
          >
            <Github size={16} /> View on GitHub
          </a>
          <Link
            to="/login"
            className="px-6 py-3 text-center text-sm font-medium text-[#006c49] rounded-md border border-[#006c49]/15 hover:bg-[#006c49]/4 transition-all"
          >
            Create Account
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className={`py-10 px-6 ${SURFACE}`}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#0A6E5C" opacity="0.08" />
            <line x1="16" y1="26" x2="16" y2="15" stroke="#0A6E5C" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M16 15 C14 12 10.5 10 8 8" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" fill="none" />
            <line x1="16" y1="15" x2="16" y2="6.5" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 15 C18 12 21.5 10 24 8" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="8" cy="8" r="2.5" fill="#10B981" />
            <circle cx="16" cy="6.5" r="2.5" fill="#10B981" />
            <circle cx="24" cy="8" r="2.5" fill="#10B981" />
          </svg>
          <span className="text-xs text-[#121c28]/35">
            &copy; {new Date().getFullYear()} HydraHouse
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/docs" className="text-xs text-[#121c28]/40 hover:text-[#121c28]/70 transition-colors">Docs</Link>
          <Link to="/docs/api" className="text-xs text-[#121c28]/40 hover:text-[#121c28]/70 transition-colors">API Reference</Link>
          <a
            href="https://github.com/davidfish-g/hydrahouse"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#121c28]/40 hover:text-[#121c28]/70 transition-colors"
          >
            GitHub
          </a>
          <a
            href="mailto:davidfish3@gmail.com"
            className="text-xs text-[#121c28]/40 hover:text-[#121c28]/70 transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

export default function Landing() {
  return (
    <div className={`min-h-screen ${SURFACE} ${TEXT}`}>
      <NavBar />
      <Hero />
      <HowItWorks />
      <Features />
      <CodeShowcase />
      <Pricing />
      <OpenSource />
      <Footer />
    </div>
  );
}
