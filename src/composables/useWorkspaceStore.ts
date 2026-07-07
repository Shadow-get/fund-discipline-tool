import { useApiBackedJson } from "./useApiBackedJson";
import { createDefaultAccounts, createDefaultStrategies, ensureBuiltinStrategies } from "../data/strategyWorkspace";
import type { AccountProfile, StrategyProfile } from "../types";

export function useAccountsStore() {
  return useApiBackedJson<AccountProfile[]>("licai.accounts", createDefaultAccounts(), "accounts");
}

export function useStrategiesStore() {
  return useApiBackedJson<StrategyProfile[]>(
    "licai.strategies",
    createDefaultStrategies(),
    "strategies",
    ensureBuiltinStrategies,
  );
}
