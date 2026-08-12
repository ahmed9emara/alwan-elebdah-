"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderActions({
  orderId,
  currentStatus,
  role,
  canAdvance,
  returnOptions,
}: {
  orderId: string;
  currentStatus: string;
  role: string;
  canAdvance: boolean;
  returnOptions: { to: string; label: string }[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [showReturn, setShowReturn] = useState(false);
  const [returnTarget, setReturnTarget] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function advance() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance", note: note || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ");
      return;
    }
    router.refresh();
  }

  async function submitReturn() {
    if (!returnTarget || !returnReason.trim()) {
      setError("يرجى اختيار المرحلة وكتابة سبب الإرجاع");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "return",
        toStatus: returnTarget,
        returnReason,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "حدث خطأ");
      return;
    }
    setShowReturn(false);
    router.refresh();
  }

  if (!canAdvance && returnOptions.length === 0) return null;

  return (
    <div dir="rtl" className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold">الإجراءات</h2>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <textarea
        placeholder="ملاحظة (اختياري)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="input mb-3"
        rows={2}
      />

      <div className="flex flex-wrap gap-3">
        {canAdvance && (
          <button
            onClick={advance}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            ✓ تم الإنجاز
          </button>
        )}
        {returnOptions.length > 0 && (
          <button
            onClick={() => setShowReturn((v) => !v)}
            className="rounded-lg border border-red-300 px-5 py-2.5 font-semibold text-red-600 hover:bg-red-50"
          >
            ↩ إرجاع لمرحلة سابقة
          </button>
        )}
      </div>

      {showReturn && (
        <div className="mt-4 space-y-3 rounded-lg bg-neutral-50 p-4">
          <select
            className="input"
            value={returnTarget}
            onChange={(e) => setReturnTarget(e.target.value)}
          >
            <option value="">اختر المرحلة المطلوب الإرجاع إليها</option>
            {returnOptions.map((opt) => (
              <option key={opt.to} value={opt.to}>
                {opt.label}
              </option>
            ))}
          </select>
          <textarea
            placeholder="سبب الإرجاع (مطلوب)"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="input"
            rows={2}
          />
          <button
            onClick={submitReturn}
            disabled={loading}
            className="rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            تأكيد الإرجاع
          </button>
        </div>
      )}
    </div>
  );
}
