
import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  ChefHat, 
  ArrowRight, 
  Search, 
  Filter, 
  PlusCircle, 
  X,
  Package,
  BookOpen
} from 'lucide-react';
import { RecipeManagement } from './RecipeManagement';

export const PendingRecipes: React.FC = () => {
  const [pendingDishes, setPendingDishes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [completingDish, setCompletingDish] = useState<string | null>(null);

  useEffect(() => {
    const loadPending = () => {
      const data = JSON.parse(localStorage.getItem('pendingRecipes') || '[]');
      setPendingDishes(data);
    };
    loadPending();
    window.addEventListener('storage', loadPending);
    return () => window.removeEventListener('storage', loadPending);
  }, []);

  const filteredDishes = pendingDishes.filter(d => 
    d.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRecipeCreated = (name: string) => {
    // Remove from pending list
    const updated = pendingDishes.filter(d => d.toLowerCase() !== name.toLowerCase());
    setPendingDishes(updated);
    localStorage.setItem('pendingRecipes', JSON.stringify(updated));
    setCompletingDish(null);
    window.dispatchEvent(new Event('storage'));
  };

  if (completingDish) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setCompletingDish(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black uppercase text-xs tracking-widest transition-colors"
        >
          <X size={16} /> Cancel Completion
        </button>
        <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 mb-8">
            <h2 className="text-2xl font-black text-emerald-900">Completing Definition: {completingDish}</h2>
            <p className="text-emerald-700 font-medium">Define ingredients and steps to link this dish to production and inventory.</p>
        </div>
        {/* We reuse the RecipeManagement logic but pre-fill the name */}
        <RecipeManagement initialDishName={completingDish} onComplete={handleRecipeCreated} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="text-amber-500" size={32} />
            Pending Recipes
          </h2>
          <p className="text-slate-500 font-medium mt-1">Dishes found in Production Plans that lack documentation.</p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search pending dishes..." 
            className="w-full pl-14 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none transition-all text-slate-900 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDishes.map((dish, idx) => (
          <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col h-full">
            <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <ChefHat size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 leading-tight">{dish}</h3>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-6">Status: Unmapped</p>
            
            <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between items-center">
              <button 
                onClick={() => setCompletingDish(dish)}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all"
              >
                Define Recipe <ArrowRight size={14} />
              </button>
              <button 
                onClick={() => {
                  if(confirm("Remove from pending list?")) {
                    const updated = pendingDishes.filter(d => d !== dish);
                    setPendingDishes(updated);
                    localStorage.setItem('pendingRecipes', JSON.stringify(updated));
                  }
                }}
                className="text-slate-300 hover:text-rose-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        ))}

        {filteredDishes.length === 0 && (
          <div className="col-span-full py-32 text-center bg-slate-50/20 rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="bg-white w-24 h-24 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 text-slate-200 border border-slate-100">
              <BookOpen size={40} />
            </div>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">System is up to date</h4>
            <p className="text-slate-500 max-w-xs mx-auto mt-2 font-medium">All dishes in your production plan are correctly mapped to master recipes.</p>
          </div>
        )}
      </div>
    </div>
  );
};
