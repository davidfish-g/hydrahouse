import { Link } from "react-router-dom";
import { Zap, RefreshCw, Radio, Users, ArrowUpDown, Globe, ArrowRight } from "lucide-react";

function NavBar() {
  return (
    <>
      <div className="h-0.5 bg-gradient-to-r from-primary to-emerald-400" />
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L28.66 9.5V24.5L16 32L3.34 24.5V9.5L16 2Z" fill="#0A6E5C" opacity="0.1" stroke="#0A6E5C" strokeWidth="1.5"/>
              <text x="16" y="21" textAnchor="middle" fill="#0A6E5C" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">H</text>
            </svg>
            <span className="text-base font-semibold text-gray-900 tracking-tight">HydraHouse</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
            <a href="#api" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">API</a>
            <Link
              to="/login"
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
          <Link
            to="/login"
            className="md:hidden px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </>
  );
}

function Hero() {
  return (
    <section className="pt-24 pb-20 px-6 bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 text-center lg:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-primary bg-primary-light border border-primary/10 rounded-full">
            Now on Cardano Preview, Preprod &amp; Mainnet
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-gray-900 leading-tight">
            Managed Hydra Heads<span className="text-primary">.</span>
            <br />
            <span className="text-gray-400">One API call.</span>
          </h1>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link
              to="/login"
              className="px-6 py-3 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors text-center"
            >
              Start Building
            </Link>
            <Link
              to="/docs"
              className="px-6 py-3 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors text-center"
            >
              Read the Docs
            </Link>
          </div>
        </div>

        {/* Illustration */}
        <div className="hidden lg:block flex-1">
          <div className="relative">
            {/* Dot grid background */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="#E5E7EB" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
            <svg viewBox="0 0 400 200" className="w-full max-w-md relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Your App */}
              <rect x="10" y="70" width="100" height="60" rx="12" fill="white" stroke="#E5E7EB" strokeWidth="1.5" />
              <text x="60" y="105" textAnchor="middle" fill="#374151" fontSize="13" fontWeight="500">Your App</text>

              {/* Animated dashed line 1 */}
              <line x1="110" y1="100" x2="150" y2="100" stroke="#0A6E5C" strokeWidth="1.5" strokeDasharray="4 4">
                <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
              </line>

              {/* HydraHouse API */}
              <rect x="150" y="70" width="120" height="60" rx="12" fill="white" stroke="#0A6E5C" strokeWidth="1.5" />
              <text x="210" y="98" textAnchor="middle" fill="#0A6E5C" fontSize="12" fontWeight="600">HydraHouse</text>
              <text x="210" y="114" textAnchor="middle" fill="#0A6E5C" fontSize="12" fontWeight="600">API</text>

              {/* Animated dashed line 2 */}
              <line x1="270" y1="100" x2="310" y2="100" stroke="#0A6E5C" strokeWidth="1.5" strokeDasharray="4 4">
                <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
              </line>

              {/* Hydra Head */}
              <rect x="310" y="70" width="80" height="60" rx="12" fill="white" stroke="#10B981" strokeWidth="1.5" />
              <text x="350" y="98" textAnchor="middle" fill="#059669" fontSize="12" fontWeight="600">Hydra</text>
              <text x="350" y="114" textAnchor="middle" fill="#059669" fontSize="12" fontWeight="600">Head</text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

const metrics = [
  { value: "< 30s", label: "Head open time", icon: Zap },
  { value: "10", label: "Participants per head", icon: Users },
  { value: "1", label: "API call to start", icon: ArrowRight },
  { value: "24/7", label: "Lifecycle management", icon: RefreshCw },
];

function Metrics() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-l-[3px] border-l-primary">
            <m.icon size={20} className="text-primary mb-2" />
            <div className="text-3xl font-bold text-gray-900">{m.value}</div>
            <div className="mt-1 text-[13px] text-gray-500">{m.label}</div>
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
    <section id="features" className="py-20 px-6 scroll-mt-20 bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Everything you need for L2 on Cardano</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-4">
                <f.icon size={20} className="text-primary" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
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
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={s.num} className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] border-t-2 border-dashed border-gray-200" />
              )}
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg mb-4 relative z-10">
                {s.num}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 max-w-xs">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeExample() {
  return (
    <section id="api" className="py-20 px-6 scroll-mt-20 bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, powerful API</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            One API call creates a fully managed Hydra head. Authenticate with your API key, specify the network and participants, and you're live.
          </p>
          <Link
            to="/docs/api"
            className="text-primary hover:text-primary-hover text-sm font-medium transition-colors inline-flex items-center gap-1"
          >
            View full API reference <ArrowRight size={14} />
          </Link>
        </div>

        {/* Code block */}
        <div className="bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-800">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
            <span className="ml-2 text-xs text-gray-500">terminal</span>
          </div>
          <pre className="p-5 text-sm leading-relaxed overflow-x-auto">
            <code>
              <span className="text-gray-500">{"# Create a Hydra head\n"}</span>
              <span className="text-gray-300">{"curl -X POST "}</span>
              <span className="text-emerald-400">{"/v1/heads"}</span>
              <span className="text-gray-300">{" \\\n"}</span>
              <span className="text-gray-300">{"  -H "}</span>
              <span className="text-emerald-400">{'"Authorization: Bearer hh_sk_..."'}</span>
              <span className="text-gray-300">{" \\\n"}</span>
              <span className="text-gray-300">{"  -d "}</span>
              <span className="text-emerald-400">{"'{\n"}</span>
              <span className="text-emerald-400">{"    "}</span>
              <span className="text-sky-300">{'"network"'}</span>
              <span className="text-emerald-400">{": "}</span>
              <span className="text-emerald-400">{'"preprod"'}</span>
              <span className="text-emerald-400">{",\n"}</span>
              <span className="text-emerald-400">{"    "}</span>
              <span className="text-sky-300">{'"participants"'}</span>
              <span className="text-emerald-400">{": "}</span>
              <span className="text-emerald-400">{"2\n"}</span>
              <span className="text-emerald-400">{"  }'"}</span>
              {"\n\n"}
              <span className="text-gray-500">{"# Response\n"}</span>
              <span className="text-gray-300">{"{\n"}</span>
              <span className="text-gray-300">{"  "}</span>
              <span className="text-sky-300">{'"id"'}</span>
              <span className="text-gray-300">{": "}</span>
              <span className="text-emerald-400">{'"hd_a1b2c3d4"'}</span>
              <span className="text-gray-300">{",\n"}</span>
              <span className="text-gray-300">{"  "}</span>
              <span className="text-sky-300">{'"status"'}</span>
              <span className="text-gray-300">{": "}</span>
              <span className="text-emerald-400">{'"initializing"'}</span>
              <span className="text-gray-300">{",\n"}</span>
              <span className="text-gray-300">{"  "}</span>
              <span className="text-sky-300">{'"ws_url"'}</span>
              <span className="text-gray-300">{": "}</span>
              <span className="text-emerald-400">{'"wss://..."'}</span>
              {"\n"}
              <span className="text-gray-300">{"}"}</span>
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
      <div className="max-w-3xl mx-auto text-center rounded-2xl border border-primary/20 bg-gradient-to-b from-primary-light to-white p-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to build on Hydra?</h2>
        <p className="text-gray-500 mb-8">
          Create a free account and deploy your first head in under a minute.
        </p>
        <Link
          to="/login"
          className="inline-block px-8 py-3 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Create Free Account
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-100 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-xs text-gray-500">&copy; {new Date().getFullYear()} HydraHouse</span>
        <div className="flex gap-6">
          <Link to="/docs" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Docs</Link>
          <a href="mailto:davidfish3@gmail.com" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
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
