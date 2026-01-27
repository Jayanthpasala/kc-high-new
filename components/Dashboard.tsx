
import React from 'react';
import { DASHBOARD_CARDS } from '../constants';
import { Inbox } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Welcome Section */}
      <section>
        <h2 className="text-2xl font-bold text-slate-800">Welcome back, Kitchen Staff!</h2>
        <p className="text-slate-500 mt-1">Here is what's happening in your kitchen today.</p>
      </section>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DASHBOARD_CARDS.map((card, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{card.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{card.description}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg">
                  {card.icon}
                </div>
              </div>
              
              <div className="mt-8 border-2 border-dashed border-slate-100 rounded-lg py-12 flex flex-col items-center justify-center text-slate-400">
                <Inbox size={32} className="opacity-20 mb-3" />
                <p className="text-sm font-medium">{card.emptyMessage}</p>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-3 flex justify-between items-center">
               <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-wider">
                 View Details
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mini Stats (Secondary Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
            { label: 'Total Active Recipes', value: '124' },
            { label: 'Ingredients Tracked', value: '450' },
            { label: 'Pending Vendor Orders', value: '8' },
            { label: 'Active Users', value: '12' }
        ].map((stat, i) => (
            <div key={i} className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-bold">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
            </div>
        ))}
      </div>
    </div>
  );
};
