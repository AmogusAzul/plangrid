export type AppLanguage = "en" | "es";

export type LanguageSettings = {
  language: AppLanguage;
  hasSeenLanguagePrompt: boolean;
};

export const LANGUAGE_STORAGE_KEY = "plangrid.language.v1";
export const LANGUAGE_PROMPT_STORAGE_KEY = "plangrid.languagePromptSeen.v1";

export const appLanguages: Array<{
  id: AppLanguage;
  label: string;
  nativeLabel: string;
}> = [
  { id: "en", label: "English", nativeLabel: "English" },
  { id: "es", label: "Spanish", nativeLabel: "Español" },
];

export const defaultLanguageSettings: LanguageSettings = {
  language: "en",
  hasSeenLanguagePrompt: false,
};

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === "en" || value === "es";
}

export function loadLanguageSettings(
  storage: Storage = localStorage,
): LanguageSettings {
  const storedLanguage = storage.getItem(LANGUAGE_STORAGE_KEY);
  return {
    language: isAppLanguage(storedLanguage)
      ? storedLanguage
      : defaultLanguageSettings.language,
    hasSeenLanguagePrompt:
      storage.getItem(LANGUAGE_PROMPT_STORAGE_KEY) === "true",
  };
}

export function saveLanguageSettings(
  settings: LanguageSettings,
  storage: Storage = localStorage,
): LanguageSettings {
  storage.setItem(LANGUAGE_STORAGE_KEY, settings.language);
  storage.setItem(
    LANGUAGE_PROMPT_STORAGE_KEY,
    String(settings.hasSeenLanguagePrompt),
  );
  return settings;
}

export function updateLanguage(
  language: AppLanguage,
): LanguageSettings {
  return {
    language,
    hasSeenLanguagePrompt: true,
  };
}

export function dismissLanguagePrompt(
  settings: LanguageSettings,
): LanguageSettings {
  return {
    ...settings,
    hasSeenLanguagePrompt: true,
  };
}
