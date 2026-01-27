
import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertCircle, Clock, Calendar, CheckCircle } from 'lucide-react';
import { ProductionPlan, Recipe, InventoryItem } from '../types';

export const Forecasting: React.FC = () => {
  const [forecasts, setForecasts] = useState<any[]>([]);

  useEffect(() => {
    const runForecast = () => {
      const plans: ProductionPlan[] = JSON.parse(localStorage.getItem('productionPlans') || '[]').filter(p => p.isApproved && !p.isConsumed);
      const recipes: Recipe[] = JSON.parse(localStorage.getItem('recipes') || '[]');
      const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
      
      const ingredientUsage: Record<string, { next7: number, next30: number }> = {};
      const today = new Date();
      const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      plans.forEach(plan => {
        const planDate = new Date(plan.date);
        plan.meals.forEach(meal => {
          meal.dishes.forEach(dish => {
            const recipe = recipes.find(r => r.name.toLowerCase() === dish.toLowerCase());
            if (recipe) {
              recipe.ingredients.forEach(ing => {
                const key = ing.name.toLowerCase();
                if (!ingredientUsage[key]) ingredientUsage[key] = { next7: 0, next30: 0 };
                
                if (planDate <= in7Days) ingredientUsage[key].next7 += ing.amount;
                if (planDate <= in30Days) ingredientUsage[key].next30 += ing.amount;
              });
            }
          });
        });
      });

      const finalForecasts = inventory.map(item => {
        const usage = ingredientUsage[item.name.toLowerCase()] || { next7: 0, next30: 0 };
        const available = item.quantity - (item.reserved || 0);
        let status: 'SAFE' | 'CRITICAL' | 'EMPTY' = 'SAFE';
        
        if (available <= 0) status = 'EMPTY';
        else if (available < usage.next7) status = 'CRITICAL';

        return {
          name: item.name,
          current: available,
          next7: usage.next7,
          next30: usage.next30,
          status,
          unit: item.unit
        };
      });

      setForecasts(finalForecasts);
    };

    runForecast();
    window.addEventListener('storage', runForecast);
    return () => window.removeEventListener('storage', runForecast);
  }, []);

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><BarChart3 className="text-emerald-500" size={32} /> Operational Forecasts</h2>
          <p className="text-slate-500 font-medium">Predictive modeling of stock usage vs. approved plans.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-3xl border shadow-sm">
             <TrendingUp className="text-emerald-500 mb-4" />
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Healthy Forecasts</p>
             <p className="text-4xl font-black text-slate-900">{forecasts.filter(f => f.status === 'SAFE').length}</p>
          </div>
          <div className="bg-white p-8 rounded-3xl border shadow-sm">
             <AlertCircle className="text-rose-500 mb-4" />
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">7-Day Critical</p>
             <p className="text-4xl font-black text-slate-900">{forecasts.filter(f => f.status === 'CRITICAL').length}</p>
          </div>
      </div>

      <div className="bg-white rounded-[3rem] border shadow-2xl overflow-hidden">
        <div className="p-10 border-b bg-slate-50/50"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Stock Exhaustion Estimates</h3></div>
        <div className="divide-y">
           {forecasts.map((f, i) => (
             <div key={i} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-6 w-1/3">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${f.status === 'SAFE' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                      {f.status === 'SAFE' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                   </div>
                   <h4 className="font-black text-lg text-slate-900">{f.name}</h4>
                </div>
                
                <div className="flex-1 px-10">
                   <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      <span>Usage: 7D ({f.next7})</span>
                      <span>Usage: 30D ({f.next30})</span>
                   </div>
                   <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500 border-r-2 border-white" style={{ width: `${Math.min((f.next7 / (f.current + 1)) * 100, 50)}%` }}></div>
                      <div className="h-full bg-slate-300" style={{ width: `${Math.min((f.next30 / (f.current + 1)) * 100, 50)}%` }}></div>
                   </div>
                </div>

                <div className="w-1/4 text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Stock</p>
                   <p className={`text-2xl font-black ${f.status === 'CRITICAL' ? 'text-rose-500 animate-pulse' : 'text-slate-900'}`}>{f.current} <span className="text-sm font-medium">{f.unit}</span></p>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};
