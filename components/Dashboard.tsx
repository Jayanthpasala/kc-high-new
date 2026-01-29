
import React, { useEffect, useState } from 'react';
import { PageId } from '../types';
import { TrendingUp, ArrowUpRight, ChefHat, AlertTriangle, History } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

interface DashboardProps {
  onNavigate: (page: PageId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
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
    // 1. Listen to Firestore Inventory for real-time valuation and stock status
    const unsubInv = onSnapshot(collection(db, "inventory"), (snapshot) => {
      const inventory = snapshot.docs.map(doc => doc.data());
      const activeCount = inventory.length;
      const lowStock = inventory.filter((i: any) => {
        const available = (i.quantity || 0) - (i.reserved || 0);
        return available <= (i.reorderLevel || 0);
      }).length;
      const totalValue = inventory.reduce((acc: number, item: any) => 
        acc + ((item.quantity || 0) * (item.lastPrice || 0)), 0
      );

      setStats(prev => ({
        ...prev,
        activeInventoryCount: activeCount,
        lowStockCount: lowStock,
        totalStockValue: totalValue
      }));
    });

    // 2. Load other stats from local systems (Recipes and Plans)
    const loadLocalStats = () => {
      const recipes = JSON.parse(localStorage.getItem('recipes') || '[]');
      const pendingRecipes = JSON.parse(localStorage.getItem('pendingRecipes') || '[]');
      const plans = JSON.parse(localStorage.getItem('productionPlans') || '[]');
      const pos = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
      const vendors = JSON.parse(localStorage.getItem('vendors') || '[]');

      const todayStr = new Date().toISOString().split('T')[0];
      const todaysPlans = plans.filter((p: any) => p.date === todayStr);
      const openPOs = pos.filter((p: any) => p.status === 'pending');

      setStats(prev => ({
        ...prev,
        recipesCount: recipes.length,
        pendingRecipesCount: pendingRecipes.length,
        todaysProduction: todaysPlans.length,
        openPOs: openPOs.length,
        activeVendors: vendors.length
      }));
    };

    loadLocalStats();
    window.addEventListener('storage', loadLocalStats);
    return () => {
      unsubInv();
      window.removeEventListener('storage', loadLocalStats);
    };
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-20">
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-500 mt-2 font-bold uppercase text-[11px] tracking-[0.2em]">Live Operations Overview</p>
        </div>
        <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => onNavigate(PageId.REPORTS)}
              className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm flex items-center gap-2 group"
            >
              <TrendingUp size={14} className="group-hover:scale-110 transition-transform" />
              Forecast
            </button>
            <button 
              onClick={() => onNavigate(PageId.PROCUREMENT)}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
            >
              Procurement ({stats.openPOs})
            </button>
        </div>
      </section>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Production Card */}
        <div className="bg-white rounded-[3rem] p-8 border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between h-full min-h-[300px]">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl">
                   <ChefHat size={32} />
                </div>
                <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full">Today</span>
              </div>
              <h3 className="text-3xl font-black text-slate-900">{stats.todaysProduction}</h3>
              <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wide">Active Meal Plans</p>
            </div>
            <button onClick={() => onNavigate(PageId.PRODUCTION)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500 transition-colors">
               Manage Schedule <ArrowUpRight size={14} />
            </button>
        </div>

        {/* Inventory Card */}
        <div className={`rounded-[3rem] p-8 border-2 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between h-full min-h-[300px] ${stats.lowStockCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}>
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className={`${stats.lowStockCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'} p-4 rounded-2xl`}>
                   <AlertTriangle size={32} />
                </div>
                <span className="text-[10px] font-black uppercase bg-white/50 text-slate-500 px-3 py-1 rounded-full">Alerts</span>
              </div>
              <h3 className={`text-3xl font-black ${stats.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{stats.lowStockCount}</h3>
              <p className={`text-sm font-bold mt-1 uppercase tracking-wide ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Items Low Stock</p>
            </div>
            <button onClick={() => onNavigate(PageId.INVENTORY)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500 transition-colors">
               Restock Now <ArrowUpRight size={14} />
            </button>
        </div>

        {/* Recipe Status Card */}
        <div className="bg-white rounded-[3rem] p-8 border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between h-full min-h-[300px]">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="bg-purple-50 text-purple-600 p-4 rounded-2xl">
                   <History size={32} />
                </div>
                {stats.pendingRecipesCount > 0 && (
                  <span className="text-[10px] font-black uppercase bg-rose-50 text-rose-500 px-3 py-1 rounded-full">Action Req</span>
                )}
              </div>
              <div className="flex gap-4 items-baseline">
                <h3 className="text-3xl font-black text-slate-900">{stats.pendingRecipesCount}</h3>
                <span className="text-slate-300 text-xl font-black">/ {stats.recipesCount}</span>
              </div>
              <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wide">Pending Definitions</p>
            </div>
            <button onClick={() => onNavigate(PageId.PENDING_RECIPES)} className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:text-emerald-500 transition-colors">
               Resolve Recipes <ArrowUpRight size={14} />
            </button>
        </div>
      </div>

      {/* Mini Stats (Secondary Row) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
            { label: 'Total Valuation', value: `₹${(stats.totalStockValue / 1000).toFixed(1)}k`, color: 'text-emerald-600', bg: 'bg-emerald-50', target: PageId.INVENTORY },
            { label: 'Active Items', value: stats.activeInventoryCount, color: 'text-blue-600', bg: 'bg-blue-50', target: PageId.INVENTORY },
            { label: 'Procurement', value: stats.openPOs, color: 'text-amber-600', bg: 'bg-amber-50', target: PageId.PROCUREMENT },
            { label: 'Vendors', value: stats.activeVendors, color: 'text-indigo-600', bg: 'bg-indigo-50', target: PageId.VENDORS }
        ].map((stat, i) => (
            <button 
              key={i} 
              onClick={() => onNavigate(stat.target)}
              className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-900 transition-all group text-left relative overflow-hidden h-full"
            >
                <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} opacity-20 -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">{stat.label}</p>
                <div className="flex items-end justify-between relative z-10">
                  <p className={`text-2xl sm:text-3xl font-black ${stat.color} tracking-tighter`}>{stat.value}</p>
                  <ArrowUpRight size={16} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                </div>
            </button>
        ))}
      </div>
    </div>
  );
};
