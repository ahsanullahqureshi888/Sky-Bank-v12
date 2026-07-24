export interface LedgerTransactionInput {
  serialNumber: number;
  cashIn: number;
  cashOut: number;
  associatedEntity: string;
}

export interface LedgerTransaction extends LedgerTransactionInput {
  runningBalance: number;
}
