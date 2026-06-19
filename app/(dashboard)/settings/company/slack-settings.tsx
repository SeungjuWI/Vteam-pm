"use client";

import { useState } from "react";
import { saveSlackSettings, sendSlackTest } from "./actions";

export default function SlackSettings({
  initialWebhook,
  initialEnabled,
}: {
  initialWebhook: string;
  initialEnabled: boolean;
}) {
  const [webhook, setWebhook] = useState(initialWebhook);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("webhookUrl", webhook);
    fd.set("enabled", enabled ? "on" : "off");
    const r = await saveSlackSettings(fd);
    setSaving(false);
    if (r?.error) setMsg({ kind: "err", text: r.error });
    else setMsg({ kind: "ok", text: "저장했어요" });
  }

  async function handleTest() {
    setTesting(true);
    setMsg(null);
    const r = await sendSlackTest();
    setTesting(false);
    if (r?.error) setMsg({ kind: "err", text: r.error });
    else setMsg({ kind: "ok", text: `슬랙으로 테스트 전송 완료 (지연 업무 ${r?.count ?? 0}건)` });
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">지연 업무 슬랙 알림</h2>
        <label className="flex cursor-pointer items-center gap-2">
          <span className="text-xs text-gray-500">{enabled ? "켜짐" : "꺼짐"}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-blue-500"
          />
        </label>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-gray-400">
        매일 평일 오전 10시에, 마감일이 지난 업무를 담당자 이름과 함께 슬랙 채널로 보냅니다.
        슬랙에서 <span className="font-medium text-gray-500">Incoming Webhook</span> 주소를 만들어 붙여넣어 주세요.
      </p>

      <label className="mb-1.5 block text-xs font-medium text-gray-600">슬랙 Webhook 주소</label>
      <input
        type="url"
        value={webhook}
        onChange={(e) => setWebhook(e.target.value)}
        placeholder="https://hooks.slack.com/services/..."
        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
      />

      {msg && (
        <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-blue-600" : "text-red-500"}`}>{msg.text}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !webhook.trim()}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? "전송 중…" : "지금 테스트 전송"}
        </button>
      </div>
    </div>
  );
}
