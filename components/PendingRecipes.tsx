
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  ChefHat, 
  ArrowRight, 
  Search, 
  X,
  Info,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Clock,
  Calendar
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { ProductionPlan, Recipe } from '../types';
import { RecipeManagement } from './RecipeManagement';

export const PendingRecipes: React.FC = () => {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [completingDish, setCompletingDish] = useState<string | null>(null);

  useEffect(() => {
    // Listen to ALL production plans (approved or otherwise) to catch unmapped dishes early
    const qPlans = query(collection(db, "productionPlans"));
    const unsubPlans = onSnapshot(qPlans, (snap) => {
      setPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionPlan)));
    });

    // Listen to all master recipes
    const unsubRecipes = onSnapshot(collection(db, "recipes"), (snap) => {
      setRecipes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe)));
      setLoading(false);
    });

    return () => {
      unsubPlans();
      unsubRecipes();
    };
  }, []);

  // Robust computation of unique dishes that appear in plans but are NOT in recipes
  const pendingDishes = useMemo(() => {
    // We map dish names to their latest plan date for helpful context
    const missingMap = new Map<string, { latestDate: string, planCount: number }>();
    
    const existingRecipeNames = new Set(
      recipes.map(r => r.name.toLowerCase().trim())
    );

    plans.forEach(plan => {
      plan.meals.forEach(meal => {
        // Collect all possible dish names from this meal
        const rawNames: string[] = [];
        if (meal.dishes) meal.dishes.forEach(d => { if (d) rawNames.push(d); });
        if (meal.dishDetails) meal.dishDetails.forEach(dd => { if (dd.name) rawNames.push(dd.name); });

        rawNames.forEach(name => {
          const trimmedName = name.trim();
          if (!trimmedName) return;
          
          const key = trimmedName.toLowerCase();
          if (!existingRecipeNames.has(key)) {
            // It's a missing recipe. Track it.
            const existing = missingMap.get(key);
            if (existing) {
              missingMap.set(key, {
                latestDate: plan.date > existing.latestDate ? plan.date : existing.latestDate,
                planCount: existing.planCount + 1
              });
            } else {
              missingMap.set(key, {
                latestDate: plan.date,
                planCount: 1
              });
            }
          }
        });
      });
    });

    // Convert map to array of displayable objects
    return Array.from(missingMap.entries())
      .map(([key, data]) => {
        // Try to find the original casing from the plans
        let originalCasing = key;
        plans.some(p => p.meals.some(m => {
          const found = (m.dishes || []).find(d => d.toLowerCase().trim() === key) || 
                        (m.dishDetails || []).find(dd => dd.name.toLowerCase().trim() === key)?.name;
          if (found) originalCasing = found;
          return !!found;
        }));

        return {
          name: originalCasing,
          ...data
        };
      })
      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate)); // Show recently added/scheduled items first
  }, [plans, recipes, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auditing Master Specifications...</p>
      </div>
    );
  }

  if (completingDish) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <button 
          onClick={() => setCompletingDish(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest transition-colors mb-4"
        >
          <X size={16} /> Cancel Specification
        </button>
        <div className="bg-amber-50 p-10 rounded-[2.5rem] border border-amber-100 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <ChefHat size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-amber-900 tracking-tight uppercase">Map Material Spec: {completingDish}</h2>
              <p className="text-amber-700/70 font-bold text-sm">Linking this dish to raw materials to enable automated production deductions.</p>
            </div>
        </div>
        <RecipeManagement initialDishName={completingDish} onComplete={() => setCompletingDish(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="text-amber-500" size={32} />
            Pending Recipes
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Dishes present in production schedules currently lacking a master specification.</p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search unmapped dishes..." 
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {pendingDishes.length === 0 ? (
        <div className="col-span-full py-32 text-center bg-slate-50/20 rounded-[3rem] border-2 border-dashed border-slate-200">
          <div className="bg-white w-24 h-24 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 text-emerald-500 border border-slate-100">
            <CheckCircle size={40} />
          </div>
          <h4 className="text-2xl font-black text-slate-900 tracking-tight">System Synchronized</h4>
          <p className="text-slate-500 max-w-xs mx-auto mt-2 font-black text-[10px] uppercase tracking-widest leading-loose">
            Every dish currently appearing in your production plans is linked to a master recipe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {pendingDishes.map((item, idx) => (
            <div key={idx} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:border-amber-400 transition-all group flex flex-col h-full border-t-8 border-t-amber-400">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                  <ChefHat size={28} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-600 px-3 py-1 rounded-lg">Missing Spec</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1"><Clock size={10} /> {item.planCount} plan(s)</span>
                </div>
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 mb-6 leading-tight flex-1">{item.name}</h3>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-slate-500">
                   <Calendar size={14} />
                   <span className="text-[10px] font-black uppercase tracking-wider">Scheduled: {item.latestDate}</span>
                </div>
              </div>

              <div className="mt-auto">
                <button 
                  onClick={() => setCompletingDish(item.name)}
                  className="w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                >
                  Define Materials <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-dashed border-slate-200 flex items-start gap-4">
        <Info className="text-blue-500 shrink-0 mt-0.5" size={24} />
        <div>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">System Reliability Note</h4>
          <p className="text-slate-500 text-xs font-medium leading-relaxed mt-1">
            Production cycles can only be finalized for inventory deductions if every dish in the schedule is mapped to a master recipe specification. This view scans your entire database to identify these gaps.
          </p>
        </div>
      </div>
    </div>
  );
};
