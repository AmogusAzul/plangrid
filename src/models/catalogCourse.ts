export type CatalogCourse = {
  code: string;
  normalizedCode: string;
  title: string;
  credits: number | null;
  departmentCode: string;
  departmentName?: string;
  description: string;
  catalogUrl?: string;
  catalogYear: "2026";
  source: "smartcatalog";
  searchableText: string;
};

export type CatalogCourseSummary = {
  title?: string;
  description?: string;
  departmentCode?: string;
  departmentName?: string;
  catalogUrl?: string;
  catalogYear?: "2026";
  matchedSnippet?: string;
};

export type CatalogIndexFile = {
  version: 1;
  catalogYear: "2026";
  generatedAt: string;
  sourceUrl: string;
  courses: CatalogCourse[];
};
