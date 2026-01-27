
import React from 'react';
import { DASHBOARD_CARDS } from '../constants';
import { Inbox, ChevronRight } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-500 mt-1 font-medium">Daily operational readiness and supply chain health.</p>
        </div>
        <div className="flex gap-2">
            <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:border-slate-300 transition-all shadow-sm">
              Today's Brief
            </button>
            <button className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 transition-all shadow-sm shadow-slate-900/10">
              Download Report
            </button>
        </div>
      </section>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DASHBOARD_CARDS.map((card, idx) => (
          <div key={idx} className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100/80 overflow-hidden hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-500 group">
            <div className="p-7">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 tracking-tight text-lg">{card.title}</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-[200px]">{card.description}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                  {/* Added generic type <any> to fix 'size' property error on cloneElement */}
                  {React.cloneElement(card.icon as React.ReactElement<any>, { size: 20 })}
                </div>
              </div>
              
              <div className="mt-8 bg-slate-50/50 rounded-2xl py-10 flex flex-col items-center justify-center text-slate-400 border border-slate-100/50">
                <Inbox size={32} className="opacity-20 mb-3" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{card.emptyMessage}</p>
              </div>
            </div>
            <div className="px-7 py-4 flex justify-between items-center border-t border-slate-50 bg-slate-50/30">
               <button className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-widest">
                 Full Analysis <ChevronRight size={12} />
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mini Stats (Secondary Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
            { label: 'Total Recipes', value: '124', color: 'text-slate-900', bg: 'bg-emerald-50' },
            { label: 'Active Inventory', value: '450', color: 'text-slate-900', bg: 'bg-blue-50' },
            { label: 'Open Procurement', value: '08', color: 'text-slate-900', bg: 'bg-amber-50' },
            { label: 'Staff Online', value: '12', color: 'text-slate-900', bg: 'bg-indigo-50' }
        ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all group">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{stat.label}</p>
                <div className="flex items-end justify-between mt-1">
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <div className={`w-2 h-2 rounded-full ${stat.bg.replace('bg-', 'bg-').replace('-50', '-400')} animate-pulse`}></div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
