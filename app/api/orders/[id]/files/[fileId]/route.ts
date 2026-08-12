import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { canViewFile } from "@/lib/permissions";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const file = await prisma.orderFile.findUnique({ where: { id: params.fileId } });
  if (!file || file.orderId !== params.id) {
    return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  }

  const allowed = canViewFile(session.role, session.userId, {
    uploadedById: file.uploadedById,
    visibility: file.visibility,
    visibleRoles: file.visibleRoles,
    visibleUserId: file.visibleUserId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "ليس لديك صلاحية للاطلاع على هذا الملف" }, { status: 403 });
  }

  const absolutePath = path.join(process.cwd(), "uploads", file.fileUrl);
  let buffer: Buffer;
  try {
    buffer = await readFile(absolutePath);
  } catch {
    return NextResponse.json({ error: "تعذر العثور على الملف على القرص" }, { status: 404 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
