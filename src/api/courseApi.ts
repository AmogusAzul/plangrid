import type { Course } from "../models/course";

export const COURSE_API_URL =
  "https://ofertadecursos.uniandes.edu.co/api/courses";

export type RawCourseOffering = {
  class?: unknown;
  course?: unknown;
  credits?: unknown;
  title?: unknown;
};

type FetchCourseApi = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class CourseApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseApiError";
  }
}

export function parseCourseSearchInput(input: string): {
  prefix: string;
  query: string;
} {
  const clean = input.trim().toUpperCase();
  const codeMatch = /^([A-Z]{3,5})[-\s]?([0-9][A-Z0-9]{2,5})$/.exec(clean);

  if (codeMatch) {
    return {
      prefix: codeMatch[1],
      query: codeMatch[2],
    };
  }

  return {
    prefix: "",
    query: clean,
  };
}

export function normalizeCourseOfferings(rows: RawCourseOffering[]): Course[] {
  const courses = new Map<string, Course>();

  for (const row of rows) {
    const department =
      typeof row.class === "string" ? row.class.trim().toUpperCase() : "";
    const number =
      typeof row.course === "string" ? row.course.trim().toUpperCase() : "";
    const name = typeof row.title === "string" ? row.title.trim() : "";
    const credits =
      typeof row.credits === "string" || typeof row.credits === "number"
        ? Number(row.credits)
        : Number.NaN;

    if (
      !department ||
      !number ||
      !name ||
      !Number.isFinite(credits) ||
      credits < 0
    ) {
      continue;
    }

    const code = `${department}-${number}`;
    if (!courses.has(code)) {
      courses.set(code, {
        code,
        name,
        credits,
        department,
      });
    }
  }

  return [...courses.values()];
}

function createSearchUrl(input: string): URL {
  const { prefix, query } = parseCourseSearchInput(input);
  const url = new URL(COURSE_API_URL);
  const parameters: Record<string, string> = {
    term: "",
    ptrm: "",
    prefix,
    attr: "",
    nameInput: query,
    campus: "",
    attrs: "",
    timeStart: "",
    offset: "0",
    limit: "25",
    courseQuotas: "",
    days: "",
    courseRestrictions: "",
    programNew: "",
    profesorName: "",
  };

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }

  return url;
}

export async function searchCourses(
  query: string,
  fetchApi: FetchCourseApi = fetch,
): Promise<Course[]> {
  if (!query.trim()) return [];

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 12_000);
  let response: Response;

  try {
    response = await fetchApi(createSearchUrl(query), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    throw new CourseApiError(
      "The Uniandes course service could not be reached.",
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new CourseApiError(
      `The Uniandes course service returned status ${response.status}.`,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new CourseApiError(
      "The Uniandes course service returned invalid JSON.",
    );
  }

  if (!Array.isArray(payload)) {
    throw new CourseApiError(
      "The Uniandes course service returned an unexpected response.",
    );
  }

  return normalizeCourseOfferings(payload);
}

export async function getCourseByCode(
  code: string,
  fetchApi: FetchCourseApi = fetch,
): Promise<Course | null> {
  const parsedCode = parseCourseSearchInput(code);
  const normalizedCode = parsedCode.prefix
    ? `${parsedCode.prefix}-${parsedCode.query}`
    : code.trim().toUpperCase().replace(/\s+/, "-");
  const courses = await searchCourses(normalizedCode, fetchApi);

  return courses.find((course) => course.code === normalizedCode) ?? null;
}
