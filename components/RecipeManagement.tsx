
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Search, 
  ChefHat, 
  Edit3, 
  Trash2, 
  X, 
  PlusCircle, 
  Save, 
  Link as LinkIcon,
  Scale,
  Info,
  Calculator,
  Package
} from 'lucide-react';
import { Recipe, Ingredient, InventoryItem } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const INITIAL_FORM_STATE: Partial<Recipe> = {
  name: '',
  category: 'Main Course',
  outputUnit: 'kg',
  difficulty: 'Medium',
  ingredients: [],
  instructions: ['']
};

interface RecipeManagementProps {
  initialDishName?: string;
  onComplete?: (name: string) => void;
}

export const RecipeManagement: React.FC<RecipeManagementProps> = ({ initialDishName, onComplete }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formData, setFormData] = useState<Partial<Recipe>>(INITIAL_FORM_STATE);
  
  const [invSearch, setInvSearch] = useState('');

  // Fix: Load recipes from local storage but Inventory Items from Firestore for live linkage
  const loadData = useCallback(() => {
    setRecipes(JSON.parse(localStorage.getItem('recipes') || '[]'));
  }, []);

  useEffect(() => {
    loadData();
    
    // Subscribe to Firestore Inventory for the material dropdown
    const q = query(collection(db, "inventory"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });

    if (initialDishName) {
      setEditingRecipe(null);
      setFormData({ ...INITIAL_FORM_STATE, name: initialDishName, ingredients: [] });
      setIsModalOpen(true);
    }

    return () => unsubscribe();
  }, [initialDishName, loadData]);

  const handleSave = () => {
    if (!formData.name || (formData.ingredients || []).length === 0) {
      alert('Data Error: Name and at least one material linkage required.');
      return;
    }

    setRecipes(prev => {
      let updated: Recipe[];
      if (editingRecipe) {
        updated = prev.map(r => r.id === editingRecipe.id ? { ...r, ...formData } as Recipe : r);
      } else {
        const newRecipe = { id: Math.random().toString(36).substr(2, 9), ...formData } as Recipe;
        updated = [newRecipe, ...prev];
      }
      localStorage.setItem('recipes', JSON.stringify(updated));
      return updated;
    });

    // Remove from pending if applicable
    const pending = JSON.parse(localStorage.getItem('pendingRecipes') || '[]');
    localStorage.setItem('pendingRecipes', JSON.stringify(
      pending.filter((d: string) => d.toLowerCase() !== formData.name?.toLowerCase())
    ));

    setIsModalOpen(false);
    window.dispatchEvent(new Event('storage'));
    if (onComplete) onComplete(formData.name!);
  };

  const addLinkedIngredient = (item: InventoryItem) => {
    const exists = formData.ingredients?.some(i => i.inventoryItemId === item.id);
    if (exists) {
      setInvSearch('');
      return;
    }

    const newIng: Ingredient = {
      name: item.name,
      brand: item.brand || '',
      amount: 1, // Default 1 unit of the raw material
      unit: item.unit,
      inventoryItemId: item.id,
      conversionFactor: 1.0
    };
    setFormData(prev => ({ ...prev, ingredients: [...(prev.ingredients || []), newIng] }));
    setInvSearch('');
  };

  const removeIngredient = (idx: number) => {
    setFormData(prev => ({ ...prev, ingredients: prev.ingredients?.filter((_, i) => i !== idx) }));
  };

  const updateIngredient = (idx: number, field: keyof Ingredient, value: any) => {
    setFormData(prev => {
      const copy = [...(prev.ingredients || [])];
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...prev, ingredients: copy };
    });
  };

  const filteredInventoryItems = inventory.filter(i => 
    i.name.toLowerCase().includes(invSearch.toLowerCase()) || 
    (i.brand || '').toLowerCase().includes(invSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="text-emerald-500" size={32} /> Recipe Studio
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Master BOM Configuration per 1.0 Unit of Finished Output</p>
        </div>
        <button onClick={() => { setEditingRecipe(null); setFormData(INITIAL_FORM_STATE); setIsModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-xl group">
          <PlusCircle size={18} className="group-hover:rotate-90 transition-all" />
          <span>New Specification</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {recipes.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())).map(recipe => (
          <div key={recipe.id} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full min-h-[300px]">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-slate-900 text-white p-4 rounded-2xl"><ChefHat size={28} /></div>
              <span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg">{recipe.category}</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-6 leading-tight flex-1">{recipe.name}</h3>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between mt-auto">
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Batch Size</span>
                  <span className="text-sm font-bold text-slate-900">1.0 {recipe.outputUnit.toUpperCase()}</span>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => { setEditingRecipe(recipe); setFormData(recipe); setIsModalOpen(true); }} className="p-3 bg-white text-slate-400 hover:text-emerald-500 rounded-xl shadow-sm border border-slate-100"><Edit3 size={18} /></button>
                  <button onClick={() => { if(confirm("Delete recipe?")) { const up = recipes.filter(r => r.id !== recipe.id); setRecipes(up); localStorage.setItem('recipes', JSON.stringify(up)); window.dispatchEvent(new Event('storage')); }}} className="p-3 bg-white text-slate-400 hover:text-rose-500 rounded-xl shadow-sm border border-slate-100"><Trash2 size={18} /></button>
               </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] w-full max-w-6xl overflow-hidden shadow-2xl border-4 border-slate-900 max-h-[95vh] flex flex-col animate-in zoom-in-95">
             <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-5">
                   <div className="bg-emerald-500 p-3 rounded-2xl text-slate-950 shadow-lg shadow-emerald-500/20"><ChefHat size={32} /></div>
                   <h3 className="text-3xl font-black tracking-tighter uppercase">{formData.name || 'Recipe Config'}</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
             </div>

             <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-10 rounded-[3rem] border-2 border-slate-100">
                   <div className="md:col-span-2 space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Recipe Identity</label>
                      <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Butter Chicken Curry" className="w-full px-8 py-5 rounded-3xl bg-white border-2 border-transparent font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 shadow-sm" />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Unit of Measurement (Output)</label>
                      <div className="flex gap-2">
                         {['kg', 'L'].map(u => (
                           <button key={u} onClick={() => setFormData({...formData, outputUnit: u as any})} className={`flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all ${formData.outputUnit === u ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>{u}</button>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                   <div className="lg:col-span-7 space-y-8">
                      <div className="flex justify-between items-center border-b-2 border-slate-100 pb-4">
                         <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><LinkIcon size={20} className="text-emerald-500" /> Material Linkage</h4>
                         <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Amounts required for 1.0 {formData.outputUnit}</p>
                      </div>

                      <div className="relative">
                         <div className="relative group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                            <input 
                              type="text" 
                              placeholder="Search Raw Materials in Pantry..." 
                              value={invSearch} 
                              onChange={e => setInvSearch(e.target.value)} 
                              className="w-full pl-16 pr-6 py-5 rounded-[2.5rem] bg-slate-50 border-none font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm" 
                            />
                         </div>
                         {invSearch.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-[110] mt-2 bg-white rounded-[2rem] shadow-2xl border-4 border-slate-900 overflow-hidden animate-in fade-in slide-in-from-top-2">
                               <div className="max-h-60 overflow-y-auto custom-scrollbar p-3 space-y-1">
                                  {filteredInventoryItems.length > 0 ? filteredInventoryItems.map(item => (
                                    <button key={item.id} onClick={() => addLinkedIngredient(item)} className="w-full text-left p-4 rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex justify-between items-center group">
                                       <div>
                                          <p className="font-black text-sm">{item.name}</p>
                                          <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{item.brand || 'General'} • {item.unit} in Stock</p>
                                       </div>
                                       <PlusCircle size={18} className="opacity-0 group-hover:opacity-100" />
                                    </button>
                                  )) : (
                                    <div className="p-6 text-center text-slate-400 font-bold text-sm">No materials matching "{invSearch}"</div>
                                  )}
                               </div>
                            </div>
                         )}
                      </div>

                      <div className="space-y-4">
                         {formData.ingredients?.map((ing, idx) => (
                           <div key={idx} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 flex flex-col gap-6 shadow-sm hover:border-emerald-500 transition-all relative overflow-hidden">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <h6 className="font-black text-lg text-slate-900">{ing.name}</h6>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Sourced from: {ing.brand || 'Market'}</p>
                                 </div>
                                 <button onClick={() => removeIngredient(idx)} className="p-3 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={20} /></button>
                              </div>
                              <div className="grid grid-cols-2 gap-8 border-t border-slate-50 pt-6">
                                 <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Scale size={12} /> Quantity per 1.0 {formData.outputUnit} ({ing.unit})</label>
                                    <input type="number" step="0.001" value={ing.amount} onChange={e => updateIngredient(idx, 'amount', parseFloat(e.target.value) || 0)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none font-black text-slate-900 text-lg shadow-inner focus:bg-white focus:ring-2 focus:ring-emerald-500/20" />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calculator size={12} /> Yield Adjustment Factor</label>
                                    <div className="flex items-center gap-3">
                                       <input type="number" step="0.01" value={ing.conversionFactor} onChange={e => updateIngredient(idx, 'conversionFactor', parseFloat(e.target.value) || 0)} className="w-full px-6 py-4 rounded-2xl bg-slate-900 text-emerald-400 border-none font-black text-lg shadow-inner" />
                                       <div className="group relative">
                                          <Info size={16} className="text-slate-300" />
                                          <div className="absolute bottom-full right-0 mb-4 w-48 p-4 bg-slate-900 text-white text-[9px] font-bold rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-[120] shadow-2xl">
                                             Multipler for waste/prep loss. <br/> Input × Factor = Total Deducted.
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                         ))}
                         {(!formData.ingredients || formData.ingredients.length === 0) && (
                            <div className="py-20 text-center bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100">
                               <Package size={48} className="text-slate-200 mx-auto mb-4" />
                               <p className="text-slate-400 font-bold text-sm">Select raw materials from the search above to build your Bill of Materials.</p>
                            </div>
                         )}
                      </div>
                   </div>

                   <div className="lg:col-span-5 space-y-8">
                      <div className="flex justify-between items-center border-b-2 border-slate-100 pb-4">
                         <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><ChefHat size={20} className="text-blue-500" /> Culinary SOP</h4>
                      </div>
                      <div className="space-y-4">
                         {formData.instructions?.map((inst, idx) => (
                           <div key={idx} className="flex gap-5 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group transition-all hover:bg-white hover:shadow-lg">
                              <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black shrink-0">{idx + 1}</span>
                              <textarea value={inst} onChange={e => { const up = [...formData.instructions!]; up[idx] = e.target.value; setFormData({...formData, instructions: up}); }} className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-slate-600 leading-relaxed resize-none h-24 p-0" placeholder="Describe a specific step in the process..." />
                              <button onClick={() => { setFormData({...formData, instructions: formData.instructions?.filter((_, i) => i !== idx)}); }} className="self-start text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                           </div>
                         ))}
                         <button onClick={() => setFormData({...formData, instructions: [...(formData.instructions || []), '']})} className="w-full py-5 rounded-3xl border-4 border-dashed border-slate-100 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-3"><PlusCircle size={16} /> Append Instruction Step</button>
                      </div>
                   </div>
                </div>
             </div>

             <div className="p-10 bg-slate-50 border-t-2 border-slate-100 flex flex-col sm:flex-row justify-end gap-6 shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors">Discard Draft</button>
                <button onClick={handleSave} className="bg-slate-900 text-white px-14 py-5 rounded-3xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-4 shadow-2xl hover:bg-emerald-600 transition-all active:scale-95">
                   <Save size={20} /> Commit Recipe Linkage
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
