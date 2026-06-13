import type { PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { STORAGE_DESTINATION } from "./courseDestination";

type RemovedCourse = {
  course: PlannedCourse | null;
  plan: StudyPlan;
};

function removeCourse(plan: StudyPlan, courseId: string): RemovedCourse {
  let removedCourse: PlannedCourse | null = null;

  const semesters = plan.semesters.map((semester) => ({
    ...semester,
    courses: semester.courses.filter((course) => {
      if (course.id !== courseId) return true;
      removedCourse ??= course;
      return false;
    }),
  }));
  const storage = plan.storage.filter((course) => {
    if (course.id !== courseId) return true;
    removedCourse ??= course;
    return false;
  });

  return {
    course: removedCourse,
    plan: {
      ...plan,
      semesters,
      storage,
    },
  };
}

export function deleteCourse(plan: StudyPlan, courseId: string): StudyPlan {
  return removeCourse(plan, courseId).plan;
}

export function moveCourse(
  plan: StudyPlan,
  courseId: string,
  destination: string,
): StudyPlan {
  const destinationExists =
    destination === STORAGE_DESTINATION ||
    plan.semesters.some((semester) => semester.id === destination);

  if (!destinationExists) return plan;

  const removed = removeCourse(plan, courseId);
  if (!removed.course) return plan;

  if (destination === STORAGE_DESTINATION) {
    return {
      ...removed.plan,
      storage: [...removed.plan.storage, removed.course],
    };
  }

  return {
    ...removed.plan,
    semesters: removed.plan.semesters.map((semester) =>
      semester.id === destination
        ? { ...semester, courses: [...semester.courses, removed.course!] }
        : semester,
    ),
  };
}

