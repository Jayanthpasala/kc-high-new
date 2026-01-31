
import React, { useEffect, useState } from 'react';
import { PageId } from '../types';
import { TrendingUp, ArrowUpRight, ChefHat, AlertTriangle, History } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export const Dashboard: React.FC<{ onNavigate: (page: PageId) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    recipesCount: 0,
    pendingRecipesCount: 0,
    activeInventoryCount: 0,
    lowStockCount: 0,
    todaysProduction: 0,
    openPOs: 0,
    activeVendors: 0,
    totalStockValue: 0
  });

  useEffect(() => {
    // 1. Inventory & Valuation
    const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => {
      const items = snap.docs.map(doc => doc.data());
      const low = items.filter((i: any) => (i.quantity || 0) <= (i.reorderLevel || 0)).length;
      const val = items.reduce((acc, i: any) => acc + ((i.quantity || 0) * (i.lastPrice || 0)), 0);
      setStats(prev => ({ ...prev, activeInventoryCount: items.length, lowStockCount: low, totalStockValue: val }));
    });

    // 2. Recipes
    const unsubRecipes = onSnapshot(collection(db, "recipes"), (snap) => {
      setStats(prev => ({ ...prev, recipesCount: snap.docs.length }));
    });

    // 3. Today's Production
    const todayStr = new Date().toISOString().split('T')[0];
    const qPlans = query(collection(db, "productionPlans"), where("date", "==", todayStr), where("isApproved", "==", true));
    const unsubPlans = onSnapshot(qPlans, (snap) => {
      setStats(prev => ({ ...prev, todaysProduction: snap.docs.length }));
    });

    // 4. Procurement/POs
    const unsubPOs = onSnapshot(collection(db, "purchaseOrders"), (snap) => {
      const open = snap.docs.filter(d => (d.data() as any).status === 'pending').length;
      setStats(prev => ({ ...prev, openPOs: open }));
    });

    // 5. Vendors
    const unsubVendors = onSnapshot(collection(db, "vendors"), (snap) => {
      setStats(prev => ({ ...prev, activeVendors: snap.docs.length }));
    });

    return () => {
      unsubInv();
      unsubRecipes();
      unsubPlans();
      unsubPOs();
      unsubVendors();
    };
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-20">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-500 mt-2 font-bold uppercase text-[11px] tracking-[0.2em]">Cloud Sync: Live Operations</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => onNavigate(PageId.REPORTS)} className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm flex items-center gap-2 group">
            <TrendingUp size={14} /> Forecast
          </button>
          <button onClick={() => onNavigate(PageId.PROCUREMENT)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95">
            Procurement ({stats.openPOs})
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-white rounded-[3rem] p-8 border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-full min-h-[300px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl"><ChefHat size={32} /></div>
              <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full">Today</span>
            </div>
            <h3 className="text-3xl font-black text-slate-900">{stats.todaysProduction}</h3>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wide">Active Meal Plans</p>
          </div>
          <button onClick={() => onNavigate(PageId.PRODUCTION)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500">Manage Schedule <ArrowUpRight size={14} /></button>
        </div>

        <div className={`rounded-[3rem] p-8 border-2 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-full min-h-[300px] ${stats.lowStockCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}>
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className={`${stats.lowStockCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'} p-4 rounded-2xl`}><AlertTriangle size={32} /></div>
              <span className="text-[10px] font-black uppercase bg-white/50 text-slate-500 px-3 py-1 rounded-full">Alerts</span>
            </div>
            <h3 className={`text-3xl font-black ${stats.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{stats.lowStockCount}</h3>
            <p className={`text-sm font-bold mt-1 uppercase tracking-wide ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Items Low Stock</p>
          </div>
          <button onClick={() => onNavigate(PageId.INVENTORY)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500">Restock Now <ArrowUpRight size={14} /></button>
        </div>

        <div className="bg-white rounded-[3rem] p-8 border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between h-full min-h-[300px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-purple-50 text-purple-600 p-4 rounded-2xl"><History size={32} /></div>
            </div>
            <div className="flex gap-4 items-baseline">
              <h3 className="text-3xl font-black text-slate-900">{stats.recipesCount}</h3>
            </div>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wide">Master Recipes</p>
          </div>
          <button onClick={() => onNavigate(PageId.RECIPES)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500">Master List <ArrowUpRight size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Valuation', value: `₹${(stats.totalStockValue / 1000).toFixed(1)}k`, color: 'text-emerald-600', bg: 'bg-emerald-50', target: PageId.INVENTORY },
          { label: 'Active Items', value: stats.activeInventoryCount, color: 'text-blue-600', bg: 'bg-blue-50', target: PageId.INVENTORY },
          { label: 'Procurement', value: stats.openPOs, color: 'text-amber-600', bg: 'bg-amber-50', target: PageId.PROCUREMENT },
          { label: 'Vendors', value: stats.activeVendors, color: 'text-indigo-600', bg: 'bg-indigo-50', target: PageId.VENDORS }
        ].map((stat, i) => (
          <button key={i} onClick={() => onNavigate(stat.target)} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-900 transition-all text-left relative overflow-hidden h-full group">
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} opacity-20 -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">{stat.label}</p>
            <div className="flex items-end justify-between relative z-10">
              <p className={`text-2xl sm:text-3xl font-black ${stat.color} tracking-tighter`}>{stat.value}</p>
              <ArrowUpRight size={16} className="text-slate-300 group-hover:text-slate-900" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
