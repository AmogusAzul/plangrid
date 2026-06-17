import { normalizeSearchText } from "./normalize";

const SEARCH_SYNONYMS: Record<string, string[]> = {
  ai: ["inteligencia artificial", "machine learning", "aprendizaje automatico"],
  ml: ["machine learning", "aprendizaje automatico"],
  db: ["bases de datos", "database"],
  database: ["bases de datos"],
  algorithms: ["algoritmos"],
  algoritmos: ["algorithms"],
  software: ["desarrollo de software", "ingenieria de software"],
  security: ["seguridad", "ciberseguridad"],
  emprendimiento: ["innovacion", "empresa"],
};

export function expandSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const expanded = new Set([query.trim()]);
  const tokens = normalized.split(/\s+/);

  for (const token of tokens) {
    for (const synonym of SEARCH_SYNONYMS[token] ?? []) {
      expanded.add(`${query.trim()} ${synonym}`);
    }
  }

  return [...expanded].slice(0, 4);
}
