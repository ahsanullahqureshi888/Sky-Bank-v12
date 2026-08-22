import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  Power,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../api/client';
import GlassCard from '../components/GlassCard';

const roles = ['Admin', 'Accountant', 'Viewer'];
const pageSize = 6;

const createForm = {
  name: '',
  email: '',
  password: '',
  role: 'Viewer',
};

const passwordForm = {
  password: '',
  confirmPassword: '',
};

const apiMessage = (error, fallback) =>
  error?.response?.data?.detail || error?.response?.data?.message || error?.message || fallback;

const getPasswordStrength = (password) => {
  if (!password) return { label: 'Not set', width: '0%', color: 'bg-slate-200', text: 'text-slate-400' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { label: 'Weak', width: '35%', color: 'bg-rose-500', text: 'text-rose-600' };
  if (score <= 4) return { label: 'Good', width: '70%', color: 'bg-amber-500', text: 'text-amber-600' };
  return { label: 'Strong', width: '100%', color: 'bg-emerald-500', text: 'text-emerald-600' };
};

const safeUserText = (value) => String(value ?? '');

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('sky_banking_user') || '{}');
  } catch {
    localStorage.removeItem('sky_banking_user');
    return {};
  }
};

const getRoleBadgeClass = (role) => {
  switch (role) {
    case 'Admin':
      return 'bg-sky-50 text-sky-700 border border-sky-200/70 font-black';
    case 'Accountant':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-black';
    case 'Viewer':
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200/70 font-black';
  }
};

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-xs font-black shadow-xl backdrop-blur-xl transition-all ${
        isSuccess ? 'border-emerald-100 bg-emerald-50/95 text-emerald-700' : 'border-rose-100 bg-rose-50/95 text-rose-700'
      }`}
      role="status"
    >
      {isSuccess ? <CheckCircle size={16} className="shrink-0 text-emerald-500" /> : <AlertCircle size={16} className="shrink-0 text-rose-500" />}
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} className="ml-2 rounded-lg p-0.5 opacity-70 hover:bg-white/60" aria-label="Close notification">
        <X size={14} />
      </button>
    </div>
  );
}

function ActionButton({ title, children, onClick, disabled, tone = 'sky' }) {
  const toneClass = {
    sky: 'text-sky-700 hover:bg-sky-100/80 bg-white/60 border border-sky-100/80',
    amber: 'text-amber-700 hover:bg-amber-100/80 bg-white/60 border border-amber-100/80',
    emerald: 'text-emerald-700 hover:bg-emerald-100/80 bg-white/60 border border-emerald-100/80',
    rose: 'text-rose-700 hover:bg-rose-100/80 bg-white/60 border border-rose-100/80',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl shadow-xs transition-all disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
}

export default function UserManagement() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [mode, setMode] = useState('create');
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState(createForm);
  const [password, setPassword] = useState(passwordForm);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const formRef = useRef(null);

  const scrollToForm = () => {
    if (window.innerWidth < 1280) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  const currentUser = getStoredUser();
  const isAdmin = currentUser.role === 'Admin';
  const strength = getPasswordStrength(mode === 'password' ? password.password : form.password);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authAPI.listUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users list', err);
      showToast('error', apiMessage(err, 'Failed to load users.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
    else setLoading(false);
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !needle || safeUserText(user.name).toLowerCase().includes(needle) || safeUserText(user.email).toLowerCase().includes(needle);
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesStatus = !statusFilter || String(user.is_active) === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const resetPanel = () => {
    setMode('create');
    setSelectedUser(null);
    setForm(createForm);
    setPassword(passwordForm);
    setErrors({});
    setShowPassword(false);
    scrollToForm();
  };

  const startEdit = (user) => {
    setMode('edit');
    setSelectedUser(user);
    setForm({ name: user.name || '', email: user.email || '', role: user.role || 'Viewer' });
    setPassword(passwordForm);
    setErrors({});
    setShowPassword(false);
    scrollToForm();
  };

  const startPassword = (user) => {
    setMode('password');
    setSelectedUser(user);
    setForm({ name: user.name || '', email: user.email || '', role: user.role || 'Viewer' });
    setPassword(passwordForm);
    setErrors({});
    setShowPassword(false);
    scrollToForm();
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPassword((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateProfile = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Full name is required.';
    if (!form.email.trim()) nextErrors.email = 'Email address is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (!roles.includes(form.role)) nextErrors.role = 'Choose a valid security role.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validatePassword = (values = password) => {
    const nextErrors = {};
    if (!values.password || values.password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
    if (values.password !== values.confirmPassword) nextErrors.confirmPassword = 'Passwords must match.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mode === 'password') {
      if (!selectedUser || !validatePassword()) return;
      setSaving(true);
      try {
        await authAPI.changePassword(selectedUser.id, password.password);
        setPassword(passwordForm);
        showToast('success', 'Password updated successfully.');
      } catch (err) {
        console.error(err);
        showToast('error', apiMessage(err, 'Failed to update password.'));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!validateProfile()) return;
    if (mode === 'create' && !validatePassword({ password: form.password, confirmPassword: form.password })) return;

    setSaving(true);
    try {
      if (mode === 'edit' && selectedUser) {
        const res = await authAPI.updateUser(selectedUser.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
        });
        setSelectedUser(res.data);
        if (String(selectedUser.id) === String(currentUser.id)) {
          localStorage.setItem('sky_banking_user', JSON.stringify(res.data));
        }
        showToast('success', 'User updated successfully.');
      } else {
        await authAPI.register(form.name.trim(), form.email.trim(), form.password, form.role);
        showToast('success', 'User created successfully.');
        resetPanel();
      }
      await fetchUsers();
    } catch (err) {
      console.error(err);
      showToast('error', apiMessage(err, 'Failed to save user.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (String(user.id) === String(currentUser.id)) {
      showToast('error', 'You cannot deactivate your own active account.');
      return;
    }

    setProcessingId(user.id);
    try {
      await authAPI.toggleUser(user.id);
      await fetchUsers();
      showToast('success', user.is_active ? 'User deactivated successfully.' : 'User activated successfully.');
    } catch (err) {
      console.error(err);
      showToast('error', apiMessage(err, 'Failed to modify user status.'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setProcessingId(deleteTarget.id);
    try {
      await authAPI.deleteUser(deleteTarget.id);
      if (selectedUser?.id === deleteTarget.id) resetPanel();
      setDeleteTarget(null);
      await fetchUsers();
      showToast('success', 'User deleted successfully.');
    } catch (err) {
      console.error(err);
      showToast('error', apiMessage(err, 'Failed to delete user.'));
    } finally {
      setProcessingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-grow items-center justify-center p-4">
        <GlassCard className="max-w-md space-y-4 p-8 text-center">
          <div className="inline-flex rounded-full bg-amber-50 p-4 text-amber-600 border border-amber-100">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-lg font-black text-sky-900">{t('userManagement.access_restricted')}</h2>
          <p className="text-xs font-semibold leading-relaxed text-sky-500">
            Only administrators are authorized to manage users, add accountants, or view the accounts directory.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-sky-900 tracking-tight leading-tight">{t('userManagement.user_directory')}</h1>
          <p className="text-xs font-bold text-sky-500/80 mt-1">{t('userManagement.manage_operators')}</p>
        </div>
        <button
          type="button"
          onClick={resetPanel}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-tr from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-black text-xs shadow-md transition-all shrink-0"
        >
          <Plus size={16} />
          <span>New User Account</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        
        {/* Left Side: Directory & Table */}
        <GlassCard className="min-w-0 p-6 space-y-5">
          <div className="flex flex-col gap-4 border-b border-sky-100 pb-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xs font-black text-sky-900 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-sky-500" />
                <span>{t('userManagement.registered_users')}</span>
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">{t('userManagement.vault_access')}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400" size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                  placeholder="Search users by name or email..."
                  aria-label="Search users"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                aria-label="Filter by role"
              >
                <option value="">All Roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                aria-label="Filter by status"
              >
                <option value="">All Statuses</option>
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid animate-pulse grid-cols-5 gap-4 rounded-xl bg-white/40 p-4">
                  <span className="h-4 rounded bg-sky-100" />
                  <span className="h-4 rounded bg-sky-100" />
                  <span className="h-4 rounded bg-sky-100" />
                  <span className="h-4 rounded bg-sky-100" />
                  <span className="h-4 rounded bg-sky-100" />
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-sky-100 bg-white/30 p-8 text-center">
              <UserCheck size={38} className="mb-3 text-sky-300" />
              <h3 className="text-sm font-black text-sky-900">No users found</h3>
              <p className="mt-1 max-w-sm text-xs font-medium text-sky-500">
                Adjust search or filters, or create a new operator account from the form panel.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto rounded-2xl border border-sky-100/70 bg-white/30 md:block">
                <table className="w-full min-w-[700px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-sky-100 text-[10px] font-black uppercase tracking-[0.1em] text-sky-500 bg-white/50">
                      <th className="px-4 py-3">Full Name</th>
                      <th className="px-4 py-3">Email / Username</th>
                      <th className="px-4 py-3">Security Role</th>
                      <th className="px-4 py-3">Account Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100/60 text-xs font-bold text-sky-900">
                    {pagedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-sky-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-black text-sky-900">{user.name}</td>
                        <td className="px-4 py-3.5 font-semibold text-sky-600">{user.email}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${getRoleBadgeClass(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                            user.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                          }`}>
                            {user.is_active ? t('userManagement.active') : t('userManagement.disabled')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <ActionButton title={`Edit ${user.name}`} onClick={() => startEdit(user)}>
                              <Edit2 size={14} />
                            </ActionButton>
                            <ActionButton title={`Change password for ${user.name}`} onClick={() => startPassword(user)} tone="amber">
                              <KeyRound size={14} />
                            </ActionButton>
                            <ActionButton
                              title={user.is_active ? `Deactivate ${user.name}` : `Activate ${user.name}`}
                              onClick={() => handleToggleActive(user)}
                              disabled={String(user.id) === String(currentUser.id) || processingId === user.id}
                              tone={user.is_active ? 'rose' : 'emerald'}
                            >
                              {processingId === user.id ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                            </ActionButton>
                            <ActionButton
                              title={`Delete ${user.name}`}
                              onClick={() => setDeleteTarget(user)}
                              disabled={String(user.id) === String(currentUser.id) || processingId === user.id}
                              tone="rose"
                            >
                              <Trash2 size={14} />
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="space-y-3 md:hidden">
                {pagedUsers.map((user) => (
                  <div key={user.id} className="rounded-2xl border border-sky-100 bg-white/50 p-4 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-xs font-black text-sky-900">{user.name}</h3>
                        <p className="truncate text-[11px] font-semibold text-sky-600">{user.email}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${user.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-sky-100/60 pt-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${getRoleBadgeClass(user.role)}`}>{user.role}</span>
                      <div className="flex items-center gap-1">
                        <ActionButton title={`Edit ${user.name}`} onClick={() => startEdit(user)}><Edit2 size={14} /></ActionButton>
                        <ActionButton title={`Change password for ${user.name}`} onClick={() => startPassword(user)} tone="amber"><KeyRound size={14} /></ActionButton>
                        <ActionButton title={user.is_active ? `Deactivate ${user.name}` : `Activate ${user.name}`} onClick={() => handleToggleActive(user)} disabled={String(user.id) === String(currentUser.id) || processingId === user.id} tone={user.is_active ? 'rose' : 'emerald'}><Power size={14} /></ActionButton>
                        <ActionButton title={`Delete ${user.name}`} onClick={() => setDeleteTarget(user)} disabled={String(user.id) === String(currentUser.id) || processingId === user.id} tone="rose"><Trash2 size={14} /></ActionButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t border-sky-100 pt-4 text-xs font-bold text-sky-500 sm:flex-row sm:items-center sm:justify-between">
                <span>Showing {pagedUsers.length} of {filteredUsers.length} operators</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1} className="rounded-xl border border-sky-100 bg-white/60 hover:bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 disabled:opacity-40 transition-all">Previous</button>
                  <span className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-1.5 text-xs font-black text-sky-700">{page} / {totalPages}</span>
                  <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages} className="rounded-xl border border-sky-100 bg-white/60 hover:bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 disabled:opacity-40 transition-all">Next</button>
                </div>
              </div>
            </>
          )}
        </GlassCard>

        {/* Right Side: Form Panel */}
        <GlassCard className="p-6 md:p-8" id="user-form-panel">
          <div ref={formRef}>
            <h2 className="text-xs font-black text-sky-900 uppercase tracking-wider border-b border-sky-100 pb-3 mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2">
                {mode === 'create' ? <UserPlus size={16} className="text-sky-500" /> : mode === 'edit' ? <Edit2 size={16} className="text-sky-500" /> : <KeyRound size={16} className="text-sky-500" />}
                <span>{mode === 'create' ? 'Create Operator Account' : mode === 'edit' ? 'Edit Account Profile' : 'Update Security Password'}</span>
              </span>
              {mode !== 'create' && (
                <button
                  type="button"
                  onClick={resetPanel}
                  className="text-[10px] font-black uppercase text-sky-500 hover:text-sky-700 transition-colors"
                >
                  Cancel
                </button>
              )}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== 'password' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                      placeholder="e.g. Finance Admin"
                      value={form.name}
                      onChange={handleFormChange}
                    />
                    {errors.name && <p className="mt-1 text-[10px] font-bold text-rose-600">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                      Email / Username
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                      placeholder="operator@skybanking.local"
                      value={form.email}
                      onChange={handleFormChange}
                    />
                    {errors.email && <p className="mt-1 text-[10px] font-bold text-rose-600">{errors.email}</p>}
                  </div>

                  {mode === 'create' && (
                    <div>
                      <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                        Initial Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          autoComplete="new-password"
                          className="w-full px-4 py-2.5 pr-10 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                          placeholder="At least 8 characters"
                          value={form.password}
                          onChange={handleFormChange}
                        />
                        <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-sky-400 hover:text-sky-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {errors.password && <p className="mt-1 text-[10px] font-bold text-rose-600">{errors.password}</p>}
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-sky-100/60">
                          <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                        </div>
                        <p className={`mt-1 text-[9px] font-black uppercase ${strength.text}`}>Strength: {strength.label}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                      Security Role
                    </label>
                    <select
                      name="role"
                      className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                      value={form.role}
                      onChange={handleFormChange}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    {errors.role && <p className="mt-1 text-[10px] font-bold text-rose-600">{errors.role}</p>}
                  </div>
                </>
              )}

              {mode === 'password' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        autoComplete="new-password"
                        className="w-full px-4 py-2.5 pr-10 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                        placeholder="Enter new password"
                        value={password.password}
                        onChange={handlePasswordChange}
                      />
                      <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-sky-400 hover:text-sky-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-[10px] font-bold text-rose-600">{errors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      autoComplete="new-password"
                      className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                      placeholder="Confirm new password"
                      value={password.confirmPassword}
                      onChange={handlePasswordChange}
                    />
                    {errors.confirmPassword && <p className="mt-1 text-[10px] font-bold text-rose-600">{errors.confirmPassword}</p>}
                  </div>

                  <div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sky-100/60">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                    </div>
                    <p className={`mt-1 text-[9px] font-black uppercase ${strength.text}`}>Strength: {strength.label}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 mt-2 bg-gradient-to-tr from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : mode === 'password' ? <KeyRound size={16} /> : <UserCheck size={16} />}
                <span>{mode === 'create' ? 'Add User Account' : mode === 'edit' ? 'Save User Changes' : 'Update Password'}</span>
              </button>
            </form>
          </div>
        </GlassCard>

      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/40 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
          <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 id="delete-user-title" className="text-base font-black text-sky-900">Delete User Account?</h2>
                <p className="mt-1 text-xs font-medium leading-relaxed text-sky-600">
                  This will remove <span className="font-bold text-sky-900">{deleteTarget.name}</span> from system access. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(processingId)} className="px-4 py-2.5 rounded-xl border border-sky-100 bg-white/80 hover:bg-sky-50 text-xs font-bold text-sky-800 transition-all disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteUser} disabled={Boolean(processingId)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-tr from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-xs font-black text-white shadow-md transition-all disabled:opacity-70">
                {processingId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
