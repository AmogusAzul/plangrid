import { describe, expect, it } from "vitest";
import type { CatalogCourse } from "../models/catalogCourse";
import { getCatalogSnippet } from "./snippets";

const course: CatalogCourse = {
  code: "ISIS-1105",
  normalizedCode: "ISIS-1105",
  title: "Diseño y Análisis de Algoritmos",
  credits: 3,
  departmentCode: "ISIS",
  description:
    "Este curso cubre grafos. También estudia programación dinámica aplicada a optimización.",
  catalogYear: "2026",
  source: "smartcatalog",
  searchableText: "",
};

describe("catalog snippets", () => {
  it("selects a short accent-insensitive snippet containing the query", () => {
    expect(getCatalogSnippet(course, "programacion dinamica")).toContain(
      "programación dinámica",
    );
  });

  it("falls back to the first description block", () => {
    expect(getCatalogSnippet(course, "machine learning")).toContain(
      "Este curso cubre grafos",
    );
  });
});
