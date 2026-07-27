"use client";

import { useState } from "react";

export function DashboardSteps({ onDeployed }: { onDeployed?: () => void }) {
  const runtimeEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_RUNTIME_ENABLED === "true";
  const [assistantName, setAssistantName] = useState("Yell");
  const [claudeCredential, setClaudeCredential] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deploySent, setDeploySent] = useState(false);

  const handleDeploy = async () => {
    setError(null);
    setLoading(true);
    setDeploySent(false);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantName: assistantName.trim() || "Yell",
          claudeCredential: claudeCredential.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deployment failed");
      setDeploySent(true);
      onDeployed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deployment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-claw-surface/80 bg-claw-surface/50 p-6 md:p-8 space-y-6 shadow-[0_20px_80px_rgba(15,23,42,0.35)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-claw-accent">
          Deploy Flow
        </p>
        <h2 className="text-2xl font-semibold">Deploy now. Scan once. Start chatting.</h2>
        <p className="max-w-2xl text-sm text-claw-muted">
          We spin up your NanoClaw runtime, wait for the WhatsApp QR, show it here in the
          dashboard, and finish setup after you scan. No WhatsApp Business API setup is required
          for this flow.
        </p>
        {!runtimeEnabled && (
          <p className="max-w-2xl text-sm text-amber-300">
            The hosted site is live, but the persistent NanoClaw runtime worker is not connected
            yet. Deployments stay disabled until that server is wired in.
          </p>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Assistant name</span>
          <input
            type="text"
            placeholder="Yell"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            className="w-full rounded-xl border border-claw-surface bg-claw-dark/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-claw-accent"
          />
          <span className="block text-[11px] text-claw-muted">
            Your WhatsApp trigger becomes @{assistantName.trim() || "Yell"}.
          </span>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Claude credential</span>
          <input
            type="password"
            placeholder="Anthropic API key or Claude OAuth token"
            value={claudeCredential}
            onChange={(e) => setClaudeCredential(e.target.value)}
            className="w-full rounded-xl border border-claw-surface bg-claw-dark/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-claw-accent"
          />
          <span className="block text-[11px] text-claw-muted">
            Optional if the server already has a default Claude credential configured.
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-claw-accent/20 bg-claw-dark/50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-claw-accent">
          What happens next
        </p>
        <ol className="space-y-1 text-sm text-claw-muted list-decimal list-inside">
          <li>We create your NanoClaw runtime on the server.</li>
          <li>We start WhatsApp auth and wait for the QR code.</li>
          <li>The QR appears in your deployment card below.</li>
          <li>You scan it with WhatsApp and the assistant comes online.</li>
          <li>You message your WhatsApp self-chat with @{assistantName.trim() || "Yell"}.</li>
        </ol>
      </div>

      <div className="rounded-2xl border border-claw-surface bg-claw-dark/40 p-4 text-xs text-claw-muted space-y-1">
        <p>Server requirements for this managed flow:</p>
        <p>1. Docker must be available to the app process.</p>
        <p>2. NanoClaw dependencies must already be installed in this repo.</p>
        <p>3. If you do not paste a credential above, the server must have a default Claude credential.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={handleDeploy}
          disabled={loading || !runtimeEnabled}
          className="rounded-xl bg-claw-accent px-5 py-3 font-semibold text-claw-dark transition hover:opacity-90 disabled:opacity-50"
        >
          {!runtimeEnabled ? "Runtime Not Connected" : loading ? "Deploying..." : "Deploy Now"}
        </button>
        {deploySent && !loading && (
          <span className="text-sm text-green-400">
            Deployment started. Watch the deployment card for the QR code.
          </span>
        )}
      </div>
    </div>
  );
}
