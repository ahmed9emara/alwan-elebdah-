import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { Role } from "@prisma/client";

const createUserSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صحيح"),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  branchId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      branchId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(req);
  if (!session || !canManageUsers(session.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      passwordHash,
      branchId: data.branchId,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
