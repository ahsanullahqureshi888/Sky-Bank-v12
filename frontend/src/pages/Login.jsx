import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';

const BRAND_NAME = 'SKY ARIANA GROUP OF COMPANIES';
const BRAND_SUBTITLE = 'Money Transaction & Hawala Receipt Management System';
const BRAND_LOGO = '/sky-bbb-logo.png';

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (step === 'forgot') {
      setError('Password reset is handled by an admin from User Management.');
      return;
    }

    setLoading(true);
    setError('');

    const email = emailOrUsername.includes('@')
      ? emailOrUsername
      : `${emailOrUsername}@skybanking.local`;

    try {
      await authAPI.login(email, password);
      if (remember) {
        localStorage.setItem('sky_banking_remember_email', emailOrUsername);
      }
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          'Invalid email or password. Verify the FastAPI backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.15),transparent_50%),linear-gradient(135deg,#f8fafc_0%,#e2e8f0_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      
      {/* Animated Golden Lines Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-90">
        <div className="golden-line-1" />
        <div className="golden-line-2" />
        <div className="golden-line-3" />
      </div>

      {/* Centered Login Card - Zoomed out via max-w-[380px] */}
      <div className="relative z-10 w-full max-w-[380px] transition-all duration-300">
        <section className="glass-panel w-full transition-all duration-500">
          <div className="relative flex flex-col p-6 sm:p-8">
            {/* Header Brand lockup */}
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-sky-100 bg-white shadow-md shadow-sky-500/10">
                <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-full w-full object-contain p-1" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-black leading-tight tracking-tight text-slate-900">{BRAND_NAME}</h1>
                <p className="mt-0.5 text-[10px] font-bold leading-snug text-slate-500">{BRAND_SUBTITLE}</p>
              </div>
            </div>

            {step === 'login' ? (
              <>
                <div className="mt-8 space-y-1">
                  <h2 className="text-xl font-black tracking-tight text-slate-900">Welcome Back</h2>
                  <p className="text-[11px] font-bold text-slate-500">Sign in to access your money history workspace</p>
                </div>

                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                  <label className="block space-y-1.5">
                    <span className="form-label">Email / Username</span>
                    <span className="relative block">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoComplete="username"
                        className="form-control pl-10 pr-4"
                        placeholder="Enter email address"
                        value={emailOrUsername}
                        onChange={(e) => setEmailOrUsername(e.target.value)}
                        required
                      />
                    </span>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="form-label">Password</span>
                    <span className="relative block">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="form-control pl-10 pr-10"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="flex cursor-pointer select-none items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-sky-200 text-sky-500 accent-sky-600 focus:ring-sky-500/20 transition"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('forgot');
                        setError('');
                      }}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-700 hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold leading-relaxed text-red-600">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="relative flex h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-[13px] font-black text-white shadow-[0_4px_15px_rgba(14,165,233,0.25)] transition-all duration-300 hover:shadow-[0_4px_20px_rgba(14,165,233,0.4)] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Signing in...
                      </span>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>

                <p className="mt-5 text-center text-[10px] font-extrabold tracking-wide text-slate-400">
                  SECURE ACCOUNTING CONSOLE
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStep('login');
                    setError('');
                  }}
                  className="mt-6 inline-flex w-fit items-center gap-1.5 text-[11px] font-extrabold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>

                <div className="mt-6 space-y-1.5 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-sky-50 text-sky-500">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">Reset Password</h2>
                  <p className="text-[11px] font-bold text-slate-500">Enter user email to contact admin.</p>
                </div>

                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                  <label className="block space-y-1.5">
                    <span className="form-label">Email</span>
                    <span className="relative block">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        className="form-control pl-10 pr-4"
                        placeholder="admin@skybanking.local"
                        value={emailOrUsername}
                        onChange={(e) => setEmailOrUsername(e.target.value)}
                        required
                      />
                    </span>
                  </label>
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold leading-relaxed text-red-600">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="relative flex h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-[13px] font-black text-white shadow-[0_4px_15px_rgba(14,165,233,0.25)] transition-all duration-300 hover:shadow-[0_4px_20px_rgba(14,165,233,0.4)] hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    Send Reset Request
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>

      <footer className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[9px] font-extrabold text-slate-400/80 tracking-[0.2em] uppercase select-none">
        {BRAND_NAME} &bull; SECURE CONSOLE
      </footer>
    </div>
  );
}
