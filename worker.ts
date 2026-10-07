/**
 * Cloudflare Worker / Edge Runtime Entrypoint
 * Provides zero-configuration serverless execution for Mr. Judge on Cloudflare Workers & Cloudflare Pages.
 */

import { PRESET_CASES } from './src/data/presets.ts';
import { CaseDossier, Character, EvidenceItem } from './src/types.ts';

export interface Env {
  GEMINI_API_KEY?: string;
  MY_GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  API_KEY?: string;
  GOOGLE_GENAI_API_KEY?: string;
  VITE_GEMINI_API_KEY?: string;
  GEMINI_BASE_URL?: string;
  GOOGLE_GENAI_BASE_URL?: string;
  PRIMARY_MODEL?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

const PRIMARY_MODEL = 'gemini-2.5-flash';
const MODEL_TIER_MAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];
const MODEL_TIER_FAST_LITE = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

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
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

function extractApiKey(request: Request, env?: Env): string {
  try {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get('apiKey') || url.searchParams.get('key');
    if (queryKey && queryKey.trim()) return queryKey.trim();
  } catch {
    // ignore URL parse error
  }

  const headerKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (headerKey && headerKey.trim()) return headerKey.trim();

  if (env) {
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim()) return env.GEMINI_API_KEY.trim();
    if (env.MY_GEMINI_API_KEY && env.MY_GEMINI_API_KEY.trim()) return env.MY_GEMINI_API_KEY.trim();
    if (env.GOOGLE_API_KEY && env.GOOGLE_API_KEY.trim()) return env.GOOGLE_API_KEY.trim();
    if (env.API_KEY && env.API_KEY.trim()) return env.API_KEY.trim();
    if (env.GOOGLE_GENAI_API_KEY && env.GOOGLE_GENAI_API_KEY.trim()) return env.GOOGLE_GENAI_API_KEY.trim();
    if (env.VITE_GEMINI_API_KEY && env.VITE_GEMINI_API_KEY.trim()) return env.VITE_GEMINI_API_KEY.trim();
  }

  if (typeof process !== 'undefined' && process?.env) {
    const pKey =
      process.env.GEMINI_API_KEY ||
      process.env.MY_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY;
    if (pKey && pKey.trim()) return pKey.trim();
  }

  return '';
}

