import type {
  CatalogCourse,
  CatalogIndexFile,
} from "../models/catalogCourse";

export function foldAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeSearchText(value: string): string {
  return foldAccents(value)
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-CO");
}

export function normalizeCourseCode(value: string): string {
  const clean = foldAccents(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const match = /^([A-Z]{3,5})([0-9][A-Z0-9]{2,5})$/.exec(clean);

  return match ? `${match[1]}-${match[2]}` : value.trim().toUpperCase();
}

export function departmentFromCode(code: string): string {
  return normalizeCourseCode(code).split("-", 1)[0] ?? "";
}

export function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function catalogSummary(course: CatalogCourse) {
  return {
    title: course.title,
    description: course.description,
    departmentCode: course.departmentCode,
    departmentName: course.departmentName,
    catalogUrl: course.catalogUrl,
    catalogYear: course.catalogYear,
  };
}

export function validateCatalogIndex(value: unknown): CatalogIndexFile {
  if (!value || typeof value !== "object") {
    throw new Error("Catalog index must be an object.");
  }

  const candidate = value as Partial<CatalogIndexFile>;
  const validCourses =
    Array.isArray(candidate.courses) &&
    candidate.courses.every((course) =>
      Boolean(course) &&
      typeof course.code === "string" &&
      typeof course.normalizedCode === "string" &&
      typeof course.title === "string" &&
      (course.credits === null || typeof course.credits === "number") &&
      typeof course.departmentCode === "string" &&
      typeof course.description === "string" &&
      course.catalogYear === "2026" &&
      course.source === "smartcatalog" &&
      typeof course.searchableText === "string",
    );

  if (
    candidate.version !== 1 ||
    candidate.catalogYear !== "2026" ||
    typeof candidate.generatedAt !== "string" ||
    typeof candidate.sourceUrl !== "string" ||
    !validCourses
  ) {
    throw new Error("Catalog index is invalid.");
  }

  return candidate as CatalogIndexFile;
}
