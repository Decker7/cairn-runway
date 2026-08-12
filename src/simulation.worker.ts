/// <reference lib="webworker" />
import { simulateRunway, type Plan } from "./domain";

self.onmessage = (event: MessageEvent<{ plan: Plan }>) => {
  try {
    self.postMessage({ ok: true, result: simulateRunway(event.data.plan) });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Simulation failed.",
    });
  }
};

export {};
