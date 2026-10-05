export type CharacterRole = 'defendant' | 'plaintiff' | 'defense_lawyer' | 'expert' | 'witness';

export interface EvidenceItem {
  id: string;
  title: string;
  type: 'physical' | 'document' | 'digital' | 'forensic';
  description: string;
  foundAt: string;
  significance: string;
  iconName?: string;
  labReport?: string;
}

export interface Character {
  id: string;
  name: string;
  role: CharacterRole;
  roleTitle: string; // e.g. "متهم اصلی", "شاکی پرونده", "وکیل مدافع", "پزشک قانونی", "شاهد عینی"
  age: number;
  occupation: string;
  relationToVictim: string;
  personality: string;
  avatarDescription?: string;
  avatarMood?: 'neutral' | 'nervous' | 'angry' | 'smug' | 'broken';
  initialStatement: string;
  suspicionLevel: number; // 0 to 100
  isLying: boolean;
  deceptionStrategy?: string; // strategy to fool the judge
  vulnerabilities?: string[]; // contradictory evidence that breaks their story
  temperament?: 'calm' | 'anxious' | 'normal';
}

export interface AutopsyReport {
  timeOfDeath: string;
  causeOfDeath: string;
  toxicology: string;
  injuries: string[];
  coronerNotes: string;
}

export interface HiddenTruth {
  realCulpritId: string;
  realCulpritName: string;
  motive: string;
  howCrimeHappened: string;
  keyContradiction: string;
  accomplices?: string;
}

export interface CaseHeaders {
  caseClassification?: string;
  investigationTitle?: string;
  victimOrPartyLabel?: string;
  briefingTitle?: string;
  expertReportTitle?: string;
  expertBadge?: string;
  timeLabel?: string;
  causeOrMethodLabel?: string;
  analysisLabel?: string;
  damagesOrInjuriesLabel?: string;
  expertNoteLabel?: string;
  evidenceSectionTitle?: string;
  relationLabel?: string;
  courtBranchTitle?: string;
}

export interface RealWorldHistoricalInfo {
  isRealCase: boolean;
  realCaseName: string; // e.g. "پرونده محاکمه قرن: او.جی. سیمپسون"
  historicalDate: string; // e.g. "۱۹۹۴ - ۱۹۹۵ میلادی"
  historicalLocation: string; // e.g. "لس‌آنجلس، ایالات متحده آمریکا"
  actualCourtVerdict: string; // The actual verdict of the real court
  actualSentence: string; // The real punishment / outcome
  historicalEpilogue: string; // What happened in reality afterwards
  historicalSignificance?: string;
}

export interface HistoricalComparison {
  actualCourtVerdict: string;
  actualSentence: string;
  divergencePercentage: number; // 0 to 100
  matchSummary: string;
  historicalAnalysis: string;
  realWorldEpilogue: string;
}

export interface CaseDossier {
  id: string;
  caseNumber: string; // e.g. "۱۴۰۵/۸۲۹-ج"
  title: string;
  genre: string;
  incidentDate: string;
  location: string;
  victimName: string;
  victimBackground: string;
  briefing: string;
  autopsyReport: AutopsyReport;
  evidence: EvidenceItem[];
  characters: Character[];
  hiddenTruth: HiddenTruth;
  customHeaders?: CaseHeaders;
  allowsLiveConfession?: boolean;
  realWorldInfo?: RealWorldHistoricalInfo;
}

export interface InterrogationMessage {
  id: string;
  sender: 'judge' | 'character' | 'lawyer' | 'dispute_character';
  senderName: string;
  characterId?: string;
  text: string;
  innerThought?: string;
  timestamp: string;
  evidencePresented?: EvidenceItem;
  stressDelta?: number;
  slipUp?: string;
  isConfession?: boolean;
}

export interface IndividualCharacterVerdict {
  characterId: string;
  characterName: string;
  status: 'guilty' | 'acquitted' | 'witness_cleared' | 'investigate_further';
  chargeAndPenalty: string;
}

export interface VerdictResult {
  isCorrect: boolean;
  justiceRating: number; // 0 to 100
  truthRevealed: string;
  feedback: string;
  deceptionBusted: boolean;
  epilogue: string;
  culpritConfession?: string;
  chargeName?: string;
  penaltyApplied?: string;
  individualEvaluations?: Array<{
    characterId?: string;
    characterName: string;
    statusSummary: string;
    isCorrectVerdict: boolean;
    note: string;
  }>;
  historicalComparison?: HistoricalComparison;
}

export interface ConsultationMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface SavedCaseState {
  id: string;
  caseData: CaseDossier;
  courtroomMessages: InterrogationMessage[];
  activeCharacterId: string;
  characterStressMap: Record<string, number>;
  currentTab: 'dossier' | 'court' | 'verdict';
  savedAt: string;
  messageCount: number;
}
