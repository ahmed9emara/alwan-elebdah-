import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { Role } from "@prisma/client";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(Role).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  if (parsed.data.email) {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing && existing.id !== params.id) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 409 });
    }
  }

  // Guard: an admin cannot demote themselves out of the admin role, to avoid
  // accidentally locking the last admin out of user management.
  if (session.userId === params.id && parsed.data.role && parsed.data.role !== Role.admin) {
    const adminCount = await prisma.user.count({ where: { role: Role.admin, deletedAt: null } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "لا يمكنك تغيير دورك بما أنك المدير الوحيد في النظام" },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: parsed.data as any,
    select: { id: true, name: true, email: true, phone: true, isActive: true, role: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  if (session.userId === params.id) {
    return NextResponse.json({ error: "لا يمكنك حذف حسابك الخاص" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), isActive: false },
  });

  return NextResponse.json({ ok: true });
}
