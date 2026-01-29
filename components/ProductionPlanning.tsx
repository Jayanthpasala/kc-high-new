
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Upload, 
  CheckCircle2, 
  Calendar as CalendarIcon, 
  Loader2, 
  Plus, 
  X,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  CalendarCheck,
  CheckCircle,
  Trash2,
  PartyPopper,
  Save,
  Link as LinkIcon,
  AlertTriangle,
  UserCheck,
  Edit,
  UserPlus,
  Scale,
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, Meal, ConsumptionRecord, DishDetail } from '../types';
import { RecipeManagement } from './RecipeManagement';
import { db } from '../firebase';
import { collection, onSnapshot, query, getDocs, writeBatch, doc } from 'firebase/firestore';

const generateId = () => Math.random().toString(36).substring(2, 11);
const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();

const mockFirestore = {
  save: (plan: ProductionPlan) => {
    const plans = mockFirestore.getAll();
    const existingIdx = plans.findIndex(p => p.id === plan.id);
    if (existingIdx > -1) {
      plans[existingIdx] = { ...plan, updatedAt: Date.now() };
    } else {
      plans.push({ ...plan });
    }
    localStorage.setItem('productionPlans', JSON.stringify(plans));
  },
  getAll: (): ProductionPlan[] => {
    try {
      const data = localStorage.getItem('productionPlans');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },
  delete: (id: string) => {
    const plans = mockFirestore.getAll().filter(p => p.id !== id);
    localStorage.setItem('productionPlans', JSON.stringify(plans));
  }
};

export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW' | 'DEFINE_RECIPE'>('CALENDAR');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayPlan, setDayPlan] = useState<ProductionPlan | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'VIEW' | 'EDIT_EXISTING' | 'CREATE_MEAL'>('VIEW');
  
  const [dishToDefine, setDishToDefine] = useState<string | null>(null);

  // States for Editing/Creating
  const [editMeals, setEditMeals] = useState<Meal[]>([]);
  const [editHeadcounts, setEditHeadcounts] = useState<ConsumptionRecord>({
    teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0
  });

  const loadData = () => {
    const all = mockFirestore.getAll();
    setApprovedPlans(all.sort((a, b) => a.date.localeCompare(b.date)));
    setRecipes(JSON.parse(localStorage.getItem('recipes') || '[]'));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const missingRecipesCount = useMemo(() => {
    const missing = new Set<string>();
    pendingPlans.forEach(plan => {
      plan.meals.forEach(meal => {
        meal.dishes.forEach(dish => {
          if (!dish.trim()) return;
          if (!recipes.some(r => r.name.toLowerCase() === dish.toLowerCase())) {
            missing.add(dish.toLowerCase());
          }
        });
      });
    });
    return missing.size;
  }, [pendingPlans, recipes]);

  const handleDayClick = (date: Date, plan: ProductionPlan | null) => {
    setSelectedDate(date);
    setDayPlan(plan);
    setEntryMode('VIEW');
    if (plan) {
      setEditMeals(plan.meals.map(m => ({
        ...m,
        dishDetails: m.dishDetails || m.dishes.map(d => ({ name: d, amountCooked: 0 }))
      })));
      setEditHeadcounts(plan.headcounts || { teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0 });
    } else {
      setEditMeals([
        { mealType: 'Breakfast', dishes: [], dishDetails: [] },
        { mealType: 'Lunch', dishes: [], dishDetails: [] },
        { mealType: 'Dinner', dishes: [], dishDetails: [] }
      ]);
      setEditHeadcounts({ teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0 });
    }
    setIsDayModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedDate) return;
    const planId = dayPlan?.id || generateId();
    const dateStr = getLocalDateString(selectedDate);

    const newPlan: ProductionPlan = {
      id: planId,
      date: dateStr,
      type: 'production',
      meals: editMeals.filter(m => m.dishes.length > 0 || (m.dishDetails && m.dishDetails.length > 0)),
      headcounts: editHeadcounts,
      isApproved: true,
      createdAt: dayPlan?.createdAt || Date.now()
    };

    mockFirestore.save(newPlan);
    loadData();
    setDayPlan(newPlan);
    setEntryMode('VIEW');
    window.dispatchEvent(new Event('storage'));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: file.type } },
            { text: `Extract meal schedule. Return JSON array with date (YYYY-MM-DD) and meals (mealType and dishes list).` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                meals: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      mealType: { type: Type.STRING },
                      dishes: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["mealType", "dishes"]
                  }
                }
              },
              required: ["date", "meals"]
            }
          }
        }
      });

      const extracted = JSON.parse(cleanJson(response.text || "[]"));
      const plans: ProductionPlan[] = extracted.map((d: any) => ({
        id: generateId(),
        date: d.date,
        type: 'production',
        meals: d.meals.map((m: any) => ({
          ...m,
          dishDetails: m.dishes.map((dn: string) => ({ name: dn, amountCooked: 0 }))
        })),
        isApproved: false,
        createdAt: Date.now()
      }));

      setPendingPlans(plans);
      setView('REVIEW');
    } catch (err: any) {
      alert("AI Processing Failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAll = () => {
    if (missingRecipesCount > 0) {
      alert("Safety Lock: All dishes must have a master recipe before approval.");
      return;
    }
    const batch = pendingPlans.map(p => ({ ...p, isApproved: true }));
    batch.forEach(p => mockFirestore.save(p));
    setPendingPlans([]);
    setView('CALENDAR');
    loadData();
  };

  const toggleConsumption = async (plan: ProductionPlan) => {
    if (plan.isConsumed) return;

    // Check for missing recipes before allowing consumption
    const unmappedDishes = plan.meals.flatMap(m => m.dishes).filter(d => !recipes.some(r => r.name.toLowerCase() === d.toLowerCase()));
    if (unmappedDishes.length > 0) {
      alert(`Safety Lock: Defined recipes are missing for: ${unmappedDishes.join(', ')}. Please map them before deductions.`);
      return;
    }

    setIsProcessing(true);
    try {
      const invSnapshot = await getDocs(collection(db, "inventory"));
      const inventory = invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      const batch = writeBatch(db);
      
      let itemsToDeduct: Record<string, number> = {};

      plan.meals.forEach((meal, mi) => {
        // Use editMeals as it contains the live inputs for amountCooked
        const details = editMeals[mi].dishDetails || [];
        details.forEach((dish) => {
          const recipe = recipes.find(r => r.name.toLowerCase() === dish.name.toLowerCase());
          const totalCookedAmount = dish.amountCooked || 0;
          
          if (recipe && totalCookedAmount > 0) {
            recipe.ingredients.forEach(ing => {
              // Standard logic: recipe is for 1 unit. 
              // totalCookedAmount (e.g. 20kg) x ingredient amount (e.g. 0.1kg chicken) x factor
              const invItem = inventory.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
              if (invItem) {
                const scaledAmount = ing.amount * totalCookedAmount * (ing.conversionFactor || 1.0);
                itemsToDeduct[invItem.id] = (itemsToDeduct[invItem.id] || 0) + scaledAmount;
              }
            });
          }
        });
      });

      // Update Firestore Inventory
      Object.entries(itemsToDeduct).forEach(([id, amt]) => {
        const invItem = inventory.find(i => i.id === id);
        if (invItem) {
          const newQty = Math.max(0, (invItem.quantity || 0) - amt);
          batch.update(doc(db, "inventory", id), {
            quantity: newQty,
            status: newQty <= (invItem.reorderLevel || 0) ? (newQty <= 0 ? 'out' : 'low') : 'healthy'
          });
        }
      });

      await batch.commit();
      
      const updated = { ...plan, isConsumed: true, headcounts: editHeadcounts, meals: editMeals };
      mockFirestore.save(updated);
      loadData();
      setDayPlan(updated);
      window.dispatchEvent(new Event('storage'));
      alert("Inventory successfully updated! Material usage scaled automatically based on production amounts.");
    } catch (err) {
      console.error(err);
      alert("Failure updating stock levels in Cloud Registry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCalendarGrid = () => {
    const days = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const grid = [];
    for (let i = 0; i < start; i++) grid.push(<div key={`e-${i}`} className="bg-slate-50/30 border-r border-b border-slate-100 h-32 md:h-40"></div>);
    for (let d = 1; d <= days; d++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      const dateStr = getLocalDateString(date);
      const plan = approvedPlans.find(p => p.date === dateStr);
      const isToday = new Date().toDateString() === date.toDateString();
      grid.push(
        <div key={d} onClick={() => handleDayClick(date, plan || null)} className={`border-r border-b border-slate-100 h-32 md:h-40 p-3 hover:bg-slate-50 cursor-pointer transition-all ${isToday ? 'bg-emerald-50/30' : 'bg-white'}`}>
           <span className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>{d}</span>
           {plan && (
             <div className="mt-2 space-y-1">
               {plan.meals.slice(0, 2).map((m, mi) => (
                 <div key={mi} className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 flex items-center gap-2 overflow-hidden shadow-sm">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                   <span className="text-[9px] font-black text-slate-700 truncate">{m.dishes[0] || (m.dishDetails && m.dishDetails[0]?.name)}</span>
                 </div>
               ))}
               {plan.isConsumed && <div className="text-[7px] font-black text-emerald-600 uppercase mt-1">✓ Stock Deducted</div>}
             </div>
           )}
        </div>
      );
    }
    return grid;
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <CalendarCheck className="text-emerald-500" size={32} /> Production Hub
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Scale Logic: Amounts defined for 1 Unit scale to Total Produced</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setView('UPLOAD')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-900/10">
            <Upload size={18} /> Import Schedule
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95">
            <Loader2 className="animate-spin mx-auto text-emerald-500 mb-6" size={64} />
            <h3 className="text-2xl font-black text-slate-900">Synchronizing Stock</h3>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">Deducting material volumes based on production scaling...</p>
          </div>
        </div>
      )}

      {/* Review Uploaded Menu */}
      {view === 'REVIEW' && (
        <div className="space-y-10 animate-in fade-in">
           <div className={`p-8 rounded-[2.5rem] flex items-center gap-6 ${missingRecipesCount > 0 ? 'bg-amber-50 border-2 border-amber-200' : 'bg-emerald-50 border-2 border-emerald-200'}`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${missingRecipesCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                 {missingRecipesCount > 0 ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}
              </div>
              <div>
                 <h3 className="text-xl font-black text-slate-900">{missingRecipesCount > 0 ? 'Linkage Required' : 'BOM Fully Synchronized'}</h3>
                 <p className="text-sm font-bold text-slate-500 mt-1">
                   {missingRecipesCount > 0 ? `Detected ${missingRecipesCount} unmapped dishes. Recipes must be defined to scale ingredients.` : 'All extracted dishes match existing master recipes.'}
                 </p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {pendingPlans.map((plan, pi) => (
                <div key={pi} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm">
                   <h4 className="font-black text-xl mb-6 text-slate-900">{new Date(plan.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h4>
                   <div className="space-y-6">
                      {plan.meals.map((m, mi) => (
                        <div key={mi} className="bg-slate-50 p-6 rounded-3xl space-y-4">
                           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{m.mealType}</p>
                           <div className="space-y-2">
                              {m.dishes.map((dish, di) => {
                                const isMapped = recipes.some(r => r.name.toLowerCase() === dish.toLowerCase());
                                return (
                                  <div key={di} className={`p-4 rounded-xl border-2 flex items-center justify-between gap-3 ${isMapped ? 'bg-white border-slate-100' : 'bg-rose-50 border-rose-100'}`}>
                                     <span className="font-bold text-sm text-slate-900">{dish}</span>
                                     {!isMapped ? (
                                       <button onClick={() => { setDishToDefine(dish); setView('DEFINE_RECIPE'); }} className="p-2 bg-rose-500 text-white rounded-lg shadow-lg hover:bg-slate-900 transition-all"><Plus size={14} /></button>
                                     ) : (
                                       <CheckCircle2 size={16} className="text-emerald-500" />
                                     )}
                                  </div>
                                );
                              })}
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>

           <div className="fixed bottom-10 right-10 flex gap-4 no-print">
              <button onClick={() => setView('CALENDAR')} className="px-10 py-5 bg-white border-2 border-slate-100 text-slate-500 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl">Abort</button>
              <button 
                onClick={handleApproveAll} 
                disabled={missingRecipesCount > 0}
                className={`px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center gap-3 transition-all ${missingRecipesCount > 0 ? 'bg-slate-300 text-white cursor-not-allowed opacity-50' : 'bg-slate-900 text-white hover:bg-emerald-600'}`}
              >
                <CheckCircle2 size={20} /> Approve Operations Plan
              </button>
           </div>
        </div>
      )}

      {/* Define Recipe Modal (Pre-filled) */}
      {view === 'DEFINE_RECIPE' && dishToDefine && (
        <div className="animate-in fade-in duration-300">
           <button onClick={() => setView('REVIEW')} className="mb-6 flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest transition-colors"><X size={16} /> Cancel Mapping</button>
           <RecipeManagement initialDishName={dishToDefine} onComplete={() => { setView('REVIEW'); loadData(); }} />
        </div>
      )}

      {/* Main Calendar View */}
      {view === 'CALENDAR' && (
        <div className="bg-white rounded-[3.5rem] shadow-xl border-2 border-slate-100 overflow-hidden animate-in fade-in">
           <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/20">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <div className="flex items-center bg-white p-2 rounded-2xl border-2 border-slate-100 shadow-sm">
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-4 text-slate-400 hover:text-slate-900"><ChevronLeft size={24} /></button>
                 <button onClick={() => setCurrentMonth(new Date())} className="px-8 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-emerald-500 tracking-widest">Today</button>
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-4 text-slate-400 hover:text-slate-900"><ChevronRight size={24} /></button>
              </div>
           </div>
           <div className="grid grid-cols-7 border-b bg-white">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>)}
           </div>
           <div className="grid grid-cols-7 bg-slate-50/30">{renderCalendarGrid()}</div>
        </div>
      )}

      {/* Detailed Day Modal (Scaling Logic Focus) */}
      {isDayModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white rounded-[4rem] w-full max-w-3xl overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[90vh] animate-in zoom-in-95">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                 <div>
                    <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mb-1">Production Registry</p>
                    <h3 className="text-2xl font-black">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                 </div>
                 <button onClick={() => setIsDayModalOpen(false)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                 {entryMode === 'VIEW' ? (
                   <>
                     {dayPlan ? (
                       <div className="space-y-10">
                          {/* Top Actions */}
                          <div className="flex justify-between items-center">
                             <div className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase border-2 ${dayPlan.isConsumed ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {dayPlan.isConsumed ? 'Operational Stock Logged' : 'Current Operations Batch'}
                             </div>
                             {!dayPlan.isConsumed && (
                               <button onClick={() => setEntryMode('EDIT_EXISTING')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-900 hover:text-emerald-500 transition-all">
                                  <Edit size={16} /> Adjust Operational Plan
                               </button>
                             )}
                          </div>

                          <div className="space-y-8">
                             {editMeals.map((meal, mi) => (
                               <div key={mi} className="space-y-4">
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                     <div className="w-8 h-px bg-slate-200"></div> {meal.mealType}
                                  </h5>
                                  <div className="space-y-3">
                                     {(meal.dishDetails || []).map((dish, di) => {
                                       const recipe = recipes.find(r => r.name.toLowerCase() === dish.name.toLowerCase());
                                       const isMapped = !!recipe;
                                       return (
                                         <div key={di} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between group">
                                            <div className="flex flex-col">
                                               <span className="font-black text-slate-900 text-lg">{dish.name}</span>
                                               <div className="flex items-center gap-2 mt-1">
                                                 {isMapped ? (
                                                   <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10} /> Specification Linked</span>
                                                 ) : (
                                                   <button onClick={() => { setDishToDefine(dish.name); setView('DEFINE_RECIPE'); setIsDayModalOpen(false); }} className="text-[8px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1 hover:underline"><AlertTriangle size={10} /> Link Spec Required to Auto-Scale</button>
                                                 )}
                                               </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                               {!dayPlan.isConsumed ? (
                                                 <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border-2 border-slate-200 shadow-inner group-focus-within:border-emerald-500 transition-all">
                                                    <input 
                                                      type="number" 
                                                      placeholder="0.0" 
                                                      value={dish.amountCooked || ''}
                                                      onChange={(e) => {
                                                         const up = [...editMeals];
                                                         up[mi].dishDetails![di].amountCooked = parseFloat(e.target.value) || 0;
                                                         setEditMeals(up);
                                                      }}
                                                      className="w-20 bg-transparent border-none font-black text-slate-900 text-center focus:ring-0 p-0" 
                                                    />
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Total {recipe?.outputUnit || 'Unit'} Produced</span>
                                                 </div>
                                               ) : (
                                                 <div className="bg-emerald-500 text-slate-900 px-4 py-2 rounded-xl text-sm font-black shadow-sm">
                                                    {dish.amountCooked} {recipe?.outputUnit || 'KG'}
                                                 </div>
                                               )}
                                            </div>
                                         </div>
                                       );
                                     })}
                                  </div>
                               </div>
                             ))}
                          </div>

                          <div className="space-y-6">
                             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3"><div className="w-8 h-px bg-slate-200"></div> Operations Headcounts</h5>
                             <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {[
                                  { label: 'Teachers', key: 'teachers' as const },
                                  { label: 'Primary', key: 'primary' as const },
                                  { label: 'Pre-Primary', key: 'prePrimary' as const },
                                  { label: 'Additional', key: 'additional' as const },
                                  { label: 'Others', key: 'others' as const }
                                ].map(cat => (
                                   <div key={cat.key} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center flex flex-col items-center">
                                      <span className="text-[8px] font-black text-slate-400 uppercase mb-2">{cat.label}</span>
                                      {dayPlan.isConsumed ? (
                                        <span className="text-xl font-black text-slate-900">{dayPlan.headcounts?.[cat.key] || 0}</span>
                                      ) : (
                                        <input 
                                          type="number" 
                                          value={editHeadcounts[cat.key]}
                                          onChange={(e) => setEditHeadcounts({...editHeadcounts, [cat.key]: parseInt(e.target.value) || 0})}
                                          className="w-full bg-white border border-slate-200 rounded-xl text-center font-black py-2 text-sm shadow-inner" 
                                        />
                                      )}
                                   </div>
                                ))}
                             </div>
                          </div>

                          {!dayPlan.isConsumed && (
                             <button 
                               onClick={() => toggleConsumption(dayPlan)}
                               className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95"
                             >
                                <UserCheck size={20} /> Initialize Stock Deduction & Scale Logic
                             </button>
                          )}
                          
                          <button onClick={() => { if(confirm("Permanently wipe this production cycle from history?")) { mockFirestore.delete(dayPlan.id); setIsDayModalOpen(false); loadData(); window.dispatchEvent(new Event('storage')); }}} className="w-full py-4 text-rose-500 hover:bg-rose-50 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                             <Trash2 size={16} /> Delete Record
                          </button>
                       </div>
                     ) : (
                       <div className="text-center py-20 space-y-12">
                          <div className="w-40 h-40 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200 flex items-center justify-center mx-auto text-slate-200"><CalendarCheck size={80} /></div>
                          <div className="max-w-xs mx-auto space-y-6">
                             <button onClick={() => setEntryMode('CREATE_MEAL')} className="w-full p-8 rounded-[3rem] bg-white border-4 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-4 group">
                                <ChefHat size={48} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                <span className="font-black text-[11px] uppercase tracking-widest text-slate-900">Initialize Batch Cycle</span>
                             </button>
                          </div>
                       </div>
                     )}
                   </>
                 ) : (
                   <div className="space-y-10 animate-in slide-in-from-right-10 duration-500">
                      <div className="space-y-8">
                         {editMeals.map((m, mi) => (
                            <div key={mi} className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100">
                               <div className="flex justify-between items-center mb-6">
                                  <h5 className="font-black text-[10px] uppercase tracking-widest text-emerald-500">{m.mealType}</h5>
                                  <button onClick={() => {
                                    const up = [...editMeals];
                                    if (!up[mi].dishes) up[mi].dishes = [];
                                    if (!up[mi].dishDetails) up[mi].dishDetails = [];
                                    up[mi].dishes.push("");
                                    up[mi].dishDetails!.push({ name: "", amountCooked: 0 });
                                    setEditMeals(up);
                                  }} className="p-2 bg-white text-slate-400 hover:text-emerald-500 rounded-xl shadow-sm border border-slate-200"><Plus size={16} /></button>
                               </div>
                               <div className="space-y-4">
                                  {m.dishDetails?.map((dish, di) => (
                                     <div key={di} className="flex gap-4">
                                       <div className="flex-1 relative">
                                          <input 
                                            type="text" 
                                            placeholder="Dish Identity (e.g., Dal Tadka)" 
                                            value={dish.name} 
                                            onChange={e => {
                                              const up = [...editMeals];
                                              up[mi].dishDetails![di].name = e.target.value;
                                              // Ensure dishes array stays in sync for basic display
                                              up[mi].dishes = up[mi].dishDetails!.map(d => d.name);
                                              setEditMeals(up);
                                            }}
                                            className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-slate-100 font-black text-slate-900 shadow-sm outline-none focus:border-emerald-500" 
                                          />
                                          {!recipes.some(r => r.name.toLowerCase() === dish.name.toLowerCase()) && dish.name.trim() !== '' && (
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-rose-500 uppercase tracking-widest">Recipe Missing</span>
                                          )}
                                       </div>
                                       <button onClick={() => {
                                         const up = [...editMeals];
                                         up[mi].dishDetails!.splice(di, 1);
                                         up[mi].dishes = up[mi].dishDetails!.map(d => d.name);
                                         setEditMeals(up);
                                       }} className="p-4 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={20} /></button>
                                     </div>
                                  ))}
                               </div>
                            </div>
                         ))}
                      </div>

                      <div className="flex gap-4">
                         <button onClick={() => setEntryMode('VIEW')} className="flex-1 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Discard Adjustments</button>
                         <button onClick={handleSaveEdit} className="flex-1 bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-emerald-600 transition-all active:scale-95">Save Operations Plan</button>
                      </div>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
