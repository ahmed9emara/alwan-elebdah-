import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      createdBy: { select: { id: true, name: true, role: true } },
      stageHistory: {
        select: { user: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

  const map = new Map<string, { id: string; name: string; role: string }>();
  map.set(order.createdBy.id, order.createdBy);
  for (const h of order.stageHistory) {
    map.set(h.user.id, h.user);
  }

  return NextResponse.json({ participants: Array.from(map.values()) });
}
