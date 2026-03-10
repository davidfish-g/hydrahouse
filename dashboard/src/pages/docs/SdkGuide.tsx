function CodeBlock({ title, children }: { title?: string; children: string }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          <span className="ml-1 text-xs text-slate-500">{title}</span>
        </div>
      )}
      <pre className="p-4 text-sm text-slate-300 overflow-x-auto">
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
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      </div>
      <div className="text-sm text-slate-400 leading-relaxed space-y-4">
        {children}
      </div>
    </div>
  );
}

export default function SdkGuide() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">SDK Guide</h1>
        <p className="text-slate-400">
          Use the TypeScript SDK to integrate HydraHouse into your app.
        </p>
      </div>

      <SectionCard
        title="Install"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
          </svg>
        }
      >
        <CodeBlock title="terminal">{`bun add @hydrahouse/sdk\n# or\nnpm install @hydrahouse/sdk`}</CodeBlock>
      </SectionCard>

      <SectionCard
        title="Quick Start"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        }
      >
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

      <SectionCard
        title="Error Handling"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        }
      >
        <p>
          All API methods throw{" "}
          <code className="text-indigo-300 text-xs bg-slate-900 px-1.5 py-0.5 rounded">
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
