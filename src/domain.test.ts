import { describe, expect, it } from "vitest";
import {
  formatMoney,
  parsePlan,
  projectionToCsv,
  samplePlan,
  simulateRunway,
  validatePlan,
} from "./domain";

describe("runway domain", () => {
  it("produces deterministic percentile projections", () => {
    const first = simulateRunway(samplePlan, 200, 9);
    const second = simulateRunway(samplePlan, 200, 9);
    expect(first).toEqual(second);
    expect(first.points).toHaveLength(samplePlan.horizonMonths + 1);
    expect(first.points[0]?.p50).toBe(samplePlan.startingCash);
  });

  it("reports validation problems before simulation", () => {
    expect(validatePlan({ ...samplePlan, variableCostRate: 140 })).toContain(
      "Variable costs must be between 0% and 100%.",
    );
  });

  it("rejects malformed imported plans", () => {
    expect(() => parsePlan({ name: "Incomplete" })).toThrow(
      "unsupported scenario mode",
    );
  });

  it("exports a portable CSV", () => {
    const csv = projectionToCsv(
      simulateRunway({ ...samplePlan, horizonMonths: 3 }, 20),
    );
    expect(csv).toContain("month,p10_cash,p50_cash,p90_cash");
    expect(csv.split("\n")).toHaveLength(5);
  });

  it("formats configured currencies", () => {
    expect(formatMoney(1200, "MYR")).toMatch(/1,200/);
  });
});
