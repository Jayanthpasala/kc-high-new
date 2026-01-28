
import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  ChefHat, 
  Edit3, 
  Trash2, 
  X, 
  PlusCircle, 
  Save, 
  ArrowRight,
  Link,
  Link2Off,
  Search as SearchIcon,
  CheckCircle2,
  AlertCircle,
  Scale,
  Beaker,
  ChevronRight,
  Info,
  Calculator,
  Tag
} from 'lucide-react';
import { Recipe, Ingredient, InventoryItem } from '../types';

const INITIAL_FORM_STATE: Partial<Recipe> = {
  name: '',
  category: 'Main Course',
  outputUnit: 'kg',
  difficulty: 'Medium',
  ingredients: [{ name: '', brand: '', amount: 0, unit: 'kg', conversionFactor: 1.0 }],
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
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formData, setFormData] = useState<Partial<Recipe>>(INITIAL_FORM_STATE);
  
  const [linkingIdx, setLinkingIdx] = useState<number | null>(null);
  const [invSearch, setInvSearch] = useState('');

  const PREDEFINED_CATEGORIES = ['Appetizer', 'Main Course', 'Side Dish', 'Dessert', 'Beverage'];
  const FILTER_CATEGORIES = ['All', ...PREDEFINED_CATEGORIES];

  const loadData = useCallback(() => {
    const recipeData = localStorage.getItem('recipes');
    if (recipeData) {
      setRecipes(JSON.parse(recipeData));
    }

    const invData = localStorage.getItem('inventory');
    if (invData) setInventory(JSON.parse(invData));
  }, []);

  useEffect(() => {
    loadData();
    
    if (initialDishName) {
      setEditingRecipe(null);
      const invData = localStorage.getItem('inventory');
      const currentInventory: InventoryItem[] = invData ? JSON.parse(invData) : [];
      const matchingInvItem = currentInventory.find(i => i.name.toLowerCase() === initialDishName.toLowerCase());
      
      const defaultIngredients = matchingInvItem ? [
        { 
          name: matchingInvItem.name, 
          brand: matchingInvItem.brand || '',
          amount: 1, 
          unit: matchingInvItem.unit, 
          inventoryItemId: matchingInvItem.id,
          conversionFactor: 1.0
        } as Ingredient
      ] : [{ name: '', brand: '', amount: 0, unit: 'kg', conversionFactor: 1.0 } as Ingredient];

      setFormData({ 
        ...INITIAL_FORM_STATE, 
        name: initialDishName,
        ingredients: defaultIngredients
      });
      setIsModalOpen(true);
    }

    const handleStorageChange = () => loadData();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [initialDishName, loadData]);

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAdd = () => {
    setEditingRecipe(null);
    setFormData(INITIAL_FORM_STATE);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormData({ ...recipe });
    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this recipe specification?')) {
      setRecipes(prev => {
        const updated = prev.filter(r => r.id !== id);
        localStorage.setItem('recipes', JSON.stringify(updated));
        return updated;
      });
      setTimeout(() => window.dispatchEvent(new Event('storage')), 0);
    }
  };

  const handleSave = () => {
    if (!formData.name) {
      alert('Please provide a recipe name.');
      return;
    }

    if (formData.ingredients?.some(i => !i.name)) {
      alert('Ensure all ingredient names are filled.');
      return;
    }

    setRecipes(prev => {
      let updated: Recipe[];
      if (editingRecipe) {
        updated = prev.map(r => r.id === editingRecipe.id ? { ...r, ...formData } as Recipe : r);
      } else {
        const newRecipe: Recipe = {
          id: Math.random().toString(36).substr(2, 9),
          ...(formData as Omit<Recipe, 'id'>)
        } as Recipe;
        updated = [newRecipe, ...prev];
      }
      localStorage.setItem('recipes', JSON.stringify(updated));
      return updated;
    });

    setTimeout(() => window.dispatchEvent(new Event('storage')), 0);
    setIsModalOpen(false);
    if (onComplete && formData.name) onComplete(formData.name);
  };

  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), { name: '', brand: '', amount: 0, unit: 'kg', conversionFactor: 1.0 }]
    }));
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients?.filter((_, i) => i !== index)
    }));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    setFormData(prev => {
      const newIngs = [...(prev.ingredients || [])];
      newIngs[index] = { ...newIngs[index], [field]: value };
      return { ...prev, ingredients: newIngs };
    });
  };

  const addInstruction = () => {
    setFormData(prev => ({
      ...prev,
      instructions: [...(prev.instructions || []), '']
    }));
  };

  const removeInstruction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions?.filter((_, i) => i !== index)
    }));
  };

  const updateInstruction = (index: number, value: string) => {
    setFormData(prev => {
      const newInst = [...(prev.instructions || [])];
      newInst[index] = value;
      return { ...prev, instructions: newInst };
    });
  };

  const linkInventoryItem = (idx: number, item: InventoryItem) => {
    updateIngredient(idx, 'name', item.name);
    updateIngredient(idx, 'brand', item.brand || '');
    updateIngredient(idx, 'unit', item.unit);
    updateIngredient(idx, 'inventoryItemId', item.id);
    setLinkingIdx(null);
    setInvSearch('');
  };

  const unlinkInventoryItem = (idx: number) => {
    updateIngredient(idx, 'inventoryItemId', undefined);
  };

  const filteredInventory = inventory.filter(i => 
    i.name.toLowerCase().includes(invSearch.toLowerCase()) || (i.brand || '').toLowerCase().includes(invSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="text-emerald-500" size={32} />
            Recipe Master BOM
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest font-black">Calculations per Standard Batch (1.0 KG / 1.0 L)</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95 group"
        >
          <PlusCircle size={18} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>New Recipe Spec</span>
        </button>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search regional recipe archives..." 
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 rounded-2xl w-full lg:w-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Cuisine Type:</label>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest outline-none focus:ring-0 text-slate-900 min-w-[120px] cursor-pointer"
          >
            {FILTER_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredRecipes.map(recipe => (
          <div key={recipe.id} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:border-emerald-200 transition-all group flex flex-col h-full relative min-h-[420px]">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-slate-50 p-4 rounded-2xl text-slate-900 border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                <ChefHat size={28} />
              </div>
              <span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-slate-200">
                {recipe.category}
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-6 leading-tight flex-1">{recipe.name}</h3>
            <div className="mb-8">
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${recipe.outputUnit === 'kg' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                    {recipe.outputUnit === 'kg' ? <Scale size={18} /> : <Beaker size={18} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Standard Unit</span>
                    <span className="text-sm font-bold text-slate-900">1.0 {recipe.outputUnit.toUpperCase()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Ingredient Map</span>
                  <p className="text-sm font-bold text-slate-700">{recipe.ingredients.length} items</p>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(recipe); }} className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"><Edit3 size={18} /></button>
                <button onClick={(e) => handleDelete(e, recipe.id)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90"><Trash2 size={18} /></button>
              </div>
              <button onClick={() => handleOpenEdit(recipe)} className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 hover:gap-4 transition-all group/btn">
                Recipe Profile <ArrowRight size={14} className="text-emerald-500 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-[95vw] 2xl:max-w-[1600px] overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[95vh] flex flex-col">
            <div className="bg-slate-900 p-6 md:px-12 md:py-8 text-white relative shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 gap-4">
              <div className="flex items-center gap-5">
                <div className="bg-emerald-500 text-slate-950 p-3 rounded-2xl shadow-lg shadow-emerald-500/20 hidden sm:block">
                  <ChefHat size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Kitchen OS BOM Studio</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight">{formData.name || 'Recipe Specification'}</h3>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="bg-white/5 hover:bg-rose-500 p-3 rounded-xl transition-all absolute top-6 right-6 sm:static"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dish Name</label>
                  <input type="text" value={formData.name || ''} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-5 py-3 rounded-xl bg-white border-2 border-slate-100 outline-none focus:border-emerald-500 transition-all font-bold text-slate-900" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                  <select value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))} className="w-full px-5 py-3 rounded-xl bg-white border-2 border-slate-100 font-bold outline-none text-slate-900 appearance-none">
                    {PREDEFINED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Standard Base</label>
                  <div className="flex gap-2">
                    <button onClick={() => setFormData(prev => ({ ...prev, outputUnit: 'kg' }))} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${formData.outputUnit === 'kg' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>KG</button>
                    <button onClick={() => setFormData(prev => ({ ...prev, outputUnit: 'L' }))} className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${formData.outputUnit === 'L' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>LIT</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b-2 border-slate-50 pb-4">
                    <div>
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Raw Material Ratios</h4>
                      <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">BOM for 1.0 {formData.outputUnit?.toUpperCase()} of final dish</p>
                    </div>
                    <button onClick={addIngredient} className="text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl hover:bg-slate-900 hover:text-white transition-all flex items-center gap-2 shadow-lg"><Plus size={14} /> Add Material</button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.ingredients?.map((ing, idx) => (
                      <div key={idx} className="relative group/ing">
                        <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-4 ${ing.inventoryItemId ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-50 bg-white'}`}>
                          <div className="flex items-center gap-4">
                            <div className="shrink-0">
                              {ing.inventoryItemId ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-amber-400" />}
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <input type="text" placeholder="Ingredient Name" value={ing.name} onChange={(e) => updateIngredient(idx, 'name', e.target.value)} className="w-full bg-transparent border-none font-bold text-slate-900 placeholder:text-slate-300 focus:ring-0 p-0 text-sm" readOnly={!!ing.inventoryItemId} />
                              <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs">
                                <Tag size={12} />
                                <input type="text" placeholder="Brand Preference" value={ing.brand} onChange={(e) => updateIngredient(idx, 'brand', e.target.value)} className="w-full bg-transparent border-none font-bold text-slate-700 placeholder:text-slate-200 focus:ring-0 p-0 text-xs" readOnly={!!ing.inventoryItemId} />
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover/ing:opacity-100 transition-all">
                               {ing.inventoryItemId ? (
                                 <button onClick={() => unlinkInventoryItem(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Link2Off size={14} /></button>
                               ) : (
                                 <button onClick={() => setLinkingIdx(idx)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg"><Link size={14} /></button>
                               )}
                               <button onClick={() => removeIngredient(idx)} className="p-2 text-slate-300 hover:text-rose-500 rounded-lg"><Trash2 size={14} /></button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100/50">
                             <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Base Weight/Qty</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" step="0.001" value={ing.amount} onChange={(e) => updateIngredient(idx, 'amount', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg bg-slate-100 border-none font-bold text-xs text-slate-900 outline-none" />
                                  <span className="text-[10px] font-black text-slate-400 uppercase">{ing.unit}</span>
                                </div>
                             </div>
                             <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><Calculator size={10} /> Conversion Factor</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" step="0.01" value={ing.conversionFactor || 1.0} onChange={(e) => updateIngredient(idx, 'conversionFactor', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg bg-slate-900 text-emerald-400 font-black text-xs outline-none" />
                                  <div className="group relative">
                                     <Info size={12} className="text-slate-300" />
                                     <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-slate-900 text-white text-[9px] font-bold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50">
                                       Multiplier for shrinkage/waste. <br/> Net Weight × Factor = Stock Deduction.
                                     </div>
                                  </div>
                                </div>
                             </div>
                          </div>
                        </div>

                        {linkingIdx === idx && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-slate-900 p-5 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-4">
                              <h5 className="font-black text-slate-900 uppercase text-[9px] tracking-widest">Link Stock Item</h5>
                              <button onClick={() => { setLinkingIdx(null); setInvSearch(''); }} className="p-1 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                            </div>
                            <div className="relative mb-4">
                              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                              <input autoFocus type="text" placeholder="Search pantry..." value={invSearch} onChange={(e) => setInvSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border-none font-bold text-sm text-slate-900" />
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                               {filteredInventory.map(item => (
                                 <button key={item.id} onClick={() => linkInventoryItem(idx, item)} className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-between group/invitem">
                                   <div className="flex flex-col">
                                      <span className="font-bold text-xs">{item.name}</span>
                                      {item.brand && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.brand}</span>}
                                   </div>
                                   <ChevronRight size={12} className="opacity-0 group-hover/invitem:opacity-100" />
                                 </button>
                               ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b-2 border-slate-50 pb-4">
                    <div>
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Technical Method</h4>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">SOP Steps</p>
                    </div>
                    <button onClick={addInstruction} className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-900 px-5 py-2.5 rounded-xl hover:bg-slate-900 hover:text-white transition-all flex items-center gap-2"><Plus size={14} /> Add Step</button>
                  </div>
                  <div className="space-y-4">
                    {formData.instructions?.map((inst, idx) => (
                      <div key={idx} className="flex gap-4 group/inst bg-slate-50/50 p-5 rounded-[1.5rem] border border-slate-100 hover:border-slate-200 transition-all">
                         <div className="shrink-0 flex flex-col items-center">
                            <span className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xs">{idx + 1}</span>
                         </div>
                         <textarea value={inst} onChange={(e) => updateInstruction(idx, e.target.value)} placeholder="Provide specific cooking instructions..." className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 font-semibold text-sm leading-relaxed resize-none h-20 p-0 placeholder:text-slate-200" />
                         <button onClick={() => removeInstruction(idx)} className="self-start p-2 text-slate-200 hover:text-rose-500 opacity-100 lg:opacity-0 group-hover/inst:opacity-100 transition-all"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t-2 border-slate-100 flex flex-col sm:flex-row justify-end gap-4 shrink-0">
               <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 hover:text-rose-500 font-black uppercase tracking-widest text-[10px] transition-all">Discard Changes</button>
               <button onClick={handleSave} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 active:scale-95">
                  <Save size={16} /> Archive Specification
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
