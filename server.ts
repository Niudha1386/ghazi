import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { PRESET_CASES } from './src/data/presets.ts';
import { CaseDossier, Character, EvidenceItem } from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multi-model pools for balanced workload distribution & zero-stall 503 recovery
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
export const ALL_AVAILABLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];
export const MODEL_TIER_MAIN = [
  PRIMARY_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];
export const MODEL_TIER_FAST_LITE = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

// ============================================================================
// SYSTEM LOGGING FRAMEWORK (For live debugging in the frontend UI)
// ============================================================================
export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'success';
  module: string;
  message: string;
  details?: any;
}

export const systemLogs: SystemLog[] = [];

export function addSystemLog(type: SystemLog['type'], module: string, message: string, details?: any) {
  const log: SystemLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    module,
    message,
    details: details ? JSON.parse(JSON.stringify(details, Object.getOwnPropertyNames(details))) : undefined,
  };
  systemLogs.unshift(log);
  if (systemLogs.length > 150) {
    systemLogs.pop();
  }
  console.log(`[${log.timestamp}] [${type.toUpperCase()}] [${module}] ${message}`);
}

// Helper to strip Markdown codeblocks before JSON parsing
function parseJsonFromAi<T>(rawText: string): T {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

// 1. Initialize Gemini AI Client
const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.MY_GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.VITE_GEMINI_API_KEY ||
  '';
const customBaseUrl = process.env.GEMINI_BASE_URL || process.env.GOOGLE_GENAI_BASE_URL || '';

let ai: GoogleGenAI | null = null;
if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey,
      ...(customBaseUrl ? { baseUrl: customBaseUrl } : {}),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-judge-app',
        },
      },
    });
    const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
    addSystemLog('success', 'GeminiClient', `کلاینت هوش مصنوعی با موفقیت تنظیم شد. کلید استفاده شده: ${maskedKey}`);
    if (customBaseUrl) {
      addSystemLog('info', 'GeminiClient', `آدرس سفارشی سرور تنظیم شده است: ${customBaseUrl}`);
    }
  } catch (err: any) {
    addSystemLog('error', 'GeminiClient', `خطا در راه‌اندازی کلاینت هوش مصنوعی: ${err?.message || err}`, err);
  }
} else {
  addSystemLog('warn', 'GeminiClient', 'کلید GEMINI_API_KEY در متغیرهای محیطی یافت نشد! حالت آفلاین سناریونویس فعال شد.');
}

// Helper to generate content with task-based model distribution, token compression & instant 503 rollover
async function generateAiContent(
  prompt: string,
  isJsonMode = false,
  temperature = 0.85,
  maxOutputTokens?: number,
  modelPool: string[] = MODEL_TIER_MAIN
) {
  if (!ai) {
    addSystemLog('error', 'GeminiAPI', 'تلاش برای تولید محتوا در حالی که کلاینت هوش مصنوعی فعال نیست (بدون کلید API)');
    throw new Error('AI client not initialized');
  }

  let lastError: any = null;
  const triedModels = new Set<string>();

  addSystemLog('info', 'GeminiAPI', `ارسال درخواست به استخر هوشمند مدل‌ها (${modelPool.join(' ⮞ ')})`);

  const startTime = Date.now();

  for (const modelCandidate of modelPool) {
    if (triedModels.has(modelCandidate)) continue;
    triedModels.add(modelCandidate);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const isLite = modelCandidate.includes('lite');
        const thinkingLevel = isLite ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;

        addSystemLog('info', 'GeminiAPI', `فراخوانی مدل [${modelCandidate}] (حالت ${isLite ? 'سریع/کم‌مصرف' : 'استاندارد'}) - تلاش ${attempt}`);
        
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents: prompt,
          config: {
            ...(isJsonMode ? { responseMimeType: 'application/json' } : {}),
            temperature,
            ...(maxOutputTokens ? { maxOutputTokens } : {}),
            thinkingConfig: { thinkingLevel },
          },
        });

        if (response && response.text) {
          const latencyMs = Date.now() - startTime;
          addSystemLog('success', 'GeminiAPI', `پاسخ موفق از مدل [${modelCandidate}] (تلاش ${attempt}) در ${latencyMs}ms`, {
            characterCount: response.text.length,
            latencyMs,
            preview: response.text.substring(0, 120) + '...'
          });
          return { text: response.text, usedModel: modelCandidate, latencyMs };
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const status = err?.status || err?.statusCode || 'UnknownStatus';
        const is503 = status === 503 || errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand') || errMsg.includes('overloaded');
        const is429 = status === 429 || errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('RESOURCE_EXHAUSTED');
        
        addSystemLog('warn', 'GeminiAPI', `خطا در مدل [${modelCandidate}] (کد: ${status}) - سوییچ به نسخه بعدی جمینای...`, { error: errMsg });
        lastError = err;

        if (is503) {
          // Instant rollover without stalling to other Gemini versions (e.g. 3.1-flash-lite or 3.8-flash)
          break;
        } else if (is429 && attempt === 1) {
          await new Promise((r) => setTimeout(r, 400));
        } else {
          break;
        }
      }
    }
  }
  
  addSystemLog('error', 'GeminiAPI', 'تمامی نسخه‌های جمینای با ترافیک موقت مواجه شدند. فعال‌سازی حالت داستانی هوشمند پشتیبان.', lastError);
  throw lastError || new Error('All Gemini candidate models failed.');
}

// ============================================================================
// DYNAMIC PROCEDURAL NARRATIVE GENERATOR
// Creates realistic, organic Persian crime stories with custom names,
// without literal placeholder repeating of raw user search terms!
// ============================================================================
function generateProceduralCase(topic: string): CaseDossier {
  const cleanTopic = topic.trim();
  const caseId = `case-${Date.now()}`;
  const caseNum = `۱۴۰۵/${Math.floor(100 + Math.random() * 899)}-ج`;

  // Keyword categories
  const isFootball = /فوتبال|ورزش|بازیکن|رختکن|استادیوم|تیم|فینال/i.test(cleanTopic);
  const isCinema = /سینما|بازیگر|فیلم|جشنواره|کارگردان|ستاره|تئاتر/i.test(cleanTopic);
  const isCorporate = /نفت|هلدینگ|شرکت|اختلاس|مالی|بانک|پول|سرمایه/i.test(cleanTopic);
  const isYacht = /کشتی|دریا|قایق|سقوط|خلیج|جزیره|تفریحی/i.test(cleanTopic);
  const isLab = /آزمایشگاه|ژنتیک|دارو|پزشک|دانشمند|فرمول|بیمارستان/i.test(cleanTopic);

  if (isFootball) {
    return {
      id: caseId,
      caseNumber: caseNum,
      title: 'قتل سهمگین کاپیتان تیم ملی در رختکن آزادی',
      genre: 'جنایی، ورزشی و معمایی دارک',
      incidentDate: '۱۴۰۵/۰۷/۰۹ - ساعت ۲۰:۴۵ شب',
      location: 'رختکن اختصاصی ورزشگاه آزادی تهران',
      victimName: 'آرش دادگر (۲۷ ساله - ستاره و کاپیتان تیم ملی)',
      victimBackground: 'کاپیتان محبوب ۲۷ ساله که ساعات پایانی قبل از بازی فینال آسیا در رختکن به طرز فجیعی به قتل رسید.',
      briefing: 'گزارش ویژه دادسرا: ساعت ۲۰:۴۵ شب گذشته، جسد آرش دادگر روی نیمکت رختکن کشف شد. علائم کالبدشکافی حاکی از مسمومیت سریع با سم اعصاب نویچوک در نوشیدنی وی است. تحقیقات اولیه از ۵ شخص کلیدی حاضر در ورزشگاه آغاز گردیده است.',
      autopsyReport: {
        timeOfDeath: 'ساعت ۲۰:۱۵ الی ۲۰:۳۰ شب',
        causeOfDeath: 'تزریق دوز مهلک سم اعصاب نویچوک به نوشیدنی ورزشی',
        toxicology: 'مثبت - وجود ماده سمی شتاب‌دهنده در نمونه خون',
        injuries: ['آثار مقاومت روی مچ دست راست', 'ساییدگی پشت لبه گردن'],
        coronerNotes: 'سم دقیقاً ۱۵ دقیقه قبل از فوت به بطری نوشیدنی اضافه شده است.',
      },
      evidence: [
        {
          id: 'ev-f1',
          title: 'بطری نوشیدنی آلوده به سم نویچوک',
          type: 'physical',
          description: 'بطری نیمه‌خورده روی میز رختکن با اثر انگشت روی درب.',
          foundAt: 'میز اختصاصی مقتول در رختکن',
          significance: 'اثر انگشت سرمربی روی درب بطری شناسایی شد.',
          labReport: 'تطبیق کامل اثر انگشت شست سرمربی تیم.',
        },
        {
          id: 'ev-f2',
          title: 'تصاویر دوربین مداربسته راهروی رختکن',
          type: 'digital',
          description: 'ورود فردی با کاپشن مشکی و کلاه در ساعت ۲۰:۲۰.',
          foundAt: 'اتاق حراست ورزشگاه',
          significance: 'رد ادعای حضور سرمربی در اتاق آنالیز ویدئویی.',
          labReport: 'تطبیق نحوه راه رفتن با سرمربی متهم.',
        },
        {
          id: 'ev-f3',
          title: 'سند تعهد ۳ میلیاردی به سایت شرط‌بندی',
          type: 'document',
          description: 'تعهدنامه مالی روی باخت تیم در فینال.',
          foundAt: 'کیف دستی سرمربی متهم',
          significance: 'انگیزه اصلی حذف کاپیتان برای باخت تیم.',
          labReport: 'استعلام اصالت امضا از بانک مرکزی.',
        },
      ],
      characters: [
        {
          id: 'char-f1',
          name: 'رضا صولتی (۴۵ ساله)',
          role: 'defendant',
          roleTitle: 'متهم ردیف اول - سرمربی تیم',
          age: 45,
          occupation: 'سرمربی فوتبال',
          relationToVictim: 'سرمربی آرش دادگر',
          personality: 'جاه‌طلب، بدهکار به سایت‌های شرط‌بندی',
          initialStatement: '«جناب قاضی، آرش برای من مثل پسرم بود! من موقع حادثه در اتاق آنالیز ویدئویی بودم. این اتهامات خط‌دهی رقبای ماست!»',
          suspicionLevel: 80,
          isLying: true,
          deceptionStrategy: 'ادعای حضور در اتاق آنالیز، در حالی که دوربین راهرو خروج او را ثبت کرده است.',
          vulnerabilities: ['تناقض ساعت حضور در اتاق آنالیز با پرینت دوربین', 'بدهی ۳ میلیاردی به سایت‌های شرط‌بندی'],
        },
        {
          id: 'char-f2',
          name: 'امیرحسین جهانگیر (۵۲ ساله)',
          role: 'plaintiff',
          roleTitle: 'شاکی - مدیرعامل و مالک باشگاه',
          age: 52,
          occupation: 'مالک باشگاه ورزشی',
          relationToVictim: 'مدیر باشگاه آرش دادگر',
          personality: 'مقتدر و خواهان قصاص قاتل',
          initialStatement: '«ریاست دادگاه، سرمربی از هفته‌ها قبل بر سر مبالغ شرط‌بندی با مقتول درگیری کلامی شدید داشت!»',
          suspicionLevel: 25,
          isLying: false,
          deceptionStrategy: 'شفاف و خواهان کشف حقیقت.',
          vulnerabilities: [],
        },
        {
          id: 'char-f3',
          name: 'سامان افشار (۳۴ ساله)',
          role: 'defendant',
          roleTitle: 'متهم ردیف دوم - ایجنت مالی مقتول',
          age: 34,
          occupation: 'مدیر برنامه بازیکنان',
          relationToVictim: 'ایجنت رسمی مقتول',
          personality: 'طماع و پنهان‌کار',
          initialStatement: '«آرش قصد داشت قراردادش را فسخ کند اما من هرگز دستم به خون او آلوده نیست!»',
          suspicionLevel: 65,
          isLying: true,
          deceptionStrategy: 'پنهان کردن پیامک‌های تهدیدآمیز ۵ میلیاردی.',
          vulnerabilities: ['پرینت پیامک تهدید به مرگ در روز قبل از حادثه'],
        },
        {
          id: 'char-f4',
          name: 'دکتر کامران مهرآسا (۴۰ ساله)',
          role: 'expert',
          roleTitle: 'کارشناس رسمی - پزشک سم‌شناس',
          age: 40,
          occupation: 'پزشک ورزشی آگاهی',
          relationToVictim: 'پزشک معالج باشگاه',
          personality: 'دقیق و بی‌طرف',
          initialStatement: '«سم در دوز کشنده و دقیقاً ۱۵ دقیقه قبل از فوت وارد بطری نوشیدنی مقتول شده است.»',
          suspicionLevel: 10,
          isLying: false,
          deceptionStrategy: 'ارائه گزارش علمی متقن.',
          vulnerabilities: [],
        },
        {
          id: 'char-f5',
          name: 'فرهاد مجد (۲۹ ساله)',
          role: 'witness',
          roleTitle: 'شاهد - مسئول تدارکات رختکن',
          age: 29,
          occupation: 'مسئول تجهیزات رختکن',
          relationToVictim: 'تدارکات رختکن مقتول',
          personality: 'مضطرب اما راستگو',
          initialStatement: '«من دیدم سرمربی با کاپشن مشکی وارد رختکن شد و بطری نوشیدنی را روی میز گذاشت!»',
          suspicionLevel: 20,
          isLying: false,
          deceptionStrategy: 'شهادت مستقیم به جابجایی بطری.',
          vulnerabilities: [],
        },
      ],
      hiddenTruth: {
        realCulpritId: 'char-f1',
        realCulpritName: 'رضا صولتی (سرمربی تیم)',
        motive: 'بدهی ۳ میلیاردی به سایت‌های شرط‌بندی و ترس از افشای آن توسط کاپیتان تیم',
        howCrimeHappened: 'سرمربی تیم با کاپشن مشکی وارد رختکن شده، سم نویچوک را در بطری ورزشی مقتول حل کرده و با ادعای دروغین حضور در اتاق آنالیز قصد فریب دادگاه را داشته است.',
        keyContradiction: 'تطبیق اثر انگشت سرمربی روی بطری سمی و فیلم دوربین راهرو با ادعای الایبی دروغین او.',
      },
    };
  }

  if (isCinema) {
    return {
      id: caseId,
      caseNumber: caseNum,
      title: 'مسمومیت مرگبار سوپراستار سینما در اختتامیه جشنواره',
      genre: 'جنایی، هنری و رازآلود',
      incidentDate: '۱۴۰۵/۰۷/۰۹ - ساعت ۲۱:۳۰ شب',
      location: 'سالن همایش‌های برج میلاد - اتاق گریم پشت صحنه',
      victimName: 'سحر جاوید (۳۲ ساله - بازیگر سرشناس)',
      victimBackground: 'بازیگر مطرح سینما که لحظاتی پس از دریافت سیمرغ بلورین در پشت صحنه به طرز مشکوکی فوت کرد.',
      briefing: 'گزارش ویژه: سحر جاوید پس از دریافت سیمرغ در اتاق گریم با نوشیدن قهوه حاوی سیانور جان باخت. تحقیقات نشان می‌دهد کارگردان فیلم و بازیگر رقیب وی انگیزه‌های پنهانی قوی داشته‌اند.',
      autopsyReport: {
        timeOfDeath: 'ساعت ۲۱:۱۵ شب',
        causeOfDeath: 'مسمومیت حاد با سیانور پتاسیم',
        toxicology: 'وجود دوز فوق‌العاده بالای سیانور در مایع معده',
        injuries: ['کبودی روی لب‌ها', 'تشنج شدید تنفسی'],
        coronerNotes: 'سم کمتر از ۵ دقیقه قبل از نوشیدن وارد فنجان شده است.',
      },
      evidence: [
        {
          id: 'ev-c1',
          title: 'فنجان قهوه سرامیکی آلوده به سیانور',
          type: 'physical',
          description: 'فنجان قهوه مقتول با اثر انگشت کارگردان روی دسته.',
          foundAt: 'میز گریم پشت صحنه جشنواره',
          significance: 'اثر انگشت کارگردان روی دسته فنجان باقی مانده است.',
          labReport: 'تایید سیانور و اثر انگشت کامل کارگردان.',
        },
        {
          id: 'ev-c2',
          title: 'اسناد افشای اختلاس بودجه فیلم',
          type: 'document',
          description: 'گزارش حسابرسی ۱۰ میلیاردی که مقتول قصد افشای آن را داشت.',
          foundAt: 'کیف دستی مقتول',
          significance: 'انگیزه قاتل برای حق‌السکوت و جنایت.',
          labReport: 'تایید اصالت مدارک کشف شده.',
        },
      ],
      characters: [
        {
          id: 'char-c1',
          name: 'پیمان معتمد (۴۸ ساله)',
          role: 'defendant',
          roleTitle: 'متهم ردیف اول - کارگردان سینما',
          age: 48,
          occupation: 'کارگردان فیلم',
          relationToVictim: 'کارگردان فیلم مقتول',
          personality: 'خودشیفته و پنهان‌کار',
          initialStatement: '«جناب قاضی، سحر شاهکار فیلم من بود! من هنگام حادثه روی سن در حال مصاحبه با خبرنگاران بودم!»',
          suspicionLevel: 80,
          isLying: true,
          deceptionStrategy: 'ادعای حضور روی سن، در حالی که مصاحبه او ۱۰ دقیقه قبل تمام شده بود.',
          vulnerabilities: ['فیلم ضبط‌شده صحنه که ترک مصاحبه توسط او را ثبت کرده است'],
        },
        {
          id: 'char-c2',
          name: 'الناز فروزش (۳۰ ساله)',
          role: 'defendant',
          roleTitle: 'متهم ردیف دوم - بازیگر رقیب',
          age: 30,
          occupation: 'بازیگر سینما',
          relationToVictim: 'رقیب مقتول در جشنواره',
          personality: 'کینه‌توز و مغرور',
          initialStatement: '«من از مقتول متنفر بودم چون نقش من را گرفت، اما من او را نکشتم!»',
          suspicionLevel: 60,
          isLying: true,
          deceptionStrategy: 'انکار ورود به اتاق گریم.',
          vulnerabilities: ['کشف اثر پودر سیانور روی کیف دستی او'],
        },
        {
          id: 'char-c3',
          name: 'مهندس کاوه شریفی (۵۵ ساله)',
          role: 'plaintiff',
          roleTitle: 'شاکی - تهیه‌کننده فیلم و همسر مقتول',
          age: 55,
          occupation: 'تهیه‌کننده سینما',
          relationToVictim: 'همسر قانونی مقتول',
          personality: 'سوگوار و شاکی',
          initialStatement: '«کارگردان می‌خواست مانع افشای اختلاس مالی بودجه فیلم توسط سحر شود!»',
          suspicionLevel: 20,
          isLying: false,
          deceptionStrategy: 'خواهان قصاص کامل.',
          vulnerabilities: [],
        },
        {
          id: 'char-c4',
          name: 'دکتر هومن صبا (۴۵ ساله)',
          role: 'expert',
          roleTitle: 'کارشناس رسمی - سم‌شناس پزشکی قانونی',
          age: 45,
          occupation: 'سم‌شناس جنایی',
          relationToVictim: 'پزشک معاینه جسد',
          personality: 'دقیق و جدی',
          initialStatement: '«سم دقیقاً ۵ دقیقه قبل از سرو قهوه به فنجان افزوده شده است.»',
          suspicionLevel: 10,
          isLying: false,
          deceptionStrategy: 'ارائه مدارک آزمایشگاهی.',
          vulnerabilities: [],
        },
        {
          id: 'char-c5',
          name: 'نیما ارجمند (۲۸ ساله)',
          role: 'witness',
          roleTitle: 'شاهد کلیدی - دستیار گریمور پشت‌صحنه',
          age: 28,
          occupation: 'دستیار گریمور',
          relationToVictim: 'همکار پشت صحنه مقتول',
          personality: 'دقیق و تیزبین',
          initialStatement: '«جناب قاضی، من دیدم کارگردان قبل از رفتن روی سن، سینی قهوه را روی میز گریم سحر گذاشت و از اتاق خارج شد!»',
          suspicionLevel: 15,
          isLying: false,
          deceptionStrategy: 'شهادت مستقیم بر رفت‌وآمد پشت صحنه.',
          vulnerabilities: [],
        },
      ],
      hiddenTruth: {
        realCulpritId: 'char-c1',
        realCulpritName: 'پیمان معتمد (کارگردان)',
        motive: 'جلوگیری از افشای اسناد اختلاس ۱۰ میلیاردی بودجه فیلم توسط مقتول',
        howCrimeHappened: 'کارگردان فیلم قبل از رفتن به اتاق گریم، سیانور را وارد فنجان قهوه سحر کرده و با ادعای مصاحبه با خبرنگاران قصد انحراف دادگاه را داشته است.',
        keyContradiction: 'تطبیق اثر انگشت کارگردان روی دسته فنجان قهوه و انقضای زمان مصاحبه تلویزیونی او.',
      },
    };
  }

  // General Universal Organic Case Generator
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
    allowsLiveConfession: Math.random() < 0.15,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Static Assets & Image Delivery
  const serveImageHandler = (req: Request, res: Response, next: NextFunction) => {
    const ext = path.extname(req.path).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico'].includes(ext)) {
      return next();
    }
    const filename = path.basename(req.path);
    const candidatePaths = [
      path.resolve(__dirname, 'public/images', filename),
      path.resolve(__dirname, 'public', filename),
      path.resolve(__dirname, 'dist/images', filename),
      path.resolve(__dirname, 'dist', filename),
      path.resolve(__dirname, 'src/assets/images', filename),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        res.setHeader('Content-Type', ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.sendFile(p);
      }
    }
    next();
  };

  app.use(serveImageHandler);
  app.use('/images', express.static(path.resolve(__dirname, 'public/images')));
  app.use('/src/assets/images', express.static(path.resolve(__dirname, 'src/assets/images')));
  app.use(express.static(path.resolve(__dirname, 'public')));
  if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
  }

  // API Routes
  app.get('/api/system-logs', (_req: Request, res: Response) => {
    res.json(systemLogs);
  });

  app.post('/api/diagnose-gemini', async (_req: Request, res: Response) => {
    addSystemLog('info', 'Diagnostics', 'فراخوانی تست اتصال دستی به جمینای آغاز شد.');
    const report: any = {
      timestamp: new Date().toISOString(),
      apiKeyConfigured: !!apiKey,
      apiKeyMasked: apiKey ? apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4) : 'یافت نشد',
      customBaseUrl: customBaseUrl || 'پیش‌فرض گوگل',
      dnsTest: 'کامل نشده',
      geminiPing: 'کامل نشده',
      errors: []
    };

    // 1. DNS / connectivity check
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const pingRes = await fetch('https://generativelanguage.googleapis.com/', { signal: controller.signal });
      clearTimeout(id);
      report.dnsTest = `موفق (کد وضعیت: ${pingRes.status})`;
      addSystemLog('success', 'Diagnostics', 'تست دسترسی اینترنتی به دامنه گوگل موفقیت‌آمیز بود.');
    } catch (err: any) {
      report.dnsTest = `خطا در اتصال: ${err?.message || err}`;
      report.errors.push(`خطای دسترسی به اینترنت: ${err?.message || err}`);
      addSystemLog('error', 'Diagnostics', 'خطای عدم دسترسی اینترنتی به گوگل مپ/جمینای از هاست', err);
    }

    // 2. Client initialization verification
    if (!ai) {
      report.geminiPing = 'کلید API تنظیم نشده است';
      report.errors.push('کلاینت هوش مصنوعی ساخته نشده است زیرا کلید API یافت نشد.');
      addSystemLog('warn', 'Diagnostics', 'تست متوقف شد: کلید API معتبر یافت نشد.');
      return res.json({ success: false, report });
    }

    // 3. Mini test query to Gemini using robust generateAiContent helper
    try {
      addSystemLog('info', 'Diagnostics', `تست فراخوانی زنده با سامانه آبشاری مدل‌ها`);
      const testResult = await generateAiContent('سلام. فقط کلمه "موفق" را برگردان.', false, 0.1, 10);
      if (testResult && testResult.text) {
        report.geminiPing = `موفق (با مدل ${testResult.usedModel}). پاسخ: "${testResult.text.trim()}"`;
        addSystemLog('success', 'Diagnostics', `تست فراخوانی زنده با موفقیت به پایان رسید. مدل: ${testResult.usedModel}`);
        return res.json({ success: true, report });
      } else {
        throw new Error('پاسخ خالی یا نامعتبر از جمینای دریافت شد.');
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errStatus = err?.status || err?.statusCode || 'نامعلوم';
      report.geminiPing = `خطای دیسپاچ: کد ${errStatus} | ${errMsg}`;
      report.errors.push({
        message: errMsg,
        status: errStatus,
        rawError: err
      });
      addSystemLog('error', 'Diagnostics', `تست فراخوانی زنده با شکست مواجه شد. کد خطا: ${errStatus}`, err);
      return res.json({ success: false, report });
    }
  });

  app.get('/api/bridge-status', (_req: Request, res: Response) => {
    res.json({
      active: !!ai,
      bridge: 'Railway Europe/Global Gateway',
      model: PRIMARY_MODEL,
      noVpnNeeded: true,
      message: ai
        ? `پل ارتباطی جمینای در سرور فعال و آماده است.`
        : 'سرور در حالت شبیه‌ساز آفلاین است. متغیر GEMINI_API_KEY را در پنل ریلوی وارد کنید.',
    });
  });

  app.get('/api/preset-cases', (_req: Request, res: Response) => {
    res.json(PRESET_CASES);
  });

  // Individual Gemini Model Connectivity & Latency Ping Endpoint
  app.post('/api/ping-model', async (req: Request, res: Response) => {
    const { modelName } = req.body;
    const targetModel = modelName || PRIMARY_MODEL;

    if (!ai) {
      return res.json({
        success: false,
        modelName: targetModel,
        latencyMs: 0,
        error: 'کلید API تنظیم نشده است (حالت آفلاین)',
      });
    }

    const startTime = Date.now();
    try {
      addSystemLog('info', 'ModelTester', `تست مستقیم پینگ نسخه [${targetModel}]`);
      const isLite = targetModel.includes('lite');
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: 'سلام. فقط کلمه "وصل" را برگردان.',
        config: {
          temperature: 0.1,
          maxOutputTokens: 10,
          thinkingConfig: { thinkingLevel: isLite ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW },
        },
      });

      const latencyMs = Date.now() - startTime;
      const text = response?.text?.trim() || 'وصل';
      addSystemLog('success', 'ModelTester', `پینگ نسخه [${targetModel}] موفق بود (${latencyMs}ms): "${text}"`);
      return res.json({
        success: true,
        modelName: targetModel,
        latencyMs,
        responseText: text,
      });
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errMsg = err?.message || String(err);
      const status = err?.status || err?.statusCode || 'Error';
      addSystemLog('error', 'ModelTester', `خطا در پینگ مدل [${targetModel}] (${latencyMs}ms): کد ${status} - ${errMsg}`, err);
      return res.json({
        success: false,
        modelName: targetModel,
        latencyMs,
        error: `کد خطا ${status}: ${errMsg}`,
      });
    }
  });

  // Get list of all available Gemini model tiers
  app.get('/api/models-info', (_req: Request, res: Response) => {
    res.json({
      primaryModel: PRIMARY_MODEL,
      models: ALL_AVAILABLE_MODELS,
      hasApiKey: !!ai,
    });
  });

  // Generate Complete Case Dossier based directly on topic/keyword
  app.post('/api/generate-case', async (req: Request, res: Response) => {
    const { customIdea, topicText } = req.body;
    const requestedTopic = (topicText || customIdea || 'جنایت پیچیده').trim();

    if (!ai) {
      const bespokeCase = generateProceduralCase(requestedTopic);
      return res.json(bespokeCase);
    }

    try {
      const prompt = `شما داستان‌نویس و طراح ارشد پرونده‌های قضایی برای بازی کارآگاهی و قضاوت «آقای قاضی» هستید.
موضوع کلی پرونده که کاربر درخواست کرده است: "${requestedTopic}"

قانون حیاتی و طلایی معمایی ۵۰/۵۰ (بسیار مهم):
۱. **توزیع کاملاً تصادفی و ۵۰ درصدی حقیقت جرم**:
   - در **۵۰٪ پرونده‌ها**: متهم ردیف اول واقعاً گناهکار و مجرم اصلی است و تلاش می‌کند با فریب و الایبی دروغین از زیر بار مجازات فرار کند.
   - در **۵۰٪ دیگر پرونده‌ها**: متهم ردیف اول **کاملاً بی‌گناه و پاک** است (قربانی یک پاپوش‌دوزی حرفه‌ای، شواهد ظاهری گمراه‌کننده، یا توطئه خانوادگی/کاری شده است). در این حالت، **مجرم واقعی یکی دیگر از افراد حاضر در دادگاه (مانند شاهد کلیدی، شریک مالی، یکی از بستگان یا ورثه، یا حتی خود شاکی که برای کلاهبرداری بیمه یا انتقام‌جویی صحنه‌سازی کرده)** می‌باشد!
   - توجه: کارآگاه یا پزشک قانونی همیشه بی‌طرف هستند؛ اما شهود، شاکیان، و افراد نزدیک به مقتول/مال‌باخته می‌توانند مقصر اصلی و فریبکار واقعی باشند.

دستورالعمل‌های سبک و ژانر پرونده:
پرونده می‌تواند در یکی از دسته‌بندی‌های زیر طراحی شود (با توجه به موضوع درخواستی "${requestedTopic}"):
۱. **جنایی (Murder / Assault)**: قتل، ضرب و شتم، جنایات فیزیکی.
۲. **مالی و تجاری (Financial Fraud / Embezzlement)**: کلاهبرداری هرمی، اختلاس، پول‌شویی، جعل اسناد ملکی، سرقت مالکیت معنوی، خیانت در امانت شرکا.
۳. **خانوادگی و مدنی (Family / Inheritance / Civil Disputes)**: تقسیم سهم‌الارث مشکوک، دعوای وصیت‌نامه جعلی، طلاق با مخفی‌کاری مالی متقابل، دعوای مالکیت زمین‌های خانوادگی.

ادبیات واقعی داستان‌نویسی قضایی:
- به هیچ عنوان عبارت خام درخواستی یا کلمات مصنوعی مانند "موضوع درخواستی" یا "پرونده ویژه موضوع..." را در متن، عناوین، سمت کاراکترها یا دیالوگ‌ها تکرار نکنید!
- یک عنوان جذاب و داستانی خلق کنید (مثال برای مالی: "پرونده اختلاس صندوق بازنشستگی زرین" یا خانوادگی: "ماترک موروثی خاندان سالار").
- تمام اسامی، مشاغل، محل وقوع جرم، گزارش ارزیابی و مدارک باید مانند یک پرونده واقعی قضایی با داستان‌نویسی روان و مهیج فارسی نگاشته شوند.

انعطاف در ساختار گزارش تخصصی (autopsyReport):
برای اینکه ساختار فیلدها ثابت بماند اما مناسب با ژانرهای مالی و خانوادگی باشد، فیلد "autopsyReport" را به صورت زیر معنایی تطبیق دهید:
الف) در پرونده‌های جنایی/قتل: همان فرمت کالبدشکافی جسد مقتول (زمان مرگ، علت فوت، سم‌شناسی، آسیب‌ها).
ب) در پرونده‌های مالی/کلاهبرداری:
   - "timeOfDeath": زمان دقیق تراکنش مشکوک اولیه یا کشف اولین فاکتور جعلی.
   - "causeOfDeath": شگرد اصلی ارتکاب کلاهبرداری یا فرار مالیاتی.
   - "toxicology": ردیابی حساب‌های مقصد و جریان جابجایی پول‌های مفقودشده.
   - "injuries": ["مبلغ دقیق کسری صندوق یا ضرر شاکیان", "لیست حساب‌های مسدودشده متهم"].
   - "coronerNotes": گزارش حسابرس رسمی دادگستری در خصوص تراز مالی جعلی و تضادهای ثبت‌شده.
ج) در پرونده‌های خانوادگی/وصیت‌نامه/ارث:
   - "timeOfDeath": تاریخ ارجاع پرونده به دادگاه خانواده یا شروع مرافعه ورثه.
   - "causeOfDeath": اختلاف اصلی طرفین (مثلا ادعای جعلی بودن وصیت‌نامه یا سهم‌الارث ناحق).
   - "toxicology": گزارش صحت‌سنجی خط‌شناسی و امضاء وصیت‌نامه یا تست سلامت روان متوفی در زمان تحریر.
   - "injuries": ["سند پلاک ثبتی مورد اختلاف", "میزان مهریه یا سهم‌الارث مورد مناقشه"].
   - "coronerNotes": گزارش رسمی مددکار خانواده یا نظریه کارشناس رسمی خط‌شناسی دادگستری.

 قانون مهم و الزام‌آور: تعداد و تنوع کامل اشخاص پرونده (هرگز کمتر از ۴ نفر نباشد!):
تعداد اشخاص و بازیگران حاضر در دادگاه باید حتماً بر اساس سوژه و میزان پیچیدگی موضوع بین ۴ تا ۷ نفر باشد (به هیچ عنوان پرونده با ۲ یا ۳ نفر ننسازید!).
- پرونده‌های معمولی: حداقل ۴ الی ۵ شخص کلیدی.
- پرونده‌های پیچیده، شرکتی، مالی، اختلاس، خانوادگی، پزشکی، سرقت باندی یا جنایت چندبعدی: بین ۵ تا ۷ شخص مختلف.
کلیه اشخاص باید مستقیماً با موضوع در ارتباط باشند. نقش‌ها (role) شامل:
  * "defendant" (متهم ردیف اول، متهم ردیف دوم، همدست، مباشر یا مجرم مظنون)
  * "plaintiff" (شاکی پرونده، مالباخته، ولی‌دم یا مدعی حق)
  * "witness" (شاهد عینی، نگهبان، کارمند، همسایه، بستگان، راننده یا فرد مطلع)
  * "expert" (کارشناس رسمی دادگستری، حسابرس، پزشک قانونی، بازرس یا کارآگاه)
  * "defense_lawyer" (وکیل مدافع یا مشاور حقوقی)
- برای هر شخص آیدی مجزا مثل "char-1", "char-2", "char-3", "char-4", "char-5", ... بگذارید.
- اگر متهم اول بی‌گناه است، مجرم واقعی یکی دیگر از کاراکترهاست و فیلد isLying برای آن شخص true و deceptionStrategy وی توضیح داده شود.

مدارک و شواهد:
- بین ۳ الی ۶ مدرک مستدل، فیزیکی، دیجیتالی یا اسناد رسمی متناسب با موضوع.

طراحی اختصاصی و صد در صد داینامیک سرتیترها توسط هوش مصنوعی (customHeaders):
سرتیترها، عناوین و برچسب‌های پرونده باید کاملاً توسط شما بر اساس ژانر و موضوع واقعی طراحی شوند تا هیچ عبارت نامربوط یا نامتناسبی نمایش داده نشود:
- اگر قتل یا جنایی است: victimOrPartyLabel باید «مقتول و قربانی جنایت:» باشد، expertReportTitle باید «گزارش کالبدشکافی و سم‌شناسی پزشکی قانونی»، timeLabel «زمان تقریبی فوت:»، causeOrMethodLabel «علت تامه فوت:»، damagesOrInjuriesLabel «آثار جراحات و ضرب و جرح بر جسد:»، evidenceSectionTitle «شواهد مادی و آزمایشگاهی صحنه جرم»، courtBranchTitle «دادگاه کیفری یک استان (ویژه قتل)».
- اگر مالی، اختلاس، سرقت یا کلاهبرداری است: victimOrPartyLabel باید «شاکی پرونده و مال‌باخته:»، expertReportTitle «گزارش حسابرسی رسمی و بازرسی مالی»، timeLabel «زمان اولین تراکنش مشکوک یا وقوع سرقت:»، causeOrMethodLabel «شگرد اختلاس و خروج پول:»، damagesOrInjuriesLabel «مبالغ مفقوده و کسری حساب‌ها:»، evidenceSectionTitle «اسناد بانکی، فاکتورها و چک‌های مکشوفه»، courtBranchTitle «دادگاه ویژه رسیدگی به جرایم اقتصادی».
- اگر خانوادگی، وصیت‌نامه یا ارث است: victimOrPartyLabel «خواهان پرونده / متوفی ماترک:»، expertReportTitle «گزارش کارشناسی خط‌شناسی و اصالت اسناد»، courtBranchTitle «دادگاه حقوقی و امور حسبی».

خروجی صرفاً یک ساختار معتبر JSON با کلیدهای زیر باشد (بدون هیچ متن اضافی قبل یا بعد از JSON):

{
  "id": "case-${Date.now()}",
  "caseNumber": "۱۴۰۵/...-ج",
  "title": "عنوان جذاب و داستانی پرونده",
  "genre": "ژانر پرونده (مثلاً: مالی - کلاهبرداری، خانوادگی - انحصار وراثت، جنایی - قتل)",
  "incidentDate": "تاریخ و ساعت وقوع یا کشف تخلف",
  "location": "مکان وقوع جرم یا محل ثبت اسناد",
  "victimName": "نام کامل شاکی پرونده، مقتول، یا صاحب اصلی اموال مفقوده",
  "victimBackground": "پیشینه، روابط و وضعیت شاکی یا قربانی اصلی",
  "briefing": "گزارش مشروح، جذاب و داستانی صحنه جرم یا خلاصه ماجرای کلاهبرداری/اختلاف خانوادگی جهت مطالعه اولیه قاضی",
  "customHeaders": {
    "caseClassification": "طبقه بندی محرمانه متناسب با ژانر",
    "investigationTitle": "عنوان گزارش ضابطین یا بازپرس ویژه",
    "victimOrPartyLabel": "برچسب مقتول / شاکی / مالباخته (دقیقاً منطبق بر داستان)",
    "briefingTitle": "عنوان شرح واقعه و گردش‌کار",
    "expertReportTitle": "عنوان گزارش کالبدشکافی یا حسابرسی",
    "expertBadge": "نشان تخصصی",
    "timeLabel": "برچسب زمان وقوع جرم یا فوت",
    "causeOrMethodLabel": "برچسب علت فوت یا شگرد کلاهبرداری",
    "analysisLabel": "برچسب نتایج سم‌شناسی یا ردیابی حساب",
    "damagesOrInjuriesLabel": "برچسب جراحات جسد یا اموال مسروقه",
    "expertNoteLabel": "برچسب نکته کلیدی پزشک قانونی یا حسابرس",
    "evidenceSectionTitle": "عنوان بخش مدارک و اسناد",
    "relationLabel": "برچسب نسبت با مقتول یا شاکی",
    "courtBranchTitle": "نام شعبه تخصصی دادگاه"
  },
  "autopsyReport": {
    "timeOfDeath": "زمان ردیابی تخلف اولیه / زمان فوت",
    "causeOfDeath": "علت فوت / شگرد کلاهبرداری / ریشه اختلاف خانوادگی",
    "toxicology": "نتایج سم‌شناسی / ردیابی حساب‌های مقصد / اصالت‌سنجی دست‌خط وصیت‌نامه",
    "injuries": ["مورد ۱", "مورد ۲"],
    "coronerNotes": "نکات کلیدی گزارش کارشناس رسمی دادگستری یا پزشکی قانونی که تناقض را نشان می‌دهد"
  },
  "evidence": [
    {
      "id": "ev-1",
      "title": "نام مدرک داستانی",
      "type": "physical",
      "description": "شرح مدرک",
      "foundAt": "محل کشف مدرک یا نحوه استخراج سند",
      "significance": "اهمیت مدرک در اثبات یا رد ادعاها",
      "labReport": "نتیجه بررسی کارشناس خط‌شناسی، آگاهی یا بازرسی مالی"
    }
  ],
  "characters": [
    {
      "id": "char-1",
      "name": "نام و فامیلی شخص اول",
      "role": "defendant",
      "roleTitle": "متهم ردیف اول - ...",
      "age": 38,
      "occupation": "شغل دقیق",
      "relationToVictim": "نسبت یا ارتباط با شاکی/قربانی",
      "personality": "روانشناسی کاراکتر",
      "initialStatement": "اظهارات اولیه طبیعی در صحن دادگاه",
      "suspicionLevel": 75,
      "isLying": true,
      "deceptionStrategy": "استراتژی دفاعی یا پنهان‌کاری",
      "vulnerabilities": ["تناقض در اظهارات با مدارک"]
    },
    {
      "id": "char-2",
      "name": "نام و فامیلی شخص دوم",
      "role": "plaintiff",
      "roleTitle": "شاکی / ولی‌دم / متضرر پرونده",
      "age": 42,
      "occupation": "شغل دقیق",
      "relationToVictim": "نسبت مستقیم",
      "personality": "روحیات و رفتار",
      "initialStatement": "ادعاها و شکایت در محضر قاضی",
      "suspicionLevel": 20,
      "isLying": false,
      "deceptionStrategy": "ارائه مدارک و تقاضای دادرسی",
      "vulnerabilities": []
    },
    {
      "id": "char-3",
      "name": "نام و فامیلی شخص سوم",
      "role": "witness",
      "roleTitle": "شاهد کلیدی / نگهبان / کارمند مطلع",
      "age": 35,
      "occupation": "شغل دقیق",
      "relationToVictim": "رابطه کاری یا خانوادگی",
      "personality": "روانشناسی",
      "initialStatement": "شهادت اولیه در دادگاه",
      "suspicionLevel": 35,
      "isLying": false,
      "deceptionStrategy": "",
      "vulnerabilities": []
    },
    {
      "id": "char-4",
      "name": "نام و فامیلی شخص چهارم",
      "role": "expert",
      "roleTitle": "کارشناس رسمی دادگستری / پزشک قانونی / حسابرس",
      "age": 48,
      "occupation": "کارشناس رسمی",
      "relationToVictim": "بی‌طرف - بررسیکننده پرونده",
      "personality": "دقیق و علمی",
      "initialStatement": "گزارش فنی اولیه به جناب قاضی",
      "suspicionLevel": 10,
      "isLying": false,
      "deceptionStrategy": "",
      "vulnerabilities": []
    },
    {
      "id": "char-5",
      "name": "نام و فامیلی شخص پنجم (در صورت نیاز ۵ الی ۷ نفر)",
      "role": "defendant",
      "roleTitle": "متهم ردیف دوم / شریک مشکوک / وکیل مدافع",
      "age": 40,
      "occupation": "شغل دقیق",
      "relationToVictim": "ارتباط با پرونده",
      "personality": "روانشناسی",
      "initialStatement": "دفاعیات یا اظهارات در صحن دادگاه",
      "suspicionLevel": 60,
      "isLying": true,
      "deceptionStrategy": "سفسطه یا انداختن تقصیر به گردن دیگران",
      "vulnerabilities": ["نقطه ضعف پرونده"]
    }
  ],
  "hiddenTruth": {
    "realCulpritId": "char-1",
    "realCulpritName": "نام مقصر واقعی",
    "motive": "انگیزه واقعی جرم",
    "howCrimeHappened": "شرح واقعی چگونگی وقوع تخلف یا جرم به ترتیب ساعت و تاریخ",
    "keyContradiction": "تناقض اساسی که قاضی باید از تطبیق مدارک کشف کند"
  }
}`;

      // Giving AI plenty of tokens (5500) so it never curtails characters or details
      const resAi = await generateAiContent(prompt, true, 0.85, 5500);
      const parsedCase = parseJsonFromAi<CaseDossier>(resAi.text);
      
      // Strictly enforce 15% probability for live courtroom confession
      const allowsLiveConfession = Math.random() < 0.15;

      res.json({
        ...parsedCase,
        allowsLiveConfession,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch (error) {
      console.error('Error generating case via Gemini:', error);
      const bespokeCase = generateProceduralCase(requestedTopic);
      res.json(bespokeCase);
    }
  });

  // Dynamic Heated Verbal Argument Generator
  app.post('/api/generate-argument', async (req: Request, res: Response) => {
    const { caseData, lastExchange } = req.body;

    if (!ai) {
      // Offline fallback argument
      const c1 = caseData?.characters?.[0] || { name: 'متهم اول' };
      const c2 = caseData?.characters?.[1] || { name: 'متهم دوم' };
      return res.json({
        argument: [
          { senderName: c1.name, text: 'جناب قاضی، این آقا دارد کاملاً دروغ می‌گوید تا خودش را تبرئه کند!' },
          { senderName: c2.name, text: 'خفه شو! خودت آن شب کلید گاوصندوق را برداشتی و دوربین‌ها را خاموش کردی!' },
          { senderName: c1.name, text: 'تهمت نزن بی‌شرف! مدارک ردیابی موبایلت در نیاوران کاملاً ثبت شده است!' }
        ]
      });
    }

    try {
      const chars = caseData.characters || [];
      const charDetails = chars.map((c: Character) => `${c.name} (${c.roleTitle}) - روحیات: ${c.personality}`).join('\n');

      const prompt = `شما کارگردان تئاتر قضایی برای بازی «آقای قاضی» هستید.
یک درگیری و مرافعه لفظی شدید و انفجاری بین شخصیت‌های دادگاه نیاز داریم.
شخصیت‌های موجود در دادگاه:
${charDetails}

موضوع پرونده:
${caseData.title} | ${caseData.briefing}

آخرین صحبت رد و بدل شده در دادگاه: "${lastExchange || 'صحبت‌های قبلی اتهام‌زنی شرکا به هم'}"

یک مرافعه لفظی، جدال حقوقی و دعوای داغ بین ۲ الی ۳ نفر از اشخاص حاضر در دادگاه (ترجیحاً افراد با تضاد منافع شدید مانند متهم و شاکی یا شرکای مشکوک) بنویسید.
لحن باید بسیار جدی، پرخاشگر، تند، حقوقی و کاملاً منطبق بر جزئیات همین پرونده باشد. کاراکترها باید ادعاهای یکدیگر را زیر سوال ببرند و مدارک یا رفتارهای مشکوک هم را افشا کنند (بدون دیالوگ‌های کودکانه یا بی‌ربط).

خروجی دقیقاً یک آرایه JSON با ساختار زیر باشد (هیچ متن دیگری ارسال نکنید):
[
  { "senderName": "نام دقیق کاراکتر اول", "text": "دیالوگ عصبانی اول..." },
  { "senderName": "نام دقیق کاراکتر دوم", "text": "پاسخ انفجاری دوم و پریدن وسط حرف کاراکتر اول..." },
  { "senderName": "نام دقیق کاراکتر اول", "text": "اتهام و فریاد متقابل کاراکتر اول..." },
  { "senderName": "نام دقیق کاراکتر سوم یا دوم", "text": "اعتراض تند بعدی..." }
]`;

      // Generate heated argument using the ultra-fast, token-saving LITE model pool
      const resAi = await generateAiContent(prompt, true, 0.9, 800, MODEL_TIER_FAST_LITE);
      const argument = parseJsonFromAi<unknown>(resAi.text);
      res.json({
        argument,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch (error) {
      console.error('Error generating heated argument:', error);
      const c1 = caseData?.characters?.[0] || { name: 'متهم اول' };
      const c2 = caseData?.characters?.[1] || { name: 'شاکی پرونده' };
      res.json({
        argument: [
          { senderName: c1.name, text: `جناب قاضی، این ادعاها درباره پرونده «${caseData?.title || 'جاری'}» کذب محض است و او سعی در فریب دادگاه دارد!` },
          { senderName: c2.name, text: `دروغ نگو! اسناد و شواهد موجود در پرونده همه چیز را اثبات می‌کند!` }
        ]
      });
    }
  });

  // Interrogation API with Group Chat Dynamic Routing & Typo/Phonetic Matching
  app.post('/api/interrogate', async (req: Request, res: Response) => {
    const { caseData, question, evidencePresentedId, history } = req.body;

    const charsList = caseData?.characters || [];
    if (charsList.length === 0) {
      return res.status(404).json({ error: 'شخصیتی در دادگاه وجود ندارد' });
    }

    const evidence = evidencePresentedId
      ? (caseData?.evidence || []).find((e: { id: string }) => e.id === evidencePresentedId)
      : null;

    if (!ai) {
      // Offline fallback defaults to first character
      const char = charsList[0];
      const isDef = char.role === 'defendant';
      return res.json({
        addressedCharacterId: char.id,
        addressedCharacterName: char.name,
        speech: isDef
          ? `جناب قاضی، بنده (${char.name}) بارها عرض کرده‌ام که در زمان وقوع حادثه، هیچ نقشی در این ماجرا نداشتم!`
          : `ریاست محترم دادگاه، بنده آنچه دیدم و شنیدم را با صداقت در محضر شما بیان کردم.`,
        innerThought: isDef ? 'باید خونسرد بمانم...' : undefined,
        slipUp: evidence ? `تناقض در خصوص مکان و چگونگی کشف ${evidence.title}` : undefined,
        stressDelta: evidence ? 18 : 6,
        interruption: null
      });
    }

    try {
      // Determine if this specific case belongs to the rare 15% where live confession is possible
      const caseIdStr = String(caseData?.id || '');
      let hash = 0;
      for (let i = 0; i < caseIdStr.length; i++) {
        hash = (hash + caseIdStr.charCodeAt(i)) % 100;
      }
      const canConfessLive = caseData?.allowsLiveConfession !== undefined ? Boolean(caseData.allowsLiveConfession) : (hash < 15);

      // Smart token reduction: keep only the last 8 recent dialogue exchanges
      const recentHistory = (history || []).slice(-8);
      const historyStr = recentHistory
        .map((h: { sender: string; text: string }) => `${h.sender}: ${h.text}`)
        .join('\n');

      const allCharsDescription = charsList
        .map((c: Character) => `ID: "${c.id}" | نام کامل: "${c.name}" | سمت: "${c.roleTitle}" | سن: ${c.age} | شغل: "${c.occupation}" | رابطه با قربانی: "${c.relationToVictim}" | روحیات: "${c.personality}" | وضعیت اخلاقی: "${c.temperament || 'normal'}" | استراتژی فریب: "${c.deceptionStrategy || 'ندارد'}" | نقاط ضعف: "${(c.vulnerabilities || []).join(', ')}"`)
        .join('\n\n');

      const confessionRuleText = canConfessLive
        ? `این پرونده استثنائاً جزو «۱۵٪ پرونده‌های خاص» است که مقصر دارای ضعف شخصیتی یا شکنندگی روانی است. اگر و تنها اگر قاضی مدرک کلیدی و ابطال‌ناپذیر پرونده را مستقیماً رو کرد و او را در بن‌بست کامل قرار داد، می‌تواند دچار فروپاشی روانی شده و اعتراف صریح کند (isConfession: true).`
        : `قانون قطعی و لازم‌الاجرا در این پرونده (۸۵٪ پرونده‌ها): **عدم امکان هرگونه اعتراف زنده در صحن دادگاه!**
مقصر در این پرونده فردی به شدت سرسخت، مغرور یا دارای وکیل و پنهان‌کار است. تحت هیچ شرایطی در طول بازجویی اعتراف صریح نمی‌کند و مقدار "isConfession" باید ۱۰۰٪ false باشد. او فقط در صورت بن‌بست دچار لغزش کلامی و تپق ریز در فیلد "slipUp" می‌شود یا با عصبانیت سکوت و انکار می‌کند تا قاضی خودش بر اساس شواهد رأی نهایی را انشا کند.`;

      const prompt = `شما کارگردان و هوش مصنوعی هماهنگ‌کننده کل سالن دادگاه تخصصی بازی «آقای قاضی» هستید.
قاضی (کاربر) در صحن علنی دادگاه، سوال یا مدرکی را مطرح کرده است. شما باید شخصیت مخاطب را تشخیص دهید و دیالوگی فوق‌العاده باهوش، واقع‌گرایانه، طبیعی و دقیقاً منطبق با موضوع پرونده برای او خلق کنید.

لیست تمامی اشخاص حاضر در صحن دادگاه (متهمین، شاکیان، شهود، کارشناسان):
${allCharsDescription}

خلاصه پرونده و موضوع دادرسی:
${caseData.briefing}
حقیقت پنهان واقعی پشت پرده:
${caseData.hiddenTruth?.howCrimeHappened || ''}
تناقض کلیدی پرونده: ${caseData.hiddenTruth?.keyContradiction || ''}

سابقه‌ی جریان دادگاه زنده:
${historyStr}

سوال یا مواجهه جدید قاضی:
"${question}"
${evidence ? `مدرک پیوست‌شده توسط قاضی که کل دادگاه آن را می‌بینند:\nعنوان مدرک: ${evidence.title}\nشرح مدرک: ${evidence.description}\nمحل کشف: ${evidence.foundAt}\nگزارش کارشناسی: ${evidence.labReport}` : 'هیچ مدرک فیزیکی ضمیمه نشده است.'}

قوانین و استانداردهای طلایی رفتار و دیالوگ کاراکترها (بسیار مهم):
۱. **هوشمندی فوق‌العاده بالا، گفتار فاخر، زیرکانه و مرتبط با جزئیات پرونده (High Intelligence, Articulate Speech & Deep Context Alignment)**:
   - تمامی کاراکترها افرادی بالغ، فوق‌العاده باهوش، محتاط، مسلط به کلام رسمی و حقوقی فارسی و کاملاً آگاه به موقعیت خود در دادگاه هستند.
   - **ارتباط دقیق و مستدل با جزئیات پرونده**: کاراکترها مطلقاً نباید پاسخ‌های کلی، تکراری، مبهم یا بی‌ارتباط بدهند! آنها باید مستقیماً با ذکر اسامی اشخاص، فاکتورها، مدارک، مبالغ، ساعات دقیق، گزارش‌های آزمایشگاه یا کالبدشکافی، و جزئیات دقیق همین پرونده («${caseData.title}») صحبت کنند.
   - **دفاعیات و سناریوسازی هوشمندانه**: متهمین دروغ‌های فوق‌العاده باورپذیر، سناریوهای جایگزین معقول و توجیهات منطقی برای رفتارهای مشکوک خود بافته و تلاش می‌کنند بار اتهام را رندانه متوجه دیگر اشخاص حاضر در دادگاه کنند.
   - **واکنش عقلانی شهود و کارشناسان**: شهود و کارشناسان با لحنی فاخر و تخصصی، بر اساس داده‌های پرونده، شواهد و دیده‌های خود استدلال می‌کنند.

۲. **قانون اعتراف، لغزش‌های کلامی و فروپاشی روانی (Breakdown & Confession)**:
   - در مکالمات عادی و استنطاق‌های معمولی: کاراکتر به هیچ وجه اعتراف نمی‌کند، انکار می‌کند و مقدار "isConfession" باید false و "slipUp" باید null باشد.
   - **قانون خاص این پرونده درباره اعتراف زنده**:
     ${confessionRuleText}
   - اگر شخص بی‌گناه است: حتی زیر شدیدترین اتهامات و فشارها، هرگز اعتراف دروغین نمی‌کند؛ بلکه با بغض، فریاد، یا سوگند به بی‌گناهی خود و توطئه‌بودن اتهامات اشاره می‌کند.

۳. **تطابق ۱۰۰٪ با موضوع و مدارک پرونده**:
   - تمامی صحبت‌ها، دفاعیات و ارجاعات باید دقیقاً بر اساس حقایق همین پرونده («${caseData.title}») باشد (مثلاً ارقام چک‌ها، قراردادها، امضاها، مبالغ، ساعات، نسبت‌ها یا گزارش‌های کارشناسی).

۴. **تشخیص دقیق مخاطب و اشتباهات تایپی**:
   - نام یا سمت مخاطب قاضی را هوشمندانه تشخیص دهید.
   - اگر قاضی اسم را با غلط املایی یا خلاصه گفت، کاراکتر با لحنی طبیعی و مودبانه/رندانه به تصحیح اسم اشاره کند (مثلاً «جناب قاضی، اگر با بنده (سهراب) هستید...»).

۵. **مداخله و قطع کلام خودکار (interruption)**:
   - بسیار نادر (کمتر از ۵٪ مواقع و فقط در صورت درگیری لفظی حاد و مستقیم شخصی، در غیر این صورت حتماً مقدار آن را null بگذارید).

خروجی صرفاً یک JSON معتبر فارسی باشد با ساختار زیر (بدون هیچ متن اضافی):
{
  "addressedCharacterId": "آیدی دقیق کاراکتر پاسخ‌دهنده",
  "addressedCharacterName": "نام دقیق کاراکتر پاسخ‌دهنده",
  "speech": "پاسخ رسا، هوشمندانه، مستدل و واقع‌گرایانه کاراکتر پاسخ‌دهنده (یا دیالوگ اعتراف در صورت فروپاشی)",
  "innerThought": "مونولوگ درونی، محاسبه‌گری یا استرس پنهان کاراکتر در مغز خود",
  "slipUp": null,
  "isConfession": false,
  "lawyerIntervention": "متن اعتراض حقوقی در صورت لزوم، در غیر این صورت null",
  "interruption": null
}`;

      const resAi = await generateAiContent(prompt, true, 0.85, 2000);
      const parsed = parseJsonFromAi<Record<string, any>>(resAi.text);

      // Hard enforcement: if this case does NOT permit live confession, ensure isConfession is strictly false!
      if (!canConfessLive) {
        parsed.isConfession = false;
      }

      res.json({
        ...parsed,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch (error) {
      addSystemLog('error', 'InterrogateAPI', `خطا در اجرای پاسخ هوشمند جمینای: ${error}`, error);
      
      // Determine which character was most likely being addressed to keep context intact
      let targetChar = charsList[0];
      const cleanQuestion = (question || '').toLowerCase();
      for (const char of charsList) {
        if (cleanQuestion.includes(char.name.toLowerCase()) || (char.roleTitle && cleanQuestion.includes(char.roleTitle.toLowerCase()))) {
          targetChar = char;
          break;
        }
      }

      // Evasive/realistic fallbacks based on role
      let speech = `جناب قاضی، بنده به عنوان ${targetChar.roleTitle} توضیحات اولیه را ارائه دادم. لطفاً سوال یا مدرک را مجدداً و شفاف‌تر مطرح کنید.`;
      if (targetChar.role === 'defendant') {
        const defendantReplies = [
          `جناب قاضی، بنده تحت فشار شدیدی هستم و نسبت به این اتهام سکوت می‌کنم تا مدارک دقیق‌تری ارائه شود! من بی‌گناهم!`,
          `ریاست محترم دادگاه، من قبلاً پاسخ این موضوع را داده‌ام و اصرار به بی‌گناهی خود دارم! او دارد مرا متهم می‌کند!`,
          `جناب قاضی، این پرسش شما یا شهود برای تخریب چهره من طراحی شده است. از ارائه پاسخ‌های فرعی خودداری می‌کنم.`
        ];
        speech = defendantReplies[Math.floor(Math.random() * defendantReplies.length)];
      } else if (targetChar.role === 'witness') {
        speech = `ریاست محترم، من فقط یک شاهد ساده هستم و بیش از آنچه ثبت شده چیزی به یاد نمی‌آورم. لطفاً مرا تحت فشار قرار ندهید.`;
      } else if (targetChar.role === 'plaintiff') {
        speech = `جناب قاضی، ما از دادگاه تقاضای اجرای اشد مجازات را داریم. مدارک و اسناد ما کاملاً واضح و گویای ارتکاب جرم است!`;
      } else if (targetChar.role === 'expert') {
        speech = `جناب قاضی، گزارش فنی و تخصصی بنده ضمیمه پرونده است. از نظر کارشناسی من، موضوع نیاز به ممیزی و ارزیابی شواهد موجود دارد.`;
      }

      res.json({
        addressedCharacterId: targetChar.id,
        addressedCharacterName: targetChar.name,
        speech,
        innerThought: targetChar.role === 'defendant' ? 'نباید سوتی بدهم... اوضاع خطری شد!' : 'امیدوارم قاضی حقیقت را بفهمد.',
        slipUp: null,
        stressDelta: 3,
        interruption: null
      });
    }
  });

  // Generate Real-World Historical Case via Gemini
  app.post('/api/generate-real-case', async (req: Request, res: Response) => {
    const { caseNameOrTopic, category, isRandom } = req.body;
    let queryDesc = (caseNameOrTopic || '').trim();

    if (isRandom || !queryDesc) {
      const randomCuratedThemes = [
        'یک پرونده واقعی و فوق‌العاده دراماتیک قتل مرموز یا جنایی در تاریخ جهان (با مدارک متناقض و معماگونه)',
        'یکی از جنجالی‌ترین پرونده‌های جنایی یا قتل‌های دادگاه‌های تاریخ ایران (مثل خفاش شب، قتل در نیاوران یا سرقت‌های مسلحانه)',
        'بزرگ‌ترین و عجیب‌ترین پرونده سرقت موزه، سرقت بانک یا کلاهبرداری مالی در تاریخ',
        'پرونده واقعی ترور یا مسمومیت مشکوک با مواد سمی ناشناخته در تاریخ',
        'معمای جنایی قتل در هالیوود یا میان افراد مشهور و ثروتمند جهان',
        'پرونده واقعی ناپدید شدن یا قتل در اتاق بسته با شواهد مبهم بالستیک',
      ];
      queryDesc = randomCuratedThemes[Math.floor(Math.random() * randomCuratedThemes.length)];
    } else if (category) {
      queryDesc = `پرونده واقعی در موضوع: ${category} - ${queryDesc}`;
    }

    if (!ai) {
      return res.status(503).json({ error: 'برای تولید پرونده‌های واقعی اتصال به جمینای الزامی است.' });
    }

    try {
      const prompt = `شما مورخ ارشد جنایی و طراح پرونده‌های واقعی برای بازی دادگاه «آقای قاضی» هستید.
کاربر درخواست ارائه یک «پرونده واقعی و تاریخی در دنیای واقعی» را دارد:
درخواست کاربر / سوژه: "${queryDesc}"

دستورالعمل‌های حیاتی:
۱. یک پرونده کاملاً واقعی، مستند و جنجالی از تاریخ ایران یا جهان (مثلاً او.جی سیمپسون، خفاش شب، زودیاک، تد باندی، جان‌بنت رمزی، مسمومیت‌های دارویی، سرقت‌های بزرگ، قتل‌های زنجیره‌ای، پرونده‌های مشهور دادگستری ایران یا جهان) را با مشخصات واقعی بازسازی کنید.
۲. کاربر ممکن است از قبل پرونده را نشناسد؛ بنابراین در خلاصه ماجرا (briefing)، مشخصات قربانی و مدارک به شکلی داستان‌پردازی جذاب، شفاف و کارآگاهی انجام دهید که هر فردی بدون نیاز به اطلاعات قبلی بتواند از صفر شواهد را کشف و معما را حل کند.
۳. در متن پرونده و معرفی اشخاص، **رأی نهایی دادگاه را لو ندهید** تا بازیکن هیجان قضاوت مستقل را تجربه کند!
۴. تمام اشخاص واقعی پرونده (متهم واقعی، کارآگاه/کارشناس رسمی، شاکی یا شهود کلیدی) را در فیلد characters بیاورید.
۵. مدارک و شواهد واقعی کشف‌شده در صحنه جرم را با جزئیات بالستیک، ژنتیک یا اسناد مکتوب ذکر کنید.
۶. بخش حیاتی: فیلد "realWorldInfo" را دقیقاً با حقیقت تاریخی پر کنید:
   - "isRealCase": true
   - "realCaseName": نام رسمی پرونده در تاریخ
   - "historicalDate": سال و دهه وقوع
   - "historicalLocation": شهر و کشور واقعی
   - "actualCourtVerdict": خلاصه رأی قطعی دادگاه در واقعیت (آیا متهم واقعی تبرئه شد یا محکوم؟ دلیل هیئت منصفه چه بود؟)
   - "actualSentence": مجازات قطعی صادره در دنیای واقعی
   - "historicalEpilogue": سرنوشت متهم و پرونده پس از حکم در تاریخ
   - "historicalSignificance": چرا این پرونده در تاریخ قضایی جهان یا ایران مشهور شد؟

قانون مهم داینامیک سرتیترها (customHeaders):
متناسب با موضوع پرونده (جنایی، سرقت، مسمومیت، مالی و...) سرتیترهای بخش‌های مختلف را تنظیم کنید.

خروجی صرفاً یک JSON معتبر باشد با ساختار CaseDossier:
{
  "id": "real-${Date.now()}",
  "caseNumber": "شماره کلاسه تاریخی پرونده",
  "title": "عنوان جذاب و واقعی پرونده",
  "genre": "ژانر واقعی پرونده",
  "incidentDate": "تاریخ دقیق وقوع",
  "location": "مکان دقیق وقوع",
  "victimName": "نام قربانی یا مال‌باخته واقعی",
  "victimBackground": "شرح حال قربانی",
  "briefing": "شرح صحنه جرم و آغاز ماجرا",
  "autopsyReport": {
    "timeOfDeath": "زمان وقوع",
    "causeOfDeath": "علت فوت یا شگرد اصلی",
    "toxicology": "گزارش سم‌شناسی یا آزمایشگاهی",
    "injuries": ["جراحات یا خسارات"],
    "coronerNotes": "نکته کلیدی کارشناس پزشکی قانونی یا مالی"
  },
  "evidence": [
    {
      "id": "ev-1",
      "title": "عنوان مدرک واقعی",
      "type": "physical",
      "description": "شرح مدرک",
      "foundAt": "محل کشف",
      "significance": "اهمیت مدرک در محکومیت یا تبرئه",
      "labReport": "گزارش کارشناسی"
    }
  ],
  "characters": [
    {
      "id": "char-1",
      "name": "نام شخص واقعی",
      "role": "defendant",
      "roleTitle": "سمت واقعی در دادگاه",
      "age": 40,
      "occupation": "شغل",
      "relationToVictim": "نسبت با قربانی",
      "personality": "روحیات و رفتار",
      "initialStatement": "دفاعیات یا سخنان واقعی در دادگاه",
      "suspicionLevel": 85,
      "isLying": true,
      "deceptionStrategy": "استراتژی دفاعی در دنیای واقعی",
      "vulnerabilities": ["تناقض‌های دفاعیات"]
    }
  ],
  "hiddenTruth": {
    "realCulpritId": "آیدی مقصر واقعی",
    "realCulpritName": "نام مقصر واقعی",
    "motive": "انگیزه واقعی",
    "howCrimeHappened": "شرح واقعی چگونگی وقوع جرم در تاریخ",
    "keyContradiction": "تناقض اساسی شواهد"
  },
  "customHeaders": {
    "caseClassification": "نام دادگاه و شعبه رسیدگی‌کننده",
    "investigationTitle": "عنوان گزارش بازپرسی",
    "victimOrPartyLabel": "عنوان شاکی یا قربانی",
    "briefingTitle": "عنوان شرح واقعه",
    "expertReportTitle": "عنوان گزارش تخصصی",
    "expertBadge": "نشان گزارش",
    "timeLabel": "عنوان زمان واقعه",
    "causeOrMethodLabel": "عنوان علت یا شگرد",
    "analysisLabel": "عنوان آزمایشگاه",
    "damagesOrInjuriesLabel": "عنوان خسارات",
    "expertNoteLabel": "عنوان نکته کارشناس",
    "evidenceSectionTitle": "عنوان بخش شواهد",
    "relationLabel": "نسبت",
    "courtBranchTitle": "نام دادگاه"
  },
  "allowsLiveConfession": false,
  "realWorldInfo": {
    "isRealCase": true,
    "realCaseName": "نام رسمی پرونده در تاریخ",
    "historicalDate": "تاریخ تاریخی",
    "historicalLocation": "محل تاریخی",
    "actualCourtVerdict": "رأی قطعی دادگاه واقعی در تاریخ",
    "actualSentence": "مجازات واقعی",
    "historicalEpilogue": "سرنوشت واقعی متهم پس از سال‌ها",
    "historicalSignificance": "اهمیت پرونده در تاریخ"
  }
}`;

      const resAi = await generateAiContent(prompt, true, 0.7, 5000);
      const parsed = parseJsonFromAi<CaseDossier>(resAi.text);
      res.json({
        ...parsed,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch (err) {
      console.error('Error generating real case:', err);
      res.status(500).json({ error: 'خطا در بازسازی پرونده تاریخی توسط جمینای.' });
    }
  });

  // Verdict Evaluation API with Multi-Character Typed Judgments
  app.post('/api/judge-verdict', async (req: Request, res: Response) => {
    const { caseData, accusedId, verdictType, verdictReasoning, penalty, chargeName, individualDecisions } = req.body;

    const chosenPerson = (caseData?.characters || []).find((c: Character) => c.id === accusedId);
    const realCulpritId = caseData?.hiddenTruth?.realCulpritId;
    const isDirectMatch = accusedId === realCulpritId;
    const isRealCase = Boolean(caseData?.realWorldInfo?.isRealCase);

    const individualDecisionsList = Array.isArray(individualDecisions) && individualDecisions.length > 0
      ? individualDecisions
      : (caseData?.characters || []).map((c: Character) => ({
          characterId: c.id,
          characterName: c.name,
          status: c.id === accusedId ? verdictType : 'acquitted',
          chargeAndPenalty: c.id === accusedId ? `${chargeName || ''} - ${penalty || ''}` : 'تبرئه',
        }));

    // Check if the real culprit was marked guilty in individual decisions
    const realCulpritFound = individualDecisionsList.some(
      (d: any) => d.characterId === realCulpritId && d.status === 'guilty'
    ) || (isDirectMatch && verdictType === 'guilty');

    if (!ai) {
      const isCorrect = realCulpritFound;
      const individualEvaluations = (caseData?.characters || []).map((c: Character) => {
        const userDec = individualDecisionsList.find((d: any) => d.characterId === c.id);
        const isCulprit = c.id === realCulpritId;
        const markedGuilty = userDec?.status === 'guilty';
        const isRight = (isCulprit && markedGuilty) || (!isCulprit && !markedGuilty);
        return {
          characterId: c.id,
          characterName: c.name,
          statusSummary: markedGuilty ? 'محکوم به مجازات' : 'تبرئه / مختومه',
          isCorrectVerdict: isRight,
          note: isRight
            ? (isCulprit ? 'احراز دقیق مجرمیت مقصر واقعی' : 'برائت شایسته فرد بی‌گناه')
            : (isCulprit ? 'عدم انتساب جرم به مقصر واقعی' : 'محکومیت اشتباه فرد بی‌گناه'),
        };
      });

      return res.json({
        isCorrect,
        justiceRating: isCorrect ? 95 : 35,
        truthRevealed: caseData?.hiddenTruth?.howCrimeHappened || 'پرونده مختومه شد.',
        feedback: isCorrect
          ? 'آفرین جناب قاضی! شما موفق شدید مجرم واقعی را در میان اشخاص شناسایی کرده و به درستی دادنامه را انشا نمایید.'
          : 'حکم صادره متاسفانه با حقیقت ماجرا مغایرت داشت و مقصر واقعی تبرئه گردید یا فرد بی‌گناهی مجازات شد.',
        deceptionBusted: isCorrect,
        epilogue: 'پرونده با صدور دادنامه تایپی جامع به اجرای احکام دادگستری ارسال شد.',
        culpritConfession: isCorrect ? 'اعتراف می‌کنم... استدلال و مدارکی که در دادنامه قید کردید راه فراری برایم نگذاشت!' : undefined,
        chargeName: chargeName || 'احراز مجرمیت جامع',
        penaltyApplied: penalty || 'مجازات بر اساس احکام تعیینی دادنامه',
        individualEvaluations,
        ...(isRealCase && caseData.realWorldInfo
          ? {
              historicalComparison: {
                actualCourtVerdict: caseData.realWorldInfo.actualCourtVerdict,
                actualSentence: caseData.realWorldInfo.actualSentence,
                divergencePercentage: isCorrect ? 85 : 30,
                matchSummary: isCorrect ? 'حکم شما تطابق بسیار بالایی با سیر قضایی این پرونده تاریخی داشت.' : 'تصمیم شما با رأی دادگاه تاریخی در دنیای واقعی تفاوت اساسی داشت.',
                historicalAnalysis: `در دنیای واقعی: ${caseData.realWorldInfo.actualCourtVerdict}`,
                realWorldEpilogue: caseData.realWorldInfo.historicalEpilogue,
              },
            }
          : {}),
      });
    }

    try {
      const charsSummary = individualDecisionsList
        .map((d: any) => `• نام شخص: "${d.characterName}" (آیدی: ${d.characterId}) -> وضعیت تعیین‌شده توسط قاضی: [${d.status}] | حکم/دستور تایپ‌شده: "${d.chargeAndPenalty || 'بدون متن'}"`)
        .join('\n');

      const evaluationPrompt = `شما هیئت عالی نظارت قضایی بر احکام دادگاه در بازی «آقای قاضی» هستید.
پرونده: ${caseData.title}
شرح واقعه: ${caseData.briefing}

حقیقت پنهان واقعی پرونده:
مجرم اصلی واقعی: ${caseData.hiddenTruth?.realCulpritName || 'مشخص شده در پرونده'} (آیدی: ${realCulpritId})
انگیزه واقعی: ${caseData.hiddenTruth?.motive || ''}
نحوه وقوع جرم: ${caseData.hiddenTruth?.howCrimeHappened || ''}
تناقض کلیدی: ${caseData.hiddenTruth?.keyContradiction || ''}

${isRealCase && caseData.realWorldInfo ? `اطلاعات پرونده واقعی در تاریخ:
نام واقعی پرونده: ${caseData.realWorldInfo.realCaseName}
رأی قطعی دادگاه واقعی در تاریخ: ${caseData.realWorldInfo.actualCourtVerdict}
مجازات واقعی در تاریخ: ${caseData.realWorldInfo.actualSentence}
سرنوشت واقعی: ${caseData.realWorldInfo.historicalEpilogue}` : ''}

تصمیمات و احکام تایپی قاضی (کاربر) برای تک‌تک اشخاص پرونده:
${charsSummary}

متن انشای کامل دادنامه و استدلال قضایی تایپ‌شده توسط قاضی:
"${verdictReasoning}"

وظیفه خطیر شما برای ارزیابی جامع دادنامه:
۱. ارزیابی تشخیص مجرم: آیا قاضی درست تشخیص داده و مجرم واقعی (${realCulpritId}) را در میان اشخاص محکوم کرده و افراد بی‌گناه را تبرئه نموده است؟
۲. **ارزیابی دادنامه تایپی و استدلال قاضی**: استدلال مکتوب قاضی، اشاره به مدارک کلیدی و تناسب مجازات‌های تایپ‌شده برای هر شخص را ارزیابی فرمایید.
۳. برای تک‌تک کاراکترها در آرایه "individualEvaluations" ارزیابی کنید که آیا تصمیم قاضی برای آن شخص درست بوده است یا خیر همراه با یک توضیح حقوقی کوتاه.
۴. نمره عدالت (justiceRating بین ۰ تا ۱۰۰) بدهید.
${isRealCase ? `۵. **تحلیل مقایسه‌ای با دنیای واقعی (historicalComparison)**: حتماً بخش مقایسه تاریخی را پر کنید و بنویسید که حکم صادر شده توسط کاربر، چند درصد (divergencePercentage) با رأی قطعی دادگاه در واقعیت تاریخ تطابق یا تفاوت داشته و چرا دادگاه واقعی آن تصمیم را گرفت.` : ''}

خروجی صرفاً یک JSON معتبر باشد با فرمت:
{
  "isCorrect": true/false,
  "justiceRating": 95,
  "truthRevealed": "شرح کامل و جذاب حقیقت واقعی پشت پرده جنایت",
  "feedback": "تحلیل تخصصی و فاخر عملکرد قاضی: ارزیابی درستی تشخیص مجرم در بین اشخاص، دادنامه مکتوب تایپ‌شده و شواهد مورد استناد",
  "deceptionBusted": true/false,
  "epilogue": "سرنوشت پرونده، متهم و شاکی پس از اجرای این حکم جامع",
  "culpritConfession": "جملات اعتراف یا واکنش نهایی مقصر اصلی در لحظه ابلاغ دادنامه",
  "chargeName": "${chargeName || 'احراز مجرمیت بر اساس دادنامه تایپی'}",
  "penaltyApplied": "${penalty || 'مجازات تعیینی دادگاه'}",
  "individualEvaluations": [
    {
      "characterName": "نام شخص",
      "statusSummary": "خلاصه تصمیم قاضی",
      "isCorrectVerdict": true/false,
      "note": "توضیح کوتاه ارزیابی دیوان عالی درباره تصمیم قاضی برای این شخص"
    }
  ]${isRealCase ? `,
  "historicalComparison": {
    "actualCourtVerdict": "خلاصه رأی دادگاه تاریخی در واقعیت",
    "actualSentence": "مجازات واقعی در تاریخ",
    "divergencePercentage": 85,
    "matchSummary": "خلاصه میزان تطابق یا تفاوت حکم قاضی با رأی تاریخی دادگاه در دنیای واقعی",
    "historicalAnalysis": "تحلیل مقایسه‌ای مفصل و جذاب: تفاوت استدلال قاضی کاربر با هیئت منصفه و وکلای دادگاه تاریخی واقعی",
    "realWorldEpilogue": "سرنوشت واقعی شخصیت‌های پرونده در تاریخ پس از دادرسی"
  }` : ''}
}`;

      const resAi = await generateAiContent(evaluationPrompt, true, 0.7, 1800, MODEL_TIER_FAST_LITE);
      const parsed = parseJsonFromAi<Record<string, unknown>>(resAi.text);
      res.json({
        ...parsed,
        _activeModel: resAi.usedModel,
        _latencyMs: resAi.latencyMs,
      });
    } catch (error) {
      console.error('Error evaluating verdict:', error);
      const isCorrect = realCulpritFound;
      res.json({
        isCorrect,
        justiceRating: isCorrect ? 92 : 40,
        truthRevealed: caseData?.hiddenTruth?.howCrimeHappened || 'پرونده بررسی شد.',
        feedback: isCorrect ? 'رأی منطبق بر حقیقت و مدارک موجود اصدار یافت.' : 'حکم صادره با واقعیت مادی پرونده همخوانی نداشت.',
        deceptionBusted: isCorrect,
        epilogue: 'پرونده به اجرای احکام دادسرا ارجاع شد.',
        chargeName: chargeName || 'احراز مجرمیت',
        penaltyApplied: penalty || 'مجازات قانونی',
        ...(isRealCase && caseData.realWorldInfo
          ? {
              historicalComparison: {
                actualCourtVerdict: caseData.realWorldInfo.actualCourtVerdict,
                actualSentence: caseData.realWorldInfo.actualSentence,
                divergencePercentage: isCorrect ? 80 : 35,
                matchSummary: isCorrect ? 'حکم شما تطابق بالایی با مستندات تاریخی داشت.' : 'حکم شما با رأی دادگاه واقعی در تاریخ متفاوت بود.',
                historicalAnalysis: `در دادگاه واقعی: ${caseData.realWorldInfo.actualCourtVerdict}`,
                realWorldEpilogue: caseData.realWorldInfo.historicalEpilogue,
              },
            }
          : {}),
      });
    }
  });

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT !== undefined ||
    fs.existsSync(path.resolve(__dirname, 'dist/index.html'));

  if (isProduction && fs.existsSync(path.resolve(__dirname, 'dist/index.html'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api') || req.path.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|map)$/i)) {
        return res.status(404).send('Asset not found');
      }
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[آقای قاضی] پل هوشمند دادگاه روی پورت ${PORT} فعال شد.`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
