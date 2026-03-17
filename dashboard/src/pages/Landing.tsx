import { Link } from "react-router-dom";
import { Zap, RefreshCw, Users, ArrowRight } from "lucide-react";
import FeatureShowcase from "../components/FeatureShowcase";

/* Two-tone palette: warm cream base, light mint accent sections */
const CREAM = "bg-[#FAFAF7]";
const MINT = "bg-[#F0FAF6]";

/* Gradient button classes */
const BTN_PRIMARY = "bg-gradient-to-r from-[#0A6E5C] to-emerald-500 hover:from-[#085D4D] hover:to-emerald-600 text-white font-medium rounded-lg transition-all shadow-sm";

function NavBar() {
  return (
    <>
      <div className="h-0.5 bg-gradient-to-r from-[#0A6E5C] to-emerald-400" />
      <nav className="sticky top-0 z-50 bg-[#FAFAF7]/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#0A6E5C" opacity="0.08"/>
              <line x1="16" y1="26" x2="16" y2="15" stroke="#0A6E5C" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M16 15 C14 12 10.5 10 8 8" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <line x1="16" y1="15" x2="16" y2="6.5" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 15 C18 12 21.5 10 24 8" stroke="#0A6E5C" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <circle cx="8" cy="8" r="2.5" fill="#10B981"/>
              <circle cx="16" cy="6.5" r="2.5" fill="#10B981"/>
              <circle cx="24" cy="8" r="2.5" fill="#10B981"/>
            </svg>
            <span className="text-base font-semibold text-gray-900 tracking-tight">HydraHouse</span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#api" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">API</a>
            <Link to="/login" className={`px-4 py-2 text-sm ${BTN_PRIMARY}`}>
              Get Started
            </Link>
          </div>
          <Link to="/login" className={`md:hidden px-4 py-2 text-sm ${BTN_PRIMARY}`}>
            Get Started
          </Link>
        </div>
      </nav>
    </>
  );
}

