import type { RequirementExpression } from "../models/courseRequirement";
import { normalizeCourseCode } from "../catalog/normalize";
import { recognizedRequirementAliasCodes } from "../models/recognizedRequirement";

type Token =
  | { type: "course"; value: string; concurrent: boolean }
  | { type: "and" | "or" | "left" | "right" };

function normalizeRequirementToken(value: string): string {
  const clean = value.replace(/\*$/, "").replace(/[^A-Z0-9]/g, "");
  const match = /^([A-Z]{3,5})([0-9][A-Z0-9]{0,5})$/.exec(clean);
  return match ? `${match[1]}-${match[2]}` : normalizeCourseCode(value);
}

function tokenize(value: string): Token[] | null {
  const tokens: Token[] = [];
  const pattern =
    /\s*(\(|\)|\bY\b|\bO\b|[A-Z]{3,5}\s*-?\s*[0-9][A-Z0-9]{0,5}\*?)/giy;
  let index = 0;

  while (index < value.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(value);
    if (!match) {
      if (/^[\s,.;:/-]*$/.test(value.slice(index))) break;
      return null;
    }

    if (match.index !== index && value.slice(index, match.index).trim()) {
      return null;
    }

    const raw = match[1].trim().toUpperCase();
    if (raw === "(") tokens.push({ type: "left" });
    else if (raw === ")") tokens.push({ type: "right" });
    else if (raw === "Y") tokens.push({ type: "and" });
    else if (raw === "O") tokens.push({ type: "or" });
    else {
      tokens.push({
        type: "course",
        value: normalizeRequirementToken(raw),
        concurrent: raw.endsWith("*"),
      });
    }
    index = pattern.lastIndex;
  }

  return tokens;
}

export function parsePrerequisiteExpression(
  value: string,
): RequirementExpression | null {
  const tokens = tokenize(value);
  if (!tokens || tokens.length === 0) return null;
  const parsedTokens = tokens;
  let index = 0;

  function primary(): RequirementExpression | null {
    const token = parsedTokens[index];
    if (!token) return null;
    if (token.type === "course") {
      index += 1;
      return {
        type: "course",
        code: token.value,
        concurrent: token.concurrent,
      };
    }
    if (token.type === "left") {
      index += 1;
      const expression = orExpression();
      if (!expression || parsedTokens[index]?.type !== "right") return null;
      index += 1;
      return expression;
    }
    return null;
  }

  function andExpression(): RequirementExpression | null {
    const children: RequirementExpression[] = [];
    const first = primary();
    if (!first) return null;
    children.push(first);

    while (parsedTokens[index]?.type === "and") {
      index += 1;
      const next = primary();
      if (!next) return null;
      children.push(next);
    }

    return children.length === 1
      ? children[0]
      : { type: "and", children };
  }

  function orExpression(): RequirementExpression | null {
    const children: RequirementExpression[] = [];
    const first = andExpression();
    if (!first) return null;
    children.push(first);

    while (parsedTokens[index]?.type === "or") {
      index += 1;
      const next = andExpression();
      if (!next) return null;
      children.push(next);
    }

    return children.length === 1
      ? children[0]
      : { type: "or", children };
  }

  const parsed = orExpression();
  return parsed && index === parsedTokens.length ? parsed : null;
}

export function resolveRequirementExpression(
  expression: RequirementExpression,
  catalogCodes: ReadonlySet<string>,
): RequirementExpression | null {
  if (expression.type === "course") {
    return catalogCodes.has(expression.code) ||
      recognizedRequirementAliasCodes.has(expression.code)
      ? expression
      : null;
  }

  const children = expression.children
    .map((child) => resolveRequirementExpression(child, catalogCodes))
    .filter((child): child is RequirementExpression => Boolean(child));

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { type: expression.type, children };
}

export function requirementCodes(
  expression: RequirementExpression,
): string[] {
  if (expression.type === "course") return [expression.code];
  return [...new Set(expression.children.flatMap(requirementCodes))];
}

export function evaluateRequirementExpression(
  expression: RequirementExpression,
  availableCodes: ReadonlySet<string>,
): boolean {
  if (expression.type === "course") return availableCodes.has(expression.code);
  return expression.type === "and"
    ? expression.children.every((child) =>
        evaluateRequirementExpression(child, availableCodes),
      )
    : expression.children.some((child) =>
        evaluateRequirementExpression(child, availableCodes),
      );
}

export function residualRequirementExpression(
  expression: RequirementExpression,
  isSatisfied: (requirement: Extract<
    RequirementExpression,
    { type: "course" }
  >) => boolean,
): RequirementExpression | null {
  if (expression.type === "course") {
    return isSatisfied(expression) ? null : expression;
  }

  const residuals = expression.children.map((child) =>
    residualRequirementExpression(child, isSatisfied),
  );

  if (expression.type === "or" && residuals.some((child) => child === null)) {
    return null;
  }

  const children = residuals.filter(
    (child): child is RequirementExpression => child !== null,
  );
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { type: expression.type, children };
}

export function formatRequirementExpression(
  expression: RequirementExpression,
): string {
  if (expression.type === "course") {
    const code = recognizedRequirementAliasCodes.has(expression.code)
      ? expression.code.replace("-", "")
      : expression.code;
    return `${code}${expression.concurrent ? "*" : ""}`;
  }
  const operator = expression.type === "and" ? " Y " : " O ";
  return `(${expression.children.map(formatRequirementExpression).join(operator)})`;
}
