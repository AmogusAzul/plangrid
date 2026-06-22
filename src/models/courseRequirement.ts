export type RequirementExpression =
  | { type: "course"; code: string; concurrent: boolean }
  | { type: "and" | "or"; children: RequirementExpression[] };

export type PrerequisiteRule = {
  codeExpression: string;
  descriptionExpression: string;
  expression?: RequirementExpression;
};

export type CourseRequirementReference = {
  code: string;
  title: string;
};

export type CourseRequirementCheck = {
  status: "loaded" | "not-offered";
  term: "202620";
  checkedAt: string;
  nrc?: string;
  partOfTerm?: string;
  prerequisites: PrerequisiteRule[];
  corequisites: CourseRequirementReference[];
};
