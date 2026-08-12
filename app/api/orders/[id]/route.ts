import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { redactOrderForRole, canViewFile } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      stageHistory: {
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      files: true,
    },
  });

  if (!order || order.deletedAt) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const visibleFiles = order.files.filter((f) =>
    canViewFile(session.role, session.userId, {
      uploadedById: f.uploadedById,
      visibility: f.visibility,
      visibleRoles: f.visibleRoles,
      visibleUserId: f.visibleUserId,
    })
  );

  return NextResponse.json({
    order: redactOrderForRole({ ...order, files: visibleFiles }, session.role),
  });
}
