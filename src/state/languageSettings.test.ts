import { describe, expect, it } from "vitest";
import {
  dismissLanguagePrompt,
  LANGUAGE_PROMPT_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  loadLanguageSettings,
  saveLanguageSettings,
  updateLanguage,
} from "./languageSettings";

describe("language settings", () => {
  it("defaults to English before the first-use prompt is seen", () => {
    const storage = new MapStorage();

    expect(loadLanguageSettings(storage)).toEqual({
      language: "en",
      hasSeenLanguagePrompt: false,
    });
  });

  it("persists a Spanish language choice and marks the prompt as seen", () => {
    const storage = new MapStorage();
    const settings = updateLanguage("es");

    saveLanguageSettings(settings, storage);

    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");
    expect(storage.getItem(LANGUAGE_PROMPT_STORAGE_KEY)).toBe("true");
    expect(loadLanguageSettings(storage)).toEqual({
      language: "es",
      hasSeenLanguagePrompt: true,
    });
  });

  it("can dismiss the first-use prompt while keeping English", () => {
    expect(dismissLanguagePrompt({
      language: "en",
      hasSeenLanguagePrompt: false,
    })).toEqual({
      language: "en",
      hasSeenLanguagePrompt: true,
    });
  });
});

class MapStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
