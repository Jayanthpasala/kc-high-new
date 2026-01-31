
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
  Save,
  AlertTriangle,
  UserCheck,
  Edit,
  FileUp,
  History
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, Meal, ConsumptionRecord } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, writeBatch, doc, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';

const generateId = () => Math.random().toString(36).substring(2, 11);

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

  const [editMeals, setEditMeals] = useState<Meal[]>([]);
  const [editHeadcounts, setEditHeadcounts] = useState<ConsumptionRecord>({
    teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0
  });

  useEffect(() => {
    // Listen to all approved plans for the calendar
    const q = query(collection(db, "productionPlans"), where("isApproved", "==", true));
    const unsubPlans = onSnapshot(q, (snap) => {
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionPlan));
      setApprovedPlans(all);
    });

    const unsubRecipes = onSnapshot(collection(db, "recipes"), (snap) => {
      setRecipes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe)));
    });

    return () => { unsubPlans(); unsubRecipes(); };
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
          if (!recipes.some(r => r.name.toLowerCase() === dish.trim().toLowerCase())) {
            missing.add(dish.trim().toLowerCase());
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
        dishDetails: m.dishDetails && m.dishDetails.length > 0 
          ? m.dishDetails 
          : (m.dishes || []).map(d => ({ name: d, amountCooked: 0 }))
      })));
      setEditHeadcounts(plan.headcounts || { teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0 });
    } else {
      setEditMeals([
        { mealType: 'Breakfast', dishes: [], dishDetails: [] },
        { mealType: 'Lunch', dishes: [], dishDetails: [] },
        { mealType: 'Snacks', dishes: [], dishDetails: [] }
      ]);
      setEditHeadcounts({ teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0 });
    }
    setIsDayModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDate) return;
    setIsProcessing(true);
    const planId = dayPlan?.id || generateId();
    const dateStr = getLocalDateString(selectedDate);
    
    const mealsWithDishes = editMeals.map(m => ({
      ...m,
      dishes: m.dishDetails?.map(d => d.name) || m.dishes || []
    }));

    const newPlan: ProductionPlan = {
      id: planId,
      date: dateStr,
      type: 'production',
      meals: mealsWithDishes.filter(m => (m.dishes.length > 0) || (m.dishDetails && m.dishDetails.length > 0)),
      headcounts: editHeadcounts,
      isApproved: true,
      createdAt: dayPlan?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    try {
      await setDoc(doc(db, "productionPlans", planId), newPlan);
      setIsDayModalOpen(false);
    } catch (e) {
      alert("Failed to sync plan to cloud. Please check connection.");
    } finally { setIsProcessing(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      // Create AI instance for menu extraction
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });

      // Use gemini-3-pro-preview for complex reasoning tasks like menu extraction
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: file.type } },
            { text: "Extract the meal schedule from this document. Return a JSON array of daily plans. Each day must have a 'date' (YYYY-MM-DD) and a 'meals' array. Each meal must have 'mealType' (e.g., Breakfast, Lunch, Dinner) and 'dishes' (array of strings). Do not include any text outside the JSON block." }
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

      // Directly access .text property as per guidelines
      const rawText = response.text || "[]";
      const cleanedJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const extracted = JSON.parse(cleanedJson);

      const plans: ProductionPlan[] = extracted.map((d: any) => ({
        id: generateId(),
        date: d.date,
        type: 'production',
        meals: d.meals.map((m: any) => ({
          ...m,
          dishDetails: m.dishes.map((dn: string) => ({ name: dn.trim(), amountCooked: 0 }))
        })),
        isApproved: false,
        createdAt: Date.now()
      }));

      setPendingPlans(plans);
      setView('REVIEW');
    } catch (err: any) {
      console.error("AI Error:", err);
      alert("AI Extraction Failed: The document structure was unclear or formatting was unsupported. Try a clearer image or CSV.");
    } finally { setIsProcessing(false); }
  };

  const handleApproveAll = async () => {
    if (missingRecipesCount > 0) {
      alert("Safety Lock: All dishes must have a master recipe before approval to ensure BOM calculation.");
      return;
    }
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      pendingPlans.forEach(p => {
        const ref = doc(db, "productionPlans", p.id);
        batch.set(ref, { ...p, isApproved: true });
      });
      await batch.commit();
      setPendingPlans([]);
      setView('CALENDAR');
    } catch (e) {
      alert("Sync Error: Failed to push approved plans to Cloud.");
    } finally { setIsProcessing(false); }
  };

  const toggleConsumption = async (plan: ProductionPlan) => {
    if (plan.isConsumed) return;
    setIsProcessing(true);
    try {
      const invSnapshot = await getDocs(collection(db, "inventory"));
      const inventory = invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      const batch = writeBatch(db);
      
      let itemsToDeduct: Record<string, number> = {};

      // Calculate deductions based on Recipe BOM
      plan.meals.forEach((meal) => {
        (meal.dishDetails || []).forEach((dish) => {
          const recipe = recipes.find(r => r.name.toLowerCase() === dish.name.toLowerCase());
          if (recipe && dish.amountCooked && dish.amountCooked > 0) {
            recipe.ingredients.forEach(ing => {
              // Priority 1: Match by direct Inventory ID if available in recipe
              // Priority 2: Fallback to name/brand match
              const invItem = inventory.find(i => 
                (ing.inventoryItemId && i.id === ing.inventoryItemId) || 
                (i.name.toLowerCase() === ing.name.toLowerCase() && (!ing.brand || i.brand === ing.brand))
              );

              if (invItem) {
                const scaledDeduction = ing.amount * (dish.amountCooked || 0) * (ing.conversionFactor || 1.0);
                itemsToDeduct[invItem.id] = (itemsToDeduct[invItem.id] || 0) + scaledDeduction;
              }
            });
          }
        });
      });

      // Commit inventory changes
      Object.entries(itemsToDeduct).forEach(([id, amt]) => {
        const invItem = inventory.find(i => i.id === id);
        if (invItem) {
          const currentQty = invItem.quantity || 0;
          const newQty = Math.max(0, currentQty - amt);
          const reorder = invItem.reorderLevel || 0;
          const status = newQty <= 0 ? 'out' : (newQty <= reorder ? 'low' : 'healthy');
          
          batch.update(doc(db, "inventory", id), { 
            quantity: newQty,
            status: status
          });
        }
      });

      // Mark plan as consumed
      batch.update(doc(db, "productionPlans", plan.id), { 
        isConsumed: true, 
        headcounts: editHeadcounts, 
        meals: editMeals 
      });

      await batch.commit();
      setIsDayModalOpen(false);
      alert("Production Log Finalized: Inventory stocks updated in real-time.");
    } catch (err) {
      console.error(err);
      alert("Critical Sync Error: Failed to deduct stock levels. Check database logs.");
    } finally { setIsProcessing(false); }
  };

  const renderCalendarGrid = () => {
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const grid = [];
    
    // Fill empty cells
    for (let i = 0; i < firstDayOfMonth; i++) {
      grid.push(<div key={`e-${i}`} className="bg-slate-50/20 border-r border-b border-slate-100 h-32 md:h-40"></div>);
    }
    
    // Fill days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      const dateStr = getLocalDateString(date);
      const plan = approvedPlans.find(p => p.date === dateStr);
      const isToday = new Date().toDateString() === date.toDateString();
      
      grid.push(
        <div key={d} onClick={() => handleDayClick(date, plan || null)} className={`border-r border-b border-slate-100 h-32 md:h-40 p-3 hover:bg-slate-50 cursor-pointer transition-all ${isToday ? 'bg-emerald-50/30' : 'bg-white'}`}>
           <span className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>{d}</span>
           {plan && (
             <div className="space-y-1">
               {plan.meals.slice(0, 3).map((m, mi) => (
                 <div key={mi} className="bg-white border border-slate-200 rounded-lg p-1.5 flex items-center gap-1.5 overflow-hidden shadow-sm">
                   <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${plan.isConsumed ? 'bg-slate-300' : 'bg-emerald-500'}`}></div>
                   <span className="text-[9px] font-black text-slate-700 truncate">{m.mealType}: {m.dishes[0] || 'Menu'}</span>
                 </div>
               ))}
               {plan.isConsumed && <div className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mt-1 text-center">✓ Consumed</div>}
             </div>
           )}
        </div>
      );
    }
    return grid;
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-200 pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <CalendarCheck className="text-emerald-500" size={32} /> Production Hub
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Cloud Synchronization Protocol Active</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setView('UPLOAD')} 
            className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl ${view === 'UPLOAD' ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            <Upload size={18} /> Import Schedule
          </button>
          {view !== 'CALENDAR' && (
            <button onClick={() => setView('CALENDAR')} className="bg-white border-2 border-slate-200 text-slate-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:border-slate-400 transition-all">
              <CalendarIcon size={18} /> Live Calendar
            </button>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-sm w-full">
            <Loader2 className="animate-spin mx-auto text-emerald-500 mb-6" size={64} />
            <h3 className="text-2xl font-black text-slate-900">Syncing Cloud...</h3>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4 leading-relaxed">Adjusting material levels across the global kitchen network.</p>
          </div>
        </div>
      )}

      {/* Upload Interface */}
      {view === 'UPLOAD' && (
        <div className="max-w-4xl mx-auto space-y-12 py-10 animate-in slide-in-from-bottom-10 duration-500">
           <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-sm">
                <FileUp size={48} />
              </div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">AI Menu Extraction</h3>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest max-w-sm mx-auto leading-relaxed">Upload your weekly menu (PDF/Image) for automated date-dish mapping.</p>
           </div>
           <div className="relative group">
              <input type="file" id="schedule-upload" className="hidden" accept=".csv,application/pdf,image/*" onChange={handleFileUpload} />
              <label htmlFor="schedule-upload" className="flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[4rem] p-24 bg-white hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer group">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Plus size={32} className="text-slate-300 group-hover:text-emerald-500" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 group-hover:text-emerald-600">Click to Select Document</p>
              </label>
           </div>
        </div>
      )}

      {/* Review Extracted Data */}
      {view === 'REVIEW' && (
        <div className="space-y-10 animate-in fade-in duration-500">
           <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase">Review Extracted Drafts</h3>
              <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${missingRecipesCount > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                 {missingRecipesCount > 0 ? `${missingRecipesCount} Unmapped Recipes` : 'System Fully Synced'}
              </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {pendingPlans.map((plan, pi) => (
                <div key={pi} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
                   <div className="flex justify-between items-start mb-6">
                      <h4 className="font-black text-xl text-slate-900">{new Date(plan.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h4>
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300"><History size={18} /></div>
                   </div>
                   <div className="space-y-4">
                     {plan.meals.map((m, mi) => (
                       <div key={mi} className="bg-slate-50 p-5 rounded-3xl">
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-3">{m.mealType}</p>
                          <div className="space-y-2">
                             {(m.dishDetails || []).map((dish, di) => {
                               const recipe = recipes.find(r => r.name.toLowerCase() === dish.name.toLowerCase());
                               return (
                                 <div key={di} className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${recipe ? 'bg-white border-slate-100 text-slate-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                                    {dish.name}
                                    {!recipe && <AlertTriangle size={14} className="text-rose-500" />}
                                 </div>
                               );
                             })}
                          </div>
                       </div>
                     ))}
                   </div>
                   <button onClick={() => setPendingPlans(pendingPlans.filter((_, i) => i !== pi))} className="absolute top-6 right-6 p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><X size={16} /></button>
                </div>
              ))}
           </div>
           <div className="fixed bottom-10 right-10 flex gap-4 no-print z-50">
              <button onClick={() => { setPendingPlans([]); setView('CALENDAR'); }} className="px-10 py-5 bg-white border-2 border-slate-200 text-slate-400 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-50">Discard Imports</button>
              <button 
                onClick={handleApproveAll} 
                disabled={missingRecipesCount > 0}
                className={`px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center gap-3 transition-all ${missingRecipesCount > 0 ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-emerald-600'}`}
              >
                <CheckCircle2 size={20} /> Approve & Sync to Calendar
              </button>
           </div>
        </div>
      )}

      {/* Main Calendar Interface */}
      {view === 'CALENDAR' && (
        <div className="bg-white rounded-[4rem] shadow-xl border-2 border-slate-100 overflow-hidden animate-in fade-in duration-700">
           <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <div className="flex items-center bg-white p-2 rounded-[2rem] border-2 border-slate-100 shadow-sm">
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-4 text-slate-400 hover:text-slate-900 transition-colors"><ChevronLeft size={24} /></button>
                 <button onClick={() => setCurrentMonth(new Date())} className="px-8 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-emerald-500 tracking-widest transition-colors">Current</button>
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-4 text-slate-400 hover:text-slate-900 transition-colors"><ChevronRight size={24} /></button>
              </div>
           </div>
           <div className="grid grid-cols-7 border-b bg-white text-center py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
           </div>
           <div className="grid grid-cols-7 bg-slate-50/30">{renderCalendarGrid()}</div>
        </div>
      )}

      {/* Detail Modal */}
      {isDayModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white rounded-[4rem] w-full max-w-3xl overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                 <div>
                    <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mb-1">Kitchen Operational Registry</p>
                    <h3 className="text-3xl font-black">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                 </div>
                 <button onClick={() => setIsDayModalOpen(false)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                 {entryMode === 'VIEW' ? (
                    <>
                       {dayPlan ? (
                          <div className="space-y-8">
                             <div className="flex justify-between items-center">
                                <div className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase border-2 ${dayPlan.isConsumed ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                   {dayPlan.isConsumed ? 'Cloud Sync: Deducted' : 'Operational Status: Active'}
                                </div>
                                {!dayPlan.isConsumed && (
                                   <button onClick={() => setEntryMode('EDIT_EXISTING')} className="text-[10px] font-black uppercase text-slate-900 hover:text-emerald-500 transition-all flex items-center gap-2">
                                      <Edit size={16} /> Update Plan
                                   </button>
                                )}
                             </div>

                             <div className="space-y-8">
                                {editMeals.map((m, mi) => (
                                   <div key={mi} className="space-y-4">
                                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-4">
                                         <div className="w-8 h-px bg-slate-200"></div> {m.mealType}
                                      </h5>
                                      <div className="space-y-3">
                                         {(m.dishDetails || []).map((dish, di) => {
                                            const recipe = recipes.find(r => r.name.toLowerCase() === dish.name.toLowerCase());
                                            return (
                                               <div key={di} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
                                                  <div className="flex flex-col">
                                                     <span className="font-black text-slate-900 text-lg">{dish.name}</span>
                                                     {recipe ? (
                                                       <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 mt-1"><CheckCircle2 size={10} /> BOM Linked</span>
                                                     ) : (
                                                       <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1 mt-1"><AlertTriangle size={10} /> No BOM Linkage</span>
                                                     )}
                                                  </div>
                                                  {!dayPlan.isConsumed ? (
                                                     <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border-2 border-slate-200">
                                                        <input 
                                                          type="number" 
                                                          placeholder="0.0" 
                                                          value={dish.amountCooked || ''}
                                                          onChange={(e) => {
                                                             const up = [...editMeals];
                                                             up[mi].dishDetails![di].amountCooked = parseFloat(e.target.value) || 0;
                                                             setEditMeals(up);
                                                          }}
                                                          className="w-20 bg-transparent border-none font-black text-slate-900 text-center p-0 outline-none" 
                                                        />
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Cooked {recipe?.outputUnit || 'Unit'}</span>
                                                     </div>
                                                  ) : (
                                                     <div className="bg-slate-900 text-white px-5 py-2 rounded-2xl text-sm font-black shadow-lg">
                                                        {dish.amountCooked} {recipe?.outputUnit || 'KG'}
                                                     </div>
                                                  )}
                                               </div>
                                            );
                                         })}
                                      </div>
                                   </div>
                                ))}
                             </div>

                             <div className="space-y-6 pt-6 border-t border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance Registry</h5>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                   {[
                                     { label: 'Staff', key: 'teachers' as const },
                                     { label: 'Prim.', key: 'primary' as const },
                                     { label: 'Pre-P.', key: 'prePrimary' as const },
                                     { label: 'Addl.', key: 'additional' as const },
                                     { label: 'Misc', key: 'others' as const }
                                   ].map(cat => (
                                      <div key={cat.key} className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                                         <p className="text-[8px] font-black text-slate-400 uppercase mb-2">{cat.label}</p>
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
                                <button onClick={() => toggleConsumption(dayPlan)} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-2xl flex items-center justify-center gap-3">
                                   <UserCheck size={20} /> Finalize Production & Deduct Stock
                                </button>
                             )}
                             <button onClick={async () => { if(confirm("Permanently wipe this cloud record?")) { await deleteDoc(doc(db, "productionPlans", dayPlan.id)); setIsDayModalOpen(false); }}} className="w-full py-4 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 rounded-2xl transition-colors">
                                <Trash2 size={16} className="inline mr-2" /> Delete Entries
                             </button>
                          </div>
                       ) : (
                          <div className="py-20 text-center space-y-10">
                             <div className="w-40 h-40 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200 flex items-center justify-center mx-auto text-slate-200"><CalendarCheck size={80} /></div>
                             <button onClick={() => setEntryMode('CREATE_MEAL')} className="bg-slate-900 text-white px-12 py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-emerald-600 transition-all">Initialize Operational Batch</button>
                          </div>
                       )}
                    </>
                 ) : (
                    <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                       <div className="space-y-6">
                          {editMeals.map((m, mi) => (
                             <div key={mi} className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100">
                                <div className="flex justify-between items-center mb-6">
                                   <h5 className="font-black text-[10px] uppercase tracking-widest text-emerald-500">{m.mealType}</h5>
                                   <button onClick={() => {
                                     const up = [...editMeals];
                                     if (!up[mi].dishDetails) up[mi].dishDetails = [];
                                     up[mi].dishDetails!.push({ name: "", amountCooked: 0 });
                                     setEditMeals(up);
                                   }} className="p-2 bg-white text-slate-400 hover:text-emerald-500 rounded-xl shadow-sm border border-slate-200"><Plus size={16} /></button>
                                </div>
                                <div className="space-y-4">
                                   {m.dishDetails?.map((dish, di) => (
                                      <div key={di} className="flex gap-4">
                                        <input 
                                          type="text" 
                                          placeholder="Dish Spec (e.g. Masoor Dal)" 
                                          value={dish.name} 
                                          onChange={e => {
                                            const up = [...editMeals];
                                            up[mi].dishDetails![di].name = e.target.value;
                                            setEditMeals(up);
                                          }}
                                          className="flex-1 px-6 py-4 rounded-2xl bg-white border-2 border-slate-100 font-black text-slate-900 shadow-sm outline-none focus:border-emerald-500" 
                                        />
                                        <button onClick={() => {
                                          const up = [...editMeals];
                                          up[mi].dishDetails!.splice(di, 1);
                                          setEditMeals(up);
                                        }} className="p-4 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={20} /></button>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          ))}
                       </div>
                       <div className="flex gap-4 sticky bottom-0 bg-white pt-6 pb-2">
                          <button onClick={() => setEntryMode('VIEW')} className="flex-1 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Cancel Draft</button>
                          <button onClick={handleSaveEdit} className="flex-1 bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-emerald-600 transition-all">Sync to Cloud</button>
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
