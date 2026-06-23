'use client';

import { useState } from 'react';
import type { DeviceInfo } from '@/app/actions';

interface Props {
  data: DeviceInfo;
  imageUrl: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  Claude: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Gemini: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'GPT-4o': 'bg-green-500/20 text-green-300 border-green-500/40',
  OpenRouter: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

const CONFIDENCE_COLORS = {
  high: 'text-emerald-400',
  medium: 'text-yellow-400',
  low: 'text-red-400',
};

const CONFIDENCE_LABELS = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

export default function ResultCard({ data, imageUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const shareText = `📱 전자기기 분석 결과

▸ 제품명: ${data.productName}
▸ 브랜드: ${data.brand}
▸ 출시 연도: ${data.estimatedYear}
▸ 스펙: ${data.specsOverview}
▸ 중고 시세: ${data.usedPriceRange}
▸ 총평: ${data.oneLineReview}

— AI 전자기기 정보 스캐너 (${data.provider})`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const providerClass = PROVIDER_COLORS[data.provider] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  const confidenceClass = CONFIDENCE_COLORS[data.confidence] ?? 'text-gray-400';

  return (
    <div
      className="fade-in rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: '#0f1929', border: '1px solid #1e3a5f' }}
    >
      {/* Image preview strip */}
      <div className="relative h-36 overflow-hidden">
        <img src={imageUrl} alt="분석된 기기" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #0f1929)' }} />
        <div className="absolute top-3 right-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${providerClass}`}>
            {data.provider}
          </span>
        </div>
        <div className="absolute bottom-3 left-4">
          <div className={`text-xs flex items-center gap-1 ${confidenceClass}`}>
            <span>인식 신뢰도</span>
            <span className="font-bold">{CONFIDENCE_LABELS[data.confidence]}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <div>
          <p className="text-xs text-sky-400 font-mono uppercase tracking-widest mb-1">{data.brand}</p>
          <h2 className="text-xl font-bold text-white leading-tight">{data.productName}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{data.estimatedYear}년 출시 추정</p>
        </div>

        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: '#080e1a', border: '1px solid #1e3a5f' }}
        >
          <Row icon="🔧" label="주요 스펙" value={data.specsOverview} multiline />
          <div className="border-t border-gray-800" />
          <Row icon="💰" label="중고 시세" value={data.usedPriceRange} highlight />
          <PriceVerdictRow verdict={data.priceVerdict.verdict} comment={data.priceVerdict.comment} />
          <div className="border-t border-gray-800" />
          <Row icon="⭐" label="한 줄 총평" value={data.oneLineReview} accent />
        </div>

        <button
          onClick={handleCopy}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
          style={{
            background: copied
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
            color: 'white',
          }}
        >
          {copied ? '✓ 클립보드에 복사됨' : '📋 결과 공유 (복사)'}
        </button>
      </div>
    </div>
  );
}

const VERDICT_STYLES = {
  '낮음': { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#34d399', badge: '🟢 낮음' },
  '적정': { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.25)', text: '#38bdf8', badge: '🔵 적정' },
  '높음': { bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)', text: '#fb923c', badge: '🟠 높음' },
};

function PriceVerdictRow({ verdict, comment }: { verdict: '낮음' | '적정' | '높음'; comment: string }) {
  const style = VERDICT_STYLES[verdict] ?? VERDICT_STYLES['적정'];
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}
    >
      <span className="text-xs font-bold shrink-0 mt-0.5" style={{ color: style.text }}>
        {style.badge}
      </span>
      <p className="text-xs leading-relaxed" style={{ color: style.text }}>
        {comment}
      </p>
    </div>
  );
}

function Row({
  icon, label, value, multiline, highlight, accent,
}: {
  icon: string; label: string; value: string;
  multiline?: boolean; highlight?: boolean; accent?: boolean;
}) {
  return (
    <div className={multiline ? 'space-y-1' : 'flex items-start justify-between gap-3'}>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p
        className={`text-sm font-medium leading-relaxed ${
          highlight ? 'text-sky-300' : accent ? 'text-yellow-300' : 'text-gray-200'
        } ${multiline ? 'mt-1' : 'text-right'}`}
      >
        {value}
      </p>
    </div>
  );
}
