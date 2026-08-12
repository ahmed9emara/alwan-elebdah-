"use client";

import { useEffect, useState } from "react";

const ROLE_OPTIONS = [
  { value: "admin", label: "مدير النظام" },
  { value: "reception", label: "الاستقبال" },
  { value: "designer", label: "التصميم" },
  { value: "ctp", label: "الزنكات (CTP)" },
  { value: "printer", label: "المطبعة" },
  { value: "cutter", label: "التقطيع" },
  { value: "carton_factory", label: "مصنع الكرتون" },
  { value: "quality", label: "مراقبة الجودة" },
  { value: "production_manager", label: "مدير الإنتاج" },
];

function roleLabel(value: string) {
  return ROLE_OPTIONS.find((r) => r.value === value)?.label ?? value;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "reception" });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) {
      const body = await res.json();
      setUsers(body.users);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ");
      return;
    }
    setForm({ name: "", email: "", password: "", role: "reception" });
    setShowForm(false);
    load();
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setError(null);
  }

  async function saveEdit(user: UserRow) {
    const roleChanged = editForm.role !== user.role;
    if (roleChanged) {
      const ok = confirm(
        `سيتم تغيير دور "${user.name}" من "${roleLabel(user.role)}" إلى "${roleLabel(editForm.role)}".\nسيؤثر هذا على المهام التي يراها هذا المستخدم فوراً. هل تريد المتابعة؟`
      );
      if (!ok) return;
    }
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ");
      return;
    }
    setEditingId(null);
    load();
  }

  async function toggleActive(user: UserRow) {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    load();
  }

  async function deleteUser(user: UserRow) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${user.name}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "تعذر حذف المستخدم");
      return;
    }
    load();
  }

  return (
    <div dir="rtl" lang="ar" className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
        >
          + مستخدم جديد
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {showForm && (
        <form onSubmit={createUser} className="mb-6 space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
          <input
            placeholder="الاسم"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="البريد الإلكتروني"
            type="email"
            dir="ltr"
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            placeholder="كلمة المرور (8 أحرف على الأقل)"
            type="password"
            dir="ltr"
            className="input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-neutral-500">جارٍ التحميل...</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              {editingId === u.id ? (
                <div className="space-y-3">
                  <input
                    className="input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="الاسم"
                  />
                  <input
                    className="input"
                    dir="ltr"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="البريد الإلكتروني"
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-500">الدور</label>
                    <select
                      className="input"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {editForm.role !== u.role && (
                      <p className="mt-1 text-xs font-semibold text-amber-600">
                        ⚠ سيتم تغيير الدور من {roleLabel(u.role)} إلى {roleLabel(editForm.role)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(u)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      حفظ التغييرات
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-sm text-neutral-500" dir="ltr">
                      {u.email}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                        {roleLabel(u.role)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"
                        }`}
                      >
                        {u.isActive ? "نشط" : "معطل"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <button onClick={() => startEdit(u)} className="text-emerald-700 hover:underline">
                      تعديل
                    </button>
                    <button onClick={() => toggleActive(u)} className="text-neutral-600 hover:underline">
                      {u.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                    <button onClick={() => deleteUser(u)} className="text-red-600 hover:underline">
                      حذف
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
