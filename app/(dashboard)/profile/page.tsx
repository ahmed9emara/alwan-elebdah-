"use client";

import { useEffect, useState } from "react";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/profile");
    if (res.ok) {
      const body = await res.json();
      setProfile(body.user);
      setName(body.user.name);
      setEmail(body.user.email);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, string> = { name, email };
    if (newPassword) {
      payload.newPassword = newPassword;
      payload.currentPassword = currentPassword;
    }

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ");
      return;
    }
    setSuccess("تم حفظ التغييرات بنجاح");
    setCurrentPassword("");
    setNewPassword("");
    load();
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
    setUploadingAvatar(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "فشل رفع الصورة");
      return;
    }
    load();
  }

  if (loading) {
    return (
      <div dir="rtl" className="mx-auto max-w-lg p-6 text-neutral-500">
        جارٍ التحميل...
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ar" className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-2xl font-bold">الملف الشخصي</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-700">
          {success}
        </div>
      )}

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-xl font-bold text-neutral-500">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="الصورة الشخصية" className="h-full w-full object-cover" />
          ) : (
            profile?.name?.charAt(0)
          )}
        </div>
        <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">
          {uploadingAvatar ? "جارٍ الرفع..." : "تغيير الصورة (اختياري)"}
          <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploadingAvatar} />
        </label>
      </div>

      <form onSubmit={save} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <label className="mb-1 block font-medium">الاسم</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block font-medium">البريد الإلكتروني</label>
          <input
            type="email"
            dir="ltr"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <hr className="border-neutral-200" />

        <p className="text-sm font-medium text-neutral-500">تغيير كلمة المرور (اختياري)</p>
        <div>
          <label className="mb-1 block font-medium">كلمة المرور الحالية</label>
          <input
            type="password"
            dir="ltr"
            className="input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block font-medium">كلمة المرور الجديدة</label>
          <input
            type="password"
            dir="ltr"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
        </button>
      </form>
    </div>
  );
}
