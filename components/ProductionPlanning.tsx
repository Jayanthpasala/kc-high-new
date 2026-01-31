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
  History,
  Users,
  Info,
  ExternalLink,
  ClipboardList,
  Search
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, Meal, ConsumptionRecord } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, writeBatch, doc, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';

const generateId = () => Math.random().toString(36).substring(2, 11);

/**
 * Robust JSON parser designed to survive deployment-specific response variations.
 */
const safeParseAIResponse = (text: string | undefined) => {
  if (!text) throw new Error("AI returned empty content.");
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    const startIdx = clean.indexOf('[');
    const endIdx = clean.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1) {
      try {
        return JSON.parse(clean.substring(startIdx, endIdx + 1));
      } catch (e2) {}
    }
    const objStart = clean.indexOf('{');
    const objEnd = clean.lastIndexOf('}');
    if (objStart !== -1 && objEnd !== -1) {
      try {
        return JSON.parse(clean.substring(objStart, objEnd + 1));
      } catch (e3) {}
    }
    throw new Error("Data formatting mismatch. Please ensure the document is clear.");
  }
};

export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW'>('CALENDAR');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
  // Default to present year and month
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayPlan, setDayPlan] = useState<ProductionPlan | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  
  const [editMeals, setEditMeals] = useState<Meal[]>([]);
  const [editHeadcounts, setEditHeadcounts] = useState<ConsumptionRecord>({
    teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0
  });

  useEffect(() => {
    const q = query(collection(db, "productionPlans"), where("isApproved", "==", true));
    const unsubPlans = onSnapshot(q, (snap) => {
      setApprovedPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionPlan)));
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

  const checkHasMissingSpec = (plan: ProductionPlan) => {
    return plan.meals.some(m => 
      m.dishes.some(d => !recipes.some(r => r.name.toLowerCase().trim() === d.toLowerCase().trim()))
    );
  };

  const handleDayClick = (date: Date, plan: ProductionPlan | null) => {
    setSelectedDate(date);
    setDayPlan(plan);
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

  const handleSaveDay = async () => {
    if (!selectedDate) return;
    setIsProcessing(true);
    const planId = dayPlan?.id || generateId();
    const dateStr = getLocalDateString(selectedDate);
    
    // Sync dishDetails back to dishes array
    const processedMeals = editMeals.map(m => ({
      ...m,
      dishes: m.dishDetails?.map(d => d.name) || m.dishes
    })).filter(m => (m.dishes && m.dishes.length > 0) || (m.dishDetails && m.dishDetails.length > 0));

    const newPlan: ProductionPlan = {
      id: planId,
      date: dateStr,
      meals: processedMeals,
      headcounts: editHeadcounts,
      isApproved: true,
      createdAt: dayPlan?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isConsumed: dayPlan?.isConsumed || false
    };

    try {
      await setDoc(doc(db, "productionPlans", planId), newPlan);
      setIsDayModalOpen(false);
    } catch (e) {
      console.error("Cloud Sync Error", e);
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
            { 
              text: `Analyze this menu and population document. Extract date, meal types, dishes and headcount numbers. Return as valid JSON array.` 
            }
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
                    }
                  }
                },
                headcounts: {
                  type: Type.OBJECT,
                  properties: {
                    teachers: { type: Type.NUMBER },
                    primary: { type: Type.NUMBER },
                    prePrimary: { type: Type.NUMBER },
                    additional: { type: Type.NUMBER },
                    others: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      });

      const extracted = safeParseAIResponse(response.text);
      const plans: ProductionPlan[] = extracted.map((d: any) => ({
        id: generateId(),
        date: d.date,
        meals: d.meals.map((m: any) => ({
          ...m,
          dishDetails: (m.dishes || []).map((dn: string) => ({ name: dn.trim(), amountCooked: 0 }))
        })),
        headcounts: {
          teachers: d.headcounts?.teachers || 0,
          primary: d.headcounts?.primary || 0,
          prePrimary: d.headcounts?.prePrimary || 0,
          additional: d.headcounts?.additional || 0,
          others: d.headcounts?.others || 0
        },
        isApproved: false,
        createdAt: Date.now()
      }));

      setPendingPlans(plans);
      setView('REVIEW');
    } catch (err: any) {
      console.error("AI Error:", err);
      alert("AI Sync Failed: Document data could not be parsed.");
    } finally { setIsProcessing(false); }
  };

  const toggleConsumption = async (plan: ProductionPlan) => {
    if (plan.isConsumed) return;
    setIsProcessing(true);
    try {
      const invSnapshot = await getDocs(collection(db, "inventory"));
      const inventory = invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      const batch = writeBatch(db);
      let deductions: Record<string, number> = {};

      plan.meals.forEach(meal => {
        (meal.dishDetails || []).forEach(dish => {
          const recipe = recipes.find(r => r.name.toLowerCase().trim() === dish.name.toLowerCase().trim());
          if (recipe && dish.amountCooked) {
            recipe.ingredients.forEach(ing => {
              const invItem = inventory.find(i => i.id === ing.inventoryItemId || i.name.toLowerCase() === ing.name.toLowerCase());
              if (invItem) {
                const amount = ing.amount * dish.amountCooked * (ing.conversionFactor || 1);
                deductions[invItem.id] = (deductions[invItem.id] || 0) + amount;
              }
            });
          }
        });
      });

      Object.entries(deductions).forEach(([id, amt]) => {
        const item = inventory.find(i => i.id === id);
        if (item) batch.update(doc(db, "inventory", id), { quantity: Math.max(0, item.quantity - amt) });
      });

      batch.update(doc(db, "productionPlans", plan.id), { isConsumed: true, headcounts: editHeadcounts, meals: editMeals });
      await batch.commit();
      setIsDayModalOpen(false);
      alert("Success: Inventory stock updated.");
    } catch (e) {
      console.error("Ledger sync error:", e);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-200 pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <CalendarCheck className="text-emerald-500" size={32} /> Production Hub
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Operational Menu & Headcount Analytics</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setView('UPLOAD')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-emerald-600 transition-all">
            <Upload size={18} /> Import Schedule
          </button>
          {view !== 'CALENDAR' && (
            <button onClick={() => setView('CALENDAR')} className="bg-white border-2 border-slate-200 text-slate-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <CalendarIcon size={18} /> Back to Hub
            </button>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-sm w-full">
            <Loader2 className="animate-spin mx-auto text-emerald-500 mb-6" size={64} />
            <h3 className="text-2xl font-black text-slate-900">Syncing...</h3>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4">Processing Cloud Operations</p>
          </div>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="max-w-4xl mx-auto space-y-12 py-10 animate-in slide-in-from-bottom-10 duration-500">
           <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-sm"><FileUp size={48} /></div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">AI Menu Integration</h3>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest max-w-sm mx-auto">Upload a meal schedule document to auto-populate production plans.</p>
           </div>
           <div className="relative group">
              <input type="file" id="schedule-upload" className="hidden" accept=".csv,application/pdf,image/*" onChange={handleFileUpload} />
              <label htmlFor="schedule-upload" className="flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[4rem] p-24 bg-white hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer group">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Plus size={32} className="text-slate-300 group-hover:text-emerald-500" /></div>
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 group-hover:text-emerald-600">Drop Document or Click</p>
              </label>
           </div>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-10 animate-in fade-in duration-500">
           <h3 className="text-2xl font-black text-slate-900 uppercase">Review Imported Plans</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {pendingPlans.map((plan, pi) => (
                <div key={pi} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm relative group hover:border-emerald-500 transition-colors">
                   <h4 className="font-black text-xl text-slate-900 mb-6">{new Date(plan.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h4>
                   <div className="space-y-4">
                     {plan.meals.map((m, mi) => (
                       <div key={mi} className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[9px] font-black text-emerald-600 uppercase mb-2">{m.mealType}</p>
                          <div className="space-y-1">
                             {m.dishes.map((d, di) => (
                               <div key={di} className="text-xs font-bold text-slate-700">• {d}</div>
                             ))}
                          </div>
                       </div>
                     ))}
                   </div>
                   <button onClick={() => setPendingPlans(pendingPlans.filter((_, i) => i !== pi))} className="absolute top-6 right-6 p-2 text-slate-200 hover:text-rose-500"><X size={16} /></button>
                </div>
              ))}
           </div>
           <button onClick={async () => {
              const batch = writeBatch(db);
              pendingPlans.forEach(p => batch.set(doc(db, "productionPlans", p.id), { ...p, isApproved: true }));
              await batch.commit();
              setPendingPlans([]);
              setView('CALENDAR');
           }} className="bg-slate-900 text-white px-12 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-emerald-600">Commit All Plans</button>
        </div>
      )}

      {view === 'CALENDAR' && (
        <div className="bg-white rounded-[4rem] shadow-xl border-2 border-slate-100 overflow-hidden animate-in fade-in duration-700">
           <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <div className="flex items-center bg-white p-2 rounded-[2rem] border-2 border-slate-100 shadow-sm">
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-4 text-slate-400 hover:text-slate-900 transition-colors"><ChevronLeft size={24} /></button>
                 <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-4 text-slate-400 hover:text-slate-900 transition-colors"><ChevronRight size={24} /></button>
              </div>
           </div>
           <div className="grid grid-cols-7 border-b bg-white text-center py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
           </div>
           <div className="grid grid-cols-7 bg-slate-50/30">
              {(() => {
                const days = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
                const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
                const grid = [];
                for (let i = 0; i < start; i++) grid.push(<div key={`e-${i}`} className="bg-slate-50/20 border-r border-b border-slate-100 h-32 md:h-44"></div>);
                for (let d = 1; d <= days; d++) {
                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                  const dateStr = getLocalDateString(date);
                  const plan = approvedPlans.find(p => p.date === dateStr);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const hasMissingSpec = plan ? checkHasMissingSpec(plan) : false;
                  // Explicitly type reducer to avoid unknown operator error
                  const totalPax = plan ? Object.values(plan.headcounts || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : 0;

                  grid.push(
                    <div key={d} onClick={() => handleDayClick(date, plan || null)} className={`border-r border-b border-slate-100 h-32 md:h-44 p-3 hover:bg-slate-50 cursor-pointer transition-all ${isToday ? 'bg-emerald-50/30' : 'bg-white'}`}>
                       <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>{d}</span>
                          {plan && totalPax > 0 && <span className="text-[8px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-full">{totalPax} PAX</span>}
                       </div>
                       {plan && (
                         <div className="space-y-1">
                           {plan.meals.slice(0, 2).map((m, mi) => (
                             <div key={mi} className="bg-white border border-slate-200 rounded-lg p-1 flex items-center gap-1 shadow-sm overflow-hidden">
                               <div className={`w-1 h-3 rounded-full ${plan.isConsumed ? 'bg-slate-300' : 'bg-emerald-500'}`}></div>
                               <span className="text-[8px] font-black text-slate-700 truncate">{m.dishes[0] || 'Menu Set'}</span>
                             </div>
                           ))}
                           <div className="flex justify-between items-center mt-2">
                             {hasMissingSpec && <span title="Missing Master Specifications"><AlertTriangle size={14} className="text-amber-500" /></span>}
                             {plan.isConsumed && <div className="text-[7px] font-black text-emerald-600 uppercase">✓ Finalized</div>}
                           </div>
                         </div>
                       )}
                    </div>
                  );
                }
                return grid;
              })()}
           </div>
        </div>
      )}

      {isDayModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white rounded-[4rem] w-full max-w-4xl overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-500">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500 rounded-2xl text-slate-950"><CalendarIcon size={24} /></div>
                    <div>
                       <h3 className="text-3xl font-black">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Operational Worklog & Menu Management</p>
                    </div>
                 </div>
                 <button onClick={() => setIsDayModalOpen(false)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                 {dayPlan ? (
                    <div className="space-y-10">
                       <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                          {[
                            { label: 'Staff/Fac.', key: 'teachers' as const },
                            { label: 'Primary', key: 'primary' as const },
                            { label: 'Pre-Prim.', key: 'prePrimary' as const },
                            { label: 'Guests', key: 'additional' as const },
                            { label: 'Others', key: 'others' as const }
                          ].map(cat => (
                             <div key={cat.key} className="text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-2">{cat.label}</p>
                                <input 
                                  type="number" 
                                  value={editHeadcounts[cat.key] || 0}
                                  onChange={(e) => setEditHeadcounts({...editHeadcounts, [cat.key]: parseInt(e.target.value) || 0})}
                                  disabled={dayPlan.isConsumed}
                                  className="w-full bg-white border border-slate-200 rounded-xl text-center font-black py-2 text-sm outline-none focus:border-emerald-500 transition-all disabled:opacity-50" 
                                />
                             </div>
                          ))}
                       </div>

                       <div className="space-y-8">
                          {editMeals.map((m, mi) => (
                             <div key={mi} className="space-y-4">
                                <div className="flex justify-between items-center">
                                   <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-4"><div className="w-8 h-px bg-slate-200"></div> {m.mealType} Service</h5>
                                   {!dayPlan.isConsumed && (
                                     <button onClick={() => {
                                       const up = [...editMeals];
                                       up[mi].dishDetails = [...(up[mi].dishDetails || []), { name: 'New Dish', amountCooked: 0 }];
                                       setEditMeals(up);
                                     }} className="text-[9px] font-black text-emerald-600 uppercase flex items-center gap-1"><Plus size={12}/> Add Dish</button>
                                   )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {(m.dishDetails || []).map((dish, di) => {
                                      const recipe = recipes.find(r => r.name.toLowerCase().trim() === dish.name.toLowerCase().trim());
                                      return (
                                         <div key={di} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 flex flex-col justify-between shadow-sm relative group">
                                            <div className="space-y-3">
                                               <div className="flex justify-between items-start">
                                                  {recipe ? (
                                                     <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[8px] font-black uppercase flex items-center gap-1"><CheckCircle size={10}/> Spec Linked</div>
                                                  ) : (
                                                     <div className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[8px] font-black uppercase flex items-center gap-1"><AlertTriangle size={10}/> Unlinked</div>
                                                  )}
                                                  {!dayPlan.isConsumed && (
                                                     <button onClick={() => {
                                                       const up = [...editMeals];
                                                       up[mi].dishDetails = up[mi].dishDetails?.filter((_, i) => i !== di);
                                                       setEditMeals(up);
                                                     }} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                                                  )}
                                               </div>
                                               <input 
                                                 type="text" 
                                                 value={dish.name} 
                                                 onChange={e => {
                                                   const up = [...editMeals];
                                                   up[mi].dishDetails![di].name = e.target.value;
                                                   setEditMeals(up);
                                                 }}
                                                 disabled={dayPlan.isConsumed}
                                                 className="w-full text-lg font-black text-slate-900 bg-transparent border-none focus:ring-0 p-0 outline-none placeholder:text-slate-200"
                                                 placeholder="Dish Name..."
                                               />
                                            </div>
                                            
                                            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                                               <div className="flex items-center gap-2">
                                                  <input 
                                                    type="number" 
                                                    step="0.1" 
                                                    value={dish.amountCooked || ''} 
                                                    onChange={e => { 
                                                      const up = [...editMeals]; 
                                                      up[mi].dishDetails![di].amountCooked = parseFloat(e.target.value) || 0; 
                                                      setEditMeals(up); 
                                                    }} 
                                                    disabled={dayPlan.isConsumed}
                                                    className="w-20 px-3 py-2 rounded-xl bg-slate-50 border-none font-black text-center text-sm shadow-inner" 
                                                    placeholder="0.0" 
                                                  />
                                                  <span className="text-[9px] font-black text-slate-400 uppercase">{recipe?.outputUnit || 'kg'}</span>
                                               </div>
                                               {recipe && <div className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"><ExternalLink size={14}/></div>}
                                            </div>
                                         </div>
                                      );
                                   })}
                                </div>
                             </div>
                          ))}
                       </div>

                       {!dayPlan.isConsumed && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                             <button onClick={handleSaveDay} className="bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl flex items-center justify-center gap-3">
                                <Save size={20} /> Update Register
                             </button>
                             <button onClick={() => toggleConsumption(dayPlan)} className="bg-white border-2 border-slate-900 text-slate-900 py-6 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-emerald-50 transition-all flex items-center justify-center gap-3">
                                <UserCheck size={20} /> Finalize & Deduct
                             </button>
                          </div>
                       )}
                       
                       <div className="flex justify-center">
                          <button onClick={async () => { if(confirm("Permanently delete this worklog?")) { await deleteDoc(doc(db, "productionPlans", dayPlan.id)); setIsDayModalOpen(false); }}} className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-rose-50 px-6 py-2 rounded-full transition-all">
                             <Trash2 size={12}/> Delete Entire Log
                          </button>
                       </div>
                    </div>
                 ) : (
                    <div className="py-24 text-center space-y-8">
                       <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mx-auto text-slate-200">
                          <ChefHat size={64} />
                       </div>
                       <div className="space-y-4">
                          <h4 className="text-3xl font-black text-slate-900 tracking-tight">Empty Schedule</h4>
                          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest max-w-xs mx-auto">No operational plan detected for this date. Initialize a new cycle to begin tracking.</p>
                       </div>
                       <button onClick={handleSaveDay} className="bg-slate-900 text-white px-12 py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-emerald-600 transition-all">Start Production Cycle</button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};