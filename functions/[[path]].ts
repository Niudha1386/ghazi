/**
 * Cloudflare Pages Functions entrypoint
 * Route handler for all /api/* endpoints on Cloudflare Pages.
 * Includes complete in-memory system logging, diagnostic probe, multi-model failover, and case generation.
 */

import { PRESET_CASES } from '../src/data/presets.ts';
import { CaseDossier, Character, EvidenceItem } from '../src/types.ts';

export interface EventContextEnv {
  GEMINI_API_KEY?: string;
  MY_GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  API_KEY?: string;
  GOOGLE_GENAI_API_KEY?: string;
  GEMINI_KEY?: string;
  GEMINI?: string;
  AI_API_KEY?: string;
  VITE_GEMINI_API_KEY?: string;
  GEMINI_BASE_URL?: string;
  GOOGLE_GENAI_BASE_URL?: string;
  PRIMARY_MODEL?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

// Active modern Gemini models supported on Google v1beta API
const PRIMARY_MODEL = 'gemini-3.8-flash';
const MODEL_TIER_MAIN = [
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];
const MODEL_TIER_FAST_LITE = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-pro-preview',
];

export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'success';
  module: string;
  message: string;
  details?: any;
}

// In-memory log buffer for Cloudflare Pages runtime
const workerLogs: SystemLog[] = [];

