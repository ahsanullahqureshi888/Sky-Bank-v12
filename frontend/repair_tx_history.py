import sys

with open('src/pages/TransactionHistory.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = """                              {!isViewer && (
                                <button 
                                  onClick={() => handleUploadClick(tx.id)}"""

end_marker = """              <div>
                <h2 id="delete-transaction-title" className="text-xl font-black text-slate-950">"""

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print('Could not find markers')
    sys.exit(1)

replacement = """                              {!isViewer && (
                                <button 
                                  onClick={() => handleUploadClick(tx.id)} 
                                  disabled={deletingTransactionId === tx.id} 
                                  className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl disabled:opacity-50 transition-all hover:bg-sky-100" 
                                  title="Attach" 
                                  aria-label={`Attach receipt to transaction ${tx.receipt_no}`}
                                >
                                  <Paperclip size={16} />
                                </button>
                              )}
                              {!isViewer && (
                                <button 
                                  onClick={() => navigate(`/edit-transaction/${tx.id}`)} 
                                  disabled={deletingTransactionId === tx.id} 
                                  className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl disabled:opacity-50 transition-all hover:bg-sky-100" 
                                  title="Edit" 
                                  aria-label={`Edit transaction ${tx.receipt_no}`}
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(tx)}
                                  disabled={deletingTransactionId === tx.id}
                                  className="h-11 flex-1 min-w-[50px] inline-flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl disabled:opacity-50 transition-all hover:bg-rose-100"
                                  title="Delete Permanently"
                                  aria-label={`Delete transaction ${tx.receipt_no}`}
                                >
                                  {deletingTransactionId === tx.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {transactions.length === 0 && (
                        <div className="py-10 text-center text-sky-400 font-bold">
                          No transaction records matched the search filters.
                        </div>
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto app-scrollbar pb-10">
                      <table className="w-full min-w-[950px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-sky-100 text-[10px] font-black text-sky-500 uppercase tracking-[0.1em]">
                            <th className="pb-3 pr-2">{t('transaction.receipt_no')}</th>
                            <th className="pb-3 px-2">{t('transaction.date_plain')}</th>
                            <th className="pb-3 px-2">{t('customerLedger.customer')}</th>
                            <th className="pb-3 px-2 text-right">{t('transaction.amount')}</th>
                            <th className="pb-3 px-2 text-right">{t('transaction.equivalent')}</th>
                            <th className="pb-3 px-2">{t('transaction.method')}</th>
                            <th className="pb-3 px-2">{t('receiver')}</th>
                            <th className="pb-3 px-2">{t('transaction.status')}</th>
                            <th className="pb-3 pl-2 text-right">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-100/60 text-[13px] font-bold text-sky-900">
                          {transactions.map((tx) => (
                            <tr key={tx.id} className={`hover:bg-sky-50/40 transition-colors group ${deletingTransactionId === tx.id ? 'opacity-70' : ''}`}>
                              <td className="py-3 pr-2 font-black text-sky-950">
                                <div className="flex items-center gap-1 min-w-0">
                                  <button
                                    className="text-left text-sky-700 hover:text-sky-950 hover:underline break-words max-w-[120px] leading-tight"
                                    onClick={() => navigate(`/transactions/${tx.id}`)}
                                  >
                                    {tx.receipt_no}
                                  </button>
                                  {tx.attachment_path && (
                                    <Paperclip
                                      size={12}
                                      className="text-sky-400 shrink-0 cursor-pointer"
                                      title={tx.attachment_path.split(/[\\/]/).pop()}
                                      onClick={() => navigate(`/transactions/${tx.id}`)}
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-sky-500 whitespace-nowrap text-xs">{formatDate(tx.date)}</td>
                              <td className="py-3 px-2 break-words max-w-[160px] leading-tight">{tx.customer_name || '-'}</td>
                              <td className={`py-3 px-2 text-right font-black whitespace-nowrap ${tx.type === 'Received' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {tx.type === 'Received' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                              </td>
                              <td className="py-3 px-2 text-right text-sky-800 font-black whitespace-nowrap">
                                {tx.equivalent_amount ? formatCurrency(tx.equivalent_amount, tx.equivalent_currency) : '-'}
                              </td>
                              <td className="py-3 px-2 text-sky-900/70 whitespace-nowrap text-xs">{tx.payment_method || '-'}</td>
                              <td className="py-3 px-2 text-sky-900/70 break-words max-w-[120px] leading-tight">{tx.receiver_name || '-'}</td>
                              <td className="py-3 px-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${
                                  tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                                  tx.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {tx.status}
                                </span>
                              </td>
                              <td className="py-3 pl-2 text-right">
                                <div className="inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => navigate(`/transactions/${tx.id}`)} disabled={deletingTransactionId === tx.id} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="View Details" aria-label={`View transaction ${tx.receipt_no}`}>
                                    <Eye size={14} />
                                  </button>
                                  <button onClick={() => handlePrintReceipt(tx)} disabled={deletingTransactionId === tx.id} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Print Receipt" aria-label={`Print transaction ${tx.receipt_no}`}>
                                    <Printer size={14} />
                                  </button>
                                  <button onClick={() => handleDownloadPDF(tx)} disabled={deletingTransactionId === tx.id || generatingPdfId !== null} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Download PDF" aria-label={`Download PDF for transaction ${tx.receipt_no}`}>
                                    {generatingPdfId === tx.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                  </button>
                                  {!isViewer && (
                                    <button onClick={() => handleUploadClick(tx.id)} disabled={deletingTransactionId === tx.id} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Attach Receipt" aria-label={`Attach receipt to transaction ${tx.receipt_no}`}>
                                      <Paperclip size={14} />
                                    </button>
                                  )}
                                  {!isViewer && (
                                    <button onClick={() => navigate(`/edit-transaction/${tx.id}`)} disabled={deletingTransactionId === tx.id} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Edit Details" aria-label={`Edit transaction ${tx.receipt_no}`}>
                                      <Edit2 size={14} />
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(tx)}
                                      disabled={deletingTransactionId === tx.id}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete Permanently"
                                      aria-label={`Delete transaction ${tx.receipt_no}`}
                                    >
                                      {deletingTransactionId === tx.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {transactions.length === 0 && (
                            <tr>
                              <td colSpan="9" className="py-14 text-center text-sky-400 font-bold">
                                No transaction records matched the search filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
        )}
      </GlassCard>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-4 py-3 text-sm font-black shadow-2xl backdrop-blur-xl ${
            toast.type === 'success'
              ? 'border-emerald-100 bg-emerald-50/95 text-emerald-700'
              : 'border-rose-100 bg-rose-50/95 text-rose-700'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-transaction-title">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-900/20">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 size={22} />
              </div>
              <div>
                <h2 id="delete-transaction-title" className="text-xl font-black text-slate-950">"""

new_content = content[:start_idx] + replacement + content[end_idx + len(end_marker):]

with open('src/pages/TransactionHistory.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Successfully repaired TransactionHistory.jsx')
