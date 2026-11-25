import nspell, { NSpellInstance } from 'nspell';
import { NoteSpellCheckLang } from '../shared/types';

export interface SpellWorkerPreloadRequest {
  id: number;
  type: 'preload';
  lang: NoteSpellCheckLang;
  affUrl: string;
  dicUrl: string;
}

export interface SpellWorkerCheckRequest {
  id: number;
  type: 'check';
  lang: NoteSpellCheckLang;
  affUrl: string;
  dicUrl: string;
  words: string[];
  ignoredWords: string[];
}

export interface SpellWorkerSuggestRequest {
  id: number;
  type: 'suggest';
  lang: NoteSpellCheckLang;
  affUrl: string;
  dicUrl: string;
  word: string;
  ignoredWords: string[];
}

export type SpellWorkerRequest =
  | SpellWorkerPreloadRequest
  | SpellWorkerCheckRequest
  | SpellWorkerSuggestRequest;

export interface SpellWorkerPreloadResponse {
  id: number;
  type: 'preloadResult';
  lang: NoteSpellCheckLang;
  ok: boolean;
  error?: string;
}

export interface SpellWorkerCheckResponse {
  id: number;
  type: 'checkResult';
  lang: NoteSpellCheckLang;
  misspelled: string[];
  error?: string;
}

export interface SpellWorkerSuggestResponse {
  id: number;
  type: 'suggestResult';
  lang: NoteSpellCheckLang;
  word: string;
  suggestions: string[];
  error?: string;
}

export type SpellWorkerResponse =
  | SpellWorkerPreloadResponse
  | SpellWorkerCheckResponse
  | SpellWorkerSuggestResponse;

const checkerCache = new Map<NoteSpellCheckLang, NSpellInstance>();
const loadingCache = new Map<NoteSpellCheckLang, Promise<NSpellInstance>>();

async function getChecker(
  lang: NoteSpellCheckLang,
  affUrl: string,
  dicUrl: string
): Promise<NSpellInstance> {
  const cached = checkerCache.get(lang);
  if (cached) return cached;

  const inflight = loadingCache.get(lang);
  if (inflight) return inflight;

  const loadPromise = (async () => {
    const [affRes, dicRes] = await Promise.all([fetch(affUrl), fetch(dicUrl)]);
    if (!affRes.ok || !dicRes.ok) {
      throw new Error(
        `Impossible de charger le dictionnaire ${lang} (${affRes.status}/${dicRes.status})`
      );
    }
    const [affText, dicText] = await Promise.all([
      affRes.text(),
      dicRes.text(),
    ]);
    const instance = nspell(affText, dicText);
    checkerCache.set(lang, instance);
    loadingCache.delete(lang);
    return instance;
  })().catch((err) => {
    loadingCache.delete(lang);
    throw err;
  });

  loadingCache.set(lang, loadPromise);
  return loadPromise;
}

function isWordCorrect(
  checker: NSpellInstance,
  word: string,
  ignoredSet: Set<string>
): boolean {
  const lower = word.toLowerCase();
  if (ignoredSet.has(lower)) return true;

  if (checker.correct(word)) return true;

  // Normalisation apostrophe courbe/droite (français & anglais)
  if (word.includes('’')) {
    const straight = word.replace(/’/g, "'");
    if (ignoredSet.has(straight.toLowerCase()) || checker.correct(straight)) {
      return true;
    }
  } else if (word.includes("'")) {
    const curly = word.replace(/'/g, '’');
    if (ignoredSet.has(curly.toLowerCase()) || checker.correct(curly)) {
      return true;
    }
  }

  // Mots composés avec trait d'union (ex: well-known, sous-tâche) :
  // si chaque segment non vide est valide individuellement, on accepte le mot composé.
  if (word.includes('-')) {
    const parts = word.split('-').filter(Boolean);
    if (
      parts.length >= 2 &&
      parts.every((part) => {
        if (part.length <= 1) return true;
        return isWordCorrect(checker, part, ignoredSet);
      })
    ) {
      return true;
    }
  }

  return false;
}

function getWordSuggestions(
  checker: NSpellInstance,
  word: string,
  maxSuggestions = 6
): string[] {
  const raw = checker.suggest(word);
  if (raw.length > 0) {
    return raw.slice(0, maxSuggestions);
  }
  if (word.includes('’')) {
    return checker.suggest(word.replace(/’/g, "'")).slice(0, maxSuggestions);
  }
  if (word.includes("'")) {
    return checker.suggest(word.replace(/'/g, '’')).slice(0, maxSuggestions);
  }
  return [];
}

self.addEventListener('message', async (event: MessageEvent<SpellWorkerRequest>) => {
  const req = event.data;
  if (!req) return;

  try {
    const checker = await getChecker(req.lang, req.affUrl, req.dicUrl);

    if (req.type === 'preload') {
      const resp: SpellWorkerPreloadResponse = {
        id: req.id,
        type: 'preloadResult',
        lang: req.lang,
        ok: true,
      };
      self.postMessage(resp);
      return;
    }

    if (req.type === 'check') {
      const ignoredSet = new Set(req.ignoredWords.map((w) => w.toLowerCase()));
      const misspelled: string[] = [];
      for (const word of req.words) {
        if (!isWordCorrect(checker, word, ignoredSet)) {
          misspelled.push(word);
        }
      }
      const resp: SpellWorkerCheckResponse = {
        id: req.id,
        type: 'checkResult',
        lang: req.lang,
        misspelled,
      };
      self.postMessage(resp);
      return;
    }

    if (req.type === 'suggest') {
      const suggestions = getWordSuggestions(checker, req.word, 6);
      const resp: SpellWorkerSuggestResponse = {
        id: req.id,
        type: 'suggestResult',
        lang: req.lang,
        word: req.word,
        suggestions,
      };
      self.postMessage(resp);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (req.type === 'preload') {
      self.postMessage({
        id: req.id,
        type: 'preloadResult',
        lang: req.lang,
        ok: false,
        error: message,
      } satisfies SpellWorkerPreloadResponse);
    } else if (req.type === 'check') {
      self.postMessage({
        id: req.id,
        type: 'checkResult',
        lang: req.lang,
        misspelled: [],
        error: message,
      } satisfies SpellWorkerCheckResponse);
    } else {
      self.postMessage({
        id: req.id,
        type: 'suggestResult',
        lang: req.lang,
        word: req.word,
        suggestions: [],
        error: message,
      } satisfies SpellWorkerSuggestResponse);
    }
  }
});
