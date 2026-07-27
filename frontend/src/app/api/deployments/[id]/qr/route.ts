import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDeploymentQrSvg } from "@/lib/nanoclaw/localDeployment";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;

  const { id } = await params;
  const deployment = await prisma.deployment.findFirst({
    where: { id },
    select: { localPath: true },
  });

  if (!deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  if (!deployment.localPath) {
    return NextResponse.json({ error: "QR not available yet" }, { status: 404 });
  }

  const svg = await getDeploymentQrSvg(deployment.localPath);
  if (!svg) {
    return NextResponse.json({ error: "QR not ready" }, { status: 404 });
  }

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
