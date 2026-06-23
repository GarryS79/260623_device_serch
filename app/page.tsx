'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { analyzeDevice, trackVisit, type DeviceInfo } from '@/app/actions';
import SettingsModal from '@/app/components/SettingsModal';
import ResultCard from '@/app/components/ResultCard';

function getOrCreateSession(): string {
  let id = sessionStorage.getItem('_sid');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('_sid', id);
  }
  return id;
}

function compressImage(file: File, maxSide = 1280): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        const ratio = maxSide / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'));
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve({ base64, mimeType: 'image/jpeg' });
          };
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [result, setResult] = useState<DeviceInfo | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [visitors, setVisitors] = useState<{ total: number; today: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sid = getOrCreateSession();
    trackVisit(sid).then(setVisitors);
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setResult(null);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleAnalyze = () => {
    if (!imageFile) return;
    startTransition(async () => {
      setError('');
      setResult(null);
      try {
        const { base64, mimeType } = await compressImage(imageFile);
        const res = await analyzeDevice(base64, mimeType);
        if (res.success) {
          setResult(res.data);
        } else {
          setError(res.error);
        }
      } catch {
        setError('이미지 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    });
  };

  const handleReset = () => {
    setImageFile(null);
    setImageUrl('');
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <main
      className="flex flex-col min-h-screen"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(8,14,26,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1e3a5f',
          paddingTop: 'max(env(safe-area-inset-top), 0.75rem)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #2563eb)' }}
          >
            📡
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">전자기기 정보 스캐너</h1>
            <p className="text-xs text-gray-500 leading-none">AI Device Scanner</p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          style={{ background: '#0f1929', border: '1px solid #1e3a5f' }}
          aria-label="설정"
        >
          ⚙️
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-4 p-4 max-w-lg mx-auto w-full">

        {/* Upload area */}
        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !imageFile && fileInputRef.current?.click()}
            className="relative rounded-2xl overflow-hidden transition-all"
            style={{
              border: `2px dashed ${isDragging ? '#38bdf8' : '#1e3a5f'}`,
              background: isDragging ? 'rgba(56,189,248,0.05)' : '#0f1929',
              minHeight: imageFile ? 'auto' : '220px',
              cursor: imageFile ? 'default' : 'pointer',
            }}
          >
            {imageFile && imageUrl ? (
              <div className="relative">
                <img
                  src={imageUrl}
                  alt="업로드된 이미지"
                  className="w-full rounded-2xl"
                  style={{ maxHeight: '300px', objectFit: 'cover' }}
                />
                {isPending && (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(8,14,26,0.75)' }}
                  >
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto mb-3">
                        <div
                          className="w-16 h-16 rounded-full border-2 border-sky-400 scanning-border"
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-2xl">
                          🔍
                        </span>
                      </div>
                      <p className="text-sky-400 text-sm font-medium">AI 분석 중...</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
                  style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)' }}
                >
                  📷
                </div>
                <p className="text-gray-300 font-medium mb-1">전자기기 사진을 업로드하세요</p>
                <p className="text-gray-500 text-xs">드래그 & 드롭 또는 클릭</p>
              </div>
            )}
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {/* Camera + gallery buttons (always shown when no result) */}
        {!result && (
          <div className="flex gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: '#0f1929', border: '1px solid #1e3a5f', color: '#94a3b8' }}
            >
              📸 카메라 촬영
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: '#0f1929', border: '1px solid #1e3a5f', color: '#94a3b8' }}
            >
              🖼 갤러리 선택
            </button>
          </div>
        )}

        {/* Analyze / reset buttons */}
        {imageFile && !result && (
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={isPending}
              className="py-3 px-5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40"
              style={{ background: '#0f1929', border: '1px solid #1e3a5f', color: '#94a3b8' }}
            >
              ✕
            </button>
            <button
              onClick={handleAnalyze}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: 'white' }}
            >
              {isPending ? '분석 중...' : '🔍 AI 분석 시작'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm fade-in"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
            }}
          >
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <>
            <ResultCard data={result} imageUrl={imageUrl} />
            <button
              onClick={handleReset}
              className="py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{ background: '#0f1929', border: '1px solid #1e3a5f', color: '#94a3b8' }}
            >
              다른 기기 분석하기
            </button>
          </>
        )}

        {/* Idle info */}
        {!imageFile && !result && (
          <div className="mt-2 text-center space-y-2">
            <p className="text-xs text-gray-500 leading-relaxed">
              노트북, 스마트폰, TV, 가전제품 등<br />
              전자기기 사진을 찍으면 AI가 스펙과 시세를 알려드립니다
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {['노트북', '스마트폰', 'TV', '카메라', '태블릿'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(14,165,233,0.08)',
                    border: '1px solid rgba(14,165,233,0.2)',
                    color: '#7dd3fc',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-3 px-4">
        {visitors && (
          <p className="text-xs text-gray-600">
            오늘 방문자{' '}
            <span className="text-sky-700 font-mono">{visitors.today.toLocaleString()}</span>
            {' '}· 총{' '}
            <span className="text-sky-700 font-mono">{visitors.total.toLocaleString()}</span>
          </p>
        )}
      </footer>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </main>
  );
}
