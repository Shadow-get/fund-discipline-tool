async function calculateWithPython<T>(action: string, payload: unknown): Promise<T> {
  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export function calculateMonthlyPlan<TInput, TResult>(input: TInput) {
  return calculateWithPython<TResult>("monthly_plan", input);
}

export function calculateHarvestPlan<TInput, TResult>(input: TInput) {
  return calculateWithPython<TResult>("harvest_plan", input);
}

export function calculatePortfolioHealth<TInput, TResult>(input: TInput) {
  return calculateWithPython<TResult>("portfolio_health", input);
}

export function calculateDcaMultiplier(input: { state: string }) {
  return calculateWithPython<number>("dca_multiplier", input);
}

export function calculateSellPlan<TInput, TResult>(input: TInput) {
  return calculateWithPython<TResult>("sell_plan", input);
}

