import { useState } from "react";
import { Download, Zap, AlertTriangle, Clipboard, Check } from "lucide-react";

function CodeBlock({ title, children }: { title?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden relative group">
      {title && (
        <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2 bg-white">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-1 text-xs text-gray-400">{title}</span>
        </div>
      )}
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check size={12} className="text-emerald-500" /> : <Clipboard size={12} />}
      </button>
      <pre className="p-4 text-sm text-gray-700 overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center text-primary">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="text-sm text-gray-500 leading-relaxed space-y-4">
        {children}
      </div>
    </div>
  );
}

export default function SdkGuide() {
  return (
    <div className="max-w-[720px] space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-gray-900 mb-2">SDK Guide</h1>
        <p className="text-gray-500">
          Use the TypeScript SDK to integrate HydraHouse into your app.
        </p>
      </div>

      <SectionCard title="Install" icon={<Download size={18} />}>
        <CodeBlock title="terminal">{`bun add @hydrahouse/sdk\n# or\nnpm install @hydrahouse/sdk`}</CodeBlock>
      </SectionCard>

      <SectionCard title="Quick Start" icon={<Zap size={18} />}>
        <CodeBlock title="app.ts">{`import { HydraHouseClient } from "@hydrahouse/sdk";

const client = new HydraHouseClient({
  baseUrl: "http://localhost:3000",
  apiKey: "hh_sk_...",
});

// Create an account (no auth required)
const { account_id, api_key } = await client.createAccount();

// List heads
const { heads } = await client.listHeads();

// Create a new Hydra head
const head = await client.createHead({
  network: "preprod",
  participants: 2,
  config: { contestation_period_secs: 60 },
});

// Get head details
const detail = await client.getHead(head.head_id);

// Deposit, transfer, withdraw
await client.deposit(head.head_id, { slot: 0 });
await client.transfer(head.head_id, { from: 0, to: 1, lovelace: 5_000_000 });
await client.decommit(head.head_id, { slot: 0, lovelace: 5_000_000 });

// Submit an L2 transaction
await client.submitTx(head.head_id, "84a400...");

// Get L2 UTxO snapshot
const { utxo } = await client.getSnapshot(head.head_id);

// Connect to the Hydra node via WebSocket
const ws = client.connectWebSocket(head.head_id);
ws.onmessage = (event) => console.log(JSON.parse(event.data));

// Close or abort a head
await client.closeHead(head.head_id);
await client.abortHead(head.head_id);`}</CodeBlock>
      </SectionCard>

      <SectionCard title="Error Handling" icon={<AlertTriangle size={18} />}>
        <p>
          All API methods throw{" "}
          <code className="text-primary text-xs bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-mono">
            HydraHouseError
          </code>{" "}
          on non-2xx responses.
        </p>
        <CodeBlock title="error-handling.ts">{`import { HydraHouseError } from "@hydrahouse/sdk";

try {
  await client.getHead("nonexistent");
} catch (err) {
  if (err instanceof HydraHouseError) {
    console.error(err.status, err.body);
  }
}`}</CodeBlock>
      </SectionCard>
    </div>
  );
}
