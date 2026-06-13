import { getCourseByCode } from "../api/courseApi";
import type { Course, PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { createId, isRegularTerm } from "../state/planFactory";
import {
  getSemesterGridColumns,
  positionSemesterCourses,
} from "../state/semesterLayout";
import { downloadTextFile, getFileName } from "./common";

const FORMAT_VERSION = "1";
const FALLBACK_CREDITS = 3;

type CourseLookup = (code: string) => Promise<Course | null>;

export type ParsedPlanFile = {
  name: string;
  creditLimitPerSemester: number;
  semesters: Array<{
    label: string;
    termHint: string;
    courses: Array<{
      code: string;
      slotStart: number;
    }>;
  }>;
  storageCodes: string[];
};

export type ImportedPlan = {
  plan: StudyPlan;
  fallbackCodes: string[];
};

export class PlanFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanFileError";
  }
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function csvRow(values: Array<string | number>): string {
  return values.map(escapeCsv).join(",");
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new PlanFileError("Malformed quoted field in plan file.");
      }
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    throw new PlanFileError("Unclosed quoted field in plan file.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function getSections(rows: string[][]): Map<string, string[][]> {
  const sections = new Map<string, string[][]>();
  let currentSection: string | null = null;

  for (const row of rows) {
    if (row.every((cell) => cell.trim() === "")) continue;

    const sectionMatch =
      row.length === 1 ? /^\[([a-z]+)\]$/i.exec(row[0].trim()) : null;

    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase();
      if (sections.has(currentSection)) {
        throw new PlanFileError(`Duplicate [${currentSection}] section.`);
      }
      sections.set(currentSection, []);
      continue;
    }

    if (!currentSection) {
      throw new PlanFileError("Plan data appears before the first section.");
    }

    sections.get(currentSection)!.push(row);
  }

  return sections;
}

function requireSection(
  sections: Map<string, string[][]>,
  name: string,
): string[][] {
  const section = sections.get(name);
  if (!section) {
    throw new PlanFileError(`Missing required [${name}] section.`);
  }
  return section;
}

export function serializePlanFile(plan: StudyPlan): string {
  const slotCount = Math.max(
    plan.creditLimitPerSemester,
    ...plan.semesters.map((semester) =>
      getSemesterGridColumns(
        semester.courses,
        plan.creditLimitPerSemester,
      ),
    ),
  );
  const slotHeaders = Array.from(
    { length: slotCount },
    (_, index) => `slot_${index + 1}`,
  );
  const lines = [
    "[plan]",
    csvRow(["format_version", FORMAT_VERSION]),
    csvRow(["plan_name", plan.name]),
    csvRow(["credit_limit", plan.creditLimitPerSemester]),
    "",
    "[semesters]",
    csvRow(["semester", "term", ...slotHeaders]),
  ];

  for (const semester of plan.semesters) {
    const slots = Array.from({ length: slotCount }, () => "");

    for (const positioned of positionSemesterCourses(semester.courses)) {
      slots[positioned.slotStart - 1] = positioned.course.code;
    }

    lines.push(
      csvRow([semester.label, semester.termHint, ...slots]),
    );
  }

  lines.push("", "[storage]", "course_code");
  lines.push(...plan.storage.map((course) => csvRow([course.code])));

  return `${lines.join("\n")}\n`;
}

