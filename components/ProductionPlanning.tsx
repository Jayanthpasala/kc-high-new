
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
import { collection, onSnapshot, getDocs, writeBatch, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';

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
    // Corrected Listener: Only fetch approved plans for the calendar display
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
        dishDetails: m.dishDetails && m.dishDetails.length > 0 
          ? m.dishDetails 
          : m.dishes.map(d => ({ name: d, amountCooked: 0 }))
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

  const handleSaveEdit = async () => {
    if (!selectedDate) return;
    setIsProcessing(true);
    const planId = dayPlan?.id || generateId();
    const dateStr = getLocalDateString(selectedDate);
    const mealsWithDishes = editMeals.map(m => ({ ...m, dishes: m.dishDetails?.map(d => d.name) || [] }));

    const newPlan: ProductionPlan = {
      id: planId,
      date: dateStr,
      type: 'production',
      meals: mealsWithDishes.filter(m => (m.dishes.length > 0) || (m.dishDetails && m.dishDetails.length > 0)),
      headcounts: editHeadcounts,
      isApproved: true,
      createdAt: dayPlan?.createdAt || Date.now()
    };

    try {
      await setDoc(doc(db, "productionPlans", planId), newPlan);
      setIsDayModalOpen(false);
    } catch (e) {
      alert("Cloud Sync Failure.");
    } finally { setIsProcessing(false); }
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
      const extracted = JSON.parse(response.text || "[]");
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
    } catch (err: any) { alert("AI Extraction Failed."); } finally { setIsProcessing(false); }
  };

  const handleApproveAll = async () => {
    if (missingRecipesCount > 0) {
      alert("Safety Lock: All dishes must have a master recipe before approval.");
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
    } catch (e) { alert("Sync Error."); } finally { setIsProcessing(false); }
  };

  const toggleConsumption = async (plan: ProductionPlan) => {
    if (plan.isConsumed) return;
    setIsProcessing(true);
    try {
      const invSnapshot = await getDocs(collection(db, "inventory"));
      const inventory = invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      const batch = writeBatch(db);
      let itemsToDeduct: Record<string, number> = {};
      plan.meals.forEach((meal, mi) => {
        const details = editMeals[mi].dishDetails || [];
        details.forEach((dish) => {
          const recipe = recipes.find(r => r.name.toLowerCase() === dish.name.toLowerCase());
          if (recipe && dish.amountCooked) {
            recipe.ingredients.forEach(ing => {
              const invItem = inventory.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
              if (invItem) {
                const scaled = ing.amount * (dish.amountCooked || 0) * (ing.conversionFactor || 1.0);
                itemsToDeduct[invItem.id] = (itemsToDeduct[invItem.id] || 0) + scaled;
              }
            });
          }
        });
      });
      Object.entries(itemsToDeduct).forEach(([id, amt]) => {
        const invItem = inventory.find(i => i.id === id);
        if (invItem) {
          const newQty = Math.max(0, (invItem.quantity || 0) - amt);
          batch.update(doc(db, "inventory", id), { quantity: newQty });
        }
      });
      batch.update(doc(db, "productionPlans", plan.id), { isConsumed: true, headcounts: editHeadcounts, meals: editMeals });
      await batch.commit();
      setIsDayModalOpen(false);
      alert("Inventory Scales Adjusted.");
    } catch (err) { alert("Stock Sync Failed."); } finally { setIsProcessing(false); }
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
                   <span className="text-[9px] font-black text-slate-700 truncate">{m.dishDetails && m.dishDetails[0] ? m.dishDetails[0].name : (m.dishes[0] || 'Unlabeled')}</span>
                 </div>
               ))}
               {plan.isConsumed && <div className="text-[7px] font-black text-emerald-600 uppercase mt-1">✓ Logged</div>}
             </div>
           )}
        </div>
      );
    }
    return grid;
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><CalendarCheck className="text-emerald-500" size={32} /> Production Hub</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Cloud Unified Operational Schedule</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setView('UPLOAD')} className={`bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-900/10 transition-all ${view === 'UPLOAD' ? 'bg-emerald-600 ring-4' : ''}`}><Upload size={18} /> Import Schedule</button>
          {view !== 'CALENDAR' && <button onClick={() => setView('CALENDAR')} className="bg-white border-2 border-slate-200 text-slate-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2"><CalendarIcon size={18} /> View Calendar</button>}
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-6 text-center">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl">
            <Loader2 className="animate-spin mx-auto text-emerald-500 mb-6" size={64} />
            <h3 className="text-2xl font-black">Syncing Operations...</h3>
          </div>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="max-w-4xl mx-auto space-y-12 py-10">
           <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto"><FileUp size={48} /></div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Menu Manifest Import</h3>
           </div>
           <div className="relative">
              <input type="file" id="schedule-upload" className="hidden" accept=".csv,application/pdf,image/*" onChange={handleFileUpload} />
              <label htmlFor="schedule-upload" className="flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[4rem] p-20 bg-white hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer">
                <Plus size={40} className="text-slate-400 mb-6" />
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Select Menu File</p>
              </label>
           </div>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-10 animate-in fade-in">
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {pendingPlans.map((plan, pi) => (
                <div key={pi} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100">
                   <h4 className="font-black text-xl mb-6">{new Date(plan.date).toLocaleDateString()}</h4>
                   {plan.meals.map((m, mi) => (
                     <div key={mi} className="bg-slate-50 p-6 rounded-3xl mb-4">
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-4">{m.mealType}</p>
                        {m.dishDetails?.map((dish, di) => (
                           <div key={di} className="p-4 rounded-xl bg-white border mb-2 font-bold text-sm">{dish.name}</div>
                        ))}
                     </div>
                   ))}
                </div>
              ))}
           </div>
           <div className="fixed bottom-10 right-10 flex gap-4 no-print">
              <button onClick={() => setView('CALENDAR')} className="px-10 py-5 bg-white border text-slate-500 rounded-3xl font-black text-xs uppercase">Discard</button>
              <button onClick={handleApproveAll} className="px-10 py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase hover:bg-emerald-600">Approve & Push to Calendar</button>
           </div>
        </div>
      )}

      {view === 'CALENDAR' && (
        <div className="bg-white rounded-[3.5rem] shadow-xl border-2 border-slate-100 overflow-hidden">
           <div className="p-10 border-b flex justify-between items-center bg-slate-50/20">
              <h3 className="text-4xl font-black tracking-tighter">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <div className="flex items-center bg-white p-2 rounded-2xl border">
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-4"><ChevronLeft size={24} /></button>
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-4"><ChevronRight size={24} /></button>
              </div>
           </div>
           <div className="grid grid-cols-7 border-b bg-white text-center py-6 text-[10px] font-black text-slate-400 uppercase">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
           </div>
           <div className="grid grid-cols-7 bg-slate-50/30">{renderCalendarGrid()}</div>
        </div>
      )}

      {isDayModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
           <div className="bg-white rounded-[4rem] w-full max-w-3xl overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                 <h3 className="text-2xl font-black">{selectedDate.toLocaleDateString()}</h3>
                 <button onClick={() => setIsDayModalOpen(false)} className="p-4 bg-white/10 rounded-2xl"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-8">
                 {dayPlan ? (
                    <>
                       {editMeals.map((m, mi) => (
                          <div key={mi} className="space-y-4">
                             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.mealType}</h5>
                             {m.dishDetails?.map((dish, di) => (
                                <div key={di} className="bg-slate-50 p-6 rounded-[2.5rem] border flex items-center justify-between">
                                   <span className="font-black text-slate-900 text-lg">{dish.name}</span>
                                   {!dayPlan.isConsumed && (
                                      <input 
                                        type="number" 
                                        placeholder="Produced Qty" 
                                        value={dish.amountCooked || ''}
                                        onChange={(e) => {
                                           const up = [...editMeals];
                                           up[mi].dishDetails![di].amountCooked = parseFloat(e.target.value) || 0;
                                           setEditMeals(up);
                                        }}
                                        className="w-24 px-4 py-2 rounded-xl border-2 font-black"
                                      />
                                   )}
                                </div>
                             ))}
                          </div>
                       ))}
                       {!dayPlan.isConsumed && (
                          <button onClick={() => toggleConsumption(dayPlan)} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600">Commit Production Records</button>
                       )}
                       <button onClick={async () => { if(confirm("Delete cloud record?")) { await deleteDoc(doc(db, "productionPlans", dayPlan.id)); setIsDayModalOpen(false); }}} className="w-full py-4 text-rose-500 font-black text-[10px] uppercase">Delete Entry</button>
                    </>
                 ) : (
                    <button onClick={handleSaveEdit} className="w-full bg-slate-900 text-white py-8 rounded-[3rem] font-black uppercase text-xs">Initialize Day Entry</button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
