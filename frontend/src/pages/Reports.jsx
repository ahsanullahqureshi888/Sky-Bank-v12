import React, { useState, useEffect } from 'react';
import { FileText, FileSpreadsheet, Download, RefreshCw, BarChart2, Calendar, User, Landmark, DollarSign, Printer, ArrowDownLeft, ArrowUpRight, Paperclip, ShieldAlert, Loader2 } from 'lucide-react';
import { reportAPI, dashboardAPI, customerAPI, bankAPI, transactionAPI, authAPI, backupAPI } from '../api/client';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '../utils/formatters';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';

const BRAND_LOGO = '/sky-bbb-logo.png';

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export default function Reports() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('balance'); // balance, daily, monthly, customer, bank, currency, received, paid, attachments, audit
  
  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  
  // Data lists for filters
  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Report output data
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchFiltersData = async () => {
    try {
      const [custRes, bankRes, userRes] = await Promise.all([
        customerAPI.list(),
        bankAPI.list(),
        authAPI.listUsers().catch(() => ({ data: [] })) // Fallback if not admin
      ]);
      setCustomers(custRes.data);
      setBanks(bankRes.data);
      setUsers(userRes.data || []);
    } catch (err) {
      console.error('Failed to load filter drop-downs', err);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getSummary();
      setSummary(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      // Build standard API query filters
      const params = {};
      if (startDate) params.date_from = startDate;
      if (endDate) params.date_to = endDate;
      if (selectedCurrency) params.currency = selectedCurrency;
      if (selectedMethod) params.payment_method = selectedMethod;
      if (selectedUserId) params.created_by = selectedUserId;

      if (reportType === 'daily') {
        const todayStr = new Date().toISOString().split('T')[0];
        params.date_from = todayStr;
        params.date_to = todayStr;
        const res = await transactionAPI.list(params);
        setReportData(res.data);
      } 
      else if (reportType === 'monthly') {
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
        params.date_from = startDate || firstDay;
        params.date_to = endDate || lastDay;
        const res = await transactionAPI.list(params);
        setReportData(res.data);
      }
      else if (reportType === 'received') {
        params.type = 'Received';
        const res = await transactionAPI.list(params);
        setReportData(res.data);
      }
      else if (reportType === 'paid') {
        params.type = 'Paid';
        const res = await transactionAPI.list(params);
        setReportData(res.data);
      }
      else if (reportType === 'customer') {
        if (!selectedCustomerId) {
          setReportData([]);
          setReportLoading(false);
          return;
        }
        const res = await customerAPI.getLedger(selectedCustomerId);
        setReportData(res.data);
      }
      else if (reportType === 'bank') {
        if (!selectedBankId) {
          setReportData([]);
          setReportLoading(false);
          return;
        }
        const res = await bankAPI.getLedger(selectedBankId);
        setReportData(res.data);
      }
      else if (reportType === 'attachments') {
        const res = await transactionAPI.list(params);
        // Filter transactions having attachment_path
        setReportData(res.data.filter(tx => tx.attachment_path));
      }
      else if (reportType === 'audit') {
        const res = await backupAPI.auditLogs();
        // Manual client side filtering for date/user on audit logs
        let filteredLogs = res.data;
        if (startDate) {
          filteredLogs = filteredLogs.filter(l => l.created_at.split('T')[0] >= startDate);
        }
        if (endDate) {
          filteredLogs = filteredLogs.filter(l => l.created_at.split('T')[0] <= endDate);
        }
        if (selectedUserId) {
          filteredLogs = filteredLogs.filter(l => l.user_id === Number(selectedUserId));
        }
        setReportData(filteredLogs);
      }
      else if (reportType === 'currency') {
        // Calculate grouping from all transactions
        const res = await transactionAPI.list(params);
        const groups = new Map();
        res.data.forEach(tx => {
          if (!groups.has(tx.currency)) {
            groups.set(tx.currency, { currency: tx.currency, count: 0, received: 0, paid: 0, balance: 0 });
          }
          const g = groups.get(tx.currency);
          g.count += 1;
          if (tx.type === 'Received') {
            g.received += tx.amount;
            g.balance += tx.amount;
          } else {
            g.paid += tx.amount;
            g.balance -= tx.amount;
          }
        });
        setReportData(Array.from(groups.values()));
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchFiltersData();
  }, []);

  useEffect(() => {
    if (reportType !== 'balance') {
      generateReport();
    } else {
      setReportData([]);
    }
  }, [reportType, startDate, endDate, selectedCustomerId, selectedBankId, selectedCurrency, selectedMethod, selectedUserId]);

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    let headers = [];
    let rows = [];

    if (reportType === 'customer' || reportType === 'bank') {
      headers = [t("reports.timestamp"), t("reports.details"), t("reports.total_debit_outflow"), t("reports.total_credit_inflow"), t("reports.vault_net_position")];
      rows = reportData.map(item => [
        item.date,
        `"${item.description.replace(/"/g, '""')}"`,
        item.debit,
        item.credit,
        item.balance
      ]);
    } else if (reportType === 'currency') {
      headers = [t('reports.currency'), "Transaction Count", "Total Received", "Total Paid", t('reports.net_vault')];
      rows = reportData.map(item => [
        item.currency,
        item.count,
        item.received,
        item.paid,
        item.balance
      ]);
    } else if (reportType === 'audit') {
      headers = [t('reports.timestamp'), t('reports.action'), "Table Name", "Operator ID", "Operator Email", "Description", "IP Address", "Device Agent"];
      rows = reportData.map(item => [
        item.created_at,
        item.action,
        item.table_name,
        item.user_id,
        item.user_email || 'System',
        `"${item.description.replace(/"/g, '""')}"`,
        item.ip_address || 'N/A',
        `"${(item.device_info || 'N/A').replace(/"/g, '""')}"`
      ]);
    } else {
      headers = [t('reports.receipt_no'), "Date", t('reports.customer'), "Bank Account ID", t('reports.type'), t('reports.amount'), t('reports.currency'), t('reports.eq_usd'), t('reports.method'), "Notes"];
      rows = reportData.map(item => [
        item.receipt_no,
        item.date,
        item.customer_name,
        item.bank_account_id,
        item.type,
        item.amount,
        item.currency,
        item.equivalent_amount,
        item.payment_method,
        `"${(item.notes || '').replace(/"/g, '""')}"`
      ]);
    }

    csvContent += headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sky-banking-report-${reportType}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDatabaseExportCSV = async () => {
    try {
      await reportAPI.exportExcel(`sky-ariana-balam-bar-baran-database-${Date.now()}.csv`);
    } catch (err) {
      console.error(err);
      alert('Failed to export the database CSV.');
    }
  };

  const handleDatabaseExportPDF = async () => {
    try {
      await reportAPI.exportPDF(`sky-ariana-balam-bar-baran-journal-${Date.now()}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to export the PDF journal.');
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let reportTitle = "Financial Statement";
    let filterSummary = `Generated on ${new Date().toLocaleDateString()}`;
    if (startDate) filterSummary += ` | From: ${startDate}`;
    if (endDate) filterSummary += ` | To: ${endDate}`;

    if (reportType === 'daily') reportTitle = "Daily Transaction Journal";
    else if (reportType === 'monthly') reportTitle = "Monthly Financial Ledger";
    else if (reportType === 'received') reportTitle = "Cash / Transfers Inflow Journal";
    else if (reportType === 'paid') reportTitle = "Payments & Outflows Journal";
    else if (reportType === 'customer') {
      const cust = customers.find(c => c.id === Number(selectedCustomerId));
      reportTitle = `Customer Ledger Statement: ${cust?.name || t('reports.customer')}`;
    }
    else if (reportType === 'bank') {
      const bank = banks.find(b => b.id === Number(selectedBankId));
      reportTitle = `Bank Vault Statement: ${bank?.account_name || 'Account'}`;
    }
    else if (reportType === 'currency') reportTitle = "Currency Vault Balances";
    else if (reportType === 'attachments') reportTitle = "Receipt Attachment Tracking Statement";
    else if (reportType === 'audit') reportTitle = "System Activity Audit Trail";

    let tableHeaders = "";
    let tableBodyRows = "";

    if (reportType === 'customer' || reportType === 'bank') {
      tableHeaders = `
        <th>Date</th>
        <th>Description</th>
        <th style="text-align: right;">Debit (Outflow)</th>
        <th style="text-align: right;">Credit (Inflow)</th>
        <th style="text-align: right;">Running Balance</th>
      `;
      tableBodyRows = reportData.map(item => `
        <tr>
          <td>${escapeHtml(formatDate(item.date))}</td>
          <td>${item.description}</td>
          <td style="text-align: right;">${item.debit > 0 ? item.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
          <td style="text-align: right;">${item.credit > 0 ? item.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
          <td style="text-align: right; font-weight: bold;">${item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        </tr>
      `).join('');
    } else if (reportType === 'currency') {
      tableHeaders = `
        <th>${t('reports.currency')}</th>
        <th style="text-align: center;">${t('reports.tx_count')}</th>
        <th style="text-align: right;">${t('reports.total_inflows')}</th>
        <th style="text-align: right;">${t('reports.total_outflows')}</th>
        <th style="text-align: right;">${t('reports.net_vault')}</th>
      `;
      tableBodyRows = reportData.map(item => `
        <tr>
          <td style="font-weight: bold; color: #0369a1;">${item.currency}</td>
          <td style="text-align: center;">${item.count}</td>
          <td style="text-align: right; color: #10b981;">${item.received.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td style="text-align: right; color: #ef4444;">${item.paid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td style="text-align: right; font-weight: bold; color: ${item.balance >= 0 ? '#10b981' : '#ef4444'};">
            ${item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </td>
        </tr>
      `).join('');
    } else if (reportType === 'audit') {
      tableHeaders = `
        <th>${t('reports.timestamp')}</th>
        <th>${t('reports.action')}</th>
        <th>${t('reports.operator')}</th>
        <th>Description</th>
        <th>${t('reports.ip_network_col')}</th>
      `;
      tableBodyRows = reportData.map(item => `
        <tr>
          <td>${formatDate(item.created_at)}</td>
          <td style="font-weight: bold; text-transform: uppercase;">${item.action}</td>
          <td>${escapeHtml(item.user_email || 'System')}</td>
          <td>${item.description}</td>
          <td style="font-family: monospace; font-size: 10px;">${item.ip_address || 'Localhost'}</td>
        </tr>
      `).join('');
    } else {
      tableHeaders = `
        <th>${t('reports.receipt_no')}</th>
        <th>Date</th>
        <th>${t('reports.cust_name')}</th>
        <th>${t('reports.method')}</th>
        <th>${t('reports.type')}</th>
        <th style="text-align: right;">${t('reports.amount')}</th>
        <th style="text-align: right;">${t('reports.eq_usd')}</th>
      `;
      tableBodyRows = reportData.map(item => `
        <tr>
          <td style="font-weight: bold; font-family: monospace;">${item.receipt_no}</td>
          <td>${formatDate(item.date)}</td>
          <td>${item.customer_name}</td>
          <td>${item.payment_method}</td>
          <td style="font-weight: bold; color: ${item.type === 'Received' ? '#10b981' : '#ef4444'};">${item.type}</td>
          <td style="text-align: right; font-weight: bold;">${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})} ${item.currency}</td>
          <td style="text-align: right; color: #64748b;">${item.equivalent_amount.toLocaleString(undefined, {minimumFractionDigits: 2})} USD</td>
        </tr>
      `).join('');
    }

    // Dynamic Summary Totals block
    let totalBlock = "";
    if (reportType !== 'currency' && reportType !== 'audit') {
      const inTot = reportData.reduce((s, x) => s + (x.type === 'Received' || x.credit > 0 ? (x.equivalent_amount || x.credit || 0) : 0), 0);
      const outTot = reportData.reduce((s, x) => s + (x.type === 'Paid' || x.debit > 0 ? (x.equivalent_amount || x.debit || 0) : 0), 0);
      totalBlock = `
        <div style="margin: 25px 0; padding: 15px; border: 1.5px solid #0284c7; background-color: #f0f9ff; border-radius: 8px; display: flex; justify-content: space-around; font-family: 'Segoe UI', Arial, sans-serif;">
          <div><strong style="color: #0284c7; font-size: 11px; text-transform: uppercase;">${t('reports.total_cr_usd')}</strong><div style="font-size: 18px; font-weight: 850; color: #1e3a8a; margin-top: 4px;">$${inTot.toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
          <div style="border-left: 1px solid #bae6fd;"></div>
          <div><strong style="color: #0284c7; font-size: 11px; text-transform: uppercase;">${t('reports.total_db_usd')}</strong><div style="font-size: 18px; font-weight: 850; color: #1e3a8a; margin-top: 4px;">$${outTot.toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
          <div style="border-left: 1px solid #bae6fd;"></div>
          <div><strong style="color: #0284c7; font-size: 11px; text-transform: uppercase;">${t('reports.net_bal_usd')}</strong><div style="font-size: 18px; font-weight: 850; color: ${(inTot - outTot) >= 0 ? '#10b981' : '#ef4444'}; margin-top: 4px;">$${(inTot - outTot).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          @media print {
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tr, .total-block, .signatures { break-inside: avoid; page-break-inside: avoid; }
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #0f172a;
            font-size: 12px;
            line-height: 1.4;
            padding: 20px;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .title-area h1 {
            font-size: 20px;
            font-weight: 900;
            color: #1e3a8a;
            margin: 0;
          }
          .brand-lockup {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .brand-logo {
            width: 76px;
            height: 52px;
            border: 1px solid #dbeafe;
            border-radius: 12px;
            object-fit: contain;
            padding: 4px;
            background: #fff;
          }
          .title-area p {
            color: #0284c7;
            font-size: 10px;
            font-weight: bold;
            margin: 3px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .meta-area {
            text-align: right;
            font-size: 10px;
            font-weight: bold;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th {
            background-color: #f1f5f9;
            color: #1e3a8a;
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
            padding: 8px 10px;
            border-bottom: 2px solid #cbd5e1;
            text-align: left;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          .signatures {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
          }
          .sig-box {
            width: 200px;
            border-top: 1px dashed #94a3b8;
            padding-top: 8px;
            text-align: center;
            font-size: 10px;
            font-weight: bold;
            color: #475569;
          }
          .btn-print {
            background-color: #0284c7;
            color: #fff;
            border: none;
            padding: 8px 16px;
            font-size: 11px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 20px;
          }
          .btn-print:hover { background-color: #0369a1; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="btn-print" onclick="window.print()">${t('reports.print_this')}</button>
        </div>
        <header>
          <div class="brand-lockup">
            <img class="brand-logo" src="${BRAND_LOGO}" alt="${t('reports.company_name')}" />
            <div class="title-area">
              <h1>${t('reports.company_name')}</h1>
              <p>${reportTitle}</p>
            </div>
          </div>
          <div class="meta-area">
            <div>${filterSummary}</div>
            <div style="margin-top: 4px;">${t('reports.company_desc')}</div>
          </div>
        </header>
        
        ${totalBlock}

        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableBodyRows}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">${t('reports.prepared_by')}</div>
          <div class="sig-box">${t('reports.verified_by')}</div>
          <div class="sig-box">${t('reports.signature')}</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    const printWhenReady = async () => {
      if (printWindow.document.fonts?.ready) await printWindow.document.fonts.ready;
      const images = Array.from(printWindow.document.images);
      await Promise.all(images.map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        })));
      printWindow.focus();
      printWindow.print();
    };
    if (printWindow.document.readyState === 'complete') {
      printWhenReady();
    } else {
      printWindow.addEventListener('load', printWhenReady, { once: true });
    }
  };

  const handleTabChange = (tab) => {
    setReportType(tab);
    setStartDate('');
    setEndDate('');
    setSelectedCustomerId('');
    setSelectedBankId('');
    setSelectedCurrency('');
    setSelectedMethod('');
    setSelectedUserId('');
    setReportData([]);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-sky-900 leading-tight">{t('reports.title')}</h1>
          <p className="text-sm text-sky-500 font-medium mt-1">{t('reports.subtitle')}</p>
        </div>
      </div>

      {/* Premium Directory Tabs */}
      <div className="flex flex-wrap gap-1.5 p-2 bg-gradient-to-r from-sky-100/60 to-white/60 backdrop-blur-xl rounded-2xl md:rounded-[24px] border border-white/80 shadow-[0_4px_20px_rgba(15,32,66,0.03)] print:hidden">
        {[
          { id: 'balance', label: 'Vault Net Position', icon: BarChart2 },
          { id: 'daily', label: 'Daily Journal', icon: Calendar },
          { id: 'monthly', label: 'Monthly Ledger', icon: Calendar },
          { id: 'customer', label: 'Customer Statement', icon: User },
          { id: 'bank', label: 'Bank Statement', icon: Landmark },
          { id: 'currency', label: 'Currency Vaults', icon: DollarSign },
          { id: 'received', label: 'Inflow (Received)', icon: ArrowDownLeft },
          { id: 'paid', label: 'Outflow (Paid)', icon: ArrowUpRight },
          { id: 'attachments', label: 'Attachments Tracker', icon: Paperclip },
          { id: 'audit', label: 'User Activity Trail', icon: ShieldAlert }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl md:rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-br from-white to-sky-50 text-sky-700 shadow-[0_4px_12px_rgba(15,32,66,0.06)] ring-1 ring-sky-900/5 translate-y-[-1px]'
                  : 'text-sky-600/70 hover:text-sky-800 hover:bg-white/60 active:bg-sky-200/50'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-sky-500' : 'text-sky-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {reportType === 'balance' ? (
        /* Vault Net Position (Summary View) */
        loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <GlassCard className="lg:col-span-2 p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-extrabold text-sky-900 border-b border-sky-100 pb-3 mb-5 flex items-center gap-2">
                  <BarChart2 size={18} className="text-sky-500" />
                  <span>{t('reports.profit_volume_summary')}</span>
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-black text-sky-900 uppercase tracking-wider">{t('reports.total_credit_inflow')}</span>
                      <span className="text-emerald-600 font-black text-sm">{formatCurrency(summary?.total_received || 0, 'USD')}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner shadow-slate-300/30">
                      <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-1000 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)] relative" style={{ width: '100%' }}>
                        <div className="absolute inset-0 bg-white/20 w-full h-1/2"></div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-black text-sky-900 uppercase tracking-wider">{t('reports.total_debit_outflow')}</span>
                      <span className="text-rose-600 font-black text-sm">{formatCurrency(summary?.total_paid || 0, 'USD')}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner shadow-slate-300/30">
                      <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-full rounded-full transition-all duration-1000 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)] relative" style={{ width: `${(summary?.total_paid / (summary?.total_received || 1)) * 100}%` }}>
                        <div className="absolute inset-0 bg-white/20 w-full h-1/2"></div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-black text-sky-900 uppercase tracking-wider">{t('reports.vault_net_position')} <span className="text-sky-500 font-bold lowercase tracking-normal">(balance)</span></span>
                      <span className={summary?.total_balance >= 0 ? 'text-sky-600 font-black text-base' : 'text-rose-600 font-black text-base'}>
                        {formatCurrency(summary?.total_balance || 0, 'USD')}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-5 rounded-full overflow-hidden shadow-inner shadow-slate-300/30 border border-slate-200/50">
                      <div className="bg-gradient-to-r from-sky-400 to-sky-600 h-full rounded-full transition-all duration-1000 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.15)] relative" style={{ width: `${(summary?.total_balance / (summary?.total_received || 1)) * 100}%` }}>
                        <div className="absolute inset-0 bg-white/20 w-full h-1/2"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-1 max-w-md w-full relative overflow-hidden group">
              {/* Background accent */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-sky-200/40 rounded-full blur-3xl transition-transform duration-700 group-hover:scale-150 pointer-events-none"></div>
              
              <div className="bg-white/60 p-6 rounded-[18px] h-full flex flex-col justify-between border border-white/50 backdrop-blur-xl relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-sky-100 border border-white flex items-center justify-center text-emerald-600 shadow-sm shadow-emerald-900/5">
                      <Download size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-black text-sky-950">
                        Full Database Export
                      </h2>
                      <p className="text-[11px] text-sky-600 font-bold uppercase tracking-wider">
                        System Archives
                      </p>
                    </div>
                  </div>
                  <p className="text-[13px] text-sky-700/80 font-medium leading-relaxed mb-6">
                    Extract and download the complete raw database archives.
                  </p>
                  
                  <div className="space-y-3 mt-auto">
                    <button
                      type="button"
                      onClick={handleDatabaseExportCSV}
                      className="w-full py-3.5 bg-gradient-to-b from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 border-t border-white/30 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-300 text-[13px] flex items-center justify-center gap-2.5 active:scale-[0.98]"
                    >
                      <FileSpreadsheet size={16} />
                      <span>{t('reports.download_excel')}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleDatabaseExportPDF}
                      className="w-full py-3.5 border border-sky-100 bg-white hover:bg-sky-50 text-sky-800 font-bold rounded-xl shadow-sm hover:shadow transition-all duration-300 text-[13px] flex items-center justify-center gap-2.5 active:scale-[0.98]"
                    >
                      <FileText size={16} className="text-rose-500" />
                      <span>{t('reports.download_pdf')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
            
          </div>
        )
      ) : (
        /* Workspace Reports with Filter panels */
        <div className="space-y-6">
          
          {/* Dynamic Filters Form */}
          <GlassCard className="p-5 print:hidden">
            <h3 className="text-xs font-black text-sky-900 uppercase tracking-wider mb-4">{t('reports.report_filters')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Date From */}
              <div>
                <label className="block text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">{t('reports.date_from')}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-sky-100 bg-white rounded-xl text-xs text-sky-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">{t('reports.date_to')}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-sky-100 bg-white rounded-xl text-xs text-sky-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              {/* Customer selection - Displayed for customer ledger */}
              {reportType === 'customer' && (
                <div>
                  <label className="block text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">{t('reports.customer_acc')}</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-sky-100 bg-white rounded-xl text-xs text-sky-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="">{t('reports.choose_customer')}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Bank selection - Displayed for bank ledger */}
              {reportType === 'bank' && (
                <div>
                  <label className="block text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">{t('reports.bank_vault_acc')}</label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full px-3 py-2 border border-sky-100 bg-white rounded-xl text-xs text-sky-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="">{t('reports.choose_bank_acc')}</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>{b.account_name} ({b.currency})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Currency selection */}
              {reportType !== 'customer' && reportType !== 'bank' && reportType !== 'currency' && reportType !== 'audit' && (
                <div>
                  <label className="block text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">{t('reports.currency')}</label>
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-sky-100 bg-white rounded-xl text-xs text-sky-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="">{t('reports.all_currencies')}</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="AED">AED</option>
                    <option value="AFN">AFN</option>
                    <option value="IRR">IRR (Toman)</option>
                    <option value="PKR">PKR</option>
                  </select>
                </div>
              )}

              {/* Payment Method */}
              {reportType !== 'customer' && reportType !== 'bank' && reportType !== 'currency' && reportType !== 'audit' && (
                <div>
                  <label className="block text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">{t('reports.payment_method')}</label>
                  <select
                    value={selectedMethod}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-sky-100 bg-white rounded-xl text-xs text-sky-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="">{t('reports.all_methods')}</option>
                    <option value={t('reports.cash')}>{t('reports.cash')}</option>
                    <option value={t('reports.bank_transfer')}>{t('reports.bank_transfer')}</option>
                    <option value="Hawala">{t('reports.hawala')}</option>
                  </select>
                </div>
              )}

              {/* User operator selection */}
              {(reportType === 'audit' || (reportType !== 'customer' && reportType !== 'bank' && reportType !== 'currency')) && users.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">{t('reports.created_by_op')}</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-sky-100 bg-white rounded-xl text-xs text-sky-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="">{t('reports.all_operators')}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.email}</option>
                    ))}
                  </select>
                </div>
              )}

            </div>
          </GlassCard>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
            <h3 className="text-sm font-extrabold text-sky-900">
              Filtered Records ({reportData.length} entries found)
            </h3>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handlePrintReport}
                disabled={reportData.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-sky-900 font-extrabold text-[11px] uppercase tracking-wider rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-slate-100 transition-all duration-300 hover:shadow-[0_4px_15px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <Printer size={14} className="text-sky-500" />
                <span>{t('reports.print_statement')}</span>
              </button>
              <button
                onClick={handleExportCSV}
                disabled={reportData.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-br from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all duration-300 hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <FileSpreadsheet size={14} />
                <span>{t('reports.export_csv')}</span>
              </button>
            </div>
          </div>

          {/* Results Area Premium Container */}
          <div className="relative flex flex-col flex-1 rounded-2xl md:rounded-[32px] overflow-hidden print:overflow-visible print:rounded-none print:border-none print:shadow-none bg-white/70 backdrop-blur-2xl border border-white shadow-[0_12px_40px_rgba(15,32,66,0.06)]">
            {/* Print-only clean statement header */}
            <div className="hidden border-b-2 border-sky-900 px-6 py-4 print:block">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-black text-sky-900">{t('reports.company_name')}</h1>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">Financial Report</p>
                </div>
                <div className="text-right text-[10px] font-semibold text-slate-500">
                  <p>Generated: <span className="font-black text-sky-900">{new Date().toLocaleDateString()}</span></p>
                </div>
              </div>
            </div>

            {reportLoading ? (
              <div className="py-24 flex justify-center">
                <Loader2 className="animate-spin text-sky-500" size={32} />
              </div>
            ) : reportData.length === 0 ? (
              <div className="py-20 text-center">
                <ShieldAlert size={36} className="text-sky-300/60 mx-auto mb-3" />
                <p className="text-sm text-sky-400 font-semibold tracking-wide">
                  {reportType === 'customer' && !selectedCustomerId ? 'Please select a customer to display statement ledger.' :
                   reportType === 'bank' && !selectedBankId ? 'Please select a bank account to display statement ledger.' :
                   'No transaction entries matched current filters.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto app-scrollbar print:overflow-visible">
                <table className="w-full text-left text-[13px] whitespace-nowrap print:text-[9px] print:whitespace-normal">
                  <thead className="bg-gradient-to-b from-sky-50/50 to-white/50 backdrop-blur-md sticky top-0 z-10 border-b border-sky-100">
                    <tr className="text-[10px] uppercase font-black text-sky-400 tracking-wider">
                      {reportType === 'customer' || reportType === 'bank' ? (
                        <>
                          <th className="py-3 pr-4">Date</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4 text-right">Debit (Outflow)</th>
                          <th className="py-3 px-4 text-right">Credit (Inflow)</th>
                          <th className="py-3 pl-4 text-right">Running Balance</th>
                        </>
                      ) : reportType === 'currency' ? (
                        <>
                          <th className="py-3 pr-4">{t('reports.currency')}</th>
                          <th className="py-3 px-4 text-center">{t('reports.tx_count')}</th>
                          <th className="py-3 px-4 text-right">{t('reports.total_inflow')}</th>
                          <th className="py-3 px-4 text-right">{t('reports.total_outflow')}</th>
                          <th className="py-3 pl-4 text-right">{t('reports.net_vault')}</th>
                        </>
                      ) : reportType === 'audit' ? (
                        <>
                          <th className="py-3 pr-4">{t('reports.timestamp')}</th>
                          <th className="py-3 px-4">{t('reports.action')}</th>
                          <th className="py-3 px-4">{t('reports.operator')}</th>
                          <th className="py-3 px-4">{t('reports.details')}</th>
                          <th className="py-3 pl-4">{t('reports.ip_network')}</th>
                        </>
                      ) : (
                        <>
                          <th className="py-3 pr-4">{t('reports.receipt_no')}</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">{t('reports.customer')}</th>
                          <th className="py-3 px-4">{t('reports.method')}</th>
                          <th className="py-3 px-4">{t('reports.type')}</th>
                          <th className="py-3 px-4 text-right">{t('reports.amount')}</th>
                          <th className="py-3 pl-4 text-right">{t('reports.eq_usd')}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-50/50">
                    {reportType === 'customer' || reportType === 'bank' ? (
                      reportData.map((item) => (
                        <tr key={item.id} className="hover:bg-sky-50/30 transition-colors">
                          <td className="py-3 pr-4 text-sky-500 font-medium whitespace-nowrap">{formatDate(item.date)}</td>
                          <td className="py-3 px-4 text-sky-900 font-semibold">{item.description}</td>
                          <td className="py-3 px-4 text-right text-rose-600 font-mono font-bold">
                            {item.debit > 0 ? Number(item.debit).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-mono font-bold">
                            {item.credit > 0 ? Number(item.credit).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                          </td>
                          <td className="py-3 pl-4 text-right text-sky-900 font-mono font-extrabold">
                            {Number(item.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                        </tr>
                      ))
                    ) : reportType === 'currency' ? (
                      reportData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-sky-50/30 transition-colors">
                          <td className="py-3 pr-4 text-sky-850 font-black text-sm">{item.currency}</td>
                          <td className="py-3 px-4 text-center text-sky-500 font-bold">{item.count}</td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-mono font-bold">
                            {Number(item.received || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                          <td className="py-3 px-4 text-right text-rose-600 font-mono font-bold">
                            {Number(item.paid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                          <td className={`py-3 pl-4 text-right font-mono font-black ${item.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {Number(item.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                        </tr>
                      ))
                    ) : reportType === 'audit' ? (
                      reportData.map((item) => (
                        <tr key={item.id} className="hover:bg-sky-50/30 transition-colors text-[11px]">
                          <td className="py-3 pr-4 text-sky-500 whitespace-nowrap">{formatDate(item.created_at)}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-100 text-[9px] font-bold uppercase">{item.action}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-sky-800 whitespace-nowrap">{item.user_email || 'System'}</td>
                          <td className="py-3 px-4 text-sky-700 font-medium">{item.description}</td>
                          <td className="py-3 pl-4 font-mono text-sky-400 whitespace-nowrap">{item.ip_address || 'Localhost'}</td>
                        </tr>
                      ))
                    ) : (
                      reportData.map((item) => (
                        <tr key={item.id} className="hover:bg-sky-50/30 transition-colors">
                          <td className="py-3 pr-4 text-sky-900 font-black font-mono whitespace-nowrap">{item.receipt_no}</td>
                          <td className="py-3 px-4 text-sky-500 whitespace-nowrap">{formatDate(item.date)}</td>
                          <td className="py-3 px-4 text-sky-800 font-bold max-w-[150px] truncate">{item.customer_name}</td>
                          <td className="py-3 px-4 text-sky-600 font-medium whitespace-nowrap">{item.payment_method}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              item.type === 'Received'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : 'bg-rose-50 text-rose-600 border border-rose-100'
                            }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-sky-900 font-mono font-bold whitespace-nowrap">
                            {Number(item.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} {item.currency}
                          </td>
                          <td className="py-3 pl-4 text-right text-sky-400 font-mono whitespace-nowrap">
                            {Number(item.equivalent_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} USD
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </div>
      )}

    </div>
  );
}
