import type { Course, PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { STORAGE_DESTINATION } from "./courseDestination";
import { toPlannedCourse } from "./planFactory";
import { insertCourseAtSlot } from "./semesterLayout";

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

export function addCourse(
  plan: StudyPlan,
  course: Course,
  destination: string,
  requestedSlot?: number,
): StudyPlan {
  const destinationExists =
    destination === STORAGE_DESTINATION ||
    plan.semesters.some((semester) => semester.id === destination);

  if (!destinationExists) return plan;

  const plannedCourse = toPlannedCourse(course);

  if (destination === STORAGE_DESTINATION) {
    return {
      ...plan,
      storage: [...plan.storage, plannedCourse],
    };
  }

  return {
    ...plan,
    semesters: plan.semesters.map((semester) =>
      semester.id === destination
        ? {
            ...semester,
            courses: insertCourseAtSlot(
              semester.courses,
              plannedCourse,
              requestedSlot,
            ),
          }
        : semester,
    ),
  };
}

export function moveCourse(
  plan: StudyPlan,
  courseId: string,
  destination: string,
  requestedSlot?: number,
): StudyPlan {
  const destinationExists =
    destination === STORAGE_DESTINATION ||
    plan.semesters.some((semester) => semester.id === destination);

  if (!destinationExists) return plan;

  const removed = removeCourse(plan, courseId);
  if (!removed.course) return plan;

  if (destination === STORAGE_DESTINATION) {
    const { slotStart: _slotStart, ...storedCourse } = removed.course;
    return {
      ...removed.plan,
      storage: [...removed.plan.storage, storedCourse],
    };
  }

  return {
    ...removed.plan,
    semesters: removed.plan.semesters.map((semester) =>
      semester.id === destination
        ? {
            ...semester,
            courses: insertCourseAtSlot(
              semester.courses,
              removed.course!,
              requestedSlot,
            ),
          }
        : semester,
    ),
  };
}
