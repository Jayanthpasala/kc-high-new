
import React, { useState, useEffect } from 'react';
import { Save, Building, FileText, Upload, Trash2, CheckCircle2, Globe, Mail, Phone, MapPin, Eye, Building2, Loader2 } from 'lucide-react';
import { POTemplateConfig } from '../types';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const DEFAULT_CONFIG: POTemplateConfig = {
  companyName: 'KMS Kitchen Management System',
  address: 'Mumbai, MH',
  gstin: '27AAACG1234F1Z5',
  pan: 'ABCDE1234F',
  email: 'ops@kms-kitchen.com',
  phone: '+91 0000 000 000',
  terms: '1. Quality check required.\n2. Net 15 Days.'
};

export const POTemplateSettings: React.FC = () => {
  const [config, setConfig] = useState<POTemplateConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Cloud Sync Settings
    const unsub = onSnapshot(doc(db, "settings", "po_config"), (snap) => {
      if (snap.exists()) setConfig(snap.data() as POTemplateConfig);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "po_config"), config);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) { alert("Save Error."); }
    finally { setIsSaving(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setConfig({ ...config, logoUrl: reader.result as string });
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><FileText className="text-emerald-500" size={32} /> PO Template Studio</h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Global Cloud Branding Config</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-xl">
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          <span>{isSaving ? 'Syncing...' : isSaved ? 'Synced to Cloud' : 'Save Config'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-8">
           <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Name</label>
                    <input type="text" value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 font-black text-slate-900 border-2 border-transparent focus:border-emerald-500" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GSTIN</label>
                    <input type="text" value={config.gstin} onChange={e => setConfig({...config, gstin: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 font-bold" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PAN</label>
                    <input type="text" value={config.pan} onChange={e => setConfig({...config, pan: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 font-bold" />
                 </div>
                 <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Address</label>
                    <textarea rows={3} value={config.address} onChange={e => setConfig({...config, address: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 font-bold" />
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
           <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-100 shadow-sm text-center">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-6">Identity Logo</label>
              <div className="relative group mx-auto w-48 h-48 mb-8 border-4 border-dashed rounded-3xl bg-slate-50 flex items-center justify-center overflow-hidden">
                 {config.logoUrl ? <img src={config.logoUrl} className="w-full h-full object-contain p-4" /> : <Building size={48} className="text-slate-200" />}
                 <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                 <label htmlFor="logo-upload" className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer font-black text-xs uppercase tracking-widest">Change</label>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
