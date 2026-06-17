import { describe, expect, it } from "vitest";
import {
  normalizeCourseCode,
  normalizeSearchText,
  validateCatalogIndex,
} from "./normalize";

describe("catalog normalization", () => {
  it("normalizes course codes and accent-folded search text", () => {
    expect(normalizeCourseCode("isis1225")).toBe("ISIS-1225");
    expect(normalizeCourseCode("ISIS 1225")).toBe("ISIS-1225");
    expect(normalizeSearchText("Programación dinámica")).toBe(
      "programacion dinamica",
    );
  });

  it("rejects malformed catalog index files", () => {
    expect(() => validateCatalogIndex({ version: 1 })).toThrow(
      "Catalog index is invalid.",
    );
  });
});
