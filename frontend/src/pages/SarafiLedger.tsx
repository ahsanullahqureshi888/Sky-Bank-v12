import React from 'react';
import { CustomerLedgerTable } from '../components/CustomerLedgerTable';
import { rawLedgerData } from '../data/ledgerData';
import { calculateRunningBalance } from '../utils/ledgerUtils';

export default function SarafiLedger() {
  const transactionsWithBalances = calculateRunningBalance(rawLedgerData);

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] w-full print:h-auto print:block">
      <CustomerLedgerTable transactions={transactionsWithBalances} />
    </div>
  );
}
