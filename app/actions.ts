'use server';

import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// ── API Key Management ──────────────────────────────────────

const KEY_NAMES = {
  anthropic: 'anthropic_key',
  gemini: 'gemini_key',
  openai: 'openai_key',
  openrouter: 'openrouter_key',
} as const;

export type Provider = keyof typeof KEY_NAMES;

export async function saveApiKeys(keys: Partial<Record<Provider, string>>) {
  const cookieStore = await cookies();
  for (const [provider, key] of Object.entries(keys)) {
    if (key && key.trim()) {
      cookieStore.set(KEY_NAMES[provider as Provider], key.trim(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }
  }
}

export async function deleteApiKey(provider: Provider) {
  const cookieStore = await cookies();
  cookieStore.delete(KEY_NAMES[provider]);
}

export async function getKeyStatus(): Promise<Record<Provider, boolean>> {
  const cookieStore = await cookies();
  return {
    anthropic: !!(cookieStore.get(KEY_NAMES.anthropic)?.value),
    gemini: !!(cookieStore.get(KEY_NAMES.gemini)?.value),
    openai: !!(cookieStore.get(KEY_NAMES.openai)?.value),
    openrouter: !!(cookieStore.get(KEY_NAMES.openrouter)?.value),
  };
}

// ── Visitor Counter ─────────────────────────────────────────

declare global {
  var visitorData: {
    total: number;
    todayDate: string;
    todayCount: number;
    sessions: Set<string>;
  } | undefined;
}

function getStore() {
  if (!globalThis.visitorData) {
    globalThis.visitorData = {
      total: 0,
      todayDate: '',
      todayCount: 0,
      sessions: new Set(),
    };
  }
  return globalThis.visitorData;
}

export async function trackVisit(sessionId: string): Promise<{ total: number; today: number }> {
  const store = getStore();
  const today = new Date().toISOString().slice(0, 10);
  if (store.todayDate !== today) {
    store.todayDate = today;
    store.todayCount = 0;
  }
  if (!store.sessions.has(sessionId)) {
    store.sessions.add(sessionId);
    store.total++;
    store.todayCount++;
    if (store.sessions.size > 10000) {
      const first = store.sessions.values().next().value!;
      store.sessions.delete(first);
    }
  }
  return { total: store.total, today: store.todayCount };
}

// ── Device Analysis ─────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert electronics analyst with deep knowledge of consumer electronics worldwide.
When shown an image of an electronic device, analyze it carefully and respond ONLY with a valid JSON object — no markdown fences, no extra text, just raw JSON.

JSON format:
{
  "productName": "specific product name (Korean if well-known brand, otherwise English/mixed)",
  "brand": "brand name",
  "estimatedYear": "estimated release year or range, e.g. 2022 or 2022-2023",
  "specsOverview": "key specs summary in Korean (CPU, RAM, storage, display, battery, etc. — 2-3 sentences)",
  "usedPriceRange": "estimated Korean used market price range, e.g. 30만원 ~ 50만원. Use N/A if unknown.",
  "priceVerdict": {
    "verdict": "낮음 if the used price is a bargain below typical market value, 적정 if it reflects fair market value, 높음 if it is above typical market value",
    "comment": "one-line recommendation in Korean on whether to buy or sell at this price, e.g. '시세보다 저렴해 지금 구매하기 좋은 타이밍입니다' or '적정가로 거래하기 무난한 상태입니다' or '시세보다 높은 편이라 구매 시 협상을 권장합니다'"
  },
  "oneLineReview": "sharp, opinionated one-line review in Korean",
  "confidence": "high if you can clearly identify the device, medium if partially visible, low if uncertain"
}

If the image does not show an electronic device, set productName to '전자기기를 찾을 수 없음', confidence to 'low', and priceVerdict to {"verdict": "적정", "comment": "기기를 인식할 수 없어 시세 판단이 어렵습니다"}.`;

export interface DeviceInfo {
  productName: string;
  brand: string;
  estimatedYear: string;
  specsOverview: string;
  usedPriceRange: string;
  priceVerdict: {
    verdict: '낮음' | '적정' | '높음';
    comment: string;
  };
  oneLineReview: string;
  confidence: 'high' | 'medium' | 'low';
  provider: string;
}

function parseJSON(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  return JSON.parse(match[0]);
}

export async function analyzeDevice(
  imageBase64: string,
  mimeType: string
): Promise<{ success: true; data: DeviceInfo } | { success: false; error: string }> {
  const cookieStore = await cookies();

  const keys = {
    anthropic: cookieStore.get(KEY_NAMES.anthropic)?.value || process.env.ANTHROPIC_API_KEY,
    gemini: cookieStore.get(KEY_NAMES.gemini)?.value || process.env.GEMINI_API_KEY,
    openai: cookieStore.get(KEY_NAMES.openai)?.value || process.env.OPENAI_API_KEY,
    openrouter: cookieStore.get(KEY_NAMES.openrouter)?.value || process.env.OPENROUTER_API_KEY,
  };

  const tried: string[] = [];
  const errors: string[] = [];

  // 1. Anthropic Claude
  if (keys.anthropic) {
    tried.push('Claude');
    try {
      const client = new Anthropic({ apiKey: keys.anthropic });
      const res = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        }],
      });
      const text = res.content[0].type === 'text' ? res.content[0].text : '';
      const data = parseJSON(text);
      return { success: true, data: { ...(data as unknown as DeviceInfo), provider: 'Claude' } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Claude: ${msg}`);
      console.error('Anthropic error:', e);
    }
  }

  // 2. Google Gemini
  if (keys.gemini) {
    tried.push('Gemini');
    try {
      const genAI = new GoogleGenerativeAI(keys.gemini);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent([
        SYSTEM_PROMPT,
        { inlineData: { data: imageBase64, mimeType } },
      ]);
      const text = result.response.text();
      const data = parseJSON(text);
      return { success: true, data: { ...(data as unknown as DeviceInfo), provider: 'Gemini' } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Gemini: ${msg}`);
      console.error('Gemini error:', e);
    }
  }

  // 3. OpenAI GPT-4o
  if (keys.openai) {
    tried.push('GPT-4o');
    try {
      const client = new OpenAI({ apiKey: keys.openai });
      const res = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        }],
      });
      const text = res.choices[0].message.content || '';
      const data = parseJSON(text);
      return { success: true, data: { ...(data as unknown as DeviceInfo), provider: 'GPT-4o' } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`GPT-4o: ${msg}`);
      console.error('OpenAI error:', e);
    }
  }

  // 4. OpenRouter
  if (keys.openrouter) {
    tried.push('OpenRouter');
    try {
      const client = new OpenAI({
        apiKey: keys.openrouter,
        baseURL: 'https://openrouter.ai/api/v1',
      });
      const res = await client.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        }],
      });
      const text = res.choices[0].message.content || '';
      const data = parseJSON(text);
      return { success: true, data: { ...(data as unknown as DeviceInfo), provider: 'OpenRouter' } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`OpenRouter: ${msg}`);
      console.error('OpenRouter error:', e);
    }
  }

  if (tried.length === 0) {
    return {
      success: false,
      error: 'API 키가 설정되지 않았습니다. ⚙️ 설정에서 API 키를 입력해주세요.',
    };
  }

  return {
    success: false,
    error: `호출 실패 (${tried.join(', ')} 시도함)\n${errors.join('\n')}`,
  };
}
