import type { Course, PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { STORAGE_DESTINATION } from "./courseDestination";
import { createPlannedCourseFromCourse } from "./createPlannedCourse";
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

function updatePlannedCourse(
  plan: StudyPlan,
  courseId: string,
  update: (course: PlannedCourse) => PlannedCourse,
): StudyPlan {
  return {
    ...plan,
    semesters: plan.semesters.map((semester) => ({
      ...semester,
      courses: semester.courses.map((course) =>
        course.id === courseId ? update(course) : course,
      ),
    })),
    storage: plan.storage.map((course) =>
      course.id === courseId ? update(course) : course,
    ),
  };
}

export function toggleCourseCoursed(
  plan: StudyPlan,
  courseId: string,
): StudyPlan {
  return updatePlannedCourse(plan, courseId, (course) => ({
    ...course,
    coursed: !course.coursed,
  }));
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

  const plannedCourse = createPlannedCourseFromCourse(course);

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
