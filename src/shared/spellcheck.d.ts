declare module 'nspell' {
  export interface NSpellInstance {
    correct(word: string): boolean;
    suggest(word: string): string[];
    spell(word: string): { correct: boolean; forbidden: boolean; warn: boolean };
    add(word: string, model?: string): NSpellInstance;
    remove(word: string): NSpellInstance;
    personal(dic: string): NSpellInstance;
  }

  export default function nspell(aff: string, dic: string): NSpellInstance;
}
