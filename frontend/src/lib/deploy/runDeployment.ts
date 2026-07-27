import { prisma } from "@/lib/prisma";
import { launchInstance } from "./ec2";

const P = "[Yell AI]";

function printError(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(P, `ERROR [${label}]:`, message);
  if (stack) console.error(P, "Stack:", stack);
}

async function addLog(deploymentId: string, message: string): Promise<void> {
  await prisma.deploymentLog.create({
    data: { deploymentId, message },
  });
}

export async function runDeployment(deploymentId: string): Promise<void> {
  console.log(P, `Starting deployment: ${deploymentId}`);
  try {
    await addLog(deploymentId, "Deployment started.");
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "provisioning" },
    });
    await addLog(deploymentId, "Launching EC2 instance...");

    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });
    if (!deployment) {
      console.error(P, "Deployment not found in DB, aborting:", deploymentId);
      return;
    }

    const onLog = (msg: string) => addLog(deploymentId, msg);
    const result = await launchInstance(deployment.id, deployment.configToken, onLog);
    console.log(P, "EC2 result:", result ? { instanceId: result.instanceId, publicIp: result.publicIp } : "mock mode");

    if (result) {
      await addLog(
        deploymentId,
        `EC2 instance started: ${result.instanceId}${result.publicIp ? ` (${result.publicIp})` : ""}`
      );
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          instanceId: result.instanceId,
          status: "configuring",
          gatewayUrl: result.publicIp
            ? `http://${result.publicIp}:18789`
            : null,
        },
      });
      await addLog(deploymentId, "Instance booting. NanoClaw installing via cloud-init (5-10 min).");
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "ready" },
      });
      await addLog(deploymentId, "Deployment ready. You can use your WhatsApp bot.");
      console.log(P, "Deployment complete:", deploymentId);
    } else {
      await addLog(deploymentId, "AWS credentials not set. Marking as mock ready.");
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "ready",
          gatewayUrl: null,
          errorMessage:
            "AWS not configured. Set AWS_* and YELLAI_* env vars to provision real EC2.",
        },
      });
    }
  } catch (err) {
    printError("runDeployment", err);
    const message = err instanceof Error ? err.message : String(err);
    await addLog(deploymentId, `Failed: ${message}`).catch((e) => printError("addLog", e));
    try {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "failed",
          errorMessage: message.slice(0, 500),
        },
      });
    } catch (dbErr) {
      printError("update status to failed", dbErr);
    }
  }
}
