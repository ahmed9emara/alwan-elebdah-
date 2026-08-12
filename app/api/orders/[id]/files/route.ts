import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Role } from "@prisma/client";

/**
 * Local-disk file storage for the foundation version.
 *
 * `fileUrl` stores an opaque path/key rather than assuming any particular
 * backend, so swapping this handler for an S3/MinIO upload later (see
 * SCALABILITY_PLAN.md, "Scaling file storage") does not require a schema
 * change — only this route and the download route.
 *
 * Files are NOT served as static assets (the uploads dir lives outside
 * /public on purpose) — every download goes through
 * app/api/orders/[id]/files/[fileId]/route.ts so visibility rules apply.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.deletedAt) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const fileType = (form.get("fileType") as string) || "other";
  const visibility = (form.get("visibility") as string) || "everyone";
  const visibleRolesRaw = form.getAll("visibleRoles") as string[];
  const visibleUserId = (form.get("visibleUserId") as string) || null;

  if (!file) {
    return NextResponse.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });
  }
  if (!["everyone", "roles", "user"].includes(visibility)) {
    return NextResponse.json({ error: "قيمة الظهور غير صحيحة" }, { status: 400 });
  }
  if (visibility === "roles" && visibleRolesRaw.length === 0) {
    return NextResponse.json({ error: "يرجى اختيار دور واحد على الأقل" }, { status: 400 });
  }
  if (visibility === "user" && !visibleUserId) {
    return NextResponse.json({ error: "يرجى اختيار المستخدم" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "uploads", order.id);
  await mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(file.name);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, storedName), buffer);

  const orderFile = await prisma.orderFile.create({
    data: {
      orderId: order.id,
      uploadedById: session.userId,
      fileName: file.name,
      fileUrl: `${order.id}/${storedName}`, // opaque key relative to the uploads root — see note above
      fileType,
      sizeBytes: buffer.byteLength,
      visibility: visibility as any,
      visibleRoles: visibility === "roles" ? (visibleRolesRaw as Role[]) : [],
      visibleUserId: visibility === "user" ? visibleUserId : null,
    },
  });

  return NextResponse.json({ file: orderFile }, { status: 201 });
}
