import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ChefHat, Loader2, LogIn, ShieldCheck, Lock, AlertTriangle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login Error:", err);
      let msg = 'Authentication failed. Please check your credentials.';
      const errString = err.toString();

      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = 'Account not found or password incorrect.';
      } else if (err.code === 'auth/wrong-password') {
        msg = 'Invalid password provided.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Try again later.';
      } else if (errString.includes('requests-to-this-api') && errString.includes('blocked')) {
        msg = 'Access Blocked: Please ensure your API restrictions allow this domain in Google Cloud Console.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Config Error: Please enable Email/Password provider in Firebase Console.';
      } else if (err.message) {
        msg = `System Error: ${err.message}`;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full -ml-48 -mb-48 blur-3xl"></div>

      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="bg-slate-900 p-10 text-white text-center relative">
          <div className="bg-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
            <ChefHat size={32} className="text-slate-950" />
          </div>
          <h2 className="text-3xl font-black tracking-tight">KMS <span className="text-emerald-400">Kitchen</span></h2>
          <p className="text-slate-400 font-bold mt-2 uppercase text-[10px] tracking-[0.3em]">Management System v5.0</p>
        </div>

        <form onSubmit={handleAuth} className="p-10 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase tracking-widest text-center animate-shake break-words flex flex-col items-center gap-2">
              <AlertTriangle size={20} />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Identity (Email)</label>
            <input 
              type="email" 
              required
              className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" 
              placeholder="chef@kms-kitchen.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Protocol (Password)</label>
            <input 
              type="password" 
              required
              className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Initialize Session
          </button>

          <div className="pt-2 text-center">
             <div className="flex items-center justify-center gap-2 text-slate-300">
               <Lock size={12} />
               <p className="text-[9px] font-black uppercase tracking-[0.2em]">Authorized Personnel Only</p>
             </div>
          </div>
        </form>

        <div className="bg-slate-50 px-10 py-6 border-t border-slate-100 flex items-center justify-center gap-2">
           <ShieldCheck size={14} className="text-emerald-500" />
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secure Cloud KMS Gatekeeper</p>
        </div>
      </div>
    </div>
  );
};