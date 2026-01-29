
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  DollarSign, 
  Tag, 
  Truck, 
  TrendingDown,
  ChevronRight,
  Calendar,
  ShieldCheck
} from 'lucide-react';
import { ProductionPlan, Recipe, InventoryItem, Vendor, VendorPricePoint } from '../types';

interface ForecastItem {
  name: string;
  brand: string;
  current: number;
  reorderLevel: number;
  dailyUsage: number;
  daysLeft: number;
  status: 'SAFE' | 'LOW' | 'CRITICAL' | 'EMPTY';
  unit: string;
}

interface BrandAnalysis {
  itemName: string;
  cheapestBrand: string;
  cheapestSupplier: string;
  lowestPrice: number;
  highestPrice: number;
  savingsOpportunity: number;
  unit: string;
}

export const Forecasting: React.FC = () => {
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysis[]>([]);

  useEffect(() => {
    const runAnalysis = () => {
      const plans: ProductionPlan[] = JSON.parse(localStorage.getItem('productionPlans') || '[]').filter(p => p.isApproved);
      const recipes: Recipe[] = JSON.parse(localStorage.getItem('recipes') || '[]');
      const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
      const vendors: Vendor[] = JSON.parse(localStorage.getItem('vendors') || '[]');
      
      const ingredientUsage: Record<string, number> = {};
      const today = new Date();
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      let daysCounted = 30;

      // Calculate usage from plans
      plans.forEach(plan => {
        const d = new Date(plan.date);
        if (d >= today && d <= in30Days) {
          plan.meals.forEach(meal => {
            meal.dishes.forEach(dish => {
              const recipe = recipes.find(r => r.name.toLowerCase() === dish.toLowerCase());
              if (recipe) {
                recipe.ingredients.forEach(ing => {
                  const key = ing.name.toLowerCase();
                  const volume = ing.amount * (ing.conversionFactor || 1.0);
                  ingredientUsage[key] = (ingredientUsage[key] || 0) + volume;
                });
              }
            });
          });
        }
      });

      const finalForecasts = inventory.map(item => {
        const totalProjectedUsage = ingredientUsage[item.name.toLowerCase()] || 0;
        const dailyUsage = totalProjectedUsage / daysCounted;
        const available = item.quantity - (item.reserved || 0);
        const reorderLevel = item.reorderLevel || 0;
        
        let daysLeft = 999;
        if (dailyUsage > 0) {
            daysLeft = available / dailyUsage;
        } else if (available <= 0) {
            daysLeft = 0;
        }

        // Estimation logic based on user-defined specs (Reorder Level & Brand-based Stock)
        let status: 'SAFE' | 'LOW' | 'CRITICAL' | 'EMPTY' = 'SAFE';
        if (available <= 0) {
            status = 'EMPTY';
        } else if (available <= (reorderLevel / 2)) {
            // Very critical, far below minimum
            status = 'CRITICAL';
        } else if (available <= reorderLevel) {
            // Reached reorder threshold
            status = 'LOW';
        } else if (daysLeft < 3) {
            // Predictive critical even if above reorder level
            status = 'CRITICAL';
        } else if (daysLeft < 7) {
            // Predictive low
            status = 'LOW';
        }

        return {
          name: item.name,
          brand: item.brand || 'Unbranded',
          current: available,
          reorderLevel: reorderLevel,
          dailyUsage,
          daysLeft,
          status,
          unit: item.unit
        };
      }).sort((a, b) => {
        // Sort by priority: Empty -> Critical -> Low -> Safe
        const priority = { 'EMPTY': 0, 'CRITICAL': 1, 'LOW': 2, 'SAFE': 3 };
        return priority[a.status] - priority[b.status];
      });

      setForecasts(finalForecasts);

      // Brand Cost Analysis
      const priceMap: Record<string, { brand: string, price: number, supplier: string, unit: string }[]> = {};
      vendors.forEach(vendor => {
        vendor.priceLedger?.forEach(pp => {
          const key = pp.itemName.toLowerCase();
          if (!priceMap[key]) priceMap[key] = [];
          priceMap[key].push({
            brand: pp.brand || 'General',
            price: pp.price,
            supplier: vendor.name,
            unit: pp.unit
          });
        });
      });

      const finalBrandAnalysis: BrandAnalysis[] = Object.entries(priceMap).map(([name, prices]) => {
        const sorted = [...prices].sort((a, b) => a.price - b.price);
        const lowest = sorted[0];
        const highest = sorted[sorted.length - 1];
        
        return {
          itemName: name.charAt(0).toUpperCase() + name.slice(1),
          cheapestBrand: lowest.brand,
          cheapestSupplier: lowest.supplier,
          lowestPrice: lowest.price,
          highestPrice: highest.price,
          savingsOpportunity: highest.price - lowest.price,
          unit: lowest.unit
        };
      }).filter(a => a.savingsOpportunity > 0);

      setBrandAnalysis(finalBrandAnalysis);
    };

    runAnalysis();
    window.addEventListener('storage', runAnalysis);
    return () => window.removeEventListener('storage', runAnalysis);
  }, []);

  return (
    <div className="space-y-12 pb-24 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><BarChart3 className="text-emerald-500" size={32} /> Predictive Analytics</h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest font-black">Estimates based on Brand Specs & Defined Reorder Levels</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group min-h-[200px]">
             <div className="relative z-10">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Stock Alerts</p>
                <p className="text-5xl font-black text-white tracking-tighter">{forecasts.filter(f => f.status !== 'SAFE').length}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Items below safety reorder levels</p>
             </div>
             <AlertCircle className="text-rose-500 absolute -right-4 -bottom-4 opacity-20" size={100} />
          </div>
          <div className="bg-emerald-500 p-8 rounded-[2.5rem] text-slate-950 flex flex-col justify-between shadow-xl relative overflow-hidden group min-h-[200px]">
             <div className="relative z-10">
                <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-4">Healthy Specs</p>
                <p className="text-5xl font-black text-white tracking-tighter">{forecasts.filter(f => f.status === 'SAFE').length}</p>
                <p className="text-[9px] font-bold text-emerald-900/60 mt-2 uppercase tracking-wide">Brand stock within safety limits</p>
             </div>
             <CheckCircle className="text-white absolute -right-4 -bottom-4 opacity-20" size={100} />
          </div>
      </div>

      {/* Brand-Based Runway Estimations */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-2 rounded-xl"><Clock size={20} /></div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Brand Runway Estimations</h3>
        </div>
        <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="divide-y divide-slate-100 min-w-[900px]">
               <div className="grid grid-cols-12 p-6 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="col-span-4">Material / Brand Spec</div>
                  <div className="col-span-2 text-center">Safety Level</div>
                  <div className="col-span-2 text-center">Daily Burn</div>
                  <div className="col-span-2 text-center">Runway</div>
                  <div className="col-span-2 text-right">Estimate Status</div>
               </div>
               {forecasts.map((f, i) => (
                 <div key={i} className="p-6 grid grid-cols-12 items-center hover:bg-slate-50 transition-all group">
                    <div className="col-span-4">
                       <h4 className="font-bold text-slate-900 text-lg">{f.name}</h4>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1"><Tag size={8} /> {f.brand}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Curr: {f.current.toFixed(1)} {f.unit}</span>
                       </div>
                    </div>
                    
                    <div className="col-span-2 text-center">
                       <p className="text-sm font-black text-slate-900">{f.reorderLevel} {f.unit}</p>
                       <p className="text-[8px] font-black text-slate-400 uppercase">Min Spec</p>
                    </div>

                    <div className="col-span-2 text-center">
                       <p className="text-sm font-black text-slate-600">{f.dailyUsage > 0 ? `${f.dailyUsage.toFixed(2)} ${f.unit}` : '-'}</p>
                    </div>

                    <div className="col-span-2 text-center">
                       {f.dailyUsage > 0 ? (
                         <div className="inline-flex items-baseline gap-1">
                            <span className={`text-xl font-black ${f.daysLeft < 3 ? 'text-rose-500' : f.daysLeft < 7 ? 'text-amber-500' : 'text-emerald-500'}`}>
                               {f.daysLeft.toFixed(0)}
                            </span>
                            <span className="text-[8px] font-black uppercase text-slate-400">Days</span>
                         </div>
                       ) : (
                         <span className="text-xs text-slate-300 font-bold italic">Stable</span>
                       )}
                    </div>

                    <div className="col-span-2 text-right">
                       <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                           f.status === 'SAFE' ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-100' :
                           f.status === 'LOW' ? 'bg-amber-50 text-amber-700 border-2 border-amber-100' :
                           'bg-rose-50 text-rose-700 border-2 border-rose-100'
                       }`}>
                           {f.status}
                       </span>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cost optimization based on brand pricing data */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl"><DollarSign size={20} /></div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Market Specs Analysis</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {brandAnalysis.map((item, idx) => (
             <div key={idx} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 hover:border-emerald-500 transition-all group flex flex-col shadow-sm">
                <div className="flex justify-between items-start mb-6">
                   <h4 className="text-xl font-black text-slate-900 leading-none">{item.itemName}</h4>
                   <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100 shadow-sm">
                      <TrendingDown size={14} /> Optimization: ₹{item.savingsOpportunity}
                   </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mt-auto flex justify-between items-end">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ShieldCheck size={10} /> Recommended Brand</p>
                      <p className="font-black text-slate-900 text-lg">{item.cheapestBrand}</p>
                      <p className="text-sm font-black text-emerald-500 mt-1">₹{item.lowestPrice} <span className="text-[10px] text-slate-300">/ {item.unit}</span></p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fulfillment</p>
                      <p className="text-xs font-bold text-slate-600">{item.cheapestSupplier}</p>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </section>
    </div>
  );
};
