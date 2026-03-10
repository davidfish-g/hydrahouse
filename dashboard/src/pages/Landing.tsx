import { Link } from "react-router-dom";

function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight text-indigo-400">
          HydraHouse
        </span>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">How It Works</a>
          <a href="#api" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">API</a>
          <Link
            to="/login"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>
        <Link
          to="/login"
          className="md:hidden px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Get Started
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 text-center lg:text-left">
          <span className="inline-block px-3 py-1 mb-6 text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            Now on Cardano Preview, Preprod &amp; Mainnet
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
            Hydra Heads<span className="text-indigo-400"> /</span>
            <br />
            Without the Ops
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-xl">
            Provision and manage Cardano Hydra heads with a single API call. We handle node orchestration, key generation, peer networking, and lifecycle management.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link
              to="/login"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors text-center"
            >
              Start Building
            </Link>
            <Link
              to="/docs"
              className="px-6 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 font-medium rounded-lg transition-colors text-center"
            >
              Read the Docs
            </Link>
          </div>
        </div>

        {/* Architecture diagram */}
        <div className="hidden lg:block flex-1">
          <svg viewBox="0 0 400 200" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Your App */}
            <rect x="10" y="70" width="100" height="60" rx="8" className="stroke-slate-600" strokeWidth="1.5" fill="#1e293b" />
            <text x="60" y="105" textAnchor="middle" className="fill-slate-300" fontSize="13" fontWeight="500">Your App</text>

            {/* Arrow 1 */}
            <line x1="110" y1="100" x2="150" y2="100" className="stroke-indigo-400" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* HydraHouse API */}
            <rect x="150" y="70" width="120" height="60" rx="8" className="stroke-indigo-500" strokeWidth="1.5" fill="#1e293b" />
            <text x="210" y="98" textAnchor="middle" className="fill-indigo-400" fontSize="12" fontWeight="600">HydraHouse</text>
            <text x="210" y="114" textAnchor="middle" className="fill-indigo-400" fontSize="12" fontWeight="600">API</text>

            {/* Arrow 2 */}
            <line x1="270" y1="100" x2="310" y2="100" className="stroke-indigo-400" strokeWidth="1.5" markerEnd="url(#arrow)" />

            {/* Hydra Head */}
            <rect x="310" y="70" width="80" height="60" rx="8" className="stroke-emerald-500" strokeWidth="1.5" fill="#1e293b" />
            <text x="350" y="98" textAnchor="middle" className="fill-emerald-400" fontSize="12" fontWeight="600">Hydra</text>
            <text x="350" y="114" textAnchor="middle" className="fill-emerald-400" fontSize="12" fontWeight="600">Head</text>

            {/* Arrow marker */}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0L8 4L0 8" className="fill-indigo-400" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>
    </section>
  );
}

const metrics = [
  { value: "< 30s", label: "Head open time" },
  { value: "10", label: "Participants per head" },
  { value: "1", label: "API call to start" },
  { value: "24/7", label: "Lifecycle management" },
];

