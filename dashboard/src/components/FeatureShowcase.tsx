import { useState, useEffect, useRef } from "react";
import { Zap, RefreshCw, Radio, Users, ArrowUpDown, Globe } from "lucide-react";

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

const HEADER_H = 50;
const BODY_H = 370;
const NUM = FEATURES.length;
const TRANSITIONS = NUM - 1;

function useIsLg() {
  const [lg, setLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setLg(mq.matches);
    const h = (e: MediaQueryListEvent) => setLg(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return lg;
}

/* ── Graphics ─────────────────────────────────────────────── */

function TerminalGraphic() {
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden font-mono text-[13px] leading-relaxed">
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800/80">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span className="ml-2 text-[11px] text-gray-500">terminal</span>
      </div>
      <div className="p-4 space-y-0">
        <div><span className="text-gray-500">$ </span><span className="text-white">curl</span><span className="text-gray-400"> -X POST </span><span className="text-emerald-400">/v1/heads</span><span className="text-gray-400"> \</span></div>
        <div className="pl-4"><span className="text-gray-400">-H </span><span className="text-amber-300">"Authorization: Bearer hh_sk_..."</span><span className="text-gray-400"> \</span></div>
        <div className="pl-4"><span className="text-gray-400">-d </span><span className="text-emerald-400">{`'{"network":"preprod","participants":2}'`}</span></div>
        <div className="mt-3 text-gray-600">// 201 Created</div>
        <div className="text-gray-300">{"{"}</div>
        <div className="pl-4"><span className="text-sky-300">"id"</span><span className="text-gray-500">: </span><span className="text-emerald-400">"hd_a1b2c3d4"</span><span className="text-gray-500">,</span></div>
        <div className="pl-4"><span className="text-sky-300">"status"</span><span className="text-gray-500">: </span><span className="text-emerald-400">"initializing"</span><span className="text-gray-500">,</span></div>
        <div className="pl-4"><span className="text-sky-300">"ws_url"</span><span className="text-gray-500">: </span><span className="text-emerald-400">"wss://api.hydrahouse.xyz/..."</span></div>
        <div className="text-gray-300">{"}"}</div>
      </div>
    </div>
  );
}

function LifecycleGraphic() {
  const states = [
    { label: "Requested", color: "#6B7280", done: true },
    { label: "Provisioning", color: "#6B7280", done: true },
    { label: "Initializing", color: "#F59E0B", done: true },
    { label: "Committing", color: "#F59E0B", done: true },
    { label: "Open", color: "#10B981", active: true },
    { label: "Closing", color: "#6B7280" },
    { label: "Closed", color: "#6B7280" },
    { label: "Fanned Out", color: "#6B7280" },
  ];
  return (
    <div className="bg-gray-900 rounded-xl p-5 pb-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[11px] font-mono text-gray-500">HEAD LIFECYCLE</span>
        <span className="text-[11px] font-mono text-emerald-500 ml-auto">● live</span>
      </div>
      <div className="flex items-center py-6">
        {states.map((s, i) => (
          <div key={s.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 relative"
                style={{
                  background: s.active ? s.color : s.done ? s.color : "transparent",
                  border: !s.active && !s.done ? `2px solid #4B5563` : "none",
                }}
              >
                {s.done && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                {s.active && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-20" />
                  </>
                )}
              </div>
              <span className="text-[9px] mt-2 whitespace-nowrap" style={{ color: s.active ? s.color : s.done ? "#9CA3AF" : "#4B5563" }}>
                {s.label}
              </span>
            </div>
            {i < states.length - 1 && (
              <div className="flex-1 h-0.5 mx-1 mt-[-18px]" style={{ background: s.done ? s.color : "#374151" }} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 pt-3 border-t border-gray-800 flex items-center gap-3 text-[11px] font-mono flex-wrap">
        <span className="text-gray-500">status:</span>
        <span className="text-emerald-400">open</span>
        <span className="text-gray-700">|</span>
        <span className="text-gray-500">uptime:</span>
        <span className="text-gray-400">4h 23m</span>
        <span className="text-gray-700">|</span>
        <span className="text-gray-500">txs:</span>
        <span className="text-gray-400">1,247</span>
        <span className="text-gray-700">|</span>
        <span className="text-gray-500">contestation:</span>
        <span className="text-gray-400">300s</span>
      </div>
    </div>
  );
}

function WebSocketGraphic() {
  const events = [
    { type: "HeadIsInitializing", color: "text-amber-400" },
    { type: "Committed", color: "text-amber-400" },
    { type: "HeadIsOpen", color: "text-emerald-400" },
    { type: "TxValid", color: "text-emerald-400" },
    { type: "SnapshotConfirmed", color: "text-sky-400" },
    { type: "TxValid", color: "text-emerald-400" },
  ];
  return (
    <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs overflow-hidden">
      <div className="flex items-center gap-2 text-gray-500 mb-3 text-[11px]">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        wss://api.hydrahouse.xyz/v1/heads/hd_a1b2/ws
      </div>
      <div className="space-y-1.5">
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-gray-600 select-none">{">"}</span>
            <span className={e.color}>{e.type}</span>
            <span className="text-gray-700 ml-auto tabular-nums">{(i * 1.2).toFixed(1)}s</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-gray-600">
          <span className="select-none">{">"}</span>
          <span className="inline-block w-1.5 h-3.5 bg-gray-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function MultiPartyGraphic() {
  const nodes = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    return { x: 160 + 34 * Math.cos(angle), y: 44 + 28 * Math.sin(angle) };
  });
  return (
    <div className="bg-gray-900 rounded-xl p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-mono text-gray-500">PEER TOPOLOGY</span>
        <span className="text-[11px] font-mono text-gray-600 ml-auto">5 nodes connected</span>
      </div>
      <svg viewBox="0 0 320 85" className="w-full" fill="none">
        {nodes.map((a, i) =>
          nodes.slice(i + 1).map((b, j) => (
            <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#10B981" strokeWidth={1} strokeDasharray="4 3" opacity={0.25}>
              <animate attributeName="stroke-dashoffset" from="7" to="0" dur={`${0.8 + j * 0.2}s`} repeatCount="indefinite" />
            </line>
          ))
        )}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={12} fill={i === 0 ? "#0A6E5C" : "#1F2937"} stroke={i === 0 ? "#10B981" : "#374151"} strokeWidth={1.5} />
            {i === 0 && (
              <circle cx={n.x} cy={n.y} r={12} fill="none" stroke="#10B981" strokeWidth={1.5} opacity={0.4}>
                <animate attributeName="r" values="12;18;12" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
              </circle>
            )}
            <text x={n.x} y={n.y + 3.5} textAnchor="middle" fill="white" fontSize={8} fontWeight={600} fontFamily="JetBrains Mono, monospace">N{i}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function DepositsGraphic() {
  return (
    <div className="bg-gray-900 rounded-xl p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-mono text-gray-500">INCREMENTAL COMMIT</span>
      </div>
      <svg viewBox="0 0 400 100" className="w-full" fill="none">
        <defs>
          <marker id="arr-r" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><path d="M0,0 L7,2.5 L0,5" fill="#10B981" /></marker>
          <marker id="arr-l" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><path d="M0,0 L7,2.5 L0,5" fill="#6B7280" /></marker>
        </defs>
        {/* L1 */}
        <rect x="10" y="8" width="130" height="84" rx="8" fill="#111827" stroke="#374151" strokeWidth="1" />
        <text x="75" y="26" textAnchor="middle" fill="#9CA3AF" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif">LAYER 1</text>
        <rect x="20" y="36" width="52" height="22" rx="4" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
        <text x="46" y="51" textAnchor="middle" fill="#34D399" fontSize="9" fontFamily="JetBrains Mono, monospace">5 ₳</text>
        <rect x="80" y="36" width="52" height="22" rx="4" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
        <text x="106" y="51" textAnchor="middle" fill="#34D399" fontSize="9" fontFamily="JetBrains Mono, monospace">10 ₳</text>
        <rect x="20" y="64" width="52" height="22" rx="4" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
        <text x="46" y="79" textAnchor="middle" fill="#34D399" fontSize="9" fontFamily="JetBrains Mono, monospace">2 ₳</text>
        {/* Arrows */}
        <line x1="148" y1="38" x2="255" y2="38" stroke="#10B981" strokeWidth="1.5" strokeDasharray="6 4" markerEnd="url(#arr-r)">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.8s" repeatCount="indefinite" />
        </line>
        <text x="201" y="31" textAnchor="middle" fill="#10B981" fontSize="8" fontWeight="500" fontFamily="Inter, sans-serif">deposit</text>
        <line x1="255" y1="68" x2="148" y2="68" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="6 4" markerEnd="url(#arr-l)">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.8s" repeatCount="indefinite" />
        </line>
        <text x="201" y="84" textAnchor="middle" fill="#6B7280" fontSize="8" fontWeight="500" fontFamily="Inter, sans-serif">withdraw</text>
        {/* L2 */}
        <rect x="260" y="8" width="130" height="84" rx="8" fill="#111827" stroke="#10B981" strokeWidth="1" />
        <text x="325" y="26" textAnchor="middle" fill="#10B981" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif">LAYER 2</text>
        <rect x="270" y="36" width="52" height="22" rx="4" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
        <text x="296" y="51" textAnchor="middle" fill="#34D399" fontSize="9" fontFamily="JetBrains Mono, monospace">5 ₳</text>
        <rect x="330" y="36" width="52" height="22" rx="4" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
        <text x="356" y="51" textAnchor="middle" fill="#34D399" fontSize="9" fontFamily="JetBrains Mono, monospace">10 ₳</text>
        <rect x="270" y="64" width="52" height="22" rx="4" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
        <text x="296" y="79" textAnchor="middle" fill="#34D399" fontSize="9" fontFamily="JetBrains Mono, monospace">8 ₳</text>
        <rect x="330" y="64" width="52" height="22" rx="4" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
        <text x="356" y="79" textAnchor="middle" fill="#34D399" fontSize="9" fontFamily="JetBrains Mono, monospace">3 ₳</text>
      </svg>
    </div>
  );
}

function NetworksGraphic() {
  const nets = [
    { name: "Preview", desc: "Bleeding edge testnet", dot: "#A855F7" },
    { name: "Preprod", desc: "Stable testnet", dot: "#10B981", selected: true },
    { name: "Mainnet", desc: "Production network", dot: "#F59E0B" },
  ];
  return (
    <div className="bg-gray-900 rounded-xl p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[11px] font-mono text-gray-500">SELECT NETWORK</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {nets.map((n) => (
          <div key={n.name} className={`rounded-lg p-4 pb-5 cursor-default transition-all ${n.selected ? "bg-emerald-500/10 border border-emerald-500/40 shadow-sm shadow-emerald-500/10" : "bg-gray-800 border border-gray-700"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: n.dot }} />
              <span className={`text-sm font-semibold ${n.selected ? "text-white" : "text-gray-300"}`}>{n.name}</span>
            </div>
            <span className="text-[11px] text-gray-500 leading-relaxed block mb-1">{n.desc}</span>
            {n.selected && <div className="mt-3 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5 inline-block">Selected</div>}
            {!n.selected && <div className="mt-3 h-[22px]" />}
          </div>
        ))}
      </div>
      <div className="mt-5 pt-3 border-t border-gray-800 text-[11px] font-mono text-gray-600">
        Same API, same SDK — just change the <span className="text-gray-400">network</span> field.
      </div>
    </div>
  );
}

const GRAPHICS = [TerminalGraphic, LifecycleGraphic, WebSocketGraphic, MultiPartyGraphic, DepositsGraphic, NetworksGraphic];

/* ── Main Component ───────────────────────────────────────── */

export default function FeatureShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fraction, setFraction] = useState(0);
  const isLg = useIsLg();

  useEffect(() => {
    if (!isLg) return;
    let ticking = false;
    function update() {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = el.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable));
      const raw = progress * TRANSITIONS;
      const idx = Math.min(Math.floor(raw), TRANSITIONS);
      const frac = idx < TRANSITIONS ? raw - idx : 0;
      setActiveIndex(idx);
      setFraction(frac);
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => { update(); ticking = false; });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLg]);

  function scrollToFeature(i: number) {
    const el = sectionRef.current;
    if (!el) return;
    const scrollable = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: el.offsetTop + scrollable * (i / TRANSITIONS), behavior: "smooth" });
  }

  const navActive = fraction > 0.6 && activeIndex < TRANSITIONS ? activeIndex + 1 : activeIndex;

  /* ── Mobile: simple card list ── */
  if (!isLg) {
    return (
      <section id="features" className="py-20 px-6 scroll-mt-20 bg-[#F0FDF8]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Everything you need for L2 on Cardano</h2>
          <div className="space-y-4">
            {FEATURES.map((f, i) => {
              const Graphic = GRAPHICS[i];
              return (
                <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5" style={{ height: HEADER_H }}>
                    <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
                      <f.icon size={16} className="text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
                  </div>
                  <div className="px-5 pb-5">
                    <p className="text-sm text-gray-500 mb-4 leading-relaxed">{f.desc}</p>
                    <Graphic />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  /* ── Desktop: scroll-driven stacking cards ── */
  return (
    <section ref={sectionRef} id="features" className="relative scroll-mt-20" style={{ height: "350vh" }}>
      <div className="sticky top-0 h-screen flex flex-col justify-center px-6 lg:px-10 overflow-hidden bg-[#F0FDF8]">
        <div className="max-w-6xl mx-auto w-full flex gap-10">
          {/* Left column: heading + nav */}
          <div className="w-52 shrink-0 flex flex-col">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Features</h2>
            <nav className="flex flex-col gap-0.5">
              {FEATURES.map((f, i) => (
                <button
                  key={i}
                  onClick={() => scrollToFeature(i)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm ${
                    i === navActive ? "text-gray-900 bg-white font-semibold shadow-sm border border-gray-200/80" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <f.icon size={16} />
                  {f.title}
                </button>
              ))}
            </nav>
          </div>

          {/* Right: stacking cards */}
          <div className="flex-1 min-w-0">
            {FEATURES.map((f, i) => {
              const isCollapsed = i < activeIndex;
              const isActive = i === activeIndex;
              const isLast = i === NUM - 1;
              const isNext = i === activeIndex + 1;
              const isFuture = i > activeIndex + 1;

              // Body heights: active collapses, next expands, total always = BODY_H
              let bodyH: number;
              if (isCollapsed) bodyH = 0;
              else if (isActive && !isLast) bodyH = BODY_H * (1 - fraction);
              else if (isActive && isLast) bodyH = BODY_H;
              else if (isNext) bodyH = BODY_H * fraction;
              else bodyH = 0;

              const mt = i === 0 ? 0 : isCollapsed ? 1 : isNext ? Math.round(16 * (1 - fraction) + 4) : 4;
              const Graphic = GRAPHICS[i];

              return (
                <div
                  key={i}
                  className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden shrink-0 ${isFuture ? "opacity-0 pointer-events-none" : ""}`}
                  style={{ marginTop: mt }}
                >
                  <div className="flex items-center gap-3 px-5" style={{ height: HEADER_H }}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isCollapsed ? "bg-gray-100" : "bg-primary-light"}`}>
                      <f.icon size={16} className={isCollapsed ? "text-gray-400" : "text-primary"} />
                    </div>
                    <h3 className={`font-semibold transition-colors ${isCollapsed ? "text-sm text-gray-400" : "text-base text-gray-900"}`}>
                      {f.title}
                    </h3>
                  </div>
                  <div className="overflow-hidden" style={{ height: bodyH }}>
                    <div className="px-5 pb-5">
                      <p className="text-sm text-gray-500 mb-4 leading-relaxed">{f.desc}</p>
                      <Graphic />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

