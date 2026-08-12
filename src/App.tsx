import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  ChartLineUp,
  Check,
  DownloadSimple,
  FileArrowUp,
  Flask,
  Moon,
  Plus,
  Sun,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatMoney,
  parsePlan,
  projectionToCsv,
  samplePlan,
  simulateRunway,
  validatePlan,
  type Plan,
  type ProjectionResult,
  type ScenarioMode,
} from "./domain";
import { RunwayChart } from "./RunwayChart";

type WorkerResponse =
  { ok: true; result: ProjectionResult } | { ok: false; error: string };

const modeCopy: Record<ScenarioMode, { label: string; description: string }> = {
  defensive: { label: "Defensive", description: "Lower demand, tighter costs" },
  planned: { label: "Planned", description: "Current operating assumptions" },
  expansion: { label: "Expansion", description: "Higher demand and hiring" },
};

function downloadFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadStoredPlan(): Plan | null {
  const stored = localStorage.getItem("cairn-plan");
  if (!stored) return samplePlan;
  if (stored === "empty") return null;
  try {
    return parsePlan(JSON.parse(stored));
  } catch {
    return samplePlan;
  }
}

export function App() {
  const [plan, setPlan] = useState<Plan | null>(loadStoredPlan);
  const [result, setResult] = useState<ProjectionResult | null>(() =>
    plan ? simulateRunway(plan) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  const workerRef = useRef<Worker | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const firstPlanSync = useRef(true);

  const validationErrors = useMemo(
    () => (plan ? validatePlan(plan) : []),
    [plan],
  );
  const isLoading = loading && validationErrors.length === 0;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const worker = new Worker(
      new URL("./simulation.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      setLoading(false);
      if (event.data.ok) {
        setResult(event.data.result);
        setError(null);
      } else {
        setResult(null);
        setError(event.data.error);
      }
    };
    worker.onerror = () => {
      setLoading(false);
      setError(
        "The projection worker stopped unexpectedly. Reload and try again.",
      );
    };
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (!plan) {
      localStorage.setItem("cairn-plan", "empty");
      return;
    }
    localStorage.setItem("cairn-plan", JSON.stringify(plan));
    if (firstPlanSync.current) {
      firstPlanSync.current = false;
      return;
    }
    const errors = validatePlan(plan);
    if (errors.length > 0 || !workerRef.current) {
      return;
    }
    setLoading(true);
    setError(null);
    workerRef.current.postMessage({ plan });
  }, [plan]);

  function updatePlan<K extends keyof Plan>(key: K, value: Plan[K]) {
    setPlan((current) => (current ? { ...current, [key]: value } : current));
    setNotice(null);
  }

  function handleImport(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parsePlan(JSON.parse(String(reader.result)));
        setPlan(imported);
        setNotice("Plan imported. The projection has been recalculated.");
        setError(null);
      } catch (importError) {
        setError(
          importError instanceof Error
            ? importError.message
            : "The plan could not be imported.",
        );
      }
    };
    reader.onerror = () => setError("The selected file could not be read.");
    reader.readAsText(file);
  }

  if (!plan) {
    return (
      <main className="empty-shell">
        <section className="empty-state" aria-labelledby="empty-title">
          <div className="brand-mark" aria-hidden="true">
            <ChartLineUp size={24} weight="bold" />
          </div>
          <p className="eyebrow">Cairn Runway</p>
          <h1 id="empty-title">Make uncertainty visible.</h1>
          <p>
            Build a private cash plan, compare operating modes, and see the
            range around your runway.
          </p>
          <div className="empty-actions">
            <button
              className="button primary"
              onClick={() => setPlan(samplePlan)}
            >
              <Flask size={18} /> Load sample plan
            </button>
            <button
              className="button secondary"
              onClick={() =>
                setPlan({
                  ...samplePlan,
                  name: "Untitled plan",
                  startingCash: 0,
                  monthlyRevenue: 0,
                })
              }
            >
              <Plus size={18} /> Start fresh
            </button>
          </div>
          <span>
            Plans stay in this browser. No account or upload required.
          </span>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to plan workspace
      </a>
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Cairn Runway home">
          <span className="brand-mark">
            <ChartLineUp size={20} weight="bold" />
          </span>
          <span>
            Cairn <small>Runway lab</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="save-state" role="status">
            <Check size={15} weight="bold" /> Saved locally
          </span>
          <button
            className="icon-button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={
              theme === "light" ? "Use dark theme" : "Use light theme"
            }
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            className="button ghost"
            onClick={() => importRef.current?.click()}
          >
            <FileArrowUp size={18} /> Import
          </button>
          <button
            className="button secondary export-button"
            onClick={() =>
              downloadFile(
                "cairn-plan.json",
                JSON.stringify(plan, null, 2),
                "application/json",
              )
            }
          >
            <DownloadSimple size={18} /> Export plan
          </button>
          <input
            className="visually-hidden"
            ref={importRef}
            type="file"
            aria-label="Import a Cairn plan"
            accept="application/json,.json"
            onChange={(event) => handleImport(event.target.files?.[0])}
          />
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Private scenario planning</p>
            <input
              className="plan-title"
              aria-label="Plan name"
              value={plan.name}
              onChange={(event) => updatePlan("name", event.target.value)}
            />
            <h1 id="page-title">Know the range, not just the average.</h1>
          </div>
          <div className="hero-note" aria-label="Simulation details">
            <div className="hero-note-icon">
              <Flask size={23} weight="bold" />
            </div>
            <div>
              <strong>1,200 local paths</strong>
              <p>
                Seeded simulations recalculate as you edit. Your operating data
                never leaves this browser.
              </p>
            </div>
          </div>
        </section>

        {notice && (
          <div className="notice success" role="status">
            <Check size={18} /> {notice}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            <Warning size={18} /> {error}
          </div>
        )}

        <section className="mode-switcher" aria-label="Scenario mode">
          {(Object.keys(modeCopy) as ScenarioMode[]).map((mode) => (
            <button
              key={mode}
              className={plan.mode === mode ? "active" : ""}
              aria-pressed={plan.mode === mode}
              onClick={() => updatePlan("mode", mode)}
            >
              <strong>{modeCopy[mode].label}</strong>
              <span>{modeCopy[mode].description}</span>
            </button>
          ))}
        </section>

        <div className="workspace-grid">
          <aside className="assumptions" aria-labelledby="assumptions-title">
            <div className="section-heading">
              <div>
                <h2 id="assumptions-title">Assumptions</h2>
                <p>Adjust the inputs that shape the range.</p>
              </div>
              <select
                aria-label="Currency"
                value={plan.currency}
                onChange={(event) =>
                  updatePlan("currency", event.target.value as Plan["currency"])
                }
              >
                <option>MYR</option>
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </div>

            <div className="input-grid">
              <NumberField
                label="Starting cash"
                value={plan.startingCash}
                prefix={plan.currency}
                onChange={(value) => updatePlan("startingCash", value)}
              />
              <NumberField
                label="Monthly revenue"
                value={plan.monthlyRevenue}
                prefix={plan.currency}
                onChange={(value) => updatePlan("monthlyRevenue", value)}
              />
              <NumberField
                label="Fixed monthly costs"
                value={plan.monthlyFixedCosts}
                prefix={plan.currency}
                onChange={(value) => updatePlan("monthlyFixedCosts", value)}
              />
              <NumberField
                label="Variable costs"
                value={plan.variableCostRate}
                suffix="%"
                onChange={(value) => updatePlan("variableCostRate", value)}
              />
              <NumberField
                label="Monthly growth"
                value={plan.monthlyGrowthRate}
                suffix="%"
                step={0.5}
                onChange={(value) => updatePlan("monthlyGrowthRate", value)}
              />
              <NumberField
                label="Revenue volatility"
                value={plan.revenueVolatility}
                suffix="%"
                onChange={(value) => updatePlan("revenueVolatility", value)}
              />
            </div>

            <label className="range-field">
              <span>
                <strong>Forecast horizon</strong>
                <output>{plan.horizonMonths} months</output>
              </span>
              <input
                type="range"
                min="3"
                max="36"
                value={plan.horizonMonths}
                onChange={(event) =>
                  updatePlan("horizonMonths", Number(event.target.value))
                }
              />
            </label>

            {validationErrors.length > 0 && (
              <div className="validation" role="alert">
                <Warning size={18} />
                <div>
                  <strong>Review the plan</strong>
                  {validationErrors.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <section
            className="projection"
            aria-labelledby="projection-title"
            aria-busy={isLoading}
          >
            <div className="section-heading projection-heading">
              <div>
                <h2 id="projection-title">Cash range</h2>
                <p>Downside, median, and upside outcomes over time.</p>
              </div>
              {result && (
                <button
                  className="button ghost"
                  onClick={() =>
                    downloadFile(
                      "cairn-projection.csv",
                      projectionToCsv(result),
                      "text/csv",
                    )
                  }
                >
                  <ArrowDown size={18} /> CSV
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="loading-panel" role="status">
                <span className="skeleton skeleton-chart" />
                <span className="visually-hidden">Running cash projection</span>
              </div>
            ) : result ? (
              <RunwayChart result={result} currency={plan.currency} />
            ) : (
              <div className="chart-error">
                <Warning size={26} />
                <strong>Projection paused</strong>
                <p>Correct the assumptions to continue.</p>
              </div>
            )}
          </section>
        </div>

        <section className="outcomes" aria-labelledby="outcomes-title">
          <div className="outcome-intro">
            <p className="eyebrow">Decision signals</p>
            <h2 id="outcomes-title">What the range means now</h2>
            <p>
              Use these signals to decide whether to protect cash, hold course,
              or fund growth.
            </p>
          </div>
          {isLoading ? (
            <div
              className="metrics-loading"
              aria-label="Loading decision signals"
            >
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ) : result ? (
            <div className="metrics">
              <Metric
                label="Survival probability"
                value={result.survivalRate + "%"}
                detail={
                  result.survivalRate >= 75
                    ? "Plan clears the forecast window"
                    : "Downside protection needs attention"
                }
                positive={result.survivalRate >= 75}
              />
              <Metric
                label="Median runway"
                value={result.medianRunway + " mo"}
                detail={
                  result.medianRunway >= plan.horizonMonths
                    ? "No median cash-out in range"
                    : "Median cash-out month"
                }
                positive={result.medianRunway >= plan.horizonMonths}
              />
              <Metric
                label="Lowest median cash"
                value={formatMoney(result.lowestMedianCash, plan.currency)}
                detail={
                  result.lowestMedianCash >= 0
                    ? "Median path remains funded"
                    : "Median path crosses zero"
                }
                positive={result.lowestMedianCash >= 0}
              />
            </div>
          ) : null}
        </section>

        <footer className="footer">
          <div>
            <strong>Cairn Runway</strong>
            <span>Local-first planning for independent operators.</span>
          </div>
          <button
            className="danger-link"
            onClick={() => {
              setPlan(null);
              setResult(null);
              setLoading(false);
              setNotice(null);
              setError(null);
            }}
          >
            <Trash size={17} /> Clear plan
          </button>
        </footer>
      </main>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({
  label,
  value,
  prefix,
  suffix,
  step = 1,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        {prefix && <small>{prefix}</small>}
        <input
          type="number"
          value={value}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  positive,
}: {
  label: string;
  value: string;
  detail: string;
  positive: boolean;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>
        {positive ? <ArrowUp size={17} /> : <ArrowClockwise size={17} />}{" "}
        {detail}
      </p>
    </article>
  );
}
