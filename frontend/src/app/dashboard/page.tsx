"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardSteps } from "@/components/DashboardSteps";
import { DeploymentCard } from "@/components/DeploymentCard";

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

function fetchDeployments(): Promise<Deployment[]> {
  return fetch("/api/deployments")
    .then((r) => r.json())
    .then((d) => d.deployments ?? [])
    .catch(() => []);
}

export default function DashboardPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);

  const refresh = useCallback(() => {
    fetchDeployments().then(setDeployments);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const inProgress = deployments.some(
    (d) =>
      d.status === "pending" ||
      d.status === "provisioning" ||
      d.status === "configuring"
  );

  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [inProgress, refresh]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-claw-muted mt-1">
          Launch your runtime, wait for the WhatsApp QR, scan it, and start talking to your assistant.
        </p>
      </div>

      <DashboardSteps onDeployed={refresh} />

      {deployments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Your deployments</h2>
          {inProgress && (
            <p className="text-claw-muted text-sm mb-2">
              Status updates every few seconds while a deployment is in progress.
            </p>
          )}
          <ul className="space-y-3">
            {deployments.map((d) => (
              <DeploymentCard key={d.id} deployment={d} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
