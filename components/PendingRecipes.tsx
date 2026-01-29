
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
  BookOpen,
  Info,
  CheckCircle
} from 'lucide-react';
import { RecipeManagement } from './RecipeManagement';

export const PendingRecipes: React.FC = () => {
  const [pendingDishes, setPendingDishes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [completingDish, setCompletingDish] = useState<string | null>(null);

  const loadPending = () => {
    const data = JSON.parse(localStorage.getItem('pendingRecipes') || '[]');
    setPendingDishes(data);
  };

  useEffect(() => {
    loadPending();
    window.addEventListener('storage', loadPending);
    return () => window.removeEventListener('storage', loadPending);
  }, []);

  const filteredDishes = pendingDishes.filter(d => 
    d.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRecipeCreated = (name: string) => {
    // Re-sync with storage to get latest pending list
    const currentPending = JSON.parse(localStorage.getItem('pendingRecipes') || '[]');
    const updated = currentPending.filter((d: string) => d.toLowerCase() !== name.toLowerCase());
    
    localStorage.setItem('pendingRecipes', JSON.stringify(updated));
    setPendingDishes(updated);
    setCompletingDish(null);
    
    // Notify other components (like RecipeManagement list) that data changed
    window.dispatchEvent(new Event('storage'));
  };

  if (completingDish) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <button 
          onClick={() => setCompletingDish(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest transition-colors"
        >
          <X size={16} /> Cancel Completion
        </button>
        <div className="bg-emerald-50 p-10 rounded-[2.5rem] border border-emerald-100 mb-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <ChefHat size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-emerald-900 tracking-tight">Defining Spec: {completingDish}</h2>
              <p className="text-emerald-700/70 font-bold text-sm">Mapping this dish to raw materials is required to enable automated scaling and stock deductions.</p>
            </div>
        </div>
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
            Pending Linkages
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Detections from Approved Plans missing master specifications.</p>
        </div>
      </div>

      <div className="bg-amber-50/50 p-8 rounded-[2rem] border border-amber-100 flex items-start gap-4">
        <Info className="text-amber-500 shrink-0 mt-0.5" size={20} />
        <p className="text-xs font-bold text-amber-700 leading-relaxed uppercase tracking-wide">
          Link these items to your inventory assets now. This allows the system to auto-calculate the exact amount of raw material to deduct when you log production totals.
        </p>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search unmapped dishes..." 
            className="w-full pl-16 pr-6 py-5 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 font-black"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredDishes.map((dish, idx) => (
          <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group flex flex-col h-full border-t-8 border-t-amber-400">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                <ChefHat size={28} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-600 px-3 py-1 rounded-lg">Unlinked</span>
            </div>
            
            <h3 className="text-xl font-black text-slate-900 mb-6 leading-tight flex-1">{dish}</h3>
            
            <div className="mt-auto pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button 
                onClick={() => setCompletingDish(dish)}
                className="w-full sm:flex-1 bg-slate-900 text-white px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
              >
                Link to Spec <ArrowRight size={14} />
              </button>
              <button 
                onClick={() => {
                  if(confirm("Permanently ignore this dish and remove from the pending alerts list?")) {
                    const updated = pendingDishes.filter(d => d !== dish);
                    setPendingDishes(updated);
                    localStorage.setItem('pendingRecipes', JSON.stringify(updated));
                    window.dispatchEvent(new Event('storage'));
                  }
                }}
                className="p-4 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                title="Ignore Alert"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        ))}

        {filteredDishes.length === 0 && (
          <div className="col-span-full py-32 text-center bg-slate-50/20 rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="bg-white w-24 h-24 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 text-emerald-500 border border-slate-100">
              <CheckCircle size={40} />
            </div>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">System Fully Linked</h4>
            <p className="text-slate-500 max-w-xs mx-auto mt-2 font-black text-[10px] uppercase tracking-widest">All dishes in your operations schedule have corresponding master specifications.</p>
          </div>
        )}
      </div>
    </div>
  );
};