function Hero() {
  return (
    <section className={`pt-24 pb-20 px-6 ${MINT}`}>
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 text-center lg:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full">
            Now on Cardano Preview, Preprod &amp; Mainnet
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-gray-900 leading-tight">
            Managed Hydra Heads<span className="text-emerald-500">.</span>
            <br />
            <span className="text-gray-400">One API call.</span>
          </h1>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link to="/login" className={`px-6 py-3 text-center ${BTN_PRIMARY}`}>
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
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="#D1FAE5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
            <svg viewBox="0 0 520 380" className="w-full relative z-10 -ml-8" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Your App */}
              <rect x="0" y="145" width="145" height="85" rx="14" fill="white" stroke="#0A6E5C" strokeWidth="1.5" strokeDasharray="6 3" />
              <text x="72" y="194" textAnchor="middle" fill="#0A6E5C" fontSize="16" fontWeight="600" fontFamily="Inter, sans-serif">Your App</text>

              {/* Single connection */}
              <line x1="145" y1="188" x2="190" y2="188" stroke="#0A6E5C" strokeWidth="1.5" strokeDasharray="5 4">
                <animate attributeName="stroke-dashoffset" from="9" to="0" dur="1s" repeatCount="indefinite" />
              </line>

              {/* HydraHouse API */}
              <rect x="190" y="145" width="150" height="85" rx="14" fill="white" stroke="#0A6E5C" strokeWidth="2" />
              <text x="265" y="184" textAnchor="middle" fill="#0A6E5C" fontSize="15" fontWeight="700" fontFamily="Inter, sans-serif">HydraHouse</text>
              <text x="265" y="205" textAnchor="middle" fill="#0A6E5C" fontSize="15" fontWeight="700" fontFamily="Inter, sans-serif">API</text>

              {/* 5 fan-out connections */}
              <path d="M 340,168 C 375,168 385,50 415,50" stroke="#10B981" strokeWidth="1.5" strokeDasharray="5 4" fill="none">
                <animate attributeName="stroke-dashoffset" from="9" to="0" dur="1.3s" repeatCount="indefinite" />
              </path>
              <path d="M 340,178 C 375,178 390,118 415,118" stroke="#10B981" strokeWidth="1.5" strokeDasharray="5 4" fill="none">
                <animate attributeName="stroke-dashoffset" from="9" to="0" dur="1.1s" repeatCount="indefinite" />
              </path>
              <line x1="340" y1="188" x2="415" y2="188" stroke="#10B981" strokeWidth="1.5" strokeDasharray="5 4">
                <animate attributeName="stroke-dashoffset" from="9" to="0" dur="1s" repeatCount="indefinite" />
              </line>
              <path d="M 340,198 C 375,198 390,258 415,258" stroke="#10B981" strokeWidth="1.5" strokeDasharray="5 4" fill="none">
                <animate attributeName="stroke-dashoffset" from="9" to="0" dur="0.9s" repeatCount="indefinite" />
              </path>
              <path d="M 340,208 C 375,208 385,328 415,328" stroke="#10B981" strokeWidth="1.5" strokeDasharray="5 4" fill="none">
                <animate attributeName="stroke-dashoffset" from="9" to="0" dur="1.2s" repeatCount="indefinite" />
              </path>

              {/* 5 Hydra Head boxes */}
              {[20, 90, 160, 230, 300].map((y, i) => (
                <g key={i}>
                  <rect x="415" y={y} width="100" height="55" rx="12" fill="white" stroke="#10B981" strokeWidth="1.5" />
                  <text x="465" y={y + 33} textAnchor="middle" fill="#059669" fontSize="13" fontWeight="600" fontFamily="Inter, sans-serif">Hydra Head</text>
                </g>
              ))}
            </svg>
          </div>
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

const metrics = [
  { value: "< 30s", label: "Head open time", icon: Zap },
  { value: "10", label: "Participants per head", icon: Users },
  { value: "1", label: "API call to start", icon: ArrowRight },
  { value: "24/7", label: "Lifecycle management", icon: RefreshCw },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className={`py-20 px-6 scroll-mt-20 ${CREAM}`}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={s.num} className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] border-t-2 border-dashed border-emerald-200" />
              )}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0A6E5C] to-emerald-500 text-white flex items-center justify-center font-bold text-lg mb-4 relative z-10 shadow-sm">
                {s.num}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 max-w-xs">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
          {metrics.map((m) => (
            <div key={m.label} className="bg-white border border-gray-200/80 rounded-xl p-5 shadow-sm border-l-[3px] border-l-emerald-500">
              <m.icon size={20} className="text-emerald-600 mb-2" />
              <div className="text-3xl font-bold text-gray-900">{m.value}</div>
              <div className="mt-1 text-[13px] text-gray-500">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className={`py-20 px-6 scroll-mt-20 ${CREAM}`}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Pricing</h2>
        <p className="text-gray-500 text-center mb-12">No subscriptions, no commitments. Only pay for what you use.</p>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-10 text-center">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-6">Per Head</p>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-6xl font-bold tracking-tight text-gray-900">$5</span>
            </div>
            <p className="text-sm text-gray-400 mb-6">one-time per head opened</p>
            <div className="h-px bg-gray-100 mb-6" />
            <p className="text-xs text-gray-500 leading-relaxed">Provisioning, key generation, orchestration, and full lifecycle management through fanout.</p>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-10 text-center">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-6">Per Request</p>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-6xl font-bold tracking-tight text-gray-900">$0.01</span>
            </div>
            <p className="text-sm text-gray-400 mb-6">per authenticated API call</p>
            <div className="h-px bg-gray-100 mb-6" />
            <p className="text-xs text-gray-500 leading-relaxed">Deposits, transfers, withdrawals, snapshots, transaction submissions, and all other endpoints.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CodeExample() {
  return (
    <section id="api" className={`py-20 px-6 scroll-mt-20 ${MINT}`}>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, powerful API</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            One API call creates a fully managed Hydra head. Authenticate with your API key, specify the network and participants, and you're live.
          </p>
          <Link
            to="/docs/api"
            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors inline-flex items-center gap-1"
          >
            View full API reference <ArrowRight size={14} />
          </Link>
        </div>

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
    <section className={`py-20 px-6 ${CREAM}`}>
      <div className="max-w-3xl mx-auto text-center rounded-2xl border border-emerald-200/60 bg-gradient-to-b from-[#F0FAF6] to-white p-12 shadow-sm">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to build on Hydra?</h2>
        <p className="text-gray-500 mb-8">
          Create a free account and deploy your first head in under a minute.
        </p>
        <Link to="/login" className={`inline-block px-8 py-3 ${BTN_PRIMARY}`}>
          Create Free Account
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#F0FAF6] border-t border-gray-200/60 py-8 px-6">
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
    <div className="min-h-screen bg-[#FAFAF7] text-gray-900">
      <NavBar />
      <Hero />
      <HowItWorks />
      <FeatureShowcase />
      <Pricing />
      <CodeExample />
      <CtaBanner />
      <Footer />
    </div>
  );
}
