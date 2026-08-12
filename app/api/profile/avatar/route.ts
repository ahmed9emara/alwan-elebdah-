import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "لم يتم إرفاق صورة" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "يجب أن يكون الملف صورة" }, { status: 400 });
  }

  const avatarsDir = path.join(process.cwd(), "uploads", "avatars");
  await mkdir(avatarsDir, { recursive: true });

  const ext = path.extname(file.name) || ".jpg";
  const storedName = `${session.userId}-${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(avatarsDir, storedName), buffer);

  // Served through this same route via GET for simplicity in the foundation version.
  const avatarUrl = `/api/profile/avatar/${storedName}`;

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl },
    select: { id: true, avatarUrl: true },
  });

  return NextResponse.json({ user });
}
