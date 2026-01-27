
import React, { useState, useEffect } from 'react';
import { Save, Building, FileText, Upload, Trash2, CheckCircle2, Globe, Mail, Phone, MapPin } from 'lucide-react';
import { POTemplateConfig } from '../types';

const DEFAULT_CONFIG: POTemplateConfig = {
  companyName: 'CulinaOps Kitchen ERP',
  address: 'Floor 4, Sector 12, Cyber Hub, Mumbai, MH - 400001',
  gstin: '27AAACG1234F1Z5',
  pan: 'ABCDE1234F',
  email: 'ops@culinaops.com',
  phone: '+91 22 4567 8900',
  terms: '1. Quality check mandatory upon delivery.\n2. Invoices must mention PO Reference ID.\n3. Payment within 15 days of verified receipt.'
};

export const POTemplateSettings: React.FC = () => {
  const [config, setConfig] = useState<POTemplateConfig>(DEFAULT_CONFIG);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('poTemplateConfig');
    if (saved) setConfig(JSON.parse(saved));
  }, []);

  const handleSave = () => {
    localStorage.setItem('poTemplateConfig', JSON.stringify(config));
    setIsSaved(true);
    window.dispatchEvent(new Event('storage'));
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setConfig({ ...config, logoUrl: reader.result as string });
    };
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <FileText className="text-emerald-500" size={32} />
             PO Template Studio
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Global Branding & Statutory Compliance Config</p>
        </div>
        <button 
          onClick={handleSave}
          className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10"
        >
          {isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          <span>{isSaved ? 'Config Saved' : 'Save Template'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Configuration Column */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3 col-span-full">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entity Registered Name</label>
                    <div className="relative">
                       <Building className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                       <input 
                         type="text" 
                         value={config.companyName} 
                         onChange={e => setConfig({...config, companyName: e.target.value})}
                         className="w-full pl-16 pr-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent font-black text-slate-900 focus:border-emerald-500 outline-none transition-all"
                       />
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GSTIN Number</label>
                    <input 
                      type="text" 
                      value={config.gstin} 
                      onChange={e => setConfig({...config, gstin: e.target.value})}
                      placeholder="Enter 15-digit GSTIN"
                      className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent font-black text-slate-900 focus:border-emerald-500 outline-none transition-all"
                    />
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PAN Identification</label>
                    <input 
                      type="text" 
                      value={config.pan} 
                      onChange={e => setConfig({...config, pan: e.target.value})}
                      placeholder="Enter PAN"
                      className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent font-black text-slate-900 focus:border-emerald-500 outline-none transition-all"
                    />
                 </div>

                 <div className="space-y-3 col-span-full">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registered Address</label>
                    <div className="relative">
                       <MapPin className="absolute left-6 top-6 text-slate-300" size={20} />
                       <textarea 
                         rows={3}
                         value={config.address} 
                         onChange={e => setConfig({...config, address: e.target.value})}
                         className="w-full pl-16 pr-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent font-black text-slate-900 focus:border-emerald-500 outline-none transition-all resize-none"
                       />
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Email</label>
                    <div className="relative">
                       <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                       <input 
                         type="email" 
                         value={config.email} 
                         onChange={e => setConfig({...config, email: e.target.value})}
                         className="w-full pl-16 pr-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent font-black text-slate-900 focus:border-emerald-500 outline-none transition-all"
                       />
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Direct Helpline</label>
                    <div className="relative">
                       <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                       <input 
                         type="text" 
                         value={config.phone} 
                         onChange={e => setConfig({...config, phone: e.target.value})}
                         className="w-full pl-16 pr-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent font-black text-slate-900 focus:border-emerald-500 outline-none transition-all"
                       />
                    </div>
                 </div>

                 <div className="space-y-3 col-span-full">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Standard PO Terms & Conditions</label>
                    <textarea 
                      rows={5}
                      value={config.terms} 
                      onChange={e => setConfig({...config, terms: e.target.value})}
                      className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent font-bold text-slate-700 focus:border-emerald-500 outline-none transition-all resize-none"
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Branding Column */}
        <div className="space-y-8">
           <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-sm text-center">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-6">Organizational Identity (Logo)</label>
              
              <div className="relative group mx-auto w-48 h-48 mb-8">
                 <div className="w-full h-full rounded-3xl border-4 border-dashed border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden transition-all group-hover:border-emerald-500">
                    {config.logoUrl ? (
                       <img src={config.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                    ) : (
                       <Building size={48} className="text-slate-200" />
                    )}
                 </div>
                 <input 
                   type="file" 
                   id="logo-upload" 
                   className="hidden" 
                   accept="image/*" 
                   onChange={handleLogoUpload} 
                 />
                 <label 
                   htmlFor="logo-upload"
                   className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-white rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-black text-[10px] uppercase tracking-widest"
                 >
                    <Upload size={20} className="mb-2" />
                    Change Logo
                 </label>
              </div>

              {config.logoUrl && (
                <button 
                  onClick={() => setConfig({...config, logoUrl: undefined})}
                  className="text-rose-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mx-auto hover:text-rose-600 transition-colors"
                >
                   <Trash2 size={14} /> Remove Identity
                </button>
              )}
           </div>

           <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-4">
              <Globe className="text-emerald-500" size={32} />
              <h4 className="text-xl font-black">Statutory Ready</h4>
              <p className="text-slate-400 text-xs font-medium leading-relaxed">
                 These details will be used to generate GST-compliant Purchase Order documents. Ensure your GSTIN is accurate to avoid fulfillment delays.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};
