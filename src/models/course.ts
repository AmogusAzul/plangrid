export type Course = {
  code: string;
  name: string;
  credits: number;
  department?: string;
};

export type PlannedCourse = Course & {
  id: string;
};

