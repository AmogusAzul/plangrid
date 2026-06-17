export type SearchAppearanceSettings = {
  useMutedCatalogOnlyCards: boolean;
};

export const SEARCH_APPEARANCE_STORAGE_KEY =
  "plangrid.settings.searchAppearance.v1";

export const defaultSearchAppearanceSettings: SearchAppearanceSettings = {
  useMutedCatalogOnlyCards: true,
};
