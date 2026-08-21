import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ClipboardCopy,
  Database,
  Download,
  FileArchive,
  Globe,
  Laptop,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
  Check,
  HardDrive,
  FileText,
  Clock,
  HelpCircle,
  X
} from 'lucide-react';
import { backupAPI, settingsAPI } from '../api/client';
import { formatDate } from '../utils/formatters';
import GlassCard from '../components/GlassCard';

const formatBytes = (bytes) => {
  if (bytes === 0 || bytes === '0') return '0 Bytes';
  if (!bytes) return 'N/A';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function BackupRestore() {
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoringAttachments, setRestoringAttachments] = useState(false);
  const [restoringPreset, setRestoringPreset] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [copiedIp, setCopiedIp] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  
  // Custom Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: '',
    isDestructive: true,
    onConfirm: null,
  });

  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await backupAPI.status();
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch backup status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await backupAPI.auditLogs();
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadData = () => {
    fetchStatus();
    fetchLogs();
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyIp = (ip) => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const handleToggleAutoBackup = async () => {
    if (!status) return;
    const newAutoValue = !status.auto_backup;
    try {
      await settingsAPI.update({ auto_backup: newAutoValue });
      setStatus((prev) => ({ ...prev, auto_backup: newAutoValue }));
      setMessage({ text: `Automatic backup system is now ${newAutoValue ? 'ENABLED' : 'DISABLED'}.`, type: 'success' });
      fetchLogs();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to update auto backup configuration.', type: 'error' });
    }
  };

  const handleExportBackup = async () => {
    try {
      setMessage({ text: '', type: '' });
      const res = await backupAPI.export();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `sky-banking-db-backup-${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setMessage({ text: 'Database JSON backup file downloaded successfully.', type: 'success' });
      fetchStatus();
      fetchLogs();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to generate database backup export.', type: 'error' });
    }
  };

  const handleExportAttachments = async () => {
    try {
      setMessage({ text: '', type: '' });
      const res = await backupAPI.exportAttachments();
      const blob = new Blob([res.data], { type: 'application/zip' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', downloadUrl);
      downloadAnchor.setAttribute('download', `sky-banking-attachments-${Date.now()}.zip`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setMessage({ text: 'Attachments ZIP archive downloaded successfully.', type: 'success' });
      fetchStatus();
      fetchLogs();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to generate attachments archive export.', type: 'error' });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleZipImportClick = () => {
    zipInputRef.current?.click();
  };

  const executeJsonRestore = async (file) => {
    setRestoring(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await backupAPI.import(file);
      if (res.data.ok) {
        setMessage({ text: 'Database restored successfully! Reloading workspace...', type: 'success' });
        loadData();
        setTimeout(() => {
          window.location.reload();
        }, 1800);
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: err.response?.data?.detail || 'Failed to restore database backup.', type: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmModal({
      isOpen: true,
      title: 'Restore Database Snapshot?',
      description: `You are about to restore "${file.name}". This will OVERWRITE existing transactions, customers, bank ledgers, and settings with data from the backup file.`,
      confirmLabel: 'Yes, Overwrite & Restore',
      isDestructive: true,
      onConfirm: () => executeJsonRestore(file),
    });
    e.target.value = '';
  };

  const executeZipRestore = async (file) => {
    setRestoringAttachments(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await backupAPI.importAttachments(file);
      if (res.data.ok) {
        setMessage({ text: `Attachments extracted successfully. Restored ${res.data.extracted_count} receipt files.`, type: 'success' });
        loadData();
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: err.response?.data?.detail || 'Failed to restore attachments archive.', type: 'error' });
    } finally {
      setRestoringAttachments(false);
    }
  };

  const handleZipImportChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmModal({
      isOpen: true,
      title: 'Restore Attachments Archive?',
      description: `Restore transaction receipts, PDF vouchers, and company assets from "${file.name}"? Existing receipt files with matching names will be replaced.`,
      confirmLabel: 'Extract & Restore ZIP',
      isDestructive: false,
      onConfirm: () => executeZipRestore(file),
    });
    e.target.value = '';
  };

  // 1-Click Restore Default / Preset Company Dataset
  const handleRestorePresetData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Load Standard Afghan Company Data?',
      description: 'This will reset the database to the official Sky Ariana Group dataset with Kandahar company settings, primary customers, bank accounts, Hawala transactions, and audit records.',
      confirmLabel: '⚡ 1-Click Load Company Data',
      isDestructive: true,
      onConfirm: async () => {
        setRestoringPreset(true);
        setMessage({ text: '', type: '' });
        try {
          // Fetch initial JSON payload from frontend assets
          const res = await fetch('/sky_banking_initial_data.json');
          const data = await res.json();
          const jsonBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          const jsonFile = new File([jsonBlob], 'sky_banking_initial_data.json', { type: 'application/json' });

          const importRes = await backupAPI.import(jsonFile);
          if (importRes.data.ok) {
            setMessage({ text: 'Standard company data restored successfully! Refreshing workspace...', type: 'success' });
            loadData();
            setTimeout(() => {
              window.location.reload();
            }, 1800);
          }
        } catch (err) {
          console.error(err);
          setMessage({ text: err.response?.data?.detail || 'Failed to restore standard dataset.', type: 'error' });
        } finally {
          setRestoringPreset(false);
        }
      },
    });
  };

  // Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = 
        !searchTerm ||
        (log.description && log.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.user_email && log.user_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.table_name && log.table_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.ip_address && log.ip_address.includes(searchTerm));
      
      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter.toLowerCase();
      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  return (
    <div className="space-y-6">
      
      {/* Page Title & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-sky-950 tracking-tight leading-tight">Backup & Restore Vault</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Vault Active
            </span>
          </div>
          <p className="text-xs font-bold text-sky-600/90 mt-1">Export database snapshots, manage document archives, or inspect security audit trails.</p>
        </div>
        
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRestorePresetData}
            disabled={restoringPreset}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-sky-200/80 bg-gradient-to-r from-sky-50 to-blue-50 hover:from-sky-100 hover:to-blue-100 text-sky-900 font-black text-xs rounded-xl shadow-xs transition-all ios-button-tap"
            title="Load default Afghan company dataset"
          >
            {restoringPreset ? <Loader2 className="animate-spin text-sky-600" size={14} /> : <Sparkles size={14} className="text-sky-600" />}
            <span>1-Click Load Company Data</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-sky-100 bg-white/80 hover:bg-sky-50 text-sky-800 font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            <RefreshCw size={14} className="text-sky-500" />
            <span>Refresh Vault</span>
          </button>
        </div>
      </div>

      {/* Message Notification Banner */}
      {message.text && (
        <div className={`p-4 border rounded-2xl text-xs font-semibold leading-relaxed shadow-sm flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
          message.type === 'success'
            ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
            : 'bg-rose-50/95 border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 font-bold">{message.text}</div>
          <button onClick={() => setMessage({ text: '', type: '' })} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Vault Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Actions & Settings Left Column */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Storage Metrics Card */}
          <GlassCard className="p-6 space-y-5 shadow-xl shadow-sky-950/[0.03]">
            <h2 className="text-xs font-black text-sky-950 uppercase tracking-wider border-b border-sky-100/80 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <HardDrive size={16} className="text-sky-500" />
                <span>Vault Storage Metrics</span>
              </span>
              <span className="text-[10px] font-bold text-sky-500 font-mono">SQLite / Memory</span>
            </h2>

            {loadingStatus ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="animate-spin text-sky-500" size={24} />
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-xs border-b border-sky-50/80 pb-2.5">
                  <span className="text-sky-600/90 font-bold flex items-center gap-1.5">
                    <Database size={13} className="text-sky-400" />
                    Database File Size
                  </span>
                  <span className="text-sky-950 font-black font-mono bg-sky-50/70 px-2 py-0.5 rounded-md border border-sky-100">
                    {formatBytes(status?.db_size_bytes)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs border-b border-sky-50/80 pb-2.5">
                  <span className="text-sky-600/90 font-bold flex items-center gap-1.5">
                    <FileArchive size={13} className="text-sky-400" />
                    Attachments Size
                  </span>
                  <span className="text-sky-950 font-black font-mono bg-sky-50/70 px-2 py-0.5 rounded-md border border-sky-100">
                    {formatBytes(status?.attachments_size_bytes)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs border-b border-sky-50/80 pb-2.5">
                  <span className="text-sky-600/90 font-bold flex items-center gap-1.5">
                    <Clock size={13} className="text-sky-400" />
                    Last Vault Backup
                  </span>
                  <span className="text-sky-950 font-black font-mono text-[11px]">
                    {status?.last_backup_at ? formatDate(status.last_backup_at) : 'Never'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1.5">
                  <div>
                    <span className="text-sky-950 font-black block">Auto Backup System</span>
                    <span className="text-[10px] text-sky-500 font-semibold">Automatic cloud sync</span>
                  </div>
                  <button 
                    type="button"
                    onClick={handleToggleAutoBackup}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      status?.auto_backup ? 'bg-sky-500 shadow-md shadow-sky-500/20' : 'bg-sky-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                        status?.auto_backup ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Backup Operations Card */}
          <GlassCard className="p-6 space-y-4 shadow-xl shadow-sky-950/[0.03]">
            <h2 className="text-xs font-black text-sky-950 uppercase tracking-wider border-b border-sky-100/80 pb-3 flex items-center gap-2">
              <Download size={16} className="text-sky-500" />
              <span>Operations Panel</span>
            </h2>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFileChange}
              className="hidden"
              accept=".json"
            />
            <input
              type="file"
              ref={zipInputRef}
              onChange={handleZipImportChange}
              className="hidden"
              accept=".zip"
            />

            <div className="space-y-3 pt-1">
              {/* Positive / Export Actions */}
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/15 transition-all flex items-center justify-center gap-2.5 ios-button-tap"
              >
                <Download size={15} />
                <span>Export Database Snapshot (JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleExportAttachments}
                className="w-full py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-sky-600/15 transition-all flex items-center justify-center gap-2.5 ios-button-tap"
              >
                <FileArchive size={15} />
                <span>Export Attachments Archive (ZIP)</span>
              </button>

              {/* Destructive / Restore Actions */}
              <button
                type="button"
                onClick={handleImportClick}
                disabled={restoring}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/15 transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 ios-button-tap"
              >
                {restoring ? <Loader2 className="animate-spin" size={15} /> : <AlertTriangle size={15} />}
                <span>Restore Database JSON (Overwrites Data)</span>
              </button>

              <button
                type="button"
                onClick={handleZipImportClick}
                disabled={restoringAttachments}
                className="w-full py-3 border border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-900 font-black text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 ios-button-tap"
              >
                {restoringAttachments ? <Loader2 className="animate-spin text-amber-600" size={15} /> : <Upload size={15} />}
                <span>Restore Attachments ZIP Archive</span>
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Security Audit Trail Table Column */}
        <GlassCard className="lg:col-span-2 p-6 flex flex-col shadow-xl shadow-sky-950/[0.03]">
          
          {/* Audit Header & Search / Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-sky-100/80 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-sky-500" />
              <div>
                <h2 className="text-sm font-black text-sky-950 uppercase tracking-wider">
                  Security Audit Trail
                </h2>
                <span className="text-[10px] text-sky-500 font-bold">
                  Showing {filteredLogs.length} of {logs.length} logged actions
                </span>
              </div>
            </div>

            {/* Search and Action Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs font-semibold rounded-lg border border-sky-100 bg-white/80 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-[140px] sm:w-[170px]"
                />
              </div>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs font-bold rounded-lg border border-sky-100 bg-white/80 text-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="EXPORT">Export</option>
                <option value="IMPORT">Import</option>
              </select>

              <button
                type="button"
                onClick={fetchLogs}
                className="text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors p-1.5 rounded-lg border border-sky-100 bg-white/80 flex items-center justify-center"
                title="Refresh logs"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Audit Logs List Table */}
          {loadingLogs ? (
            <div className="py-20 flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-sky-500" size={28} />
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto min-h-[42vh] max-h-[62vh] pr-1 app-scrollbar">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-sky-100/90 text-[10px] font-black uppercase text-sky-500 tracking-[0.1em] bg-white/40 sticky top-0 backdrop-blur-md z-10">
                    <th className="py-3 pr-4">Timestamp</th>
                    <th className="py-3 px-3">Action</th>
                    <th className="py-3 px-3">Operator</th>
                    <th className="py-3 px-3">Details</th>
                    <th className="py-3 pl-4">Network Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/60 text-xs font-bold text-sky-950">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-sky-50/50 transition-colors group">
                      <td className="py-3 pr-4 text-sky-500 font-semibold whitespace-nowrap font-mono text-[11px]">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          log.action === 'create' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' :
                          log.action === 'update' ? 'bg-amber-50 text-amber-700 border border-amber-200/70' :
                          log.action === 'delete' ? 'bg-rose-50 text-rose-700 border border-rose-200/70' :
                          log.action === 'import' ? 'bg-purple-50 text-purple-700 border border-purple-200/70' :
                          log.action === 'export' ? 'bg-blue-50 text-blue-700 border border-blue-200/70' :
                          'bg-sky-50 text-sky-700 border border-sky-200/70'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-black text-sky-950 max-w-[140px] truncate" title={log.user_email || 'System'}>
                        {log.user_email || 'System Admin'}
                      </td>
                      <td className="py-3 px-3 text-sky-800 font-semibold min-w-[200px]" dir="auto">
                        {log.description}
                      </td>
                      <td className="py-3 pl-4 text-sky-500 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => handleCopyIp(log.ip_address)}
                            className="flex items-center gap-1 hover:text-sky-700 transition-colors text-left"
                            title="Click to copy IP"
                          >
                            <Globe size={10} className="text-sky-400" />
                            <span>{log.ip_address || '127.0.0.1'}</span>
                            {copiedIp === log.ip_address && <Check size={10} className="text-emerald-500" />}
                          </button>
                          <span className="flex items-center gap-1 max-w-[140px] truncate text-slate-400" title={log.device_info}>
                            <Laptop size={10} className="text-sky-300" />
                            {log.device_info ? log.device_info.split(')')[0].replace('Mozilla/5.0 (', '') : 'CLI / System'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-sky-400 font-bold">
                        No security actions matched your search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-sky-100 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
                confirmModal.isDestructive ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-sky-50 text-sky-600 border border-sky-100'
              }`}>
                {confirmModal.isDestructive ? <AlertTriangle size={20} /> : <Database size={20} />}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{confirmModal.title}</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Confirmation Required</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal({ ...confirmModal, isOpen: false });
                  if (action) action();
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-white font-black text-xs shadow-md transition-all ${
                  confirmModal.isDestructive 
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                    : 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20'
                }`}
              >
                {confirmModal.confirmLabel || 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
