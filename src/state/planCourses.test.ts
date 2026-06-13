import { describe, expect, it } from "vitest";
import type { PlannedCourse } from "../models/course";
import { STORAGE_DESTINATION } from "./courseDestination";
import { createBlankPlan } from "./planFactory";
import { deleteCourse, moveCourse } from "./planCourses";

const course: PlannedCourse = {
  id: "course-1",
  code: "ISIS-1225",
  name: "Data Structures",
  credits: 3,
};

describe("planCourses", () => {
  it("moves a semester course into storage without changing its identity", () => {
    const plan = createBlankPlan(2);
    plan.semesters[0].courses.push(course);

    const moved = moveCourse(plan, course.id, STORAGE_DESTINATION);

    expect(moved.semesters[0].courses).toHaveLength(0);
    expect(moved.storage).toEqual([course]);
  });

  it("places a stored course in a selected semester", () => {
    const plan = createBlankPlan(2);
    plan.storage.push(course);

    const moved = moveCourse(plan, course.id, plan.semesters[1].id);

    expect(moved.storage).toHaveLength(0);
    expect(moved.semesters[1].courses).toEqual([course]);
  });

  it("leaves the plan unchanged for an invalid destination", () => {
    const plan = createBlankPlan(1);
    plan.storage.push(course);

    expect(moveCourse(plan, course.id, "missing-semester")).toBe(plan);
  });

  it("deletes a course from any plan area", () => {
    const plan = createBlankPlan(1);
    plan.storage.push(course);

    expect(deleteCourse(plan, course.id).storage).toHaveLength(0);
  });
});

