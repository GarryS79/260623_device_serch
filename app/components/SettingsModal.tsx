'use client';

import { useState, useEffect, useTransition } from 'react';
import { saveApiKeys, deleteApiKey, getKeyStatus, type Provider } from '@/app/actions';

interface Props {
  onClose: () => void;
}

const PROVIDERS: { id: Provider; label: string; placeholder: string; color: string }[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', color: 'text-orange-400' },
  { id: 'gemini', label: 'Google Gemini', placeholder: 'AIza...', color: 'text-blue-400' },
  { id: 'openai', label: 'OpenAI (GPT-4o)', placeholder: 'sk-...', color: 'text-green-400' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...', color: 'text-purple-400' },
];

export default function SettingsModal({ onClose }: Props) {
  const [keys, setKeys] = useState<Partial<Record<Provider, string>>>({});
  const [status, setStatus] = useState<Record<Provider, boolean>>({
    anthropic: false, gemini: false, openai: false, openrouter: false,
  });
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getKeyStatus().then(setStatus);
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      await saveApiKeys(keys);
      const newStatus = await getKeyStatus();
      setStatus(newStatus);
      setKeys({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const handleDelete = (provider: Provider) => {
    startTransition(async () => {
      await deleteApiKey(provider);
      const newStatus = await getKeyStatus();
      setStatus(newStatus);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: '#0f1929', border: '1px solid #1e3a5f' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-sky-400">⚙️ API 키 설정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-5">
          키는 httpOnly 쿠키에 저장되며 서버에서만 사용됩니다.
          우선순위: Claude → Gemini → GPT-4o → OpenRouter
        </p>

        <div className="space-y-4">
          {PROVIDERS.map((p) => (
            <div key={p.id}>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-sm font-medium ${p.color}`}>{p.label}</label>
                {status[p.id] ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      저장됨
                    </span>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      disabled={isPending}
                    >
                      삭제
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">미설정</span>
                )}
              </div>
              <input
                type="password"
                value={keys[p.id] ?? ''}
                onChange={(e) => setKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                placeholder={status[p.id] ? '새 키로 교체하려면 입력' : p.placeholder}
                className="w-full rounded-lg px-3 py-2 text-sm bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={isPending || Object.values(keys).every((v) => !v?.trim())}
          className="mt-6 w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: saved
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
            color: 'white',
          }}
        >
          {saved ? '✓ 저장됨' : isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
