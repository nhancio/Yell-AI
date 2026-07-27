import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { runLocalDeployment } from "@/lib/nanoclaw/localDeployment";

export const dynamic = "force-dynamic";

function isServerlessRuntime(): boolean {
  return process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;
}

export async function POST(req: Request) {
  if (isServerlessRuntime()) {
    return NextResponse.json(
      {
        error:
          "Deployments are not available from the Vercel frontend yet. This route needs a persistent Docker-capable runtime host for NanoClaw.",
      },
      { status: 503 },
    );
  }

  let body: {
    assistantName?: string;
    claudeCredential?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const assistantName =
    typeof body.assistantName === "string" && body.assistantName.trim()
      ? body.assistantName.trim().slice(0, 40)
      : "Yell";
  const claudeCredential =
    typeof body.claudeCredential === "string" && body.claudeCredential.trim()
      ? body.claudeCredential.trim()
      : null;

  const configToken = nanoid(32);

  const deployment = await prisma.deployment.create({
    data: {
      status: "pending",
      configToken,
      assistantName,
      aiProvider: "anthropic",
      aiApiKeyEnc: claudeCredential,
    },
  });

  runLocalDeployment(deployment.id, assistantName, claudeCredential).catch((err) => {
    console.error("[Yell AI] Deployment failed (async):", err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error("[Yell AI] Stack:", err.stack);
  });

  return NextResponse.json({
    deploymentId: deployment.id,
    status: deployment.status,
    message: "Your local NanoClaw setup has started.",
  });
}
