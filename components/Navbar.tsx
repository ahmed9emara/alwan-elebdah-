"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  reception: "الاستقبال",
  designer: "التصميم",
  ctp: "الزنكات (CTP)",
  printer: "المطبعة",
  cutter: "التقطيع",
  carton_factory: "مصنع الكرتون",
  quality: "مراقبة الجودة",
  production_manager: "مدير الإنتاج",
};

export default function Navbar({
  userName,
  role,
  canCreateOrder,
  isAdmin,
}: {
  userName: string;
  role: string;
  canCreateOrder: boolean;
  isAdmin: boolean;
}) {
  return (
    <nav dir="rtl" className="border-b border-neutral-200 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold text-emerald-700">
            نظام إدارة الإنتاج
          </Link>
          <Link href="/dashboard" className="text-sm text-neutral-600 hover:text-emerald-700">
            مهامي
          </Link>
          {canCreateOrder && (
            <Link href="/orders/new" className="text-sm text-neutral-600 hover:text-emerald-700">
              طلب جديد
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin/users" className="text-sm text-neutral-600 hover:text-emerald-700">
              إدارة المستخدمين
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="text-sm text-neutral-600 hover:text-emerald-700"
          >
            {userName} · {ROLE_LABELS[role] ?? role}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    </nav>
  );
}