function Metrics() {
  return (
    <section className="border-t border-slate-800 py-12 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-3xl font-bold text-white">{m.value}</div>
            <div className="mt-1 text-sm text-slate-400">{m.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const features = [
  {
    title: "One-Call Provisioning",
    desc: "Spin up a fully configured Hydra head with a single POST request. No node setup, no config files.",
    icon: (
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: "Full Lifecycle",
    desc: "Automatic state management from Init through Commit, Open, Close, and Fanout. We handle it all.",
    icon: (
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
  },
  {
    title: "Real-Time WebSocket",
    desc: "Stream transactions and state updates in real time through our WebSocket proxy to your Hydra node.",
    icon: (
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    title: "Multi-Party Heads",
    desc: "Create heads with up to 10 participants. We coordinate peer discovery and mutual commitment automatically.",
    icon: (
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    title: "Incremental Deposits",
    desc: "Add or remove funds from an open head without closing it. Flexible liquidity management built in.",
    icon: (
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5m4.5 4.5V4.5" />
      </svg>
    ),
  },
  {
    title: "Preview, Preprod & Mainnet",
    desc: "Test on Cardano preview or preprod with zero risk, then deploy to mainnet with the same API. No code changes needed.",
    icon: (
      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.528.38-2.967 1.05-4.228" />
      </svg>
    ),
  },
];

function Features() {
  return (
    <section id="features" className="py-20 px-6 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-4">Everything you need for L2 on Cardano</h2>
        <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
          Focus on your application logic. We handle the Hydra infrastructure.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    num: "1",
    title: "Create",
    desc: "POST /v1/heads with your desired network and participants. We provision nodes, generate keys, and initialize the head.",
  },
  {
    num: "2",
    title: "Transact",
    desc: "Submit L2 transactions via REST or stream them over WebSocket. Near-instant finality, near-zero fees.",
  },
  {
    num: "3",
    title: "Close",
    desc: "Close the head when you're done. Funds fan out to L1, infrastructure tears down automatically.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={s.num} className="relative flex flex-col items-center text-center">
              {/* Dashed connector (hidden on mobile, hidden on last item) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] border-t-2 border-dashed border-slate-700" />
              )}
              <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg mb-4 relative z-10">
                {s.num}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 max-w-xs">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeExample() {
  return (
    <section id="api" className="py-20 px-6 scroll-mt-20">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-bold text-white mb-4">Simple, powerful API</h2>
          <p className="text-slate-400 mb-6 leading-relaxed">
            One API call creates a fully managed Hydra head. Authenticate with your API key, specify the network and participants, and you're live.
          </p>
          <Link
            to="/docs/api"
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
          >
            View full API reference &rarr;
          </Link>
        </div>

        {/* Terminal window */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="ml-2 text-xs text-slate-500">terminal</span>
          </div>
          <pre className="p-5 text-sm leading-relaxed overflow-x-auto">
            <code>
              <span className="text-slate-500">{"# Create a Hydra head\n"}</span>
              <span className="text-slate-300">{"curl -X POST "}</span>
              <span className="text-emerald-400">{"/v1/heads"}</span>
              <span className="text-slate-300">{" \\\n"}</span>
              <span className="text-slate-300">{"  -H "}</span>
              <span className="text-emerald-400">{'"Authorization: Bearer hh_sk_..."'}</span>
              <span className="text-slate-300">{" \\\n"}</span>
              <span className="text-slate-300">{"  -d "}</span>
              <span className="text-emerald-400">{"'{\n"}</span>
              <span className="text-emerald-400">{"    "}</span>
              <span className="text-indigo-300">{'"network"'}</span>
              <span className="text-emerald-400">{": "}</span>
              <span className="text-emerald-400">{'"preprod"'}</span>
              <span className="text-emerald-400">{",\n"}</span>
              <span className="text-emerald-400">{"    "}</span>
              <span className="text-indigo-300">{'"participants"'}</span>
              <span className="text-emerald-400">{": "}</span>
              <span className="text-emerald-400">{"2\n"}</span>
              <span className="text-emerald-400">{"  }'"}</span>
              {"\n\n"}
              <span className="text-slate-500">{"# Response\n"}</span>
              <span className="text-slate-300">{"{\n"}</span>
              <span className="text-slate-300">{"  "}</span>
              <span className="text-indigo-300">{'"id"'}</span>
              <span className="text-slate-300">{": "}</span>
              <span className="text-emerald-400">{'"hd_a1b2c3d4"'}</span>
              <span className="text-slate-300">{",\n"}</span>
              <span className="text-slate-300">{"  "}</span>
              <span className="text-indigo-300">{'"status"'}</span>
              <span className="text-slate-300">{": "}</span>
              <span className="text-emerald-400">{'"initializing"'}</span>
              <span className="text-slate-300">{",\n"}</span>
              <span className="text-slate-300">{"  "}</span>
              <span className="text-indigo-300">{'"network"'}</span>
              <span className="text-slate-300">{": "}</span>
              <span className="text-emerald-400">{'"preprod"'}</span>
              <span className="text-slate-300">{",\n"}</span>
              <span className="text-slate-300">{"  "}</span>
              <span className="text-indigo-300">{'"ws_url"'}</span>
              <span className="text-slate-300">{": "}</span>
              <span className="text-emerald-400">{'"wss://api.hydrahouse.io/v1/heads/hd_a1b2c3d4/ws"'}</span>
              {"\n"}
              <span className="text-slate-300">{"}"}</span>
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function CtaBanner() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto text-center rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/10 to-transparent p-12">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to build on Hydra?</h2>
        <p className="text-slate-400 mb-8">
          Create a free account and deploy your first head in under a minute.
        </p>
        <Link
          to="/login"
          className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
        >
          Create Free Account
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-800 py-8 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <span className="text-xs text-slate-600">&copy; {new Date().getFullYear()} HydraHouse</span>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <NavBar />
      <Hero />
      <Metrics />
      <Features />
      <HowItWorks />
      <CodeExample />
      <CtaBanner />
      <Footer />
    </div>
  );
}
