import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deployment = await prisma.deployment.findFirst({
    where: { id },
    select: { id: true },
  });
  if (!deployment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logs = await prisma.deploymentLog.findMany({
    where: { deploymentId: id },
    orderBy: { createdAt: "asc" },
    select: { message: true, createdAt: true },
  });

  return NextResponse.json({ logs });
}
