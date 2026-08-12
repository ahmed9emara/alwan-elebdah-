import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل").optional(),
  })
  .refine((d) => !d.newPassword || !!d.currentPassword, {
    message: "يجب إدخال كلمة المرور الحالية لتغيير كلمة المرور",
    path: ["currentPassword"],
  });

export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, phone: true, role: true, avatarUrl: true },
  });
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "بيانات غير صحيحة" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const current = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!current) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  const updateData: Record<string, any> = {};
  if (data.name) updateData.name = data.name;

  if (data.email && data.email !== current.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 409 });
    }
    updateData.email = data.email;
  }

  if (data.newPassword) {
    const valid = await bcrypt.compare(data.currentPassword!, current.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
    }
    updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: updateData,
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  return NextResponse.json({ user });
}
