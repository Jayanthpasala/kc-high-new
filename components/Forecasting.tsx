
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  Calendar, 
  CheckCircle, 
  DollarSign, 
  Tag, 
  Truck, 
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { ProductionPlan, Recipe, InventoryItem, Vendor, VendorPricePoint } from '../types';

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
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysis[]>([]);

  useEffect(() => {
    const runAnalysis = () => {
      const plans: ProductionPlan[] = JSON.parse(localStorage.getItem('productionPlans') || '[]').filter(p => p.isApproved && !p.isConsumed);
      const recipes: Recipe[] = JSON.parse(localStorage.getItem('recipes') || '[]');
      const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
      const vendors: Vendor[] = JSON.parse(localStorage.getItem('vendors') || '[]');
      
      // 1. Production Stock Forecast
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
                
                const volume = ing.amount * (ing.conversionFactor || 1.0);
                if (planDate <= in7Days) ingredientUsage[key].next7 += volume;
                if (planDate <= in30Days) ingredientUsage[key].next30 += volume;
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

      // 2. Brand Cost Analysis
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
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><BarChart3 className="text-emerald-500" size={32} /> Operational Intelligence</h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Predictive usage & Brand arbitrage reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group">
             <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingDown size={80} /></div>
             <div className="relative z-10">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Savings Discovery</p>
                <p className="text-4xl font-black text-white tracking-tighter">₹{brandAnalysis.reduce((acc, curr) => acc + curr.savingsOpportunity, 0).toLocaleString()}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Possible monthly arbitrage</p>
             </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 flex flex-col justify-between group shadow-sm">
             <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Critical Shortages</p>
                <p className="text-4xl font-black text-rose-500 tracking-tighter">{forecasts.filter(f => f.status === 'CRITICAL').length}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Exhaustion within 7 days</p>
             </div>
             <AlertCircle className="text-rose-500/20 self-end" size={24} />
          </div>
      </div>

      {/* Brand Arbitrage Report */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-white p-2 rounded-xl"><DollarSign size={20} /></div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Cheapest Brand Discovery</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {brandAnalysis.map((item, idx) => (
             <div key={idx} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 hover:border-emerald-500 transition-all group flex flex-col">
                <div className="flex justify-between items-start mb-6">
                   <h4 className="text-2xl font-black text-slate-900 leading-none">{item.itemName}</h4>
                   <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
                      <TrendingDown size={14} /> Potential Saving: ₹{item.savingsOpportunity}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-auto">
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Tag size={10} /> Cheapest Brand</p>
                      <p className="font-black text-slate-900 text-lg">{item.cheapestBrand}</p>
                      <p className="text-sm font-black text-emerald-500 mt-1">₹{item.lowestPrice} <span className="text-[10px] text-slate-300">/ {item.unit}</span></p>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Truck size={10} /> Best Supplier</p>
                      <p className="font-black text-slate-900 text-sm leading-tight">{item.cheapestSupplier}</p>
                      <div className="mt-3 flex items-center gap-1 text-[10px] font-black text-slate-300 uppercase">
                         Review Partner <ChevronRight size={10} />
                      </div>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* Stock Exhaustion Estimates */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-2 rounded-xl"><Clock size={20} /></div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Exhaustion Estimates</h3>
        </div>
        <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
             {forecasts.map((f, i) => (
               <div key={i} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-all group">
                  <div className="flex items-center gap-6 w-1/3">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${f.status === 'SAFE' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500 group-hover:bg-rose-500 group-hover:text-white'}`}>
                        {f.status === 'SAFE' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                     </div>
                     <h4 className="font-black text-xl text-slate-900 tracking-tight">{f.name}</h4>
                  </div>
                  
                  <div className="flex-1 px-10">
                     <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        <span>7D Cycle: {f.next7.toFixed(2)} {f.unit}</span>
                        <span>30D Goal: {f.next30.toFixed(2)} {f.unit}</span>
                     </div>
                     <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className="h-full bg-emerald-500 border-r-2 border-white" style={{ width: `${Math.min((f.next7 / (f.current + 1)) * 100, 50)}%` }}></div>
                        <div className="h-full bg-slate-200" style={{ width: `${Math.min((f.next30 / (f.current + 1)) * 100, 50)}%` }}></div>
                     </div>
                  </div>

                  <div className="w-1/4 text-right">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Volume</p>
                     <p className={`text-3xl font-black ${f.status === 'CRITICAL' ? 'text-rose-500 animate-pulse' : 'text-slate-900'}`}>{f.current.toFixed(2)} <span className="text-sm font-medium uppercase">{f.unit}</span></p>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </section>
    </div>
  );
};
