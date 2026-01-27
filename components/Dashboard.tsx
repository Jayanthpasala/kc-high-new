
import React from 'react';
import { DASHBOARD_CARDS } from '../constants';
import { Inbox } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Welcome Section */}
      <section>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Welcome back, Kitchen Staff!</h2>
        <p className="text-slate-500 mt-1 font-medium">Real-time overview of your operational health.</p>
      </section>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DASHBOARD_CARDS.map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 tracking-tight">{card.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 font-medium leading-relaxed">{card.description}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                  {card.icon}
                </div>
              </div>
              
              <div className="mt-8 border-2 border-dashed border-slate-100 rounded-2xl py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                <Inbox size={40} className="opacity-20 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">{card.emptyMessage}</p>
              </div>
            </div>
            <div className="bg-slate-50/50 px-6 py-4 flex justify-between items-center border-t border-slate-100">
               <button className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-[0.2em]">
                 Full History
               </button>
               <button className="text-[10px] font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-[0.2em]">
                 Dismiss
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mini Stats (Secondary Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
            { label: 'Recipes', value: '124', color: 'text-emerald-500' },
            { label: 'Stock Items', value: '450', color: 'text-blue-500' },
            { label: 'Pending Orders', value: '8', color: 'text-amber-500' },
            { label: 'Active Staff', value: '12', color: 'text-slate-900' }
        ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black">{stat.label}</p>
                <p className={`text-2xl md:text-3xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
        ))}
      </div>
    </div>
  );
};
