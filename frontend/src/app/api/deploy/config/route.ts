import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Called by the EC2 instance during cloud-init to fetch NanoClaw config.
 * Token is single-use — marked as consumed after first fetch.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const deployment = await prisma.deployment.findUnique({
    where: { configToken: token },
  });

  if (!deployment) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  // Enforce single-use: reject if config was already fetched
  if (deployment.configFetched) {
    console.warn("[Yell AI] Config token replay attempt:", token.slice(0, 8));
    return NextResponse.json({ error: "Token already used" }, { status: 410 });
  }

  // Mark token as consumed
  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { configFetched: true },
  });

  const envKey =
    deployment.aiProvider === "openai"
      ? "OPENAI_API_KEY"
      : deployment.aiProvider === "google"
        ? "GOOGLE_GENERATIVE_AI_API_KEY"
        : "ANTHROPIC_API_KEY";

  const apiKey =
    deployment.aiProvider === "google"
      ? (process.env.YELLAI_GEMINI_API_KEY ?? deployment.aiApiKeyEnc ?? "")
      : (deployment.aiApiKeyEnc ?? "");

  const nanoclawConfig = {
    gateway: {
      host: "0.0.0.0",
      port: 18789,
    },
    channels: {
      whatsapp: deployment.whatsappToken
        ? {
            enabled: true,
            phoneNumberId: deployment.whatsappPhoneNumberId,
            token: deployment.whatsappToken,
            provider: deployment.whatsappProvider,
          }
        : undefined,
    },
  };


  return NextResponse.json({
    nanoclawJson: nanoclawConfig,
    env: {
      [envKey]: apiKey,
    },
  });
}
