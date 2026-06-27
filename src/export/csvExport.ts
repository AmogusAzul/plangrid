import { getCourseByCode } from "../api/courseApi";
import type { Course, PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import {
  createId,
  isRegularTerm,
  normalizePlanFilename,
} from "../state/planFactory";
import {
  hydrateCourses,
  type CourseLookup,
} from "../state/courseHydration";
import {
  getSemesterGridColumns,
  positionSemesterCourses,
} from "../state/semesterLayout";
import { downloadTextFile, getFileName } from "./common";
import {
  formatRequirementExpression,
  parsePrerequisiteExpression,
} from "../requirements/prerequisiteParser";
import type { CourseRequirementCheck } from "../models/courseRequirement";
import {
  recognizedRequirementDefinitions,
  type RecognizedRequirementId,
} from "../models/recognizedRequirement";
import {
  colorOverrideSchemes,
  defaultColorOverrideSchemeIds,
} from "../ui/courseColor";

const FORMAT_VERSION = "7";
const PREVIOUS_FORMAT_VERSION = "6";
const SECOND_PREVIOUS_FORMAT_VERSION = "5";
const THIRD_PREVIOUS_FORMAT_VERSION = "4";
const FOURTH_PREVIOUS_FORMAT_VERSION = "3";
const FIFTH_PREVIOUS_FORMAT_VERSION = "2";
const LEGACY_FORMAT_VERSION = "1";

type CachedCourse = Course & {
  metadataFallback?: boolean;
};

export type ParsedPlanFile = {
  id?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  creditLimitPerSemester: number;
  semesters: Array<{
    label: string;
    termHint: string;
    courses: Array<{
      code: string;
      slotStart: number;
      coursed: boolean;
    }>;
  }>;
  storageCourses: Array<{
    code: string;
    coursed: boolean;
  }>;
  cachedCourses: CachedCourse[];
  recognizedRequirementIds: RecognizedRequirementId[];
  colorOverrideSchemeIds: string[];
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

function parseCourseCell(value: string): { code: string; coursed: boolean } {
  const [code, ...flags] = value.split("|").map((part) => part.trim());
  return {
    code: normalizeCode(code ?? ""),
    coursed: flags.map((flag) => flag.toLowerCase()).includes("coursed"),
  };
}

function formatCourseCell(course: Pick<PlannedCourse, "code" | "coursed">): string {
  return course.coursed ? `${course.code}|coursed` : course.code;
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
      row.length === 1 ? /^\[([a-z_]+)\]$/i.exec(row[0].trim()) : null;

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
  const allCourses = [
    ...plan.semesters.flatMap((semester) => semester.courses),
    ...plan.storage,
  ];
  const coursesByCode = new Map<string, PlannedCourse>();

  for (const course of allCourses) {
    if (!coursesByCode.has(course.code)) {
      coursesByCode.set(course.code, course);
    }
  }
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
    csvRow(["plan_id", plan.id]),
    csvRow(["plan_name", plan.name]),
    csvRow(["created_at", plan.createdAt]),
    csvRow(["updated_at", plan.updatedAt]),
    csvRow(["credit_limit", plan.creditLimitPerSemester]),
    "",
    "[recognized_requirements]",
    csvRow(["id"]),
    ...plan.recognizedRequirementIds.map((id) => csvRow([id])),
    "",
    "[color_overrides]",
    csvRow(["scheme_id"]),
    ...plan.colorOverrideSchemeIds.map((id) => csvRow([id])),
    "",
    "[courses]",
    csvRow([
      "code",
      "name",
      "credits",
      "department",
      "metadata_fallback",
      "metadata_source",
      "availability",
      "catalog_title",
      "catalog_description",
      "catalog_department_code",
      "catalog_department_name",
      "catalog_year",
      "catalog_url",
    ]),
    ...[...coursesByCode.values()].map((course) =>
      csvRow([
        course.code,
        course.name,
        course.credits,
        course.department ?? "",
        course.metadataFallback ? "true" : "false",
        course.metadataSource ?? "",
        course.availability ?? "",
        course.catalog?.title ?? "",
        course.catalog?.description ?? "",
        course.catalog?.departmentCode ?? "",
        course.catalog?.departmentName ?? "",
        course.catalog?.catalogYear ?? "",
        course.catalog?.catalogUrl ?? "",
      ]),
    ),
    "",
    "[requirement_checks]",
    csvRow(["code", "status", "term", "checked_at", "nrc", "part_of_term"]),
    ...[...coursesByCode.values()]
      .filter((course) => course.requirements)
      .map((course) =>
        csvRow([
          course.code,
          course.requirements!.status,
          course.requirements!.term,
          course.requirements!.checkedAt,
          course.requirements!.nrc ?? "",
          course.requirements!.partOfTerm ?? "",
        ]),
      ),
    "",
    "[prerequisites]",
    csvRow([
      "code",
      "rule_index",
      "code_expression",
      "description_expression",
      "normalized_expression",
    ]),
    ...[...coursesByCode.values()].flatMap((course) =>
      (course.requirements?.prerequisites ?? []).map((rule, index) =>
        csvRow([
          course.code,
          index,
          rule.codeExpression,
          rule.descriptionExpression,
          rule.expression
            ? formatRequirementExpression(rule.expression)
            : "",
        ]),
      ),
    ),
    "",
    "[corequisites]",
    csvRow(["code", "required_code", "title"]),
    ...[...coursesByCode.values()].flatMap((course) =>
      (course.requirements?.corequisites ?? []).map((corequisite) =>
        csvRow([course.code, corequisite.code, corequisite.title]),
      ),
    ),
    "",
    "[semesters]",
    csvRow(["semester", "term", ...slotHeaders]),
  ];

  for (const semester of plan.semesters) {
    const slots = Array.from({ length: slotCount }, () => "");

    for (const positioned of positionSemesterCourses(semester.courses)) {
      slots[positioned.slotStart - 1] = formatCourseCell(positioned.course);
    }

    lines.push(
      csvRow([semester.label, semester.termHint, ...slots]),
    );
  }

  lines.push("", "[storage]", csvRow(["course_code", "coursed"]));
  lines.push(
    ...plan.storage.map((course) =>
      csvRow([course.code, course.coursed ? "true" : "false"]),
    ),
  );

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

  const formatVersion = metadata.get("format_version");
  if (
    formatVersion !== FORMAT_VERSION &&
    formatVersion !== PREVIOUS_FORMAT_VERSION &&
    formatVersion !== SECOND_PREVIOUS_FORMAT_VERSION &&
    formatVersion !== THIRD_PREVIOUS_FORMAT_VERSION &&
    formatVersion !== FOURTH_PREVIOUS_FORMAT_VERSION &&
    formatVersion !== FIFTH_PREVIOUS_FORMAT_VERSION &&
    formatVersion !== LEGACY_FORMAT_VERSION
  ) {
    throw new PlanFileError("Unsupported or missing plan format version.");
  }

  const id = metadata.get("plan_id")?.trim() || undefined;
  const name = metadata.get("plan_name")?.trim();
  const createdAt = metadata.get("created_at")?.trim() || undefined;
  const updatedAt = metadata.get("updated_at")?.trim() || undefined;
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
      .map((value, index) => ({
        ...parseCourseCell(value),
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

  const hasStorageCoursedColumn = storageRows[0]?.[1]?.trim() === "coursed";
  const storageCourses = storageRows
    .slice(1)
    .map((row) => {
      const parsedCell = parseCourseCell(row[0] ?? "");
      return {
        code: parsedCell.code,
        coursed: hasStorageCoursedColumn
          ? row[1]?.trim().toLowerCase() === "true"
          : parsedCell.coursed,
      };
    })
    .filter((course) => course.code.length > 0);
  const courseRows = sections.get("courses");
  const cachedCourses: CachedCourse[] = [];

  if (
    formatVersion === FORMAT_VERSION ||
    formatVersion === PREVIOUS_FORMAT_VERSION ||
    formatVersion === SECOND_PREVIOUS_FORMAT_VERSION ||
    formatVersion === THIRD_PREVIOUS_FORMAT_VERSION ||
    formatVersion === FOURTH_PREVIOUS_FORMAT_VERSION ||
    formatVersion === FIFTH_PREVIOUS_FORMAT_VERSION
  ) {
    if (!courseRows) {
      throw new PlanFileError("Missing required [courses] section.");
    }
    const header = courseRows[0]?.map((cell) => cell.trim()) ?? [];
    const headerText = header.join(",");
    const isPreviousHeader =
      headerText === "code,name,credits,department,metadata_fallback";
    const isCurrentHeader =
      headerText ===
      "code,name,credits,department,metadata_fallback,metadata_source,availability,catalog_title,catalog_description,catalog_department_code,catalog_department_name,catalog_year,catalog_url";

    if (!isPreviousHeader && !isCurrentHeader) {
      throw new PlanFileError("The [courses] header is invalid.");
    }

    for (const [index, row] of courseRows.slice(1).entries()) {
      const code = normalizeCode(row[0] ?? "");
      const courseName = row[1]?.trim();
      const credits = Number(row[2]);
      const department = row[3]?.trim().toUpperCase() || undefined;
      const fallbackText = row[4]?.trim().toLowerCase();
      const metadataSource = row[5]?.trim() || undefined;
      const availability = row[6]?.trim() || undefined;
      const catalogTitle = row[7]?.trim() || undefined;
      const catalogDescription = row[8]?.trim() || undefined;
      const catalogDepartmentCode = row[9]?.trim() || undefined;
      const catalogDepartmentName = row[10]?.trim() || undefined;
      const catalogYear = row[11]?.trim() || undefined;
      const catalogUrl = row[12]?.trim() || undefined;

      if (
        !code ||
        !courseName ||
        !Number.isFinite(credits) ||
        credits < 0 ||
        !["true", "false"].includes(fallbackText)
      ) {
        throw new PlanFileError(
          `Course metadata row ${index + 1} is invalid.`,
        );
      }

      cachedCourses.push({
        code,
        name: courseName,
        credits,
        department,
        ...(metadataSource
          ? { metadataSource: metadataSource as CachedCourse["metadataSource"] }
          : {}),
        ...(availability
          ? { availability: availability as CachedCourse["availability"] }
          : {}),
        ...(catalogTitle ||
        catalogDescription ||
        catalogDepartmentCode ||
        catalogDepartmentName ||
        catalogYear ||
        catalogUrl
          ? {
              catalog: {
                title: catalogTitle,
                description: catalogDescription,
                departmentCode: catalogDepartmentCode,
                departmentName: catalogDepartmentName,
                catalogYear:
                  catalogYear === "2026"
                    ? "2026"
                    : undefined,
                catalogUrl,
              },
            }
          : {}),
        ...(fallbackText === "true" ? { metadataFallback: true } : {}),
      });
    }
  }

  if (
    formatVersion === FORMAT_VERSION ||
    formatVersion === PREVIOUS_FORMAT_VERSION ||
    formatVersion === SECOND_PREVIOUS_FORMAT_VERSION ||
    formatVersion === THIRD_PREVIOUS_FORMAT_VERSION
  ) {
    const checkRows = requireSection(sections, "requirement_checks");
    const prerequisiteRows = requireSection(sections, "prerequisites");
    const corequisiteRows = requireSection(sections, "corequisites");
    if (
      checkRows[0]?.map((cell) => cell.trim()).join(",") !==
        "code,status,term,checked_at,nrc,part_of_term" ||
      prerequisiteRows[0]?.map((cell) => cell.trim()).join(",") !==
        "code,rule_index,code_expression,description_expression,normalized_expression" ||
      corequisiteRows[0]?.map((cell) => cell.trim()).join(",") !==
        "code,required_code,title"
    ) {
      throw new PlanFileError("The requirement metadata headers are invalid.");
    }

    const requirementsByCode = new Map<string, CourseRequirementCheck>();
    for (const row of checkRows.slice(1)) {
      const code = normalizeCode(row[0] ?? "");
      const status = row[1]?.trim();
      if (
        !code ||
        !["loaded", "not-offered"].includes(status) ||
        row[2]?.trim() !== "202620" ||
        !row[3]?.trim()
      ) {
        throw new PlanFileError("A requirement check row is invalid.");
      }
      requirementsByCode.set(code, {
        status: status as CourseRequirementCheck["status"],
        term: "202620",
        checkedAt: row[3].trim(),
        nrc: row[4]?.trim() || undefined,
        partOfTerm: row[5]?.trim() || undefined,
        prerequisites: [],
        corequisites: [],
      });
    }
    for (const row of prerequisiteRows.slice(1)) {
      const check = requirementsByCode.get(normalizeCode(row[0] ?? ""));
      if (!check) continue;
      const normalized = row[4]?.trim();
      check.prerequisites.push({
        codeExpression: row[2] ?? "",
        descriptionExpression: row[3] ?? "",
        expression: normalized
          ? parsePrerequisiteExpression(normalized) ?? undefined
          : undefined,
      });
    }
    for (const row of corequisiteRows.slice(1)) {
      const check = requirementsByCode.get(normalizeCode(row[0] ?? ""));
      const requiredCode = normalizeCode(row[1] ?? "");
      if (check && requiredCode) {
        check.corequisites.push({
          code: requiredCode,
          title: row[2]?.trim() ?? "",
        });
      }
    }
    for (const course of cachedCourses) {
      const requirements = requirementsByCode.get(course.code);
      if (requirements) course.requirements = requirements;
    }
  }

  const recognizedRequirementIds: RecognizedRequirementId[] = [];
  if (
    formatVersion === FORMAT_VERSION ||
    formatVersion === PREVIOUS_FORMAT_VERSION ||
    formatVersion === SECOND_PREVIOUS_FORMAT_VERSION
  ) {
    const recognizedRows = requireSection(sections, "recognized_requirements");
    if (recognizedRows[0]?.[0]?.trim() !== "id") {
      throw new PlanFileError(
        "The [recognized_requirements] header is invalid.",
      );
    }
    const validIds = new Set(
      recognizedRequirementDefinitions.map((definition) => definition.id),
    );
    for (const row of recognizedRows.slice(1)) {
      const id = row[0]?.trim() as RecognizedRequirementId;
      if (!validIds.has(id)) {
        throw new PlanFileError(`Unknown recognized requirement: ${id}.`);
      }
      recognizedRequirementIds.push(id);
    }
  }

  let colorOverrideSchemeIds = defaultColorOverrideSchemeIds;
  if (formatVersion === FORMAT_VERSION) {
    const colorOverrideRows = requireSection(sections, "color_overrides");
    if (colorOverrideRows[0]?.[0]?.trim() !== "scheme_id") {
      throw new PlanFileError("The [color_overrides] header is invalid.");
    }
    const validSchemeIds = new Set(
      colorOverrideSchemes.map((scheme) => scheme.id),
    );
    colorOverrideSchemeIds = [];
    for (const row of colorOverrideRows.slice(1)) {
      const id = row[0]?.trim();
      if (!id) continue;
      if (!validSchemeIds.has(id)) {
        throw new PlanFileError(`Unknown color override scheme: ${id}.`);
      }
      colorOverrideSchemeIds.push(id);
    }
  }

  return {
    id,
    name,
    createdAt,
    updatedAt,
    creditLimitPerSemester: creditLimit,
    semesters,
    storageCourses,
    cachedCourses,
    recognizedRequirementIds,
    colorOverrideSchemeIds,
  };
}

function plannedCourse(
  course: Course,
  metadataFallback: boolean,
  slotStart?: number,
  coursed = false,
): PlannedCourse {
  return {
    ...course,
    id: createId(),
    ...(slotStart === undefined ? {} : { slotStart }),
    ...(metadataFallback ? { metadataFallback: true } : {}),
    ...(coursed ? { coursed: true } : {}),
  };
}

export async function importPlanFile(
  text: string,
  lookup: CourseLookup = getCourseByCode,
  filename = "",
): Promise<ImportedPlan> {
  const parsed = parsePlanFile(text);
  const codes = [
    ...parsed.semesters.flatMap((semester) =>
      semester.courses.map((course) => course.code),
    ),
    ...parsed.storageCourses.map((course) => course.code),
  ];
  const uniqueCodes = [...new Set(codes)];
  const hydrated = await hydrateCourses(
    uniqueCodes,
    parsed.cachedCourses,
    lookup,
  );

  const now = new Date().toISOString();
  const fallbackSet = new Set(hydrated.fallbackCodes);
  const cachedFallbackSet = new Set(
    parsed.cachedCourses
      .filter(
        (course) =>
          course.metadataFallback &&
          hydrated.cachedCodes.includes(course.code),
      )
      .map((course) => course.code),
  );
  const plan: StudyPlan = {
    id: parsed.id ?? createId(),
    filename: normalizePlanFilename(filename, parsed.name),
    name: parsed.name,
    createdAt: parsed.createdAt ?? now,
    updatedAt: now,
    creditLimitPerSemester: parsed.creditLimitPerSemester,
    semesters: parsed.semesters.map((semester) => ({
      id: createId(),
      label: semester.label,
      termHint: semester.termHint,
      courses: semester.courses.map(({ code, slotStart, coursed }) =>
        plannedCourse(
          hydrated.courses.get(code)!,
          fallbackSet.has(code) || cachedFallbackSet.has(code),
          slotStart,
          coursed,
        ),
      ),
    })),
    storage: parsed.storageCourses.map(({ code, coursed }) =>
      plannedCourse(
        hydrated.courses.get(code)!,
        fallbackSet.has(code) || cachedFallbackSet.has(code),
        undefined,
        coursed,
      ),
    ),
    recognizedRequirementIds: parsed.recognizedRequirementIds,
    colorOverrideSchemeIds: parsed.colorOverrideSchemeIds,
  };

  return {
    plan,
    fallbackCodes: hydrated.fallbackCodes,
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
