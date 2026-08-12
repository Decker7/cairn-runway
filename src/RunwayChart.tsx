import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import type { Plan, ProjectionResult } from "./domain";

interface RunwayChartProps {
  result: ProjectionResult;
  currency: Plan["currency"];
}

export function RunwayChart({ result, currency }: RunwayChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue("--muted").trim();
    const gridColor = styles.getPropertyValue("--line").trim();
    const accent = styles.getPropertyValue("--accent").trim();
    const chart = new Chart(context, {
      type: "line",
      data: {
        labels: result.points.map((point) =>
          point.month === 0 ? "Now" : "M" + point.month,
        ),
        datasets: [
          {
            label: "Upside range",
            data: result.points.map((point) => point.p90),
            borderColor: "rgba(143, 167, 145, 0.45)",
            backgroundColor: "rgba(143, 167, 145, 0.08)",
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.35,
            fill: "+1",
          },
          {
            label: "Median cash",
            data: result.points.map((point) => point.p50),
            borderColor: accent,
            backgroundColor: "rgba(215, 239, 107, 0.14)",
            borderWidth: 3,
            pointRadius: 0,
            tension: 0.35,
            fill: false,
          },
          {
            label: "Downside range",
            data: result.points.map((point) => point.p10),
            borderColor: "rgba(231, 137, 114, 0.55)",
            backgroundColor: "rgba(215, 239, 107, 0.08)",
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.35,
            fill: "-1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? false
          : { duration: 420 },
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: {
            labels: {
              color: textColor,
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (item) =>
                item.dataset.label +
                ": " +
                new Intl.NumberFormat("en", {
                  style: "currency",
                  currency,
                  maximumFractionDigits: 0,
                }).format(Number(item.raw)),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, maxTicksLimit: 8 },
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: (value) =>
                new Intl.NumberFormat("en", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(Number(value)),
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [currency, result]);

  return (
    <div className="chart-wrap">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Cash balance projection showing downside, median, and upside ranges by month"
      />
    </div>
  );
}
