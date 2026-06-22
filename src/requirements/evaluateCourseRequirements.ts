import { normalizeCourseCode } from "../catalog/normalize";
import type { PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import {
  formatRequirementExpression,
  requirementCodes,
  residualRequirementExpression,
} from "./prerequisiteParser";
import { recognizedRequirementCodes } from "../models/recognizedRequirement";

export type CourseRequirementEvaluation = {
  status: "unavailable" | "satisfied" | "unmet";
  unmetPrerequisites: Array<{
    codes: string[];
    expression: string;
    originalExpression: string;
    ruleIndex: number;
  }>;
  unmetCorequisites: string[];
};

export function evaluatePlannedCourseRequirements(
  plan: StudyPlan,
  courseId: string,
): CourseRequirementEvaluation {
  const semesterIndex = plan.semesters.findIndex((semester) =>
    semester.courses.some((course) => course.id === courseId),
  );
  if (semesterIndex < 0) {
    return {
      status: "unavailable",
      unmetPrerequisites: [],
      unmetCorequisites: [],
    };
  }

  const course = plan.semesters[semesterIndex].courses.find(
    (entry) => entry.id === courseId,
  );
  if (!course?.requirements || course.requirements.status !== "loaded") {
    return {
      status: "unavailable",
      unmetPrerequisites: [],
      unmetCorequisites: [],
    };
  }

  const earlierCodes = new Set(
    plan.semesters
      .slice(0, semesterIndex)
      .flatMap((semester) => semester.courses)
      .map((entry) => normalizeCourseCode(entry.code)),
  );
  const sameSemesterCodes = new Set(
    plan.semesters[semesterIndex].courses.map((entry) =>
      normalizeCourseCode(entry.code),
    ),
  );
  const recognizedCodes = recognizedRequirementCodes(
    plan.recognizedRequirementIds ?? [],
  );
  const acceptsSameSemesterPrerequisites = ["8A", "8B"].includes(
    course.requirements.partOfTerm ?? "",
  );
  const availableCorequisiteCodes = new Set([
    ...sameSemesterCodes,
    ...recognizedCodes,
  ]);
  const unmetPrerequisites = course.requirements.prerequisites
    .map((rule, ruleIndex) => {
      if (!rule.expression) return null;
      const residual = residualRequirementExpression(
        rule.expression,
        (requirement) =>
          recognizedCodes.has(requirement.code) ||
          earlierCodes.has(requirement.code) ||
          ((requirement.concurrent || acceptsSameSemesterPrerequisites) &&
            sameSemesterCodes.has(requirement.code)),
      );
      if (!residual) return null;
      return {
        codes: requirementCodes(residual),
        expression: formatRequirementExpression(residual),
        originalExpression: formatRequirementExpression(rule.expression),
        ruleIndex,
      };
    })
    .filter(
      (
        rule,
      ): rule is CourseRequirementEvaluation["unmetPrerequisites"][number] =>
        rule !== null,
    );
  const unmetCorequisites = course.requirements.corequisites
    .map((corequisite) => normalizeCourseCode(corequisite.code))
    .filter((code) => !availableCorequisiteCodes.has(code));

  return {
    status:
      unmetPrerequisites.length > 0 || unmetCorequisites.length > 0
        ? "unmet"
        : "satisfied",
    unmetPrerequisites,
    unmetCorequisites,
  };
}

export function allCoursesWithRequirementEvaluations(
  plan: StudyPlan,
): Array<{
  course: PlannedCourse;
  semesterId: string;
  evaluation: CourseRequirementEvaluation;
}> {
  return plan.semesters.flatMap((semester) =>
    semester.courses.map((course) => ({
      course,
      semesterId: semester.id,
      evaluation: evaluatePlannedCourseRequirements(plan, course.id),
    })),
  );
}
