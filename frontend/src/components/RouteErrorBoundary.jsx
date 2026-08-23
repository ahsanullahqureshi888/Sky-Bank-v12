import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import GlassCard from './GlassCard';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Route render failed', error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
    if (typeof this.props.onRetry === 'function') this.props.onRetry();
  };

  handleResetSession = () => {
    try {
      const email = localStorage.getItem('sky_banking_remember_email');
      localStorage.clear();
      if (email) localStorage.setItem('sky_banking_remember_email', email);
    } catch (_) {}
    window.location.href = '/login';
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <GlassCard className="max-w-md w-full space-y-6 p-8 text-center bg-white/95 !text-slate-900 border border-amber-300/60 shadow-2xl rounded-3xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">{this.props.title || 'SKY ARIANA GROUP OF COMPANIES'}</h1>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">
              {this.props.message || 'A temporary display issue occurred. Your data is completely safe.'}
            </p>
            {this.state.error && (
              <div className="mt-3 p-2.5 rounded-xl bg-slate-900 text-rose-300 text-left text-[10px] font-mono overflow-auto max-h-28 border border-rose-900/30">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 text-xs font-black text-white shadow-md shadow-sky-500/20 hover:from-sky-600 hover:to-blue-700 active:scale-[0.98] transition-all"
            >
              <RefreshCw size={14} />
              Reload Page
            </button>
            <button
              type="button"
              onClick={this.handleResetSession}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 px-5 text-xs font-black text-slate-700 active:scale-[0.98] transition-all"
            >
              Reset Session
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }
}