function extractCustomBaseUrl(env?: Env): string {
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
      timeOfDeath: 'ساعت ۲۰:۳۰ الی ۲۰:۰۰ شب',
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
    throw new Error('No Gemini API key supplied');
  }

  let lastErrorMsg = '';
  const baseUrl = (customBaseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');

  for (const modelCandidate of modelPool) {
    try {
      const endpoint = `${baseUrl}/v1beta/models/${modelCandidate}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const reqBody: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          ...(isJsonMode ? { responseMimeType: 'application/json' } : {}),
          ...(maxOutputTokens ? { maxOutputTokens } : {}),
        },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aistudio-build-judge-app-worker',
        },
        body: JSON.stringify(reqBody),
      });

      if (!res.ok) {
        const errJson: any = await res.json().catch(() => null);
        const errMsg = errJson?.error?.message || (await res.text().catch(() => '')) || res.statusText;
        lastErrorMsg = `[Model ${modelCandidate} HTTP ${res.status}]: ${errMsg}`;
        continue;
      }

      const data: any = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { text, usedModel: modelCandidate };
      } else {
        lastErrorMsg = `[Model ${modelCandidate}]: Empty candidate text returned`;
      }
    } catch (err: any) {
      lastErrorMsg = `[Model ${modelCandidate}]: ${err?.message || err}`;
    }
  }

  throw new Error(`All Gemini candidate models failed. Details: ${lastErrorMsg}`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = extractApiKey(request, env);
    const customBaseUrl = extractCustomBaseUrl(env);

    // 1. Preset Cases
    if (url.pathname === '/api/preset-cases') {
      return jsonResponse(PRESET_CASES);
    }

    // 2. System Logs
    if (url.pathname === '/api/system-logs') {
      return jsonResponse([
        {
          id: 'log-worker-init',
          timestamp: new Date().toISOString(),
          type: apiKey ? 'success' : 'warn',
          module: 'CloudflareWorker',
          message: apiKey
            ? `سرویس ورکر کلودفلر با کلید API فعال است. (${apiKey.substring(0, 6)}...)`
            : 'سرویس ورکر در حالت شبیه‌ساز آفلاین است (کلید API یافت نشد).',
        },
      ]);
    }

    // 3. Models Info
    if (url.pathname === '/api/models-info') {
      return jsonResponse({
        primaryModel: env?.PRIMARY_MODEL || PRIMARY_MODEL,
        models: MODEL_TIER_MAIN,
        hasApiKey: !!apiKey,
      });
    }

    // 4. Bridge Status
    if (url.pathname === '/api/bridge-status') {
      return jsonResponse({
        active: !!apiKey,
        bridge: 'Cloudflare Pages & Worker Edge Runtime',
        model: env?.PRIMARY_MODEL || PRIMARY_MODEL,
        noVpnNeeded: true,
        message: apiKey
          ? 'پل ارتباطی جمینای در سرور ورکر فعال و آماده است.'
          : 'کلید GEMINI_API_KEY در متغیرهای ورکر یافت نشد. حالت آفلاین فعال است.',
      });
    }

    // 5. Ping & Test Model
    if ((url.pathname === '/api/ping-model' || url.pathname === '/api/test-gemini-model') && request.method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const targetModel = body.modelName || env?.PRIMARY_MODEL || PRIMARY_MODEL;

      if (!apiKey) {
        return jsonResponse({
          success: false,
          modelName: targetModel,
          latencyMs: 0,
          error: 'کلید GEMINI_API_KEY در متغیرهای ورکر تنظیم نشده است.',
        });
      }

      const startTime = Date.now();
      try {
        const resAi = await generateWorkerRestAi(
          apiKey,
          'سلام. فقط کلمه "وصل" را برگردان.',
          false,
          0.1,
          10,
          [targetModel, ...MODEL_TIER_MAIN],
          customBaseUrl
        );
        const latencyMs = Date.now() - startTime;
        return jsonResponse({
          success: true,
          modelName: resAi.usedModel,
          latencyMs,
          responseText: resAi.text.trim(),
        });
      } catch (err: any) {
        return jsonResponse({
          success: false,
          modelName: targetModel,
          latencyMs: Date.now() - startTime,
          error: `خطا در پینگ ورکر: ${err?.message || err}`,
        });
      }
    }

    // 6. Diagnose Gemini
    if (url.pathname === '/api/diagnose-gemini' && request.method === 'POST') {
      const report: any = {
        timestamp: new Date().toISOString(),
        apiKeyConfigured: !!apiKey,
        apiKeyMasked: apiKey ? apiKey.substring(0, 6) + '...' + apiKey.substring(apiKey.length - 4) : 'یافت نشد',
        customBaseUrl: customBaseUrl || 'پیش‌فرض (Google API)',
        dnsTest: 'موفق (اتصال Edge)',
        geminiPing: 'کامل نشده',
        errors: [],
      };

      if (!apiKey) {
        report.geminiPing = 'کلید API تنظیم نشده است';
        return jsonResponse({ success: false, report });
      }

      try {
        const resAi = await generateWorkerRestAi(
          apiKey,
          'سلام. فقط کلمه "موفق" را برگردان.',
          false,
          0.1,
          10,
          MODEL_TIER_MAIN,
          customBaseUrl
        );
        report.geminiPing = `موفق (با مدل ${resAi.usedModel}). پاسخ: "${resAi.text.trim()}"`;
        return jsonResponse({ success: true, report });
      } catch (err: any) {
        report.geminiPing = `خطا: ${err?.message || err}`;
        report.errors.push(String(err));
        return jsonResponse({ success: false, report });
      }
    }

    // 7. Generate Procedural / Gemini Case
    if (url.pathname === '/api/generate-case' && request.method === 'POST') {
      try {
        const body: any = await request.json().catch(() => ({}));
        const requestedTopic = (body.topicText || body.customIdea || 'جنایت پیچیده').trim();

        if (!apiKey) {
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
        return jsonResponse({
          ...parsed,
          allowsLiveConfession: Math.random() < 0.15,
          _activeModel: resAi.usedModel,
        });
      } catch {
        const body: any = await request.json().catch(() => ({}));
        return jsonResponse(generateProceduralCase(body.topicText || 'جنایت'));
      }
    }

    // 8. Generate Real-World Historical Case
    if (url.pathname === '/api/generate-real-case' && request.method === 'POST') {
      try {
        const body: any = await request.json().catch(() => ({}));
        const { caseNameOrTopic, category, isRandom } = body;
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

        if (!apiKey) {
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
        return jsonResponse({
          ...parsed,
          allowsLiveConfession: false,
          _activeModel: resAi.usedModel,
        });
      } catch {
        return jsonResponse(generateProceduralCase('پرونده تاریخی'));
      }
    }

    // 9. Generate Heated Argument
    if (url.pathname === '/api/generate-argument' && request.method === 'POST') {
      try {
        const body: any = await request.json().catch(() => ({}));
        const { caseData, lastExchange } = body;
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
      try {
        const body: any = await request.json().catch(() => ({}));
        const { caseData, question, history } = body;
        const charsList = caseData?.characters || [];

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
        return jsonResponse({
          ...parsed,
          _activeModel: resAi.usedModel,
        });
      } catch {
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
      try {
        const body: any = await request.json().catch(() => ({}));
        const { caseData, accusedId, verdictType, verdictReasoning, penalty, chargeName, individualDecisions } = body;
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

    // Static Assets Fallback for Cloudflare Pages / Workers
    if (env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
