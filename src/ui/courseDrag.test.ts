import { describe, expect, it } from "vitest";
import { parseCourseDrag, serializeCourseDrag } from "./courseDrag";

describe("courseDrag", () => {
  it("round-trips planned and catalog payloads", () => {
    const planned = { kind: "planned-course", courseId: "local-id" } as const;
    const catalog = { kind: "catalog-course", courseCode: "ISIS-1225" } as const;

    expect(parseCourseDrag(serializeCourseDrag(planned))).toEqual(planned);
    expect(parseCourseDrag(serializeCourseDrag(catalog))).toEqual(catalog);
  });

  it("rejects malformed or unrelated drag data", () => {
    expect(parseCourseDrag("not-json")).toBeNull();
    expect(parseCourseDrag('{"kind":"planned-course"}')).toBeNull();
    expect(parseCourseDrag('{"kind":"other","courseId":"x"}')).toBeNull();
  });
});

