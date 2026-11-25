import { NoteSpellCheckLang } from '../shared/types';
import type {
  SpellWorkerCheckResponse,
  SpellWorkerPreloadResponse,
  SpellWorkerRequest,
  SpellWorkerResponse,
  SpellWorkerSuggestResponse,
} from './spellcheckWorker';

export type SpellCheckEngineStatus = 'idle' | 'loading' | 'ready' | 'error';

function resolveDictionaryUrls(lang: NoteSpellCheckLang): {
  affUrl: string;
  dicUrl: string;
} {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return {
      affUrl: chrome.runtime.getURL(`dictionaries/${lang}.aff`),
      dicUrl: chrome.runtime.getURL(`dictionaries/${lang}.dic`),
    };
  }
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return {
    affUrl: `${base}/dictionaries/${lang}.aff`,
    dicUrl: `${base}/dictionaries/${lang}.dic`,
  };
}

interface PendingEntry {
  resolve: (value: SpellWorkerResponse) => void;
  reject: (reason?: unknown) => void;
}

class SpellcheckClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingEntry>();
  private statusByLang = new Map<NoteSpellCheckLang, SpellCheckEngineStatus>();
  private listeners = new Set<() => void>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(
      new URL('./spellcheckWorker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.addEventListener(
      'message',
      (event: MessageEvent<SpellWorkerResponse>) => {
        const resp = event.data;
        if (!resp) return;
        const entry = this.pending.get(resp.id);
        if (entry) {
          this.pending.delete(resp.id);
          entry.resolve(resp);
        }
      }
    );
    worker.addEventListener('error', (err) => {
      for (const [, entry] of this.pending) {
        entry.reject(err);
      }
      this.pending.clear();
      this.worker = null;
      this.statusByLang.set('fr', 'error');
      this.statusByLang.set('en', 'error');
      this.notifyListeners();
    });
    this.worker = worker;
    return worker;
  }

  private send<T extends SpellWorkerResponse>(
    payload: Omit<SpellWorkerRequest, 'id'>
  ): Promise<T> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (resp) => resolve(resp as T),
        reject,
      });
      worker.postMessage({ ...payload, id } as SpellWorkerRequest);
    });
  }

  private setStatus(lang: NoteSpellCheckLang, status: SpellCheckEngineStatus) {
    if (this.statusByLang.get(lang) === status) return;
    this.statusByLang.set(lang, status);
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const fn of this.listeners) {
      fn();
    }
  }

  public getStatus(lang: NoteSpellCheckLang): SpellCheckEngineStatus {
    return this.statusByLang.get(lang) ?? 'idle';
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async preload(lang: NoteSpellCheckLang): Promise<boolean> {
    if (this.statusByLang.get(lang) === 'ready') return true;
    this.setStatus(lang, 'loading');
    const { affUrl, dicUrl } = resolveDictionaryUrls(lang);
    try {
      const resp = await this.send<SpellWorkerPreloadResponse>({
        type: 'preload',
        lang,
        affUrl,
        dicUrl,
      } as Omit<SpellWorkerRequest, 'id'>);
      if (resp.ok) {
        this.setStatus(lang, 'ready');
        return true;
      }
      this.setStatus(lang, 'error');
      return false;
    } catch {
      this.setStatus(lang, 'error');
      return false;
    }
  }

  public async checkWords(
    lang: NoteSpellCheckLang,
    words: string[],
    ignoredWords: string[]
  ): Promise<Set<string>> {
    if (words.length === 0) return new Set();
    if (this.statusByLang.get(lang) !== 'ready') {
      this.setStatus(lang, 'loading');
    }
    const { affUrl, dicUrl } = resolveDictionaryUrls(lang);
    const resp = await this.send<SpellWorkerCheckResponse>({
      type: 'check',
      lang,
      affUrl,
      dicUrl,
      words,
      ignoredWords,
    } as Omit<SpellWorkerRequest, 'id'>);
    if (resp.error) {
      this.setStatus(lang, 'error');
      return new Set();
    }
    this.setStatus(lang, 'ready');
    return new Set(resp.misspelled);
  }

  public async getSuggestions(
    lang: NoteSpellCheckLang,
    word: string,
    ignoredWords: string[]
  ): Promise<string[]> {
    const { affUrl, dicUrl } = resolveDictionaryUrls(lang);
    const resp = await this.send<SpellWorkerSuggestResponse>({
      type: 'suggest',
      lang,
      affUrl,
      dicUrl,
      word,
      ignoredWords,
    } as Omit<SpellWorkerRequest, 'id'>);
    if (resp.error) return [];
    this.setStatus(lang, 'ready');
    return resp.suggestions;
  }
}

export const spellcheckClient = new SpellcheckClient();
