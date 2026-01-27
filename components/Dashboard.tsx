
import React from 'react';
import { DASHBOARD_CARDS } from '../constants';
import { PageId } from '../types';
import { Inbox, ChevronRight, TrendingUp, ArrowUpRight } from 'lucide-react';

interface DashboardProps {
  onNavigate: (page: PageId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-500 mt-2 font-bold uppercase text-[11px] tracking-[0.2em]">Operational Readiness & Intelligence Hub</p>
        </div>
        <div className="flex gap-3">
            <button 
              onClick={() => onNavigate(PageId.REPORTS)}
              className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm flex items-center gap-2 group"
            >
              <TrendingUp size={14} className="group-hover:scale-110 transition-transform" />
              Intelligence Brief
            </button>
            <button 
              onClick={() => window.print()}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
            >
              Export Global Status
            </button>
        </div>
      </section>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {DASHBOARD_CARDS.map((card) => (
          <div 
            key={card.id} 
            className="bg-white rounded-[3rem] shadow-sm border-2 border-slate-100/80 overflow-hidden hover:shadow-2xl hover:border-emerald-500/30 transition-all duration-500 group flex flex-col h-full"
          >
            <div className="p-8 flex-1">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="font-black text-slate-900 tracking-tight text-xl">{card.title}</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed max-w-[200px] opacity-60">{card.description}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-sm">
                  {React.cloneElement(card.icon as React.ReactElement<any>, { size: 24 })}
                </div>
              </div>
              
              <div className="mt-8 bg-slate-50/50 rounded-[2rem] py-12 flex flex-col items-center justify-center text-slate-400 border border-slate-100/50 group-hover:bg-white transition-colors duration-500">
                <div className="relative">
                  <Inbox size={40} className="opacity-10 mb-4 group-hover:opacity-20 transition-opacity" />
                  <div className="absolute inset-0 bg-emerald-500/5 blur-2xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-700"></div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center px-6 leading-relaxed">{card.emptyMessage}</p>
              </div>
            </div>
            <div className="px-8 py-6 border-t border-slate-50 bg-slate-50/30 flex justify-end">
               <button 
                onClick={() => onNavigate(card.targetPage)}
                className="flex items-center gap-2 text-[10px] font-black text-slate-900 hover:text-emerald-600 transition-all uppercase tracking-[0.2em] group/btn"
               >
                 Go to Module <ArrowUpRight size={16} className="text-emerald-500 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mini Stats (Secondary Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {[
            { label: 'Master Recipes', value: '124', color: 'text-slate-900', bg: 'bg-emerald-500', target: PageId.RECIPES },
            { label: 'Active Inventory', value: '450', color: 'text-slate-900', bg: 'bg-blue-500', target: PageId.INVENTORY },
            { label: 'Open Procurement', value: '08', color: 'text-slate-900', bg: 'bg-amber-500', target: PageId.PROCUREMENT },
            { label: 'Staff Online', value: '12', color: 'text-slate-900', bg: 'bg-indigo-500', target: PageId.USERS }
        ].map((stat, i) => (
            <button 
              key={i} 
              onClick={() => onNavigate(stat.target)}
              className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-900 transition-all group text-left relative overflow-hidden"
            >
                <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} opacity-5 -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2">{stat.label}</p>
                <div className="flex items-end justify-between">
                  <p className={`text-4xl font-black ${stat.color} tracking-tighter`}>{stat.value}</p>
                  <div className={`w-3 h-3 rounded-full ${stat.bg} animate-pulse shadow-lg`}></div>
                </div>
            </button>
        ))}
      </div>
    </div>
  );
};