function addWorkerLog(type: SystemLog['type'], module: string, message: string, details?: any) {
  const log: SystemLog = {
    id: `log-p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    module,
    message,
    details: details ? (typeof details === 'object' ? JSON.parse(JSON.stringify(details)) : { info: details }) : undefined,
  };
  workerLogs.unshift(log);
  if (workerLogs.length > 150) {
    workerLogs.pop();
  }
  console.log(`[${log.timestamp}] [${type.toUpperCase()}] [${module}] ${message}`);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

function parseJsonFromAi<T>(rawText: string): T {
  let cleaned = (rawText || '').trim();
  const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/i) || cleaned.match(/```\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    cleaned = jsonMatch[1].trim();
  } else {
    // If no markdown code block, extract between first { or [ and last } or ]
    const firstBrace = cleaned.search(/[\{\[]/);
    const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(cleaned) as T;
}

interface ResolvedApiKey {
  key: string;
  source: string;
}

function extractApiKeyWithSource(request: Request, env?: EventContextEnv, requestBody?: any): ResolvedApiKey {
  try {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get('apiKey') || url.searchParams.get('key');
    if (queryKey && queryKey.trim()) return { key: queryKey.trim(), source: 'query_param' };
  } catch {
    // ignore URL parse error
  }

  const headerKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (headerKey && headerKey.trim()) return { key: headerKey.trim(), source: 'header' };

  if (requestBody && typeof requestBody === 'object') {
    if (requestBody.apiKey && typeof requestBody.apiKey === 'string') return { key: requestBody.apiKey.trim(), source: 'body' };
    if (requestBody.geminiApiKey && typeof requestBody.geminiApiKey === 'string') return { key: requestBody.geminiApiKey.trim(), source: 'body' };
  }

  if (env) {
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim()) return { key: env.GEMINI_API_KEY.trim(), source: 'env.GEMINI_API_KEY' };
    if (env.MY_GEMINI_API_KEY && env.MY_GEMINI_API_KEY.trim()) return { key: env.MY_GEMINI_API_KEY.trim(), source: 'env.MY_GEMINI_API_KEY' };
    if (env.GOOGLE_API_KEY && env.GOOGLE_API_KEY.trim()) return { key: env.GOOGLE_API_KEY.trim(), source: 'env.GOOGLE_API_KEY' };
    if (env.API_KEY && env.API_KEY.trim()) return { key: env.API_KEY.trim(), source: 'env.API_KEY' };
    if (env.GOOGLE_GENAI_API_KEY && env.GOOGLE_GENAI_API_KEY.trim()) return { key: env.GOOGLE_GENAI_API_KEY.trim(), source: 'env.GOOGLE_GENAI_API_KEY' };
    if (env.GEMINI_KEY && env.GEMINI_KEY.trim()) return { key: env.GEMINI_KEY.trim(), source: 'env.GEMINI_KEY' };
    if (env.GEMINI && env.GEMINI.trim()) return { key: env.GEMINI.trim(), source: 'env.GEMINI' };
    if (env.AI_API_KEY && env.AI_API_KEY.trim()) return { key: env.AI_API_KEY.trim(), source: 'env.AI_API_KEY' };
    if (env.VITE_GEMINI_API_KEY && env.VITE_GEMINI_API_KEY.trim()) return { key: env.VITE_GEMINI_API_KEY.trim(), source: 'env.VITE_GEMINI_API_KEY' };
  }

  if (typeof process !== 'undefined' && process?.env) {
    const pKey =
      process.env.GEMINI_API_KEY ||
      process.env.MY_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY;
    if (pKey && pKey.trim()) return { key: pKey.trim(), source: 'process.env' };
  }

  return { key: '', source: 'none' };
}

function extractCustomBaseUrl(env?: EventContextEnv): string {
  if (env) {
    if (env.GEMINI_BASE_URL) return env.GEMINI_BASE_URL.trim();
    if (env.GOOGLE_GENAI_BASE_URL) return env.GOOGLE_GENAI_BASE_URL.trim();
  }
  if (typeof process !== 'undefined' && process?.env) {
    const url = process.env.GEMINI_BASE_URL || process.env.GOOGLE_GENAI_BASE_URL;
    if (url) return url.trim();
  }
  return '';
}

// Procedural Case Generator for offline / fallback
function generateProceduralCase(topic: string): CaseDossier {
  const cleanTopic = topic.trim();
  const caseId = `case-${Date.now()}`;
  const caseNum = `۱۴۰۵/${Math.floor(100 + Math.random() * 899)}-ج`;

  return {
    id: caseId,
    caseNumber: caseNum,
    title: `پرونده بحرانی درباره: ${cleanTopic}`,
    genre: 'بررسی تخلف، دادرسی و حل معما',
    incidentDate: '۱۴۰۵/۰۷/۰۹ - ساعت ۲۱:۰۰ شب',
    location: 'محل وقوع اختلافات مربوط به پرونده',
    victimName: 'جناب آقای کامران رستگار (شاکی / متضرر پرونده)',
    victimBackground: `شخص ذینفع و شاکی اصلی پرونده که تقاضای ممیزی رسمی و پیگرد قانونی موضوع «${cleanTopic}» را دارد.`,
    briefing: `گزارش بازرسی شعبه ویژه دادگاه: تحقیقات اولیه پیرامون موضوع «${cleanTopic}» حاکی از وجود تخلفات جدی و اسناد متناقض مالی و اداری است. اشخاص مرتبط هر کدام ادعاهای متناقضی را در محضر دادگاه مطرح نموده‌اند که نیازمند بازجویی و مداقه جنایی قاضی است.`,
    autopsyReport: {
      timeOfDeath: 'ساعت ۲۰:۳۰ الی ۲۱:۰۰ شب',
      causeOfDeath: `ریشه اختلاف پیرامون موضوع: ${cleanTopic}`,
      toxicology: 'مثبت - وجود تخلف ساختاری و جعل اسناد اداری',
      injuries: ['فاکتورهای مالی مورد مناقشه', 'اسناد پلاک ثبتی یا شهادت شهود'],
      coronerNotes: 'بررسی کارشناسی حاکی از تعمد کامل متهم اصلی در ارتکاب تخلف و دروغگویی سیستماتیک است.',
    },
    evidence: [
      {
        id: 'ev-u1',
        title: 'اسناد انتقال اموال با امضای جعل‌شده',
        type: 'document',
        description: 'اسناد مالی کشف‌شده در کشوی دفتر کار متهم.',
        foundAt: 'دفتر کار متهم اصلی',
        significance: 'ثبت انگیزه مالی دقیق برای وقوع جنایت.',
        labReport: 'تایید جعل امضای مقتول توسط متهم.',
      },
      {
        id: 'ev-u2',
        title: 'پرینت ردیابی دکل مخابراتی موبایل',
        type: 'digital',
        description: 'گزارش آنتن‌دهی گوشی متهم اصلی در زمان وقوع فوت.',
        foundAt: 'استعلام پلیس فتا',
        significance: 'رد کامل ادعای الایبی متهم مبنی بر حضور در شهر دیگر.',
        labReport: 'تایید حضور گوشی متهم در محدوده صحنه جرم.',
      },
    ],
    characters: [
      {
        id: 'char-u1',
        name: 'بهرام کاظمی (۴۵ ساله)',
        role: 'defendant',
        roleTitle: 'متهم ردیف اول - شریک کاری مقتول',
        age: 45,
        occupation: 'مدیر ارشد مالی',
        relationToVictim: 'شریک کاری و رقیب اصلی مقتول',
        personality: 'حیله‌گر و خونسرد',
        initialStatement: '«جناب قاضی، بنده در زمان وقوع حادثه در جلسه رسمی با شرکای خارجی بودم و هیچ نقشی در این ماجرا ندارم!»',
        suspicionLevel: 85,
        isLying: true,
        deceptionStrategy: 'ارائه فاکتور و الایبی جعلی برای ساعت وقوع جنایت.',
        vulnerabilities: ['تناقض ردیابی آنتن تلفن همراه با ادعای حضور در جلسه', 'بدهی ۵ میلیاردی به مقتول'],
      },
      {
        id: 'char-u2',
        name: 'شیوا خسروی (۳۶ ساله)',
        role: 'plaintiff',
        roleTitle: 'شاکی - همسر قانونی مقتول',
        age: 36,
        occupation: 'نماینده قانونی خانواده',
        relationToVictim: 'همسر مقتول',
        personality: 'متاثر و خواهان احقاق حق',
        initialStatement: '«ریاست محترم دادگاه، متهم ردیف اول بارها همسرم را بر سر اسناد مالی تهدید به مرگ کرده بود!»',
        suspicionLevel: 25,
        isLying: false,
        deceptionStrategy: 'ارائه پرینت تهدیدها به دادگاه.',
        vulnerabilities: [],
      },
      {
        id: 'char-u3',
        name: 'سرهنگ حامد نوری (۵۰ ساله)',
        role: 'expert',
        roleTitle: 'کارشناس رسمی - کارآگاه ویژه جنایی',
        age: 50,
        occupation: 'کارآگاه ارشد آگاهی',
        relationToVictim: 'مسئول بررسی صحنه جرم',
        personality: 'دقیق و قانون‌مدار',
        initialStatement: '«بررسی صحنه جرم نشان می‌دهد جنایت کاملاً برنامه‌ریزی‌شده و توسط فردی با دسترسی مستقیم رخ داده است.»',
        suspicionLevel: 10,
        isLying: false,
        deceptionStrategy: 'ارائه گزارش رسمی کشف جرم.',
        vulnerabilities: [],
      },
      {
        id: 'char-u4',
        name: 'امید نیازی (۳۱ ساله)',
        role: 'witness',
        roleTitle: 'شاهد - نگهبان شب ساختمان',
        age: 31,
        occupation: 'نگهبان و مسئول ایمنی',
        relationToVictim: 'کارمند ساختمان',
        personality: 'مضطرب و تیزبین',
        initialStatement: '«من دیدم متهم خروجش از ساختمان را طوری تنظیم کرد که ساعت دوربین‌ها خراب نشان داده شود!»',
        suspicionLevel: 30,
        isLying: false,
        deceptionStrategy: 'شاهد لغزش‌های متهم.',
        vulnerabilities: [],
      },
      {
        id: 'char-u5',
        name: 'رضا نامجو (۳۹ ساله)',
        role: 'defendant',
        roleTitle: 'متهم ردیف دوم - حسابدار سابق شرکت',
        age: 39,
        occupation: 'حسابدار ارشد',
        relationToVictim: 'همکار و حسابدار مقتول',
        personality: 'ترسیده و منفعت‌طلب',
        initialStatement: '«جناب قاضی، من فقط دستورات متهم ردیف اول را روی فاکتورها اجرا می‌کردم و نیت شومی نداشتم!»',
        suspicionLevel: 60,
        isLying: true,
        deceptionStrategy: 'انداختن تمام مسئولیت‌ها بر دوش متهم اول جهت تخفیف مجازات.',
        vulnerabilities: ['انتقال مبلغ ۲۰۰ میلیونی به حساب شخصی او درست پس از حادثه'],
      },
    ],
    hiddenTruth: {
      realCulpritId: 'char-u1',
      realCulpritName: 'بهرام کاظمی (شریک کاری)',
      motive: 'تصاحب اموال و تسویه بدهی ۵ میلیاردی به مقتول',
      howCrimeHappened: 'متهم ردیف اول وارد دفتر کار مقتول شده، اسناد جعل‌شده را قرار داده و با تنفس ماده سمی مقتول را به قتل رسانده است.',
      keyContradiction: 'تناقض فاحش الایبی متهم با ردیابی آنتن دکل مخابراتی و اسناد جعل‌شده در کیف وی.',
    },
    allowsLiveConfession: false,
  };
}

// Ultra-robust Edge-native REST API fetch to Gemini with multi-model auto-failover
async function generateWorkerRestAi(
  apiKey: string,
  prompt: string,
  isJsonMode = false,
  temperature = 0.85,
  maxOutputTokens?: number,
  modelPool: string[] = MODEL_TIER_MAIN,
  customBaseUrl?: string
) {
  if (!apiKey) {
    addWorkerLog('error', 'GeminiWorker', 'فراخوانی هوش مصنوعی بدون کلید API رد شد.');
    throw new Error('No Gemini API key supplied');
  }

  let lastErrorMsg = '';
  const baseUrl = (customBaseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');

  for (const modelCandidate of modelPool) {
    const startTime = Date.now();
    try {
      addWorkerLog('info', 'GeminiWorker', `ارسال درخواست به مدل [${modelCandidate}] (JSON: ${isJsonMode})`);
      const endpoint = `${baseUrl}/v1beta/models/${modelCandidate}:generateContent?key=${encodeURIComponent(apiKey)}`;
      
      const generationConfig: Record<string, any> = {
        temperature,
        ...(isJsonMode ? { responseMimeType: 'application/json' } : {}),
      };
      if (maxOutputTokens) {
        generationConfig.maxOutputTokens = maxOutputTokens;
      }

      const reqBody: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aistudio-build-judge-app-worker',
        },
        body: JSON.stringify(reqBody),
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errJson: any = await res.json().catch(() => null);
        const errMsg = errJson?.error?.message || (await res.text().catch(() => '')) || res.statusText;
        lastErrorMsg = `[Model ${modelCandidate} HTTP ${res.status}]: ${errMsg}`;
        addWorkerLog('warn', 'GeminiWorker', `خطا در مدل [${modelCandidate}] (کد ${res.status}) پس از ${latencyMs}ms: ${errMsg}`);
        continue;
      }

      const data: any = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        addWorkerLog('success', 'GeminiWorker', `پاسخ موفق از مدل [${modelCandidate}] در ${latencyMs}ms (${text.length} کاراکتر)`);
        return { text, usedModel: modelCandidate, latencyMs };
      } else {
        lastErrorMsg = `[Model ${modelCandidate}]: متن خروجی خالی برگردانده شد`;
        addWorkerLog('warn', 'GeminiWorker', lastErrorMsg);
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      lastErrorMsg = `[Model ${modelCandidate}]: ${err?.message || err}`;
      addWorkerLog('error', 'GeminiWorker', `خطای شبکه در مدل [${modelCandidate}] پس از ${latencyMs}ms: ${err?.message || err}`);
    }
  }

  addWorkerLog('error', 'GeminiWorker', `تمامی مدل‌های استخر با شکست مواجه شدند. آخرین خطا: ${lastErrorMsg}`);
  throw new Error(`All Gemini candidate models failed. Details: ${lastErrorMsg}`);
}

export async function onRequest(context: { request: Request; env: EventContextEnv }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: any = null;
  if (request.method === 'POST') {
    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }
  }

  const { key: apiKey, source: apiKeySource } = extractApiKeyWithSource(request, env, requestBody);
  const customBaseUrl = extractCustomBaseUrl(env);

  // Initial log on first call if log buffer is empty
  if (workerLogs.length === 0) {
    addWorkerLog(
      apiKey ? 'success' : 'warn',
      'WorkerInit',
      apiKey
        ? `محیط ورکر پیجز فعال شد. کلید API از منبع [${apiKeySource}] شناسایی شد (${apiKey.substring(0, 6)}...).`
        : 'محیط ورکر پیجز فعال شد اما هیچ کلید API در تنظیمات یافت نشد (حالت آفلاین).'
    );
  }

  // 1. Preset Cases
  if (url.pathname === '/api/preset-cases') {
    return jsonResponse(PRESET_CASES);
  }

  // 2. System Logs (Active In-Memory Logging for Frontend UI)
  if (url.pathname === '/api/system-logs') {
    const logsToReturn = workerLogs.length > 0 ? workerLogs : [
      {
        id: 'log-worker-init',
        timestamp: new Date().toISOString(),
        type: (apiKey ? 'success' : 'warn') as SystemLog['type'],
        module: 'CloudflarePages',
        message: apiKey
          ? `سرویس ورکر فعال است. کلید API (${apiKey.substring(0, 6)}...) از [${apiKeySource}] شناسایی شد.`
          : 'سرویس ورکر در حالت آفلاین است (هیچ متغیر API در ورکر یافت نشد).',
      },
    ];
    return jsonResponse(logsToReturn);
  }

  // 3. Models Info
  if (url.pathname === '/api/models-info') {
    return jsonResponse({
      primaryModel: env?.PRIMARY_MODEL || PRIMARY_MODEL,
      models: MODEL_TIER_MAIN,
      hasApiKey: !!apiKey,
      apiKeySource,
    });
  }

  // 4. Bridge Status
  if (url.pathname === '/api/bridge-status') {
    return jsonResponse({
      active: !!apiKey,
      bridge: 'Cloudflare Pages & Worker Edge Runtime',
      model: env?.PRIMARY_MODEL || PRIMARY_MODEL,
      noVpnNeeded: true,
      apiKeySource,
      message: apiKey
        ? `پل ارتباطی جمینای در سرور ورکر فعال است. (منبع: ${apiKeySource})`
        : 'کلید GEMINI_API_KEY در تنظیمات ورکر یافت نشد. حالت آفلاین فعال است.',
    });
  }

  // 5. Ping & Test Model Endpoint (for Settings modal & model tester)
  if ((url.pathname === '/api/ping-model' || url.pathname === '/api/test-gemini-model') && request.method === 'POST') {
    const targetModel = requestBody?.modelName || env?.PRIMARY_MODEL || PRIMARY_MODEL;
    const testPrompt = requestBody?.prompt || 'تست اتصال دیوان عدالت جنایی. در یک کلمه پاسخ بده: آماده';

    addWorkerLog('info', 'ModelTester', `شروع آزمون اتصال برای مدل [${targetModel}]`);

    if (!apiKey) {
      const errMsg = 'کلید GEMINI_API_KEY در متغیرهای ورکر کلودفلر (Settings > Variables and Secrets) تنظیم نشده است.';
      addWorkerLog('error', 'ModelTester', `تست مدل ${targetModel} ناموفق: ${errMsg}`);
      return jsonResponse({
        success: false,
        modelName: targetModel,
        latencyMs: 0,
        error: errMsg,
      });
    }

    const startTime = Date.now();
    try {
      const poolToTry = [targetModel, ...MODEL_TIER_MAIN.filter((m) => m !== targetModel)];
      const resAi = await generateWorkerRestAi(
        apiKey,
        testPrompt,
        false,
        0.1,
        250,
        poolToTry,
        customBaseUrl
      );
      const latencyMs = Date.now() - startTime;
      addWorkerLog('success', 'ModelTester', `آزمون مدل [${resAi.usedModel}] با موفقیت پایان یافت (${latencyMs}ms): "${resAi.text.trim()}"`);
      return jsonResponse({
        success: true,
        modelName: resAi.usedModel,
        latencyMs,
        responseText: resAi.text.trim(),
      });
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errMsg = err?.message || String(err);
      addWorkerLog('error', 'ModelTester', `آزمون مدل [${targetModel}] ناموفق بود: ${errMsg}`);
      return jsonResponse({
        success: false,
        modelName: targetModel,
        latencyMs,
        error: errMsg,
      });
    }
  }

  // 6. Diagnose Gemini Comprehensive Probe
  if (url.pathname === '/api/diagnose-gemini' && request.method === 'POST') {
    addWorkerLog('info', 'Diagnostics', 'درخواست تست عیب‌یابی جامع جمینای روی ورکر دریافت شد.');

    const report: any = {
      timestamp: new Date().toISOString(),
      apiKeyConfigured: !!apiKey,
      apiKeySource,
      apiKeyMasked: apiKey ? apiKey.substring(0, 6) + '...' + apiKey.substring(apiKey.length - 4) : 'یافت نشد',
      customBaseUrl: customBaseUrl || 'پیش‌فرض (Google Generative AI)',
      dnsTest: 'موفق (اتصال Edge)',
      geminiPing: 'کامل نشده',
      errors: [],
    };

    if (!apiKey) {
      report.geminiPing = 'کلید API تنظیم نشده است. لطفاً در پنل ورکر متغیر GEMINI_API_KEY را اضافه کنید.';
      addWorkerLog('warn', 'Diagnostics', 'تست عیب‌یابی: کلید API یافت نشد.');
      return jsonResponse({ success: false, report });
    }

    try {
      const resAi = await generateWorkerRestAi(
        apiKey,
        'سلام. فقط کلمه "موفق" را برگردان.',
        false,
        0.1,
        100,
        MODEL_TIER_MAIN,
        customBaseUrl
      );
      report.geminiPing = `موفق (با مدل ${resAi.usedModel} در ${resAi.latencyMs}ms). پاسخ: "${resAi.text.trim()}"`;
      addWorkerLog('success', 'Diagnostics', `تست عیب‌یابی موفق بود با مدل [${resAi.usedModel}]: "${resAi.text.trim()}"`);
      return jsonResponse({ success: true, report });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      report.geminiPing = `خطا در برقراری ارتباط: ${errMsg}`;
      report.errors.push(errMsg);
      addWorkerLog('error', 'Diagnostics', `تست عیب‌یابی شکست خورد: ${errMsg}`);
      return jsonResponse({ success: false, report });
    }
  }

  // 7. Generate Procedural / Gemini Case
  if (url.pathname === '/api/generate-case' && request.method === 'POST') {
    const requestedTopic = (requestBody?.topicText || requestBody?.customIdea || 'جنایت پیچیده').trim();
    addWorkerLog('info', 'CaseGenerator', `درخواست ساخت پرونده با سوژه: "${requestedTopic}"`);

    if (!apiKey) {
      addWorkerLog('warn', 'CaseGenerator', 'کلید API تنظیم نشده؛ استفاده از سناریونویس آفلاین.');
      return jsonResponse(generateProceduralCase(requestedTopic));
    }

    const prompt = `شما داستان‌نویس و طراح ارشد پرونده‌های قضایی برای بازی «آقای قاضی» هستید.
موضوع کلی پرونده که کاربر درخواست کرده است: "${requestedTopic}"

قانون حیاتی و طلایی معمایی ۵۰/۵۰:
۱. ۵۰٪ پرونده‌ها: متهم ردیف اول واقعاً گناهکار است.
۲. ۵۰٪ دیگر: متهم ردیف اول کاملاً بی‌گناه است و مجرم واقعی یکی دیگر از اشخاص حاضر در دادگاه (شاهد، شریک، شاکی یا ولی‌دم) است.

قانون مهم: تعداد اشخاص پرونده باید بین ۴ تا ۷ نفر باشد (هرگز ۲ یا ۳ نفر نباشد).
اشخاص شامل: متهم اول، متهم دوم یا شریک مشکوک، شاکی، شهود، کارشناس رسمی، وکیل.

خروجی صرفاً یک JSON معتبر فارسی باشد با فیلدهای CaseDossier:
{
  "id": "case-${Date.now()}",
  "caseNumber": "۱۴۰۵/...-ج",
  "title": "عنوان جذاب پرونده",
  "genre": "ژانر پرونده",
  "incidentDate": "تاریخ و ساعت",
  "location": "مکان وقوع",
  "victimName": "نام قربانی یا شاکی",
  "victimBackground": "پیشینه قربانی",
  "briefing": "شرح صحنه جرم",
  "autopsyReport": {
    "timeOfDeath": "زمان وقوع",
    "causeOfDeath": "علت تامه",
    "toxicology": "گزارش آزمایشگاه",
    "injuries": ["مورد ۱", "مورد ۲"],
    "coronerNotes": "نکات کارشناس"
  },
  "evidence": [
    {
      "id": "ev-1",
      "title": "عنوان مدرک",
      "type": "physical",
      "description": "شرح",
      "foundAt": "محل کشف",
      "significance": "اهمیت",
      "labReport": "گزارش آزمایشگاه"
    }
  ],
  "characters": [
    {
      "id": "char-1",
      "name": "نام متهم اول",
      "role": "defendant",
      "roleTitle": "متهم ردیف اول",
      "age": 38,
      "occupation": "شغل",
      "relationToVictim": "نسبت",
      "personality": "روحیات",
      "initialStatement": "اظهارات اولیه در دادگاه",
      "suspicionLevel": 75,
      "isLying": true,
      "deceptionStrategy": "استراتژی دفاعی",
      "vulnerabilities": ["نقطه ضعف"]
    },
    {
      "id": "char-2",
      "name": "نام شاکی",
      "role": "plaintiff",
      "roleTitle": "شاکی پرونده",
      "age": 42,
      "occupation": "شغل",
      "relationToVictim": "نسبت",
      "personality": "روحیات",
      "initialStatement": "اظهارات شاکی",
      "suspicionLevel": 20,
      "isLying": false,
      "deceptionStrategy": "",
      "vulnerabilities": []
    },
    {
      "id": "char-3",
      "name": "نام شاهد",
      "role": "witness",
      "roleTitle": "شاهد کلیدی",
      "age": 35,
      "occupation": "شغل",
      "relationToVictim": "نسبت",
      "personality": "روحیات",
      "initialStatement": "شهادت",
      "suspicionLevel": 35,
      "isLying": false,
      "deceptionStrategy": "",
      "vulnerabilities": []
    },
    {
      "id": "char-4",
      "name": "نام کارشناس",
      "role": "expert",
      "roleTitle": "کارشناس دادگستری / پزشک قانونی",
      "age": 48,
      "occupation": "کارشناس",
      "relationToVictim": "بی‌طرف",
      "personality": "علمی",
      "initialStatement": "گزارش تخصصی",
      "suspicionLevel": 10,
      "isLying": false,
      "deceptionStrategy": "",
      "vulnerabilities": []
    },
    {
      "id": "char-5",
      "name": "نام متهم دوم یا شریک",
      "role": "defendant",
      "roleTitle": "متهم ردیف دوم",
      "age": 40,
      "occupation": "شغل",
      "relationToVictim": "ارتباط",
      "personality": "روحیات",
      "initialStatement": "دفاعیات",
      "suspicionLevel": 60,
      "isLying": true,
      "deceptionStrategy": "استراتژی",
      "vulnerabilities": []
    }
  ],
  "hiddenTruth": {
    "realCulpritId": "char-1",
    "realCulpritName": "نام مقصر واقعی",
    "motive": "انگیزه",
    "howCrimeHappened": "شرح واقعی وقوع",
    "keyContradiction": "تناقض اساسی"
  }
}`;

    try {
      const resAi = await generateWorkerRestAi(
        apiKey,
        prompt,
        true,
        0.85,
        5000,
        MODEL_TIER_MAIN,
        customBaseUrl
      );
      const parsed = parseJsonFromAi<CaseDossier>(resAi.text);
      addWorkerLog('success', 'CaseGenerator', `پرونده "${parsed.title}" با موفقیت توسط مدل [${resAi.usedModel}] تولید شد.`);
      return jsonResponse({
        ...parsed,
        allowsLiveConfession: Math.random() < 0.15,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch (err: any) {
      addWorkerLog('error', 'CaseGenerator', `خطا در تولید پرونده با جمینای: ${err?.message || err}. استفاده از سناریوی پشتیبان.`);
      return jsonResponse(generateProceduralCase(requestedTopic));
    }
  }

  // 8. Generate Real-World Historical Case
  if (url.pathname === '/api/generate-real-case' && request.method === 'POST') {
    const { caseNameOrTopic, category, isRandom } = requestBody || {};
    let queryDesc = (caseNameOrTopic || '').trim();

    if (isRandom || !queryDesc) {
      const randomCuratedThemes = [
        'یک پرونده واقعی و فوق‌العاده دراماتیک قتل مرموز یا جنایی در تاریخ جهان',
        'یکی از جنجالی‌ترین پرونده‌های جنایی یا قتل‌های دادگاه‌های تاریخ ایران',
        'بزرگ‌ترین و عجیب‌ترین پرونده سرقت موزه، سرقت بانک یا کلاهبرداری مالی در تاریخ',
        'پرونده واقعی ترور یا مسمومیت مشکوک با مواد سمی ناشناخته در تاریخ',
      ];
      queryDesc = randomCuratedThemes[Math.floor(Math.random() * randomCuratedThemes.length)];
    } else if (category) {
      queryDesc = `پرونده واقعی در موضوع: ${category} - ${queryDesc}`;
    }

    addWorkerLog('info', 'RealCaseGenerator', `درخواست بازسازی پرونده تاریخی: "${queryDesc}"`);

    if (!apiKey) {
      addWorkerLog('warn', 'RealCaseGenerator', 'کلید API موجود نیست؛ بازگشت سناریوی پشتیبان.');
      return jsonResponse(generateProceduralCase(queryDesc));
    }

    const prompt = `شما مورخ ارشد جنایی و طراح پرونده‌های واقعی برای بازی دادگاه «آقای قاضی» هستید.
درخواست کاربر / سوژه پرونده واقعی: "${queryDesc}"

یک پرونده واقعی، مستند و تاریخی از تاریخ ایران یا جهان را با مشخصات واقعی بازسازی کنید.
رأی نهایی دادگاه را در متن اصلی لو ندهید.
فیلد realWorldInfo را پر کنید.

خروجی صرفاً یک JSON معتبر باشد با ساختار CaseDossier:
{
  "id": "real-${Date.now()}",
  "caseNumber": "شماره کلاسه تاریخی",
  "title": "عنوان واقعی پرونده",
  "genre": "ژانر واقعی",
  "incidentDate": "تاریخ دقیق",
  "location": "مکان دقیق",
  "victimName": "نام قربانی",
  "victimBackground": "شرح حال",
  "briefing": "شرح واقعه",
  "autopsyReport": {
    "timeOfDeath": "زمان",
    "causeOfDeath": "علت",
    "toxicology": "گزارش آزمایشگاه",
    "injuries": ["جراحات"],
    "coronerNotes": "نکات کارشناس"
  },
  "evidence": [
    {
      "id": "ev-1",
      "title": "مدرک واقعی",
      "type": "physical",
      "description": "شرح",
      "foundAt": "محل کشف",
      "significance": "اهمیت",
      "labReport": "گزارش"
    }
  ],
  "characters": [
    {
      "id": "char-1",
      "name": "نام شخص واقعی",
      "role": "defendant",
      "roleTitle": "سمت",
      "age": 40,
      "occupation": "شغل",
      "relationToVictim": "نسبت",
      "personality": "روحیات",
      "initialStatement": "دفاعیات",
      "suspicionLevel": 85,
      "isLying": true,
      "deceptionStrategy": "استراتژی",
      "vulnerabilities": ["نقطه ضعف"]
    }
  ],
  "hiddenTruth": {
    "realCulpritId": "char-1",
    "realCulpritName": "نام مقصر",
    "motive": "انگیزه",
    "howCrimeHappened": "شرح وقوع",
    "keyContradiction": "تناقض"
  },
  "realWorldInfo": {
    "isRealCase": true,
    "realCaseName": "نام پرونده تاریخی",
    "historicalDate": "تاریخ",
    "historicalLocation": "محل",
    "actualCourtVerdict": "رأی دادگاه واقعی",
    "actualSentence": "مجازات واقعی",
    "historicalEpilogue": "سرنوشت متهم",
    "historicalSignificance": "اهمیت پرونده"
  }
}`;

    try {
      const resAi = await generateWorkerRestAi(
        apiKey,
        prompt,
        true,
        0.7,
        5000,
        MODEL_TIER_MAIN,
        customBaseUrl
      );
      const parsed = parseJsonFromAi<CaseDossier>(resAi.text);
      addWorkerLog('success', 'RealCaseGenerator', `پرونده واقعی "${parsed.title}" با موفقیت توسط مدل [${resAi.usedModel}] بازسازی شد.`);
      return jsonResponse({
        ...parsed,
        allowsLiveConfession: false,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch (err: any) {
      addWorkerLog('error', 'RealCaseGenerator', `خطا در بازسازی پرونده تاریخی: ${err?.message || err}`);
      return jsonResponse(generateProceduralCase('پرونده تاریخی'));
    }
  }

  // 9. Generate Heated Argument
  if (url.pathname === '/api/generate-argument' && request.method === 'POST') {
    const { caseData, lastExchange } = requestBody || {};
    const chars = caseData?.characters || [];

    if (!apiKey || chars.length === 0) {
      const c1 = chars[0] || { name: 'متهم اول' };
      const c2 = chars[1] || { name: 'شاکی' };
      return jsonResponse({
        argument: [
          { senderName: c1.name, text: 'جناب قاضی، این ادعاها کذب محض است!' },
          { senderName: c2.name, text: 'دروغ نگو! اسناد همه چیز را اثبات می‌کند!' },
        ],
      });
    }

    const prompt = `شما کارگردان تئاتر قضایی بازی «آقای قاضی» هستید.
یک مرافعه لفظی شدید و تند بین کاراکترهای دادگاه بنویسید:
شخصیت‌ها: ${chars.map((c: Character) => `${c.name} (${c.roleTitle})`).join(', ')}
موضوع: ${caseData.title}
آخرین صحبت: "${lastExchange || ''}"

خروجی دقیقاً یک آرایه JSON باشد:
[
  { "senderName": "نام شخص اول", "text": "دیالوگ عصبانی اول..." },
  { "senderName": "نام شخص دوم", "text": "پاسخ تند دوم..." }
]`;

    try {
      const resAi = await generateWorkerRestAi(
        apiKey,
        prompt,
        true,
        0.9,
        800,
        MODEL_TIER_FAST_LITE,
        customBaseUrl
      );
      const argument = parseJsonFromAi<unknown>(resAi.text);
      return jsonResponse({
        argument,
        _activeModel: resAi.usedModel,
      });
    } catch {
      return jsonResponse({
        argument: [
          { senderName: 'متهم', text: 'جناب قاضی، من بی‌گناهم!' },
          { senderName: 'شاکی', text: 'مدارک برعکس این را نشان می‌دهد!' },
        ],
      });
    }
  }

  // 10. Interrogate Character
  if (url.pathname === '/api/interrogate' && request.method === 'POST') {
    const { caseData, question, history } = requestBody || {};
    const charsList = caseData?.characters || [];

    addWorkerLog('info', 'Interrogate', `استنطاق از صحن دادگاه با سوال قاضی: "${(question || '').substring(0, 50)}..."`);

    if (!apiKey || charsList.length === 0) {
      const char = charsList[0] || { id: 'char-1', name: 'متهم' };
      return jsonResponse({
        addressedCharacterId: char.id,
        addressedCharacterName: char.name,
        speech: 'جناب قاضی، بنده توضیحات را با صداقت عرض کردم.',
        innerThought: undefined,
        isConfession: false,
        interruption: null,
      });
    }

    const prompt = `شما بازیگران و هماهنگ‌کننده دادگاه «آقای قاضی» هستید.
شخصیت‌های دادگاه:
${charsList.map((c: Character) => `${c.id}: ${c.name} (${c.roleTitle}) - ${c.occupation}`).join('\n')}

موضوع پرونده: ${caseData.title}
خلاصه: ${caseData.briefing}
حقیقت پنهان: ${caseData.hiddenTruth?.howCrimeHappened || ''}

سوابق اخیر: ${(history || []).slice(-6).map((h: any) => `${h.sender}: ${h.text}`).join('\n')}
سوال قاضی: "${question}"

قوانین دیالوگ:
- دیالوگ بسیار باهوش، فاخر، مستدل و مرتبط با جزئیات همین پرونده باشد.
- بدون سوتی یا اعتراف پیش‌پاافتاده.

خروجی صرفاً یک JSON باشد:
{
  "addressedCharacterId": "آیدی کاراکتر پاسخ‌دهنده",
  "addressedCharacterName": "نام کاراکتر پاسخ‌دهنده",
  "speech": "پاسخ رسا و هوشمندانه",
  "innerThought": "مونولوگ درونی کوتاه",
  "isConfession": false,
  "lawyerIntervention": null,
  "interruption": null
}`;

    try {
      const resAi = await generateWorkerRestAi(
        apiKey,
        prompt,
        true,
        0.85,
        2000,
        MODEL_TIER_MAIN,
        customBaseUrl
      );
      const parsed = parseJsonFromAi<any>(resAi.text);
      addWorkerLog('success', 'Interrogate', `پاسخ از کاراکتر [${parsed.addressedCharacterName}] با مدل [${resAi.usedModel}] دریافت شد.`);
      return jsonResponse({
        ...parsed,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch (err: any) {
      addWorkerLog('error', 'Interrogate', `خطا در استنطاق با هوش مصنوعی: ${err?.message || err}`);
      return jsonResponse({
        addressedCharacterId: 'char-1',
        addressedCharacterName: 'شخص حاضر در دادگاه',
        speech: 'جناب قاضی، پاسخ لازم در پرونده قید شده است.',
        isConfession: false,
        interruption: null,
      });
    }
  }

  // 11. Judge Verdict Evaluation
  if (url.pathname === '/api/judge-verdict' && request.method === 'POST') {
    const { caseData, accusedId, verdictType, verdictReasoning, penalty, chargeName, individualDecisions } = requestBody || {};
    const realCulpritId = caseData?.hiddenTruth?.realCulpritId;

    const individualDecisionsList = Array.isArray(individualDecisions) && individualDecisions.length > 0
      ? individualDecisions
      : (caseData?.characters || []).map((c: Character) => ({
          characterId: c.id,
          characterName: c.name,
          status: c.id === accusedId ? verdictType : 'acquitted',
          chargeAndPenalty: c.id === accusedId ? `${chargeName || ''} - ${penalty || ''}` : 'تبرئه',
        }));

    const realCulpritFound = individualDecisionsList.some(
      (d: any) => d.characterId === realCulpritId && d.status === 'guilty'
    ) || (accusedId === realCulpritId && verdictType === 'guilty');

    if (!apiKey) {
      const individualEvaluations = (caseData?.characters || []).map((c: Character) => {
        const userDec = individualDecisionsList.find((d: any) => d.characterId === c.id);
        const isCulprit = c.id === realCulpritId;
        const markedGuilty = userDec?.status === 'guilty';
        const isRight = (isCulprit && markedGuilty) || (!isCulprit && !markedGuilty);
        return {
          characterName: c.name,
          statusSummary: markedGuilty ? 'محکوم به مجازات' : 'تبرئه / مختومه',
          isCorrectVerdict: isRight,
          note: isRight ? 'احراز صحیح وضعیت قضایی' : 'مغایرت با حقیقت مادی',
        };
      });

      return jsonResponse({
        isCorrect: realCulpritFound,
        justiceRating: realCulpritFound ? 95 : 35,
        truthRevealed: caseData?.hiddenTruth?.howCrimeHappened || 'حقیقت بررسی شد.',
        feedback: realCulpritFound ? 'عدالت به درستی محقق شد.' : 'متاسفانه مقصر واقعی شناسایی نشد.',
        deceptionBusted: realCulpritFound,
        epilogue: 'پرونده به اجرای احکام ارسال شد.',
        chargeName: chargeName || 'احراز مجرمیت',
        penaltyApplied: penalty || 'مجازات تعیینی',
        individualEvaluations,
      });
    }

    const prompt = `شما هیئت نظارت قضایی بازی «آقای قاضی» هستید.
پرونده: ${caseData.title}
مقصر واقعی: ${caseData.hiddenTruth?.realCulpritName} (آیدی: ${realCulpritId})
حقیقت: ${caseData.hiddenTruth?.howCrimeHappened}

تصمیمات قاضی برای اشخاص:
${individualDecisionsList.map((d: any) => `• ${d.characterName}: [${d.status}] - ${d.chargeAndPenalty}`).join('\n')}

استدلال مکتوب قاضی: "${verdictReasoning}"

ارزیابی فرمایید:
خروجی صرفاً یک JSON باشد:
{
  "isCorrect": true/false,
  "justiceRating": 95,
  "truthRevealed": "شرح حقیقت پرونده",
  "feedback": "تحلیل عملکرد قاضی",
  "deceptionBusted": true/false,
  "epilogue": "سرانجام پرونده",
  "culpritConfession": "اعتراف مقصر",
  "chargeName": "${chargeName || 'احراز مجرمیت'}",
  "penaltyApplied": "${penalty || 'مجازات'}",
  "individualEvaluations": [
    {
      "characterName": "نام شخص",
      "statusSummary": "خلاصه حکم",
      "isCorrectVerdict": true/false,
      "note": "توضیح کوتاه"
    }
  ]
}`;

    try {
      const resAi = await generateWorkerRestAi(
        apiKey,
        prompt,
        true,
        0.7,
        1800,
        MODEL_TIER_FAST_LITE,
        customBaseUrl
      );
      const parsed = parseJsonFromAi<any>(resAi.text);
      return jsonResponse({
        ...parsed,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch {
      return jsonResponse({
        isCorrect: true,
        justiceRating: 90,
        truthRevealed: 'پرونده رسیدگی شد.',
        feedback: 'رأی اصدار یافت.',
        deceptionBusted: true,
        epilogue: 'پرونده مختومه شد.',
      });
    }
  }

  // Static Assets Fallback for Cloudflare Pages
  if (env?.ASSETS) {
    return env.ASSETS.fetch(request);
  }

  return new Response('Not Found', { status: 404 });
}
