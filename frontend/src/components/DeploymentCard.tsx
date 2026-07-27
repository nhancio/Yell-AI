"use client";

import { useEffect, useState } from "react";

type Deployment = {
  id: string;
  status: string;
  assistantName: string;
  instanceId: string | null;
  phoneNumber: string | null;
  gatewayUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
};

const STEPS = [
  { key: "pending", label: "Queued" },
  { key: "provisioning", label: "Creating your NanoClaw runtime" },
  { key: "configuring", label: "Waiting for WhatsApp auth and starting the assistant" },
  { key: "ready", label: "Ready" },
  { key: "failed", label: "Failed" },
] as const;

const QR_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
      <rect width="320" height="320" rx="24" fill="#ffffff"/>
      <rect x="24" y="24" width="272" height="272" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
      <text x="160" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#0f172a">Waiting for QR</text>
      <text x="160" y="178" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Refresh after a few seconds</text>
    </svg>`,
  );

type LogEntry = { message: string; createdAt: string };

export function DeploymentCard({ deployment }: { deployment: Deployment }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [qrKey, setQrKey] = useState(0);

  const inProgress =
    deployment.status === "pending" ||
    deployment.status === "provisioning" ||
    deployment.status === "configuring";

  useEffect(() => {
    const fetchLogs = () => {
      fetch(`/api/deployments/${deployment.id}/logs`)
        .then((r) => r.json())
        .then((d) => setLogs(d.logs ?? []))
        .catch(() => {});
    };

    fetchLogs();
    if (!inProgress) return;
    const t = setInterval(fetchLogs, 2000);
    return () => clearInterval(t);
  }, [deployment.id, inProgress]);

  const currentStepIndex = STEPS.findIndex((s) => s.key === deployment.status);
  const displayStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <li className="bg-claw-surface/50 border border-claw-surface rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{deployment.id.slice(0, 8)}…</span>
          {deployment.instanceId && (
            <span className="ml-2 text-claw-muted text-sm font-mono">
              {deployment.instanceId}
            </span>
          )}
          <span className="ml-2 text-claw-muted text-sm">
            @{deployment.assistantName}
          </span>
          <span
            className={`ml-2 text-sm ${
              deployment.status === "ready"
                ? "text-green-400"
                : deployment.status === "failed"
                  ? "text-red-400"
                  : "text-claw-muted"
            }`}
          >
            {deployment.status}
          </span>
          {(inProgress || deployment.status === "ready") && (
            <button
              onClick={() => {
                setShowQr(!showQr);
                if (!showQr) setQrKey((prev) => prev + 1);
              }}
              className="ml-4 px-3 py-1 bg-claw-accent/20 hover:bg-claw-accent/30 text-claw-accent rounded text-xs transition-colors"
            >
              {showQr ? "Hide QR" : "Show QR"}
            </button>
          )}
        </div>
      </div>

      {showQr && (
        <div className="bg-white p-4 rounded-lg inline-block mx-auto text-center">
          <p className="text-black text-xs font-bold mb-2">Scan with WhatsApp</p>
          <img
            src={`/api/deployments/${deployment.id}/qr?k=${qrKey}`}
            alt="WhatsApp QR Code"
            className="w-48 h-48 mx-auto"
            onError={(e) => {
              (e.target as HTMLImageElement).src = QR_PLACEHOLDER;
            }}
          />
          <button
            onClick={() => setQrKey((prev) => prev + 1)}
            className="mt-2 text-claw-dark text-[10px] hover:underline"
          >
            Refresh QR
          </button>
        </div>
      )}

      {deployment.status === "ready" && (
        <div className="text-sm text-claw-muted">
          {deployment.phoneNumber ? (
            <p>
              Connected on WhatsApp +{deployment.phoneNumber}. Open your self-chat and send{" "}
              <span className="text-white">@{deployment.assistantName}</span>.
            </p>
          ) : (
            <p>
              Open WhatsApp and message yourself with{" "}
              <span className="text-white">@{deployment.assistantName}</span>.
            </p>
          )}
        </div>
      )}

      <div className="text-sm">
        <p className="text-claw-muted mb-2">Progress</p>
        <ol className="flex flex-wrap gap-x-4 gap-y-1">
          {STEPS.map((step, i) => {
            const isCurrent = i === displayStepIndex;
            const isPast = i < displayStepIndex;
            return (
              <li
                key={step.key}
                className={
                  isCurrent
                    ? deployment.status === "failed"
                      ? "text-red-400 font-medium"
                      : "text-claw-accent font-medium"
                    : isPast
                      ? "text-green-400"
                      : "text-claw-muted"
                }
              >
                {i + 1}. {step.label}
                {isCurrent && " (current)"}
              </li>
            );
          })}
        </ol>
      </div>

      {(logs.length > 0 || inProgress) && (
        <div className="text-sm">
          <p className="text-claw-muted mb-1">Activity</p>
          <div className="bg-claw-dark rounded p-2 font-mono text-xs max-h-40 overflow-y-auto">
            {logs.length === 0 && inProgress ? (
              <span className="text-claw-muted">Waiting for activity…</span>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="text-claw-muted">
                  [{new Date(entry.createdAt).toLocaleTimeString()}] {entry.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {deployment.errorMessage && (
        <p className="text-sm text-red-400">{deployment.errorMessage}</p>
      )}
    </li>
  );
}
