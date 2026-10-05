import { SavedCaseState } from '../types.ts';

const ACTIVE_SAVE_KEY = 'mr_judge_active_case_save';
const ARCHIVE_SAVES_KEY = 'mr_judge_archived_cases_history';

/**
 * Save current active case session progress
 */
export function saveActiveCaseSession(state: Omit<SavedCaseState, 'savedAt' | 'messageCount'>): void {
  try {
    const fullSave: SavedCaseState = {
      ...state,
      savedAt: new Date().toISOString(),
      messageCount: state.courtroomMessages.length,
    };
    localStorage.setItem(ACTIVE_SAVE_KEY, JSON.stringify(fullSave));
  } catch (err) {
    console.error('Failed to save active case session:', err);
  }
}

/**
 * Get active saved case session if exists
 */
export function getActiveCaseSession(): SavedCaseState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SAVE_KEY);
    if (!raw) return null;
    const parsed: SavedCaseState = JSON.parse(raw);
    if (parsed && parsed.caseData && parsed.caseData.id) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse active case session:', err);
  }
  return null;
}

/**
 * Clear the active saved case session (e.g., when case is finished or discarded)
 */
export function clearActiveCaseSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SAVE_KEY);
  } catch (err) {
    console.error('Failed to clear active case session:', err);
  }
}

/**
 * Archive a case session into history
 */
export function archiveCaseSession(state: SavedCaseState): void {
  try {
    const rawHistory = localStorage.getItem(ARCHIVE_SAVES_KEY);
    let history: SavedCaseState[] = rawHistory ? JSON.parse(rawHistory) : [];
    // Remove duplicate if exists
    history = history.filter((h) => h.id !== state.id && h.caseData.id !== state.caseData.id);
    // Unshift new item
    history.unshift(state);
    // Limit to 10 recent items
    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem(ARCHIVE_SAVES_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to archive case session:', err);
  }
}

/**
 * Get archived cases history
 */
export function getArchivedCasesHistory(): SavedCaseState[] {
  try {
    const rawHistory = localStorage.getItem(ARCHIVE_SAVES_KEY);
    if (!rawHistory) return [];
    return JSON.parse(rawHistory);
  } catch (err) {
    console.error('Failed to load archived cases history:', err);
    return [];
  }
}

/**
 * Delete a specific archived case from history
 */
export function deleteArchivedCase(id: string): void {
  try {
    const history = getArchivedCasesHistory().filter((h) => h.id !== id && h.caseData.id !== id);
    localStorage.setItem(ARCHIVE_SAVES_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to delete archived case:', err);
  }
}
