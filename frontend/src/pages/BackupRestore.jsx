import React, { useState, useEffect, useRef } from 'react';
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
  ShieldAlert,
  Upload,
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
  const [message, setMessage] = useState({ text: '', type: '' });

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
      setLogs(res.data);
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

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.confirm('WARNING: Restoring the database will OVERWRITE all existing transactions, ledgers, customer accounts, and settings. Are you sure you want to proceed?')) {
      setRestoring(true);
      setMessage({ text: '', type: '' });
      try {
        const res = await backupAPI.import(file);
        if (res.data.ok) {
          setMessage({ text: 'Database restored successfully! Reloading workspace...', type: 'success' });
          loadData();
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (err) {
        console.error(err);
        setMessage({ text: err.response?.data?.detail || 'Failed to restore database backup.', type: 'error' });
      } finally {
        setRestoring(false);
      }
    }
    e.target.value = '';
  };

  const handleZipImportChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.confirm('Restore attachments from backup archive? This will extract and overwrite transaction images and PDF receipts.')) {
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
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-sky-900 tracking-tight leading-tight">Backup & Restore Vault</h1>
          <p className="text-xs font-bold text-sky-500/80 mt-1">Export database snapshots, manage document archives, or inspect security audit trails.</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-sky-100 bg-white/60 hover:bg-sky-50 text-sky-800 font-bold text-xs rounded-xl shadow-xs transition-all shrink-0"
        >
          <RefreshCw size={14} className="text-sky-500" />
          <span>Refresh Vault Status</span>
        </button>
      </div>

      {/* Message Banner */}
      {message.text && (
        <div className={`p-4 border rounded-xl text-xs font-semibold leading-relaxed shadow-xs flex items-start gap-2.5 ${
          message.type === 'success'
            ? 'bg-emerald-50/90 border-emerald-100 text-emerald-700'
            : 'bg-rose-50/90 border-rose-100 text-rose-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
          )}
          <div>{message.text}</div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Actions & Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Storage Metrics Card */}
          <GlassCard className="p-6 space-y-5">
            <h2 className="text-xs font-black text-sky-900 uppercase tracking-wider border-b border-sky-100 pb-3 flex items-center gap-2">
              <Database size={16} className="text-sky-500" />
              <span>Vault Storage Metrics</span>
            </h2>

            {loadingStatus ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="animate-spin text-sky-500" size={24} />
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-xs border-b border-sky-50/80 pb-2.5">
                  <span className="text-sky-500/90 font-bold">Database File Size</span>
                  <span className="text-sky-900 font-black font-mono">{formatBytes(status?.db_size_bytes)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-sky-50/80 pb-2.5">
                  <span className="text-sky-500/90 font-bold">Attachments Size</span>
                  <span className="text-sky-900 font-black font-mono">{formatBytes(status?.attachments_size_bytes)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-sky-50/80 pb-2.5">
                  <span className="text-sky-500/90 font-bold">Last Vault Backup</span>
                  <span className="text-sky-900 font-black font-mono">
                    {status?.last_backup_at ? formatDate(status.last_backup_at) : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-sky-500/90 font-bold">Auto Backup System</span>
                  <button 
                    type="button"
                    onClick={handleToggleAutoBackup}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      status?.auto_backup ? 'bg-sky-500' : 'bg-sky-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        status?.auto_backup ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Backup Operations Card */}
          <GlassCard className="p-6 space-y-4">
            <h2 className="text-xs font-black text-sky-900 uppercase tracking-wider border-b border-sky-100 pb-3 flex items-center gap-2">
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
              {/* Positive/Export Actions */}
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full py-3 bg-gradient-to-tr from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Download size={15} />
                <span>Export Database Snapshot (JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleExportAttachments}
                className="w-full py-3 bg-gradient-to-tr from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <FileArchive size={15} />
                <span>Export Attachments Archive (ZIP)</span>
              </button>

              {/* Destructive / Restore Actions with Rose & Amber warning styling */}
              <button
                type="button"
                onClick={handleImportClick}
                disabled={restoring}
                className="w-full py-3 bg-gradient-to-tr from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {restoring ? <Loader2 className="animate-spin" size={15} /> : <AlertTriangle size={15} />}
                <span>Restore Database JSON (Overwrites Data)</span>
              </button>

              <button
                type="button"
                onClick={handleZipImportClick}
                disabled={restoringAttachments}
                className="w-full py-3 border border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-800 font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {restoringAttachments ? <Loader2 className="animate-spin text-amber-600" size={15} /> : <Upload size={15} />}
                <span>Restore Attachments ZIP Archive</span>
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Security Audit Trail Table */}
        <GlassCard className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex items-center justify-between border-b border-sky-100 pb-3 mb-5">
            <h2 className="text-xs font-black text-sky-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={16} className="text-sky-500" />
              <span>Security Audit Trail</span>
            </h2>
            <button
              type="button"
              onClick={fetchLogs}
              className="text-xs font-bold text-sky-500 hover:text-sky-700 transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} />
              <span>Refresh Trail</span>
            </button>
          </div>

          {loadingLogs ? (
            <div className="py-20 flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-sky-500" size={28} />
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto min-h-[40vh] max-h-[60vh] pr-1 app-scrollbar">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-sky-100 text-[10px] font-black uppercase text-sky-500 tracking-[0.1em] bg-white/40">
                    <th className="py-3 pr-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Operator</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 pl-4">Network Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/60 text-xs font-bold text-sky-900">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="py-3 pr-4 text-sky-500 font-semibold whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                          log.action === 'create' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' :
                          log.action === 'update' ? 'bg-amber-50 text-amber-700 border border-amber-200/70' :
                          log.action === 'delete' ? 'bg-rose-50 text-rose-700 border border-rose-200/70' :
                          log.action === 'import' ? 'bg-purple-50 text-purple-700 border border-purple-200/70' :
                          'bg-sky-50 text-sky-700 border border-sky-200/70'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-sky-900 max-w-[150px] truncate">
                        {log.user_email || 'System'}
                      </td>
                      <td className="py-3 px-4 text-sky-700 font-semibold min-w-[200px]">
                        {log.description}
                      </td>
                      <td className="py-3 pl-4 text-sky-500 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                          <span className="flex items-center gap-1">
                            <Globe size={10} className="text-sky-400" />
                            {log.ip_address || 'Localhost'}
                          </span>
                          <span className="flex items-center gap-1 max-w-[150px] truncate" title={log.device_info}>
                            <Laptop size={10} className="text-sky-400" />
                            {log.device_info ? log.device_info.split(')')[0].replace('Mozilla/5.0 (', '') : 'CLI / System'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-sky-400 font-bold">
                        No security actions recorded in audit trail.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

      </div>
    </div>
  );
}
