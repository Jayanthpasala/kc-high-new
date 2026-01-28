
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
  Calendar
} from 'lucide-react';
import { ProductionPlan, Recipe, InventoryItem, Vendor, VendorPricePoint } from '../types';

interface ForecastItem {
  name: string;
  current: number;
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
      
      // 1. Calculate Average Daily Usage based on future 30 days plans
      const ingredientUsage: Record<string, number> = {};
      const today = new Date();
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      let daysCounted = 0;

      // Filter plans for the next 30 days
      const relevantPlans = plans.filter(p => {
         const d = new Date(p.date);
         return d >= today && d <= in30Days;
      });
      
      if (relevantPlans.length > 0) {
          relevantPlans.forEach(plan => {
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
          });
          daysCounted = 30; // Assuming the plan covers the window, roughly
      }

      const finalForecasts = inventory.map(item => {
        const totalProjectedUsage = ingredientUsage[item.name.toLowerCase()] || 0;
        const dailyUsage = daysCounted > 0 ? totalProjectedUsage / daysCounted : 0;
        const available = item.quantity - (item.reserved || 0);
        
        let daysLeft = 999;
        if (dailyUsage > 0) {
            daysLeft = available / dailyUsage;
        } else if (available <= 0) {
            daysLeft = 0;
        }

        let status: 'SAFE' | 'LOW' | 'CRITICAL' | 'EMPTY' = 'SAFE';
        if (available <= 0) status = 'EMPTY';
        else if (daysLeft < 3) status = 'CRITICAL';
        else if (daysLeft < 7) status = 'LOW';

        return {
          name: item.name,
          current: available,
          dailyUsage,
          daysLeft,
          status,
          unit: item.unit
        };
      }).sort((a, b) => a.daysLeft - b.daysLeft);

      setForecasts(finalForecasts);

      // 2. Brand Cost Analysis (Existing Logic)
      const priceMap: Record<string, { brand: string, price: number, supplier: string, unit: string }[]> = {};
      vendors.forEach(vendor => {
        vendor.priceLedger?.forEach(pp => {
          const key = pp.itemName.toLowerCase();
          if (!priceMap[key]) priceMap[key] = [];
          priceMap[key].push({
            brand: pp.brand || 'Unbranded',
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
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><BarChart3 className="text-emerald-500" size={32} /> Operational Forecast</h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Predictive Stock Runways & Purchase Suggestions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group">
             <div className="relative z-10">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Urgent Attention</p>
                <p className="text-5xl font-black text-white tracking-tighter">{forecasts.filter(f => f.status === 'CRITICAL' || f.status === 'EMPTY').length}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Items expiring within 3 days</p>
             </div>
             <AlertCircle className="text-rose-500 absolute -right-4 -bottom-4 opacity-20" size={100} />
          </div>
      </div>

      {/* Stock Exhaustion Estimates */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-2 rounded-xl"><Clock size={20} /></div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Stock Runway Estimates</h3>
        </div>
        <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
             <div className="grid grid-cols-12 p-6 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <div className="col-span-4">Item Name</div>
                <div className="col-span-3">Est. Daily Usage</div>
                <div className="col-span-3">Days Left</div>
                <div className="col-span-2 text-right">Status</div>
             </div>
             {forecasts.map((f, i) => (
               <div key={i} className="p-6 grid grid-cols-12 items-center hover:bg-slate-50 transition-all group">
                  <div className="col-span-4">
                     <h4 className="font-bold text-slate-900">{f.name}</h4>
                     <p className="text-xs text-slate-400 font-medium">Current: {f.current.toFixed(1)} {f.unit}</p>
                  </div>
                  
                  <div className="col-span-3 text-sm text-slate-600 font-bold">
                     {f.dailyUsage > 0 ? `${f.dailyUsage.toFixed(2)} ${f.unit}/day` : '-'}
                  </div>

                  <div className="col-span-3">
                     {f.dailyUsage > 0 ? (
                       <div className="flex items-center gap-2">
                          <span className={`text-xl font-black ${f.daysLeft < 3 ? 'text-rose-500' : f.daysLeft < 7 ? 'text-amber-500' : 'text-emerald-500'}`}>
                             {f.daysLeft.toFixed(0)}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Days</span>
                       </div>
                     ) : (
                       <span className="text-xs text-slate-300 font-bold">No Usage Data</span>
                     )}
                  </div>

                  <div className="col-span-2 text-right">
                     <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                         f.status === 'SAFE' ? 'bg-emerald-100 text-emerald-600' :
                         f.status === 'LOW' ? 'bg-amber-100 text-amber-600' :
                         'bg-rose-100 text-rose-600'
                     }`}>
                         {f.status}
                     </span>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* Brand Analysis Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl"><DollarSign size={20} /></div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Cost Optimization</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {brandAnalysis.map((item, idx) => (
             <div key={idx} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 hover:border-emerald-500 transition-all group flex flex-col">
                <div className="flex justify-between items-start mb-6">
                   <h4 className="text-xl font-black text-slate-900 leading-none">{item.itemName}</h4>
                   <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
                      <TrendingDown size={14} /> Save ₹{item.savingsOpportunity}
                   </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mt-auto">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Tag size={10} /> Cheapest Option</p>
                   <p className="font-black text-slate-900 text-lg">{item.cheapestBrand}</p>
                   <p className="text-sm font-black text-emerald-500 mt-1">₹{item.lowestPrice} <span className="text-[10px] text-slate-300">/ {item.unit} via {item.cheapestSupplier}</span></p>
                </div>
             </div>
           ))}
        </div>
      </section>
    </div>
  );
};