export function parsePlanFile(text: string): ParsedPlanFile {
  const sections = getSections(parseCsvRows(text));
  const planRows = requireSection(sections, "plan");
  const semesterRows = requireSection(sections, "semesters");
  const storageRows = requireSection(sections, "storage");
  const metadata = new Map(
    planRows.map((row) => [row[0]?.trim(), row[1] ?? ""]),
  );

  if (metadata.get("format_version") !== FORMAT_VERSION) {
    throw new PlanFileError("Unsupported or missing plan format version.");
  }

  const name = metadata.get("plan_name")?.trim();
  const creditLimit = Number(metadata.get("credit_limit"));

  if (!name) {
    throw new PlanFileError("The plan name is missing.");
  }
  if (
    !Number.isInteger(creditLimit) ||
    creditLimit < 1 ||
    creditLimit > 30
  ) {
    throw new PlanFileError("The credit limit must be between 1 and 30.");
  }

  const semesterHeader = semesterRows[0] ?? [];
  if (
    semesterHeader[0]?.trim() !== "semester" ||
    semesterHeader[1]?.trim() !== "term" ||
    semesterHeader.length < 3
  ) {
    throw new PlanFileError("The [semesters] header is invalid.");
  }

  semesterHeader.slice(2).forEach((header, index) => {
    if (header.trim() !== `slot_${index + 1}`) {
      throw new PlanFileError("Semester slot columns must be sequential.");
    }
  });

  const semesters = semesterRows.slice(1).map((row, rowIndex) => {
    const label = row[0]?.trim();
    const termHint = row[1]?.trim();

    if (!label || !termHint || !isRegularTerm(termHint)) {
      throw new PlanFileError(
        `Semester row ${rowIndex + 1} has an invalid label or term.`,
      );
    }

    const courses = row
      .slice(2, semesterHeader.length)
      .map((code, index) => ({
        code: normalizeCode(code),
        slotStart: index + 1,
      }))
      .filter((course) => course.code.length > 0);

    return { label, termHint, courses };
  });

  if (semesters.length === 0) {
    throw new PlanFileError("The plan must contain at least one semester.");
  }

  if (storageRows[0]?.[0]?.trim() !== "course_code") {
    throw new PlanFileError("The [storage] header is invalid.");
  }

  const storageCodes = storageRows
    .slice(1)
    .map((row) => normalizeCode(row[0] ?? ""))
    .filter(Boolean);

  return {
    name,
    creditLimitPerSemester: creditLimit,
    semesters,
    storageCodes,
  };
}

function fallbackCourse(code: string): Course {
  const department = code.split("-", 1)[0];
  return {
    code,
    name: `Unknown course (${code})`,
    credits: FALLBACK_CREDITS,
    department: department || undefined,
  };
}

function plannedCourse(
  course: Course,
  fallback: boolean,
  slotStart?: number,
): PlannedCourse {
  return {
    ...course,
    id: createId(),
    ...(slotStart === undefined ? {} : { slotStart }),
    ...(fallback ? { metadataFallback: true } : {}),
  };
}

export async function importPlanFile(
  text: string,
  lookup: CourseLookup = getCourseByCode,
): Promise<ImportedPlan> {
  const parsed = parsePlanFile(text);
  const codes = [
    ...parsed.semesters.flatMap((semester) =>
      semester.courses.map((course) => course.code),
    ),
    ...parsed.storageCodes,
  ];
  const uniqueCodes = [...new Set(codes)];
  const resolved = new Map<string, Course>();
  const fallbackCodes: string[] = [];

  await Promise.all(
    uniqueCodes.map(async (code) => {
      let course: Course | null = null;

      try {
        course = await lookup(code);
      } catch {
        course = null;
      }

      if (!course) {
        fallbackCodes.push(code);
        course = fallbackCourse(code);
      }

      resolved.set(code, course);
    }),
  );

  const now = new Date().toISOString();
  const fallbackSet = new Set(fallbackCodes);
  const plan: StudyPlan = {
    id: createId(),
    name: parsed.name,
    createdAt: now,
    updatedAt: now,
    creditLimitPerSemester: parsed.creditLimitPerSemester,
    semesters: parsed.semesters.map((semester) => ({
      id: createId(),
      label: semester.label,
      termHint: semester.termHint,
      courses: semester.courses.map(({ code, slotStart }) =>
        plannedCourse(resolved.get(code)!, fallbackSet.has(code), slotStart),
      ),
    })),
    storage: parsed.storageCodes.map((code) =>
      plannedCourse(resolved.get(code)!, fallbackSet.has(code)),
    ),
  };

  return {
    plan,
    fallbackCodes: fallbackCodes.sort(),
  };
}

export function exportPlanFile(
  plan: StudyPlan,
  date = new Date(),
  download = downloadTextFile,
): void {
  download(
    serializePlanFile(plan),
    `${getFileName(plan.name, date)}.plan`,
    "text/csv;charset=utf-8",
  );
}
