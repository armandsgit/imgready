import type { ProcessingMode } from '@/types';

export const REMOVE_BACKGROUND_CREDIT_COST = 1;
export const OPTIMIZE_ONLY_CREDIT_COST = 0.5;

export function getProcessingCreditCost(mode: ProcessingMode) {
  return mode === 'optimize-only' ? OPTIMIZE_ONLY_CREDIT_COST : REMOVE_BACKGROUND_CREDIT_COST;
}

export function formatCreditAmount(amount: number) {
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(1);
}

export function formatCreditCostLabel(amount: number) {
  return `${formatCreditAmount(amount)} credit`;
}

export function formatCreditPerImageText(mode: ProcessingMode) {
  return `1 image = ${formatCreditCostLabel(getProcessingCreditCost(mode))}`;
}
