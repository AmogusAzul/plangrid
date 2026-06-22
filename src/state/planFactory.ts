import type { Course, PlannedCourse } from "../models/course";
import type { PlanSemester, StudyPlan } from "../models/studyPlan";

export const DEFAULT_SEMESTER_COUNT = 8;
export const DEFAULT_CREDIT_LIMIT = 21;
export const DEFAULT_FIRST_TERM = "2026-20";

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nextRegularTerm(term: string): string {
  const match = /^(\d{4})-(10|20)$/.exec(term);

  if (!match) {
    throw new Error(`Invalid regular term: ${term}`);
  }

  const year = Number(match[1]);
  return match[2] === "10" ? `${year}-20` : `${year + 1}-10`;
}

export function isRegularTerm(term: string): boolean {
  return /^\d{4}-(10|20)$/.test(term);
}

export function cascadeSemesterTerms(
  plan: StudyPlan,
  startIndex: number,
  firstTerm: string,
): StudyPlan {
  const term = firstTerm.trim();

  if (!isRegularTerm(term)) {
    throw new Error(`Invalid regular term: ${firstTerm}`);
  }

  if (startIndex < 0 || startIndex >= plan.semesters.length) {
    return plan;
  }

  let nextTerm = term;
  const semesters = plan.semesters.map((semester, index) => {
    if (index < startIndex) {
      return semester;
    }

    const updatedSemester = {
      ...semester,
      termHint: nextTerm,
    };
    nextTerm = nextRegularTerm(nextTerm);
    return updatedSemester;
  });

  return {
    ...plan,
    semesters,
  };
}

export function updateSemesterTerm(
  plan: StudyPlan,
  semesterId: string,
  term: string,
): StudyPlan {
  const semesterIndex = plan.semesters.findIndex(
    (semester) => semester.id === semesterId,
  );

  return cascadeSemesterTerms(plan, semesterIndex, term);
}

export function createSemesters(
  count: number,
  firstTerm = DEFAULT_FIRST_TERM,
): PlanSemester[] {
  const semesters: PlanSemester[] = [];
  let term = firstTerm;

  for (let index = 0; index < count; index += 1) {
    semesters.push({
      id: createId(),
      label: `Semester ${index + 1}`,
      termHint: term,
      courses: [],
    });
    term = nextRegularTerm(term);
  }

  return semesters;
}

export function createBlankPlan(
  semesterCount = DEFAULT_SEMESTER_COUNT,
): StudyPlan {
  const now = new Date().toISOString();

  return {
    id: createId(),
    name: "My PlanGrid",
    createdAt: now,
    updatedAt: now,
    creditLimitPerSemester: DEFAULT_CREDIT_LIMIT,
    semesters: createSemesters(semesterCount),
    storage: [],
    recognizedRequirementIds: [],
  };
}

export function toPlannedCourse(course: Course): PlannedCourse {
  return {
    ...course,
    id: createId(),
  };
}

export function resizeSemesters(
  plan: StudyPlan,
  requestedCount: number,
): StudyPlan {
  const count = Math.min(16, Math.max(1, Math.trunc(requestedCount)));

  if (count === plan.semesters.length) {
    return plan;
  }

  const semesters = plan.semesters.slice(0, count);
  const removedCourses = plan.semesters
    .slice(count)
    .flatMap((semester) => semester.courses);

  if (count > semesters.length) {
    let term = semesters.at(-1)?.termHint ?? DEFAULT_FIRST_TERM;

    if (semesters.length > 0) {
      term = nextRegularTerm(term);
    }

    while (semesters.length < count) {
      semesters.push({
        id: createId(),
        label: `Semester ${semesters.length + 1}`,
        termHint: term,
        courses: [],
      });
      term = nextRegularTerm(term);
    }
  }

  return {
    ...plan,
    semesters,
    storage: [...plan.storage, ...removedCourses],
  };
}
