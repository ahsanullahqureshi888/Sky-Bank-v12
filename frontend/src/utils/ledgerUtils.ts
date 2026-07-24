import { LedgerTransactionInput, LedgerTransaction } from '../types/ledger';

/**
 * Calculates the running balance for an array of ledger transactions.
 * Assumes the array is sorted in chronological or sequential order.
 *
 * @param transactions - Array of transaction inputs (without runningBalance)
 * @returns Array of transactions with runningBalance populated
 */
export const calculateRunningBalance = (
  transactions: LedgerTransactionInput[]
): LedgerTransaction[] => {
  let currentBalance = 0;

  return transactions.map((tx) => {
    // Formula: Previous Balance + Cash In - Cash Out
    currentBalance = currentBalance + tx.cashIn - tx.cashOut;
    
    return {
      ...tx,
      runningBalance: currentBalance,
    };
  });
};
