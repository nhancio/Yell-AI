import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const deployments = await prisma.deployment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      assistantName: true,
      instanceId: true,
      phoneNumber: true,
      gatewayUrl: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ deployments });
}
