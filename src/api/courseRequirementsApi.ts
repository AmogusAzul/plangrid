import type {
  CourseRequirementCheck,
  CourseRequirementReference,
  PrerequisiteRule,
} from "../models/courseRequirement";
import {
  findExactCourseOfferings,
  type RawCourseOffering,
} from "./courseApi";

export const COURSE_DETAILS_API_URL =
  "https://ofertadecursos.uniandes.edu.co/api/courseDetails";
export const REQUIREMENT_TERM = "202620" as const;

type FetchApi = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type RawCourseRequirement = {
  subject?: unknown;
  coursenumber?: unknown;
  title?: unknown;
};

export type RawPrerequisiteExpression = {
  code?: unknown;
  descr?: unknown;
};

export type RawCourseDetails = {
  nrc?: unknown;
  term?: unknown;
  ptrm?: unknown;
  class?: unknown;
  course?: unknown;
  coreq?: unknown;
  prereq?: unknown;
};

function normalizeCorequisite(
  raw: RawCourseRequirement,
): CourseRequirementReference | null {
  if (
    typeof raw.subject !== "string" ||
    typeof raw.coursenumber !== "string"
  ) {
    return null;
  }

  return {
    code: `${raw.subject.trim().toUpperCase()}-${raw.coursenumber.trim().toUpperCase()}`,
    title: typeof raw.title === "string" ? raw.title.trim() : "",
  };
}

function normalizePrerequisite(
  raw: RawPrerequisiteExpression,
): PrerequisiteRule | null {
  if (typeof raw.code !== "string") return null;
  return {
    codeExpression: raw.code.trim(),
    descriptionExpression:
      typeof raw.descr === "string" ? raw.descr.trim() : "",
  };
}

export function normalizeCourseDetails(
  raw: RawCourseDetails,
  checkedAt = new Date().toISOString(),
): CourseRequirementCheck {
  const corequisites = Array.isArray(raw.coreq)
    ? raw.coreq
        .map((item) => normalizeCorequisite(item as RawCourseRequirement))
        .filter((item): item is CourseRequirementReference => Boolean(item))
    : [];
  const prerequisites = Array.isArray(raw.prereq)
    ? raw.prereq
        .map((item) =>
          normalizePrerequisite(item as RawPrerequisiteExpression),
        )
        .filter((item): item is PrerequisiteRule => Boolean(item))
    : [];

  return {
    status: "loaded",
    term: REQUIREMENT_TERM,
    checkedAt,
    nrc: typeof raw.nrc === "string" ? raw.nrc : undefined,
    partOfTerm: typeof raw.ptrm === "string" ? raw.ptrm : undefined,
    prerequisites,
    corequisites,
  };
}

function offeringIdentity(
  offering: RawCourseOffering,
): { term: string; ptrm: string; nrc: string } | null {
  if (
    typeof offering.term !== "string" ||
    typeof offering.ptrm !== "string" ||
    typeof offering.nrc !== "string"
  ) {
    return null;
  }
  return {
    term: offering.term,
    ptrm: offering.ptrm,
    nrc: offering.nrc,
  };
}

export async function fetchCourseRequirements(
  code: string,
  fetchApi: FetchApi = fetch,
  offeringLookup = findExactCourseOfferings,
): Promise<CourseRequirementCheck> {
  const offerings = (await offeringLookup(code, fetchApi))
    .map(offeringIdentity)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 3);
  const checkedAt = new Date().toISOString();

  if (offerings.length === 0) {
    return {
      status: "not-offered",
      term: REQUIREMENT_TERM,
      checkedAt,
      prerequisites: [],
      corequisites: [],
    };
  }

  let lastError: unknown;
  for (const offering of offerings) {
    try {
      const url = new URL(COURSE_DETAILS_API_URL);
      url.search = new URLSearchParams(offering).toString();
      const response = await fetchApi(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        lastError = new Error(`Course details returned ${response.status}.`);
        continue;
      }

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") {
        lastError = new Error("Course details returned invalid data.");
        continue;
      }
      return normalizeCourseDetails(payload as RawCourseDetails, checkedAt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Course requirements could not be fetched.");
}
