import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Upload, Loader2, Image as ImageIcon, CheckCircle, AlertCircle, Hash, RefreshCw } from 'lucide-react';
import { settingsAPI } from '../api/client';
import GlassCard from '../components/GlassCard';

const LANDMARK_BACKGROUNDS = [
  { id: '/afghan-blue-mosque.jpg', name: 'Blue Mosque', location: 'Mazar-i-Sharif', preview: '/afghan-blue-mosque.jpg' },
  { id: '/afghan-darul-aman.jpg', name: 'Darul Aman Palace', location: 'Kabul', preview: '/afghan-darul-aman.jpg' },
  { id: '/afghan-qala-bost.jpg', name: 'Arch of Qala-e-Bost', location: 'Helmand', preview: '/afghan-qala-bost.jpg' },
  { id: '/afghan-band-e-amir.jpg', name: 'Band-e-Amir Lakes', location: 'Bamyan', preview: '/afghan-band-e-amir.jpg' },
];

export default function Settings() {
  const [form, setForm] = useState({
    company_name: '',
    address: '',
    phone: '',
    email: '',
    receipt_footer: '',
    default_currency: 'USD',
    receipt_prefix: 'TX',
    next_receipt_number: 1,
    receipt_background: '/afghan-blue-mosque.jpg',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currencySequences, setCurrencySequences] = useState([]);
  const [sequencesLoading, setSequencesLoading] = useState(false);

  useEffect(() => {
    settingsAPI.get()
      .then((res) => {
        const d = res.data;
        if (d) {
          setForm({
            company_name: d.company_name || '',
            address: d.address || '',
            phone: d.phone || '',
            email: d.email || '',
            receipt_footer: d.receipt_footer || '',
            default_currency: d.default_currency || 'USD',
            receipt_prefix: d.receipt_prefix || 'TX',
            next_receipt_number: d.next_receipt_number || 1,
            receipt_background: d.receipt_background || '/afghan-blue-mosque.jpg',
          });
          if (d.receipt_background) {
            localStorage.setItem('sky_receipt_bg', d.receipt_background);
          }
          localStorage.setItem('sky_banking_settings', JSON.stringify(d));
          if (d.logo_path) {
            setLogoPreview(d.logo_path);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load settings', err);
        setLoading(false);
      });
  }, []);

  const CURRENCIES = ['USD', 'Toman', 'Dirham', 'Afghani'];

  const loadCurrencySequences = async () => {
    setSequencesLoading(true);
    try {
      const results = await Promise.all(
        CURRENCIES.map((c) =>
          settingsAPI.getNextReceiptNo(c).then((res) => ({ currency: c, receipt_no: res.data?.receipt_no || '—' }))
            .catch(() => ({ currency: c, receipt_no: '—' }))
        )
      );
      setCurrencySequences(results);
    } finally {
      setSequencesLoading(false);
    }
  };

  useEffect(() => {
    loadCurrencySequences();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectBackground = (bgId) => {
    setForm((prev) => ({ ...prev, receipt_background: bgId }));
    localStorage.setItem('sky_receipt_bg', bgId);
    window.dispatchEvent(new CustomEvent('sky_settings_updated', { detail: { ...form, receipt_background: bgId } }));
  };

  const handleLogoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const payload = {
        ...form,
        next_receipt_number: Number(form.next_receipt_number || 1),
      };
      // Save metadata
      const res = await settingsAPI.update(payload);
      const updatedData = res.data || payload;

      // Save logo file if exists
      if (logoFile) {
        await settingsAPI.uploadLogo(logoFile);
      }

      localStorage.setItem('sky_receipt_bg', payload.receipt_background);
      localStorage.setItem('sky_banking_settings', JSON.stringify(updatedData));
      window.dispatchEvent(new CustomEvent('sky_settings_updated', { detail: updatedData }));

      setMessage('Branding settings & background image updated successfully across all receipts!');
      loadCurrencySequences();
    } catch (err) {
      console.error(err);
      setMessage('Failed to save settings. Confirm Admin authorization.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-sky-900 tracking-tight leading-tight">Settings & Branding</h1>
        <p className="text-xs font-bold text-sky-500/80 mt-1">Configure your invoice company, logo, and receipt templates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Settings Panel */}
        <GlassCard className="lg:col-span-2 p-6 md:p-8">
          <h2 className="text-xs font-black text-sky-900 uppercase tracking-wider border-b border-sky-100 pb-3 mb-6 flex items-center gap-2">
            <SettingsIcon size={16} className="text-sky-500" />
            <span>Company Profile Configuration</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                  value={form.company_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                  Default Vault Currency
                </label>
                <select
                  name="default_currency"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                  value={form.default_currency}
                  onChange={handleChange}
                >
                  <option value="USD">USD</option>
                  <option value="Toman">Toman</option>
                  <option value="Dirham">Dirham</option>
                  <option value="Afghani">Afghani</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                  Receipt Auto Prefix
                </label>
                <input
                  type="text"
                  name="receipt_prefix"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                  value={form.receipt_prefix}
                  onChange={handleChange}
                  required
                />
                <p className="text-[10px] text-sky-400 font-bold mt-1">Used as the base for every currency sequence, e.g. {form.receipt_prefix}-USD-0001</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                  Legacy Fallback Number
                </label>
                <input
                  type="number"
                  name="next_receipt_number"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                  value={form.next_receipt_number}
                  onChange={handleChange}
                  required
                  min="1"
                />
                <p className="text-[10px] text-sky-400 font-bold mt-1">Only used if no currency is selected. Each currency now tracks its own sequence automatically.</p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                  Contact Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                  Contact Email
                </label>
                <input
                  type="email"
                  name="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                  Business Address
                </label>
                <input
                  type="text"
                  name="address"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-sky-500 uppercase tracking-[0.1em] mb-1.5">
                  Receipt Footer Disclaimer
                </label>
                <textarea
                  name="receipt_footer"
                  rows="3"
                  className="w-full px-4 py-2.5 rounded-xl border border-sky-100 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-xs font-semibold text-sky-900 transition-all resize-none"
                  value={form.receipt_footer}
                  onChange={handleChange}
                />
              </div>

              <div className="md:col-span-2 space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black text-sky-600 uppercase tracking-[0.12em]">
                    🇦🇫 Official Afghanistan Landmark Security Watermark
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">Select receipt background image</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {LANDMARK_BACKGROUNDS.map((bg) => {
                    const isSelected = form.receipt_background === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => handleSelectBackground(bg.id)}
                        className={`relative flex flex-col items-center justify-between p-2.5 rounded-2xl border-2 transition-all ${
                          isSelected
                            ? 'border-sky-600 bg-sky-50/80 shadow-md ring-2 ring-sky-500/20'
                            : 'border-slate-200/80 bg-white hover:border-sky-300'
                        }`}
                      >
                        <div className="relative w-full h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/60 mb-2">
                          <img src={bg.preview} alt={bg.name} className="w-full h-full object-cover" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-sky-600/25 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="bg-sky-600 text-white rounded-full p-1 shadow-md">
                                <CheckCircle size={16} />
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-black text-slate-900 text-center leading-tight">{bg.name}</span>
                        <span className="text-[9px] font-bold text-sky-600 text-center mt-0.5">{bg.location}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {message && (
              <div className={`p-3.5 border rounded-xl text-xs font-semibold leading-relaxed flex items-center gap-2 ${
                message.includes('successfully')
                  ? 'bg-emerald-50/90 border-emerald-100 text-emerald-700'
                  : 'bg-rose-50/90 border-rose-100 text-rose-700'
              }`}>
                {message.includes('successfully') ? (
                  <CheckCircle size={16} className="shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 text-rose-500" />
                )}
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-tr from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-black rounded-xl shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-all text-xs flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              <span>Save System Settings</span>
            </button>
          </form>
        </GlassCard>

        {/* Logo Configuration Column */}
        <div className="lg:col-span-1">
          <GlassCard className="p-6 text-center space-y-6">
            <h2 className="text-xs font-black text-sky-900 uppercase tracking-wider border-b border-sky-100 pb-3 flex items-center gap-2 text-left">
              <ImageIcon size={16} className="text-sky-500" />
              <span>Logo Branding</span>
            </h2>

            <div className="flex flex-col items-center">
              {logoPreview ? (
                <div className="w-28 h-28 rounded-2xl border border-sky-100 bg-white p-2 shadow-inner flex items-center justify-center overflow-hidden">
                  <img
                    src={logoPreview}
                    alt="Company Logo"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      setLogoPreview('');
                    }}
                  />
                </div>
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-sky-50/80 border border-sky-100 flex items-center justify-center text-sky-300 shadow-inner">
                  <ImageIcon size={36} />
                </div>
              )}
              
              <p className="text-xs text-sky-900/80 font-black mt-3">Company Header Logo</p>
              <p className="text-[10px] text-sky-400 font-bold block mt-1">Recommended size 120x120px</p>
            </div>

            <label className="w-full py-2.5 bg-white/80 hover:bg-sky-50 border border-sky-100 text-sky-700 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all active:scale-[0.98]">
              <Upload size={14} />
              <span>Select Image Logo</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleLogoChange}
              />
            </label>
          </GlassCard>

          <GlassCard className="p-6 mt-6 space-y-4">
            <h2 className="text-xs font-black text-sky-900 uppercase tracking-wider border-b border-sky-100 pb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Hash size={16} className="text-sky-500" />
                <span>Receipt Sequences</span>
              </span>
              <button
                type="button"
                onClick={loadCurrencySequences}
                disabled={sequencesLoading}
                className="text-sky-400 hover:text-sky-600 transition-colors disabled:opacity-40"
                aria-label="Refresh sequences"
              >
                <RefreshCw size={13} className={sequencesLoading ? 'animate-spin' : ''} />
              </button>
            </h2>
            <p className="text-[10px] text-sky-400 font-bold -mt-2">Next receipt number per currency, updated live as transactions are recorded.</p>
            <div className="space-y-2">
              {currencySequences.map(({ currency, receipt_no }) => (
                <div key={currency} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-sky-50/60 border border-sky-100">
                  <span className="text-xs font-black text-sky-800">{currency}</span>
                  <span className="text-xs font-bold font-mono text-sky-600">{receipt_no}</span>
                </div>
              ))}
              {currencySequences.length === 0 && sequencesLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin text-sky-400" size={18} />
                </div>
              )}
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
}