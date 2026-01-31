
import React, { useEffect, useState } from 'react';
import { PageId, ProductionPlan } from '../types';
import { TrendingUp, ArrowUpRight, ChefHat, AlertTriangle, History, Users, Package, Wallet } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export const Dashboard: React.FC<{ onNavigate: (page: PageId) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    recipesCount: 0,
    activeInventoryCount: 0,
    lowStockCount: 0,
    todaysProduction: 0,
    totalHeadcountToday: 0,
    openPOs: 0,
    totalStockValue: 0
  });

  useEffect(() => {
    const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => {
      const items = snap.docs.map(doc => doc.data());
      const low = items.filter((i: any) => (i.quantity || 0) <= (i.reorderLevel || 0)).length;
      const val = items.reduce((acc, i: any) => acc + ((i.quantity || 0) * (i.lastPrice || 0)), 0);
      setStats(prev => ({ ...prev, activeInventoryCount: items.length, lowStockCount: low, totalStockValue: val }));
    });

    const unsubRecipes = onSnapshot(collection(db, "recipes"), (snap) => {
      setStats(prev => ({ ...prev, recipesCount: snap.docs.length }));
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const qPlans = query(collection(db, "productionPlans"), where("date", "==", todayStr), where("isApproved", "==", true));
    const unsubPlans = onSnapshot(qPlans, (snap) => {
      const plans = snap.docs.map(d => d.data() as ProductionPlan);
      const hc = plans.reduce((acc, p) => {
        if (!p.headcounts) return acc;
        // Fix: Explicitly type reducer parameters to avoid 'unknown' operator errors from Object.values
        return acc + Object.values(p.headcounts).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
      }, 0);
      setStats(prev => ({ ...prev, todaysProduction: plans.length, totalHeadcountToday: hc }));
    });

    const unsubPOs = onSnapshot(collection(db, "purchaseOrders"), (snap) => {
      const open = snap.docs.filter(d => (d.data() as any).status === 'pending').length;
      setStats(prev => ({ ...prev, openPOs: open }));
    });

    return () => { unsubInv(); unsubRecipes(); unsubPlans(); unsubPOs(); };
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-20">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Enterprise Overview</h2>
          <p className="text-slate-500 mt-2 font-bold uppercase text-[11px] tracking-[0.2em]">Live Supply Chain & Operational Intelligence</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => onNavigate(PageId.PRODUCTION)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl active:scale-95">
             Daily Registry
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-white rounded-[3rem] p-8 border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-full min-h-[320px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl"><ChefHat size={32} /></div>
              <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full">Operations</span>
            </div>
            <h3 className="text-4xl font-black text-slate-900">{stats.todaysProduction}</h3>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wide">Active Meal Plans Today</p>
            <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-lg">
               <Users size={14} />
               <span className="text-[10px] font-black uppercase">{stats.totalHeadcountToday} Planned Attendance</span>
            </div>
          </div>
          <button onClick={() => onNavigate(PageId.PRODUCTION)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500">Live Schedule <ArrowUpRight size={14} /></button>
        </div>

        <div className={`rounded-[3rem] p-8 border-2 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-full min-h-[320px] ${stats.lowStockCount > 0 ? 'bg-amber-50 border-amber-100 shadow-amber-100/50' : 'bg-white border-slate-100'}`}>
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className={`${stats.lowStockCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'} p-4 rounded-2xl`}><Package size={32} /></div>
              <span className="text-[10px] font-black uppercase bg-white/50 text-slate-500 px-3 py-1 rounded-full">Inventory</span>
            </div>
            <h3 className={`text-4xl font-black ${stats.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{stats.lowStockCount}</h3>
            <p className={`text-sm font-bold mt-1 uppercase tracking-wide ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Critical Material Shortages</p>
          </div>
          <button onClick={() => onNavigate(PageId.INVENTORY)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500">Replenish Stocks <ArrowUpRight size={14} /></button>
        </div>

        <div className="bg-white rounded-[3rem] p-8 border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-full min-h-[320px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl"><Wallet size={32} /></div>
              <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full">Financial</span>
            </div>
            <h3 className="text-4xl font-black text-slate-900">₹{(stats.totalStockValue / 1000).toFixed(1)}k</h3>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wide">Current Raw Asset Valuation</p>
          </div>
          <button onClick={() => onNavigate(PageId.REPORTS)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500">Financial Insights <ArrowUpRight size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Master Specs', value: stats.recipesCount, color: 'text-indigo-600', bg: 'bg-indigo-50', target: PageId.RECIPES },
          { label: 'Material Ledger', value: stats.activeInventoryCount, color: 'text-blue-600', bg: 'bg-blue-50', target: PageId.INVENTORY },
          { label: 'Procurement', value: stats.openPOs, color: 'text-amber-600', bg: 'bg-amber-50', target: PageId.PROCUREMENT },
          { label: 'Attendance Total', value: stats.totalHeadcountToday, color: 'text-emerald-600', bg: 'bg-emerald-50', target: PageId.PRODUCTION }
        ].map((stat, i) => (
          <button key={i} onClick={() => onNavigate(stat.target)} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-900 transition-all text-left group">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">{stat.label}</p>
            <div className="flex items-end justify-between">
              <p className={`text-2xl sm:text-3xl font-black ${stat.color} tracking-tighter`}>{stat.value}</p>
              <ArrowUpRight size={16} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
