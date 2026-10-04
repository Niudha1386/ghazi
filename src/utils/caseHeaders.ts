import { CaseDossier } from '../types.ts';

export interface DynamicCaseLabels {
  caseClassification: string;
  investigationTitle: string;
  victimOrPartyLabel: string;
  briefingTitle: string;
  expertReportTitle: string;
  expertBadge: string;
  timeLabel: string;
  causeOrMethodLabel: string;
  analysisLabel: string;
  damagesOrInjuriesLabel: string;
  expertNoteLabel: string;
  evidenceSectionTitle: string;
  relationLabel: string;
  courtBranchTitle: string;
}

export function getDynamicCaseLabels(caseData: CaseDossier | null | undefined): DynamicCaseLabels {
  if (!caseData) {
    return {
      caseClassification: 'محرمانه - پرونده قضایی',
      investigationTitle: 'گزارش کلانتری و ضابطین قضایی',
      victimOrPartyLabel: 'مشخصات بزه دیده / شاکی:',
      briefingTitle: 'شرح واقعه و گردش کار پرونده:',
      expertReportTitle: 'گزارش ارزیابی کارشناسی تخصصی',
      expertBadge: 'مستندات پرونده',
      timeLabel: 'زمان وقوع واقعه:',
      causeOrMethodLabel: 'شگرد / موضوع مناقشه:',
      analysisLabel: 'نتایج بررسی کارشناسی:',
      damagesOrInjuriesLabel: 'خسارات و صدمات:',
      expertNoteLabel: 'نکته کلیدی کارشناس رسمی:',
      evidenceSectionTitle: 'مدارک و شواهد مکشوفه در پرونده',
      relationLabel: 'ارتباط با طرفین پرونده:',
      courtBranchTitle: 'دادگاه کیفری و حقوقی',
    };
  }

  // 1. First Priority: Custom Headers designed dynamically by Gemini for this specific case!
  const custom = caseData.customHeaders;

  const textToScan = `${caseData.title || ''} ${caseData.genre || ''} ${caseData.briefing || ''}`.toLowerCase();
  const isHomicideOrPhysical = /قتل|مقتول|جنایت|جنایی|کالبدشکافی|جسد|سم‌شناسی|چاقو|تیراندازی|خون|ضرب و جرح|مسمومیت|سیانور/i.test(textToScan);
  const isFamilyOrInheritance = /ارث|سهم‌الارث|وصیت|وراثت|خانوادگی|مهریه|نفقه|طلاق|فرزند|ماترک|نسب|حضانت/i.test(textToScan);
  const isFinancialOrTheft = !isHomicideOrPhysical && /دزدی|سرقت|کلاهبرداری|اختلاس|مالی|چک|پول|سکه|طلا|بانک|حسابداری|ملک|زمین|هرمی|امضا|قرارداد|فاکتور|جعل|تجاری/i.test(textToScan);

  // Fallback defaults based on genre
  let defaults: DynamicCaseLabels;

  if (isHomicideOrPhysical) {
    defaults = {
      caseClassification: 'محرمانه - دادگاه کیفری یک امور جنایی و قتل',
      investigationTitle: 'گزارش کلانتری، بازپرس ویژه قتل و اداره آگاهی',
      victimOrPartyLabel: 'مقتول و قربانی جنایت:',
      briefingTitle: 'شرح صحنه جنایت و خلاصه ماجرای قتل:',
      expertReportTitle: 'گزارش پزشکی قانونی و تالار تشریح',
      expertBadge: 'اسناد کالبدشکافی و آزمایشگاه جنایی',
      timeLabel: 'زمان تقریبی وقوع جنایت و فوت:',
      causeOrMethodLabel: 'علت تامه فوت و شگرد جنایت:',
      analysisLabel: 'نتایج سم‌شناسی، آسیب‌شناسی و معاینات بالینی:',
      damagesOrInjuriesLabel: 'جراحات، صدمات و آثار ضرب و جرح مکشوفه:',
      expertNoteLabel: 'نکته کلیدی و محرمانه پزشک قانونی:',
      evidenceSectionTitle: 'شواهد مادی، فیزیکی و آزمایشگاهی صحنه جرم',
      relationLabel: 'نسبت و ارتباط با مقتول:',
      courtBranchTitle: 'دادگاه کیفری یک استان (شعبه ویژه قتل)',
    };
  } else if (isFamilyOrInheritance) {
    defaults = {
      caseClassification: 'محرمانه - شعبه ویژه دادگاه حقوقی و امور حسبی',
      investigationTitle: 'گزارش مددکاری و تحقیقات اولیه مراجع قضایی',
      victimOrPartyLabel: 'خواهان پرونده / متوفی ماترک:',
      briefingTitle: 'شرح اختلاف خانوادگی و موضوع ادعای طرفین:',
      expertReportTitle: 'گزارش کارشناسی رسمی خط، امضا و اسناد ملکی',
      expertBadge: 'مستندات ثبتی و اسناد رسمی',
      timeLabel: 'تاریخ تنظیم سند / شروع مناقشه ورثه:',
      causeOrMethodLabel: 'ریشه اصلی اختلاف و ادعای جعل یا تضییع حق:',
      analysisLabel: 'بررسی اصالت دست‌خط، وصیت‌نامه و امضاها:',
      damagesOrInjuriesLabel: 'ماترک، پلاک‌های ثبتی و حقوق مورد مناقشه:',
      expertNoteLabel: 'نظریه کارشناس رسمی خط‌شناسی و املاک:',
      evidenceSectionTitle: 'اسناد رسمی، وصیت‌نامه‌ها و مدارک ثبتی',
      relationLabel: 'نسبت با خواهان / متوفی:',
      courtBranchTitle: 'شعبه ویژه دادگاه حقوقی و خانواده',
    };
  } else if (isFinancialOrTheft) {
    defaults = {
      caseClassification: 'محرمانه - دادگاه ویژه رسیدگی به جرایم اقتصادی و سرقت',
      investigationTitle: 'گزارش پلیس آگاهی و ممیزی مالی دادسرا',
      victimOrPartyLabel: 'شاکی / مال‌باخته و متضرر مالی:',
      briefingTitle: 'شرح ماجرای تخلف مالی/سرقت و چگونگی کشف:',
      expertReportTitle: 'گزارش حسابرسی رسمی، ردزنی تراکنش‌ها و خط‌شناسی',
      expertBadge: 'مستندات حسابرسی و بانکی',
      timeLabel: 'زمان وقوع سرقت / تراکنش‌های مشکوک اولیه:',
      causeOrMethodLabel: 'شگرد و شیوه ارتکاب جرم / سرقت:',
      analysisLabel: 'ردیابی حساب‌های مقصد و اصالت‌سنجی فاکتورها:',
      damagesOrInjuriesLabel: 'اموال مسروقه، چک‌ها و مبالغ کسری صندوق:',
      expertNoteLabel: 'نکته کلیدی حسابرس رسمی و مأمور پرونده:',
      evidenceSectionTitle: 'اسناد مالی، پرینت‌های بانکی و شواهد دیجیتالی',
      relationLabel: 'ارتباط با مالباخته / شاکی:',
      courtBranchTitle: 'دادگاه ویژه رسیدگی به جرایم اقتصادی و سرقت',
    };
  } else {
    defaults = {
      caseClassification: 'محرمانه - دادگاه عمومی و کیفری',
      investigationTitle: 'گزارش کلانتری و بازرسی قضایی',
      victimOrPartyLabel: 'شاکی / متضرر اصلی پرونده:',
      briefingTitle: 'شرح ماجرا و گردش‌کار مقدماتی:',
      expertReportTitle: 'گزارش ارزیابی کارشناسی تخصصی',
      expertBadge: 'مستندات و نظریه کارشناس',
      timeLabel: 'زمان و تاریخ وقوع واقعه:',
      causeOrMethodLabel: 'شگرد و شیوه وقوع بزه:',
      analysisLabel: 'نتایج بررسی کارشناسی و ممیزی:',
      damagesOrInjuriesLabel: 'صدمات، خسارات و موضوعات مورد ادعا:',
      expertNoteLabel: 'نکته کلیدی کارشناس رسمی دادگستری:',
      evidenceSectionTitle: 'مدارک، اسناد و شواهد مکشوفه',
      relationLabel: 'ارتباط با شاکی و پرونده:',
      courtBranchTitle: 'دادگاه تخصصی کیفری و حقوقی',
    };
  }

  // Merge Gemini custom headers on top of defaults
  return {
    caseClassification: custom?.caseClassification || defaults.caseClassification,
    investigationTitle: custom?.investigationTitle || defaults.investigationTitle,
    victimOrPartyLabel: custom?.victimOrPartyLabel || defaults.victimOrPartyLabel,
    briefingTitle: custom?.briefingTitle || defaults.briefingTitle,
    expertReportTitle: custom?.expertReportTitle || defaults.expertReportTitle,
    expertBadge: custom?.expertBadge || defaults.expertBadge,
    timeLabel: custom?.timeLabel || defaults.timeLabel,
    causeOrMethodLabel: custom?.causeOrMethodLabel || defaults.causeOrMethodLabel,
    analysisLabel: custom?.analysisLabel || defaults.analysisLabel,
    damagesOrInjuriesLabel: custom?.damagesOrInjuriesLabel || defaults.damagesOrInjuriesLabel,
    expertNoteLabel: custom?.expertNoteLabel || defaults.expertNoteLabel,
    evidenceSectionTitle: custom?.evidenceSectionTitle || defaults.evidenceSectionTitle,
    relationLabel: custom?.relationLabel || defaults.relationLabel,
    courtBranchTitle: custom?.courtBranchTitle || defaults.courtBranchTitle,
  };
}
