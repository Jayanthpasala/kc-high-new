
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
  Clock,
  Link,
  AlertTriangle,
  UserCheck,
  Edit,
  UserPlus
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, InventoryReservation, Meal, ConsumptionRecord, DishDetail } from '../types';

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
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW'>('CALENDAR');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [dayPlan, setDayPlan] = useState<ProductionPlan | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'VIEW' | 'CREATE_MEAL' | 'CREATE_EVENT' | 'EDIT_EXISTING'>('VIEW');
  
  const [manualMeals, setManualMeals] = useState<Meal[]>([
    { mealType: 'Breakfast', dishes: [''], dishDetails: [{ name: '', amountCooked: 0 }] },
    { mealType: 'Lunch', dishes: [''], dishDetails: [{ name: '', amountCooked: 0 }] },
    { mealType: 'Dinner', dishes: [''], dishDetails: [{ name: '', amountCooked: 0 }] }
  ]);
  const [manualHeadcounts, setManualHeadcounts] = useState<ConsumptionRecord>({
    teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0
  });
  const [manualEventName, setManualEventName] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const currentYear = new Date().getFullYear();

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

  // Check if all dishes in pending plans have recipes
  const missingRecipes = useMemo(() => {
    const missing = new Set<string>();
    pendingPlans.forEach(plan => {
      plan.meals.forEach(meal => {
        meal.dishes.forEach(dish => {
          if (!dish.trim()) return;
          const exists = recipes.some(r => r.name.toLowerCase() === dish.toLowerCase());
          if (!exists) missing.add(dish);
        });
      });
    });
    return Array.from(missing);
  }, [pendingPlans, recipes]);

  const handleDayClick = (date: Date) => {
    const dateStr = getLocalDateString(date);
    const existing = approvedPlans.find(p => p.date === dateStr);
    
    setSelectedDate(date);
    setDayPlan(existing || null);
    setEntryMode('VIEW');
    
    if (existing) {
      setManualMeals(existing.meals.map(m => ({
        ...m,
        dishDetails: m.dishDetails || m.dishes.map(d => ({ name: d, amountCooked: 0 }))
      })));
      setManualHeadcounts(existing.headcounts || { teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0 });
      setManualEventName(existing.eventName || '');
      setManualNotes(existing.notes || '');
    } else {
      setManualMeals([
          { mealType: 'Breakfast', dishes: [''], dishDetails: [{ name: '', amountCooked: 0 }] },
          { mealType: 'Lunch', dishes: [''], dishDetails: [{ name: '', amountCooked: 0 }] },
          { mealType: 'Dinner', dishes: [''], dishDetails: [{ name: '', amountCooked: 0 }] }
      ]);
      setManualHeadcounts({ teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0 });
      setManualEventName('');
      setManualNotes('');
    }
    
    setIsDayModalOpen(true);
  };

  const handleSavePlan = () => {
    if (!selectedDate) return;
    
    const planId = dayPlan?.id || generateId();
    const isProduction = entryMode === 'CREATE_MEAL' || entryMode === 'EDIT_EXISTING' || (dayPlan && dayPlan.type === 'production');

    const newPlan: ProductionPlan = {
      id: planId,
      date: getLocalDateString(selectedDate),
      type: entryMode === 'CREATE_EVENT' ? 'event' : 'production',
      eventName: entryMode === 'CREATE_EVENT' ? manualEventName : undefined,
      notes: manualNotes,
      meals: isProduction ? manualMeals.filter(m => m.dishes.some(d => d.trim() !== '')) : [],
      headcounts: manualHeadcounts,
      isApproved: true,
      createdAt: dayPlan?.createdAt || Date.now()
    };

    if (newPlan.type === 'event' && !manualEventName) return alert("Please enter event name.");

    mockFirestore.save(newPlan);
    loadData();
    setIsDayModalOpen(false);
    window.dispatchEvent(new Event('storage'));
  };

  const handleApproveAllPending = () => {
    if (missingRecipes.length > 0) {
      alert(`Safety Lock: Please define recipes for ${missingRecipes.length} dishes before approval. Check the highlighted items.`);
      return;
    }
    const batch = pendingPlans.map(p => ({ ...p, isApproved: true }));
    batch.forEach(p => mockFirestore.save(p));
    setPendingPlans([]);
    setView('CALENDAR');
    loadData();
    window.dispatchEvent(new Event('storage'));
  };

  const toggleConsumption = (id: string) => {
    const plan = approvedPlans.find(p => p.id === id);
    if (!plan || plan.isConsumed) return; 

    const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
    let updatedInventory = [...inventory];
    
    plan.meals.forEach(meal => {
      const details = meal.dishDetails || [];
      details.forEach(dish => {
        const recipe = recipes.find(r => r.name.toLowerCase() === dish.name.toLowerCase());
        const cookedQty = dish.amountCooked || 0;
        
        if (recipe && cookedQty > 0) {
          recipe.ingredients.forEach(ing => {
            const invItemIdx = updatedInventory.findIndex(item => item.name.toLowerCase() === ing.name.toLowerCase());
            if (invItemIdx > -1) {
              // Deduction = Ingredient amount per unit * Total Amount Cooked
              const baseDeduction = ing.amount * (ing.conversionFactor || 1.0);
              const totalDeduction = baseDeduction * cookedQty;
              
              updatedInventory[invItemIdx].quantity = Math.max(0, updatedInventory[invItemIdx].quantity - totalDeduction);
              updatedInventory[invItemIdx].reserved = Math.max(0, (updatedInventory[invItemIdx].reserved || 0) - totalDeduction);
              
              const item = updatedInventory[invItemIdx];
              if (item.quantity <= 0) item.status = 'out';
              else if (item.quantity < item.reorderLevel) item.status = 'low';
              else item.status = 'healthy';
            }
          });
        }
      });
    });

    const updated = { ...plan, isConsumed: true, headcounts: manualHeadcounts };
    mockFirestore.save(updated);
    localStorage.setItem('inventory', JSON.stringify(updatedInventory));
    
    loadData();
    setDayPlan(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fix: Obtained exclusively from process.env.API_KEY as per GenAI integration rules
    const apiKey = process.env.API_KEY;
    if (!apiKey) return alert("System Error: API key missing.");

    setIsProcessing(true);
    try {
      // Fix: Strictly follow initialization: new GoogleGenAI({ apiKey: process.env.API_KEY });
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
            { text: `Extract meal schedule from image. Return JSON array with date (YYYY-MM-DD) and meals (mealType and dishes list). Year: ${currentYear}.` }
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
          dishDetails: m.dishes.map((dishName: string) => ({ name: dishName, amountCooked: 0 }))
        })),
        isApproved: false,
        isConsumed: false,
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

  const renderCalendar = () => {
      const days = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
      const startDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
      const grid = [];
      
      for (let i = 0; i < startDay; i++) grid.push(<div key={`empty-${i}`} className="bg-slate-50/30 border-r border-b border-slate-100 h-24 md:h-40"></div>);

      for (let day = 1; day <= days; day++) {
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          const dateStr = getLocalDateString(date);
          const plan = approvedPlans.find(p => p.date === dateStr);
          const isToday = new Date().toDateString() === date.toDateString();

          grid.push(
              <div 
                key={day} 
                onClick={() => handleDayClick(date)}
                className={`border-r border-b border-slate-100 h-24 md:h-40 p-3 relative hover:bg-slate-50 cursor-pointer transition-all ${isToday ? 'bg-emerald-50/30' : 'bg-white'}`}
              >
                 <div className="flex justify-between items-start">
                     <span className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>{day}</span>
                     {plan && <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${plan.isConsumed ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>{plan.isConsumed ? 'Done' : 'Active'}</span>}
                 </div>
                 {plan && (
                     <div className="mt-2 space-y-1">
                        {plan.meals.slice(0, 2).map((m, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 flex items-center gap-2 overflow-hidden">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                             <span className="text-[9px] font-bold text-slate-700 truncate">{m.dishes[0]}</span>
                          </div>
                        ))}
                     </div>
                 )}
              </div>
          );
      }
      return grid;
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <CalendarCheck className="text-emerald-500" size={32} /> Cycle Planner
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Accurate Production & Headcount Registry</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setView('UPLOAD')} className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-900/10 transition-transform active:scale-95">
            <Upload size={18} /> Import Menu
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95">
            <Loader2 className="animate-spin mx-auto text-emerald-500 mb-6" size={64} />
            <h3 className="text-2xl font-black text-slate-900">Validating Logic</h3>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">AI Extraction Protocol In-Progress</p>
          </div>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-8 animate-in fade-in">
           <div className={`p-8 rounded-[2.5rem] flex items-center gap-6 ${missingRecipes.length > 0 ? 'bg-amber-50 border-2 border-amber-200' : 'bg-emerald-50 border-2 border-emerald-200'}`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${missingRecipes.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                 {missingRecipes.length > 0 ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}
              </div>
              <div>
                 <h3 className="text-xl font-black text-slate-900">{missingRecipes.length > 0 ? 'Recipe Linking Required' : 'All Dishes Synchronized'}</h3>
                 <p className="text-sm font-bold text-slate-500 mt-1">
                   {missingRecipes.length > 0 ? `Detected ${missingRecipes.length} dishes without master recipes. Approval is locked.` : 'AI detection matches 100% of master BOM data.'}
                 </p>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {pendingPlans.map((plan, i) => (
                 <div key={i} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm relative">
                    <div className="mb-8">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Production Date</label>
                       <input type="date" value={plan.date} onChange={(e) => {
                         const up = [...pendingPlans];
                         up[i].date = e.target.value;
                         setPendingPlans(up);
                       }} className="w-full font-black text-xl bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-900 mt-2 outline-none focus:border-emerald-500" />
                    </div>
                    <div className="space-y-6">
                       {plan.meals.map((m, mi) => (
                          <div key={mi} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                             <div className="flex justify-between items-center mb-4">
                                <span className="font-black text-[10px] uppercase tracking-widest text-emerald-600">{m.mealType}</span>
                                <button onClick={() => {
                                   const up = [...pendingPlans];
                                   up[i].meals[mi].dishes.push("");
                                   up[i].meals[mi].dishDetails?.push({ name: "", amountCooked: 0 });
                                   setPendingPlans(up);
                                }} className="p-1.5 bg-white text-slate-400 hover:text-emerald-500 rounded-lg shadow-sm border border-slate-100"><Plus size={14} /></button>
                             </div>
                             <div className="space-y-3">
                                {m.dishes.map((d, di) => {
                                   const isMissing = !recipes.some(r => r.name.toLowerCase() === d.toLowerCase());
                                   return (
                                     <div key={di} className="relative">
                                       <input 
                                         value={d} 
                                         onChange={(e) => {
                                            const up = [...pendingPlans];
                                            up[i].meals[mi].dishes[di] = e.target.value;
                                            if (up[i].meals[mi].dishDetails) {
                                              up[i].meals[mi].dishDetails![di].name = e.target.value;
                                            }
                                            setPendingPlans(up);
                                         }} 
                                         className={`w-full text-sm font-bold bg-white border-2 rounded-xl px-4 py-3 text-slate-900 outline-none shadow-sm ${isMissing ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'}`} 
                                         placeholder="Enter dish name..."
                                       />
                                       {isMissing && d.trim() !== "" && <Link size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-400" />}
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
              <button onClick={() => setView('CALENDAR')} className="px-10 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl">Abort</button>
              <button 
                onClick={handleApproveAllPending} 
                className={`px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center gap-3 transition-all ${missingRecipes.length > 0 ? 'bg-slate-300 text-white cursor-not-allowed opacity-70' : 'bg-slate-900 text-white hover:bg-emerald-600 hover:scale-105'}`}
              >
                <CheckCircle2 size={20} /> Approve All Plans
              </button>
           </div>
        </div>
      )}

      {view === 'CALENDAR' && (
         <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
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
            <div className="grid grid-cols-7 bg-slate-50/30">{renderCalendar()}</div>
         </div>
      )}

      {isDayModalOpen && selectedDate && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in">
            <div className="bg-white rounded-[4rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[90vh] animate-in zoom-in-95">
               <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                  <div>
                     <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mb-1">Production Registry</p>
                     <h3 className="text-2xl font-black">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                  </div>
                  <button onClick={() => setIsDayModalOpen(false)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
               </div>

               <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                  {entryMode === 'VIEW' && (
                    <>
                      {dayPlan ? (
                        <div className="space-y-10">
                          {dayPlan.type === 'production' && (
                            <div className="grid grid-cols-2 gap-4">
                               <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 flex flex-col items-center">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Cycle Status</span>
                                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${dayPlan.isConsumed ? 'bg-slate-200 text-slate-500' : 'bg-emerald-500 text-slate-900'}`}>
                                     {dayPlan.isConsumed ? 'Cycle Fulfilled' : 'Pending Batch'}
                                  </div>
                               </div>
                               <button onClick={() => setEntryMode('EDIT_EXISTING')} className="p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-emerald-500 transition-all flex flex-col items-center">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Actions</span>
                                  <div className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-900"><Edit size={14} /> Adjust Plan</div>
                               </button>
                            </div>
                          )}

                          <div className="space-y-8">
                            {dayPlan.meals.map((meal, i) => (
                              <div key={i} className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3">
                                   <div className="w-8 h-px bg-slate-200"></div> {meal.mealType}
                                </h4>
                                <div className="space-y-3">
                                  {(meal.dishDetails || meal.dishes.map(d => ({ name: d, amountCooked: 0 }))).map((dish, dIdx) => (
                                    <div key={dIdx} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                                      <span className="font-black text-slate-900 text-lg">{dish.name}</span>
                                      <div className="flex items-center gap-4">
                                        {!dayPlan.isConsumed && (
                                           <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border-2 border-slate-200 shadow-inner">
                                              <input 
                                                type="number" 
                                                value={manualMeals[i].dishDetails?.[dIdx]?.amountCooked} 
                                                onChange={(e) => {
                                                   const up = [...manualMeals];
                                                   if (!up[i].dishDetails) up[i].dishDetails = up[i].dishes.map(d => ({ name: d, amountCooked: 0 }));
                                                   up[i].dishDetails![dIdx].amountCooked = parseFloat(e.target.value) || 0;
                                                   setManualMeals(up);
                                                }}
                                                className="w-16 bg-transparent border-none font-black text-slate-900 text-center focus:ring-0 p-0" 
                                              />
                                              <span className="text-[9px] font-black text-slate-400">KG/L</span>
                                           </div>
                                        )}
                                        {dayPlan.isConsumed && (
                                           <span className="font-black text-emerald-500">{(dish.amountCooked || 0).toFixed(1)} {recipes.find(r => r.name === dish.name)?.outputUnit || 'KG'}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-6">
                             <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3">
                                <div className="w-8 h-px bg-slate-200"></div> Consumption Headcounts
                             </h4>
                             <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                                {[
                                  { label: 'Teachers', key: 'teachers' as const },
                                  { label: 'Primary', key: 'primary' as const },
                                  { label: 'Pre-Primary', key: 'prePrimary' as const },
                                  { label: 'Additional', key: 'additional' as const },
                                  { label: 'Others', key: 'others' as const }
                                ].map(cat => (
                                  <div key={cat.key} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                     <p className="text-[8px] font-black text-slate-400 uppercase mb-2">{cat.label}</p>
                                     {dayPlan.isConsumed ? (
                                        <p className="text-xl font-black text-slate-900">{dayPlan.headcounts?.[cat.key] || 0}</p>
                                     ) : (
                                        <input 
                                          type="number" 
                                          value={manualHeadcounts[cat.key]} 
                                          onChange={(e) => setManualHeadcounts({...manualHeadcounts, [cat.key]: parseInt(e.target.value) || 0})}
                                          className="w-full bg-white border border-slate-200 rounded-lg text-center font-black py-1 text-sm shadow-inner" 
                                        />
                                     )}
                                  </div>
                                ))}
                             </div>
                          </div>

                          {!dayPlan.isConsumed && (
                            <button 
                              onClick={() => toggleConsumption(dayPlan.id)} 
                              className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 transition-all shadow-2xl flex items-center justify-center gap-3"
                            >
                               <UserCheck size={20} /> Initialize Stock Deduction
                            </button>
                          )}
                          
                          <button onClick={() => { if(confirm("Wipe this data?")) { mockFirestore.delete(dayPlan.id); setIsDayModalOpen(false); loadData(); window.dispatchEvent(new Event('storage')); } }} className="w-full py-4 text-rose-500 hover:bg-rose-50 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                             <Trash2 size={16} /> Permanently Wipe Cycle
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-10 space-y-12">
                           <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mx-auto text-slate-200 border-2 border-dashed border-slate-200"><CalendarCheck size={64} /></div>
                           <div className="grid grid-cols-2 gap-6">
                              <button onClick={() => setEntryMode('CREATE_MEAL')} className="p-8 rounded-[3rem] bg-white border-4 border-slate-50 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-4">
                                 <ChefHat size={40} className="text-slate-300" />
                                 <span className="font-black text-[10px] uppercase tracking-widest">New Cycle</span>
                              </button>
                              <button onClick={() => setEntryMode('CREATE_EVENT')} className="p-8 rounded-[3rem] bg-white border-4 border-slate-50 hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-4">
                                 <PartyPopper size={40} className="text-slate-300" />
                                 <span className="font-black text-[10px] uppercase tracking-widest">Add Event</span>
                              </button>
                           </div>
                        </div>
                      )}
                    </>
                  )}

                  {(entryMode === 'CREATE_MEAL' || entryMode === 'CREATE_EVENT' || entryMode === 'EDIT_EXISTING') && (
                     <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
                        {entryMode === 'CREATE_EVENT' ? (
                          <div className="space-y-6">
                             <input type="text" placeholder="Event Title..." value={manualEventName} onChange={e => setManualEventName(e.target.value)} className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-4 border-transparent font-black text-2xl outline-none focus:border-purple-500 shadow-inner" />
                             <textarea placeholder="Technical details..." value={manualNotes} onChange={e => setManualNotes(e.target.value)} className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-4 border-transparent font-bold text-slate-700 outline-none focus:border-purple-500 h-40 resize-none shadow-inner" />
                          </div>
                        ) : (
                          <div className="space-y-8">
                             {manualMeals.map((m, idx) => (
                                <div key={idx} className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100">
                                   <div className="flex justify-between items-center mb-6">
                                      <h5 className="font-black text-[10px] uppercase tracking-widest text-emerald-500">{m.mealType}</h5>
                                      <button onClick={() => {
                                        const up = [...manualMeals];
                                        up[idx].dishes.push("");
                                        up[idx].dishDetails!.push({ name: "", amountCooked: 0 });
                                        setManualMeals(up);
                                      }} className="p-2 bg-white text-slate-400 hover:text-emerald-500 rounded-xl shadow-sm border border-slate-200"><Plus size={16} /></button>
                                   </div>
                                   <div className="space-y-3">
                                      {m.dishes.map((dish, dIdx) => (
                                         <div key={dIdx} className="flex gap-3">
                                           <input 
                                             type="text" 
                                             placeholder="Dish name..." 
                                             value={dish} 
                                             onChange={e => {
                                               const up = [...manualMeals];
                                               up[idx].dishes[dIdx] = e.target.value;
                                               up[idx].dishDetails![dIdx].name = e.target.value;
                                               setManualMeals(up);
                                             }}
                                             className="flex-1 px-6 py-4 rounded-xl bg-white border-2 border-slate-100 font-bold outline-none focus:border-emerald-500 shadow-sm" 
                                           />
                                           <button onClick={() => {
                                             const up = [...manualMeals];
                                             up[idx].dishes.splice(dIdx, 1);
                                             up[idx].dishDetails!.splice(dIdx, 1);
                                             setManualMeals(up);
                                           }} className="p-4 text-slate-300 hover:text-rose-500"><Trash2 size={20} /></button>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ))}
                             
                             <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6">
                                <div className="flex items-center gap-3">
                                   <UserPlus size={20} className="text-emerald-400" />
                                   <h4 className="text-[10px] font-black uppercase tracking-widest">Initial Headcount Target</h4>
                                </div>
                                <div className="grid grid-cols-5 gap-3">
                                   {['teachers', 'primary', 'prePrimary', 'additional', 'others'].map(k => (
                                      <div key={k} className="space-y-2">
                                         <label className="text-[8px] font-black uppercase text-slate-400 block text-center truncate">{k}</label>
                                         <input 
                                           type="number" 
                                           value={(manualHeadcounts as any)[k]} 
                                           onChange={e => setManualHeadcounts({...manualHeadcounts, [k]: parseInt(e.target.value) || 0})}
                                           className="w-full bg-white/10 border-none rounded-lg text-center font-black py-2 text-xs text-white" 
                                         />
                                      </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                        )}

                        <div className="flex gap-4">
                           <button onClick={() => setEntryMode('VIEW')} className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Abort Changes</button>
                           <button onClick={handleSavePlan} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-emerald-600 transition-all">Save Operations Plan</button>
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
