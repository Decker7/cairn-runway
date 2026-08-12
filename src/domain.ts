export type ScenarioMode = "defensive" | "planned" | "expansion";

export interface Plan {
  name: string;
  currency: "USD" | "MYR" | "EUR" | "GBP";
  startingCash: number;
  monthlyRevenue: number;
  monthlyFixedCosts: number;
  variableCostRate: number;
  monthlyGrowthRate: number;
  revenueVolatility: number;
  horizonMonths: number;
  mode: ScenarioMode;
}

export interface ProjectionPoint {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface ProjectionResult {
  points: ProjectionPoint[];
  survivalRate: number;
  medianRunway: number;
  lowestMedianCash: number;
  trials: number;
}

export const samplePlan: Plan = {
  name: "Northstar Studio plan",
  currency: "MYR",
  startingCash: 86000,
  monthlyRevenue: 31500,
  monthlyFixedCosts: 21800,
  variableCostRate: 18,
  monthlyGrowthRate: 1.5,
  revenueVolatility: 22,
  horizonMonths: 18,
  mode: "planned",
};

export const modeAdjustments: Record<
  ScenarioMode,
  { revenue: number; costs: number; volatility: number }
> = {
  defensive: { revenue: 0.82, costs: 0.94, volatility: 1.25 },
  planned: { revenue: 1, costs: 1, volatility: 1 },
  expansion: { revenue: 1.16, costs: 1.12, volatility: 1.1 },
};

export function validatePlan(plan: Plan): string[] {
  const errors: string[] = [];
  if (!plan.name.trim()) errors.push("Plan name is required.");
  if (plan.startingCash < 0) errors.push("Starting cash cannot be negative.");
  if (plan.monthlyRevenue < 0) errors.push("Revenue cannot be negative.");
  if (plan.monthlyFixedCosts < 0)
    errors.push("Fixed costs cannot be negative.");
  if (plan.variableCostRate < 0 || plan.variableCostRate > 100)
    errors.push("Variable costs must be between 0% and 100%.");
  if (plan.monthlyGrowthRate < -100 || plan.monthlyGrowthRate > 100)
    errors.push("Monthly growth must be between -100% and 100%.");
  if (plan.revenueVolatility < 0 || plan.revenueVolatility > 100)
    errors.push("Revenue volatility must be between 0% and 100%.");
  if (plan.horizonMonths < 3 || plan.horizonMonths > 36)
    errors.push("Forecast horizon must be between 3 and 36 months.");
  return errors;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(random: () => number): number {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor(quantile * sorted.length),
  );
  return sorted[index] ?? 0;
}

export function simulateRunway(
  plan: Plan,
  trials = 1200,
  seed = 27,
): ProjectionResult {
  const errors = validatePlan(plan);
  if (errors.length > 0) throw new Error(errors.join(" "));

  const adjustment = modeAdjustments[plan.mode];
  const random = mulberry32(seed);
  const cashByMonth: number[][] = Array.from(
    { length: plan.horizonMonths + 1 },
    () => [],
  );
  const runwayMonths: number[] = [];

  for (let trial = 0; trial < trials; trial += 1) {
    let cash = plan.startingCash;
    let exhaustedAt = plan.horizonMonths;
    cashByMonth[0]?.push(cash);

    for (let month = 1; month <= plan.horizonMonths; month += 1) {
      const growth = Math.pow(1 + plan.monthlyGrowthRate / 100, month - 1);
      const noise =
        normal(random) * (plan.revenueVolatility / 100) * adjustment.volatility;
      const revenue = Math.max(
        0,
        plan.monthlyRevenue * adjustment.revenue * growth * (1 + noise),
      );
      const costs =
        plan.monthlyFixedCosts * adjustment.costs +
        revenue * (plan.variableCostRate / 100);
      cash += revenue - costs;
      cashByMonth[month]?.push(cash);
      if (cash < 0 && exhaustedAt === plan.horizonMonths) exhaustedAt = month;
    }
    runwayMonths.push(exhaustedAt);
  }

  const points = cashByMonth.map((values, month) => ({
    month,
    p10: Math.round(percentile(values, 0.1)),
    p50: Math.round(percentile(values, 0.5)),
    p90: Math.round(percentile(values, 0.9)),
  }));
  const finalCash = cashByMonth[plan.horizonMonths] ?? [];

  return {
    points,
    survivalRate: Math.round(
      (finalCash.filter((cash) => cash >= 0).length / trials) * 100,
    ),
    medianRunway: Math.round(percentile(runwayMonths, 0.5)),
    lowestMedianCash: Math.min(...points.map((point) => point.p50)),
    trials,
  };
}

export function formatMoney(value: number, currency: Plan["currency"]): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function parsePlan(value: unknown): Plan {
  if (!value || typeof value !== "object")
    throw new Error("The file does not contain a plan.");
  const candidate = value as Partial<Plan>;
  const mode = candidate.mode;
  if (mode !== "defensive" && mode !== "planned" && mode !== "expansion")
    throw new Error("The plan has an unsupported scenario mode.");
  const plan = candidate as Plan;
  const errors = validatePlan(plan);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return plan;
}

export function projectionToCsv(result: ProjectionResult): string {
  return [
    "month,p10_cash,p50_cash,p90_cash",
    ...result.points.map((point) =>
      [point.month, point.p10, point.p50, point.p90].join(","),
    ),
  ].join("\n");
}
