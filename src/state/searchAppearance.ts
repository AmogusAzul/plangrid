import {
  defaultSearchAppearanceSettings,
  SEARCH_APPEARANCE_STORAGE_KEY,
  type SearchAppearanceSettings,
} from "../models/searchAppearance";

function isSearchAppearanceSettings(
  value: unknown,
): value is SearchAppearanceSettings {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as SearchAppearanceSettings).useMutedCatalogOnlyCards ===
      "boolean"
  );
}

export function loadSearchAppearanceSettings(
  storage: Storage = localStorage,
): SearchAppearanceSettings {
  try {
    const raw = storage.getItem(SEARCH_APPEARANCE_STORAGE_KEY);
    if (!raw) return defaultSearchAppearanceSettings;

    const parsed: unknown = JSON.parse(raw);
    return isSearchAppearanceSettings(parsed)
      ? parsed
      : defaultSearchAppearanceSettings;
  } catch {
    return defaultSearchAppearanceSettings;
  }
}

export function saveSearchAppearanceSettings(
  settings: SearchAppearanceSettings,
  storage: Storage = localStorage,
): SearchAppearanceSettings {
  storage.setItem(SEARCH_APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
  return settings;
}
