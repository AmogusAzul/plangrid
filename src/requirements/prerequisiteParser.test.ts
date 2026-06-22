import { describe, expect, it } from "vitest";
import {
  evaluateRequirementExpression,
  formatRequirementExpression,
  parsePrerequisiteExpression,
  resolveRequirementExpression,
} from "./prerequisiteParser";

describe("prerequisite expression parsing", () => {
  it("parses nested Spanish AND/OR expressions and asterisks", () => {
    const parsed = parsePrerequisiteExpression(
      "(FISI 1100 Y (MATE 1203* O MATE 1204*)) O MATE 1203",
    );

    expect(parsed).not.toBeNull();
    expect(formatRequirementExpression(parsed!)).toContain("FISI-1100");
    expect(formatRequirementExpression(parsed!)).toContain("MATE-1203*");
    expect(
      evaluateRequirementExpression(parsed!, new Set(["MATE-1203"])),
    ).toBe(true);
  });

  it("preserves a concurrent marker on a single prerequisite leaf", () => {
    expect(parsePrerequisiteExpression("MATE 1203*")).toEqual({
      type: "course",
      code: "MATE-1203",
      concurrent: true,
    });
  });

  it("removes catalog-unknown abstract leaves and simplifies groups", () => {
    const parsed = parsePrerequisiteExpression(
      "(ISIS 1221 O ISIS 1222) Y (MATE 1201 O MATE1 O MATS1)",
    )!;
    const resolved = resolveRequirementExpression(
      parsed,
      new Set(["ISIS-1221", "ISIS-1222", "MATE-1201"]),
    );

    expect(formatRequirementExpression(resolved!)).toBe(
      "((ISIS-1221 O ISIS-1222) Y (MATE-1201 O MATE1 O MATS1))",
    );
  });

  it("fails open for malformed or entirely abstract expressions", () => {
    expect(parsePrerequisiteExpression("(ISIS 1221 Y")).toBeNull();
    const abstract = parsePrerequisiteExpression("ABCD1 O WXYZ1")!;
    expect(resolveRequirementExpression(abstract, new Set())).toBeNull();
  });
});
