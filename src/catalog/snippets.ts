import type { CatalogCourse } from "../models/catalogCourse";
import { foldAccents, normalizeSearchText } from "./normalize";

function includesFolded(text: string, query: string): boolean {
  return foldAccents(text).toLocaleLowerCase("es-CO")
    .includes(foldAccents(query).toLocaleLowerCase("es-CO"));
}

export function getCatalogSnippet(
  course: CatalogCourse,
  query: string,
  maxLength = 260,
): string | undefined {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return undefined;

  const blocks = course.description
    .split(/(?<=[.!?])\s+|\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const matched =
    blocks.find((block) =>
      queryTokens.every((token) => includesFolded(block, token)),
    ) ??
    blocks.find((block) =>
      includesFolded(block, normalizedQuery) ||
      queryTokens.some((token) => includesFolded(block, token)),
    ) ??
    blocks[0] ??
    course.title;

  const compact = matched.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;

  return `${compact.slice(0, maxLength - 1).trim()}…`;
}
