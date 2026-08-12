"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

interface Participant {
  id: string;
  name: string;
  role: string;
}

export default function FileUpload({
  orderId,
  participants,
}: {
  orderId: string;
  participants: Participant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"everyone" | "roles" | "user">("everyone");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) {
      setError("يرجى اختيار ملف");
      return;
    }
    if (visibility === "roles" && selectedRoles.length === 0) {
      setError("يرجى اختيار دور واحد على الأقل");
      return;
    }
    if (visibility === "user" && !selectedUserId) {
      setError("يرجى اختيار المستخدم");
      return;
    }

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileType", "other");
    formData.append("visibility", visibility);
    if (visibility === "roles") {
      selectedRoles.forEach((r) => formData.append("visibleRoles", r));
    }
    if (visibility === "user") {
      formData.append("visibleUserId", selectedUserId);
    }

    const res = await fetch(`/api/orders/${orderId}/files`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "فشل رفع الملف");
      return;
    }
    setFile(null);
    setOpen(false);
    setVisibility("everyone");
    setSelectedRoles([]);
    setSelectedUserId("");
    router.refresh();
  }

  return (
    <div dir="rtl">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          📎 إرفاق ملف
        </button>
      ) : (
        <div className="w-72 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          {error && <p className="text-sm text-red-500">{error}</p>}

          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />

          <div>
            <p className="mb-1 text-sm font-medium">من يمكنه رؤية هذا الملف؟</p>
            <select
              className="input"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
            >
              <option value="everyone">الجميع المشاركون في الطلب</option>
              <option value="roles">أدوار محددة</option>
              <option value="user">مستخدم محدد</option>
            </select>
          </div>

          {visibility === "roles" && (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-neutral-200 bg-white p-2">
              {ROLE_OPTIONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.value)}
                    onChange={(e) => {
                      setSelectedRoles((prev) =>
                        e.target.checked ? [...prev, r.value] : prev.filter((v) => v !== r.value)
                      );
                    }}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          )}

          {visibility === "user" && (
            <select
              className="input"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">اختر المستخدم</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={uploading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {uploading ? "جارٍ الرفع..." : "رفع الملف"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-white"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
