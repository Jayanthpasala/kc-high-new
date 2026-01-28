import React, { useState, useEffect } from 'react';
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
  Clock
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, InventoryReservation, Meal } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);
const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();

/* ---------------- MOCK STORAGE ---------------- */
const mockFirestore = {
  collection: 'productionPlans',
  save: (plan: ProductionPlan) => {
    const plans = mockFirestore.getAll();
    const existingIdx = plans.findIndex(p => p.id === plan.id);
    if (existingIdx > -1) {
      plans[existingIdx] = { ...plan, updatedAt: Date.now() };
    } else {
      plans.push({ ...plan, type: plan.type || 'production' });
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
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [dayPlan, setDayPlan] = useState<ProductionPlan | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'VIEW' | 'CREATE_MEAL' | 'CREATE_EVENT'>('VIEW');
  
  const [manualMeals, setManualMeals] = useState<Meal[]>([
    { mealType: 'Breakfast', dishes: [''] },
    { mealType: 'Lunch', dishes: [''] },
    { mealType: 'Dinner', dishes: [''] }
  ]);
  const [manualEventName, setManualEventName] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const currentYear = new Date().getFullYear();

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const updatePlans = () => {
    const all = mockFirestore.getAll();
    setApprovedPlans(all.sort((a, b) => a.date.localeCompare(b.date)));
  };

  useEffect(() => {
    updatePlans();
    const handleStorage = () => updatePlans();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleDayClick = (date: Date) => {
    const dateStr = getLocalDateString(date);
    const existing = approvedPlans.find(p => p.date === dateStr);
    
    setSelectedDate(date);
    setDayPlan(existing || null);
    setEntryMode('VIEW');
    setManualMeals([
        { mealType: 'Breakfast', dishes: [''] },
        { mealType: 'Lunch', dishes: [''] },
        { mealType: 'Dinner', dishes: [''] }
    ]);
    setManualEventName('');
    setManualNotes('');
    setIsDayModalOpen(true);
  };

  const handleSaveManualPlan = () => {
    if (!selectedDate) return;
    
    const newPlan: ProductionPlan = {
      id: generateId(),
      date: getLocalDateString(selectedDate),
      type: entryMode === 'CREATE_EVENT' ? 'event' : 'production',
      eventName: entryMode === 'CREATE_EVENT' ? manualEventName : undefined,
      notes: manualNotes,
      meals: entryMode === 'CREATE_MEAL' ? manualMeals.filter(m => m.dishes.some(d => d.trim() !== '')) : [],
      isApproved: true,
      createdAt: Date.now()
    };

    if (entryMode === 'CREATE_EVENT' && !manualEventName) {
        alert("Please enter an event name.");
        return;
    }

    mockFirestore.save(newPlan);
    if (newPlan.type === 'production') processReservations([newPlan]);

    updatePlans();
    setIsDayModalOpen(false);
    window.dispatchEvent(new Event('storage'));
  };

  const processReservations = (plans: ProductionPlan[]) => {
    const recipes: Recipe[] = JSON.parse(localStorage.getItem('recipes') || '[]');
    let pendingRecipes: string[] = JSON.parse(localStorage.getItem('pendingRecipes') || '[]');
    let reservations: InventoryReservation[] = JSON.parse(localStorage.getItem('inventoryReservations') || '[]');
    const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');

    plans.forEach(plan => {
      if (plan.type === 'event') return;
      plan.meals.forEach(meal => {
        meal.dishes.forEach(dish => {
          if (!dish.trim()) return;
          const recipe = recipes.find(r => r.name.toLowerCase() === dish.toLowerCase());
          if (recipe) {
             recipe.ingredients.forEach(ing => {
                const invItem = inventory.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
                if (invItem) {
                   const qtyNeeded = ing.amount * (ing.conversionFactor || 1);
                   reservations.push({
                      id: generateId(),
                      planId: plan.id,
                      date: plan.date,
                      ingredientName: ing.name,
                      quantity: qtyNeeded,
                      unit: ing.unit
                   });
                   invItem.reserved = (invItem.reserved || 0) + qtyNeeded;
                }
             });
          } else if (!pendingRecipes.includes(dish)) {
             pendingRecipes.push(dish);
          }
        });
      });
    });

    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('inventoryReservations', JSON.stringify(reservations));
    localStorage.setItem('pendingRecipes', JSON.stringify(pendingRecipes));
  };

  const handleApproveAllPending = () => {
    const batch = pendingPlans.map(p => ({ ...p, isApproved: true }));
    batch.forEach(p => mockFirestore.save(p));
    processReservations(batch);
    setPendingPlans([]);
    setView('CALENDAR');
    updatePlans();
    window.dispatchEvent(new Event('storage'));
  };

  const toggleConsumption = (id: string) => {
    const plan = approvedPlans.find(p => p.id === id);
    if (!plan || plan.isConsumed) return; 

    const recipes: Recipe[] = JSON.parse(localStorage.getItem('recipes') || '[]');
    const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
    let reservations: InventoryReservation[] = JSON.parse(localStorage.getItem('inventoryReservations') || '[]');
    let updatedInventory = [...inventory];
    
    plan.meals.forEach(meal => {
      meal.dishes.forEach(dish => {
        const recipe = recipes.find(r => r.name.toLowerCase() === dish.toLowerCase());
        if (recipe) {
          recipe.ingredients.forEach(ing => {
            const invItemIdx = updatedInventory.findIndex(item => item.name.toLowerCase() === ing.name.toLowerCase());
            if (invItemIdx > -1) {
              const deduction = ing.amount * (ing.conversionFactor || 1.0);
              updatedInventory[invItemIdx].reserved = Math.max(0, (updatedInventory[invItemIdx].reserved || 0) - deduction);
              updatedInventory[invItemIdx].quantity = Math.max(0, updatedInventory[invItemIdx].quantity - deduction);
              
              const item = updatedInventory[invItemIdx];
              if (item.quantity <= 0) item.status = 'out';
              else if (item.quantity < item.reorderLevel) item.status = 'low';
              else item.status = 'healthy';
            }
          });
        }
      });
    });

    reservations = reservations.filter(r => r.planId !== plan.id);
    const updated = { ...plan, isConsumed: true };
    mockFirestore.save(updated);
    
    localStorage.setItem('inventory', JSON.stringify(updatedInventory));
    localStorage.setItem('inventoryReservations', JSON.stringify(reservations));
    
    updatePlans();
    setDayPlan(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const deletePlan = (id: string) => {
     if(confirm("Permanently delete this production plan?")) {
        mockFirestore.delete(id);
        updatePlans();
        setIsDayModalOpen(false);
        window.dispatchEvent(new Event('storage'));
     }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const apiKey = (window as any).GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      alert("AI Configuration Error: Gemini API key missing.");
      return;
    }

    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
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
            { text: `Extract meal schedule from image. Return JSON array with date (YYYY-MM-DD) and meals (mealType and dishes list). Current year is ${currentYear}.` }
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
        meals: d.meals,
        isApproved: false,
        isConsumed: false,
        createdAt: Date.now()
      }));

      setPendingPlans(plans);
      setView('REVIEW');
    } catch (err: any) {
      alert("AI Analysis Failed: " + err.message);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const renderCalendar = () => {
      const days = daysInMonth(currentMonth);
      const startDay = startDayOfMonth(currentMonth);
      const grid = [];
      
      for (let i = 0; i < startDay; i++) {
          grid.push(<div key={`empty-${i}`} className="bg-slate-50/30 border-r border-b border-slate-100 h-24 md:h-32 lg:h-40"></div>);
      }

      for (let day = 1; day <= days; day++) {
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          const dateStr = getLocalDateString(date);
          const dayPlans = approvedPlans.filter(p => p.date === dateStr);
          const isToday = new Date().toDateString() === date.toDateString();
          const plan = dayPlans[0];

          grid.push(
              <div 
                key={day} 
                onClick={() => handleDayClick(date)}
                className={`border-r border-b border-slate-100 h-24 md:h-32 lg:h-40 p-2 md:p-3 relative transition-all hover:bg-slate-50 cursor-pointer ${isToday ? 'bg-emerald-50/30' : 'bg-white'}`}
              >
                 <div className="flex justify-between items-start">
                     <span className={`text-xs md:text-sm font-bold w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{day}</span>
                     {plan && (
                         <span className={`text-[8px] md:text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                             plan.type === 'event' ? 'bg-purple-100 text-purple-600' : plan.isConsumed ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-600'
                         }`}>
                            {plan.type === 'event' ? 'Event' : plan.isConsumed ? 'Done' : 'Active'}
                         </span>
                     )}
                 </div>
                 
                 {plan && (
                     <div className="mt-2 space-y-1">
                        {plan.type === 'event' ? (
                            <div className="bg-purple-50 p-1.5 rounded-lg border border-purple-100">
                                <p className="text-[9px] font-bold text-purple-700 truncate">{plan.eventName}</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                               {plan.meals.slice(0, 2).map((m, i) => (
                                   <div key={i} className="bg-white border border-slate-100 rounded-lg p-1 flex items-center gap-1.5 shadow-sm overflow-hidden">
                                       <div className={`w-1 h-1 rounded-full shrink-0 ${m.mealType.includes('Breakfast') ? 'bg-amber-400' : m.mealType.includes('Lunch') ? 'bg-blue-400' : 'bg-slate-400'}`}></div>
                                       <span className="text-[8px] font-bold text-slate-600 truncate">{m.dishes[0]}</span>
                                   </div>
                               ))}
                               {plan.meals.length > 2 && <p className="text-[8px] text-slate-400 text-center font-bold">+{plan.meals.length - 2} more</p>}
                            </div>
                        )}
                     </div>
                 )}
              </div>
          );
      }
      return grid;
  };

  const shiftMonth = (delta: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <CalendarCheck className="text-emerald-500" size={32} /> Cycle Planner
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">SOP-Driven Production Logic</p>
        </div>
        <div className="flex gap-4">
          {view !== 'CALENDAR' && (
            <button onClick={() => setView('CALENDAR')} className="px-6 py-3 bg-white border-2 border-slate-100 rounded-xl text-xs font-black uppercase text-slate-500">Back</button>
          )}
          <button onClick={() => setView('UPLOAD')} className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-900/10">
            <Upload size={18} /> Import Menu
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95">
            <Loader2 className="animate-spin mx-auto text-emerald-500 mb-6" size={64} />
            <h3 className="text-2xl font-black text-slate-900">Synchronizing Cycle</h3>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-2">AI Extraction Protocol In-Progress</p>
          </div>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="bg-white border-2 border-dashed border-slate-200 p-16 md:p-32 text-center rounded-[3rem] animate-in fade-in">
          <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-slate-300">
             <CalendarIcon size={48} />
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-2">Import Master Schedule</h3>
          <p className="text-slate-500 max-w-md mx-auto font-medium">Upload a photo of your weekly menu board or digital PDF to auto-populate the cycle.</p>
          <input type="file" id="menu-upload" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
          <label htmlFor="menu-upload" className="mt-12 inline-flex items-center gap-3 cursor-pointer bg-slate-900 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl">
             Select Local Document
          </label>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2.5rem] flex items-center gap-4">
              <CheckCircle className="text-emerald-500" size={32} />
              <div>
                 <h3 className="text-lg font-black text-emerald-900">Validation Protocol</h3>
                 <p className="text-sm font-bold text-emerald-600/70">Review and refine the AI-extracted dishes before committing to the schedule.</p>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingPlans.map((plan, i) => (
                 <div key={i} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
                    <div className="mb-6">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Date</label>
                       <input 
                         type="date" 
                         value={plan.date} 
                         onChange={(e) => {
                            const up = [...pendingPlans];
                            up[i].date = e.target.value;
                            setPendingPlans(up);
                         }} 
                         className="w-full font-black text-xl bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-slate-900 mt-2 outline-none focus:border-emerald-500" 
                       />
                    </div>
                    <div className="space-y-6">
                       {plan.meals.map((m, mi) => (
                          <div key={mi} className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                             <input 
                               value={m.mealType} 
                               onChange={(e) => {
                                  const up = [...pendingPlans];
                                  up[i].meals[mi].mealType = e.target.value;
                                  setPendingPlans(up);
                               }} 
                               className="font-black text-[10px] uppercase tracking-widest text-emerald-600 bg-white border border-slate-200 rounded-lg px-2 py-1 w-full mb-4 focus:ring-0" 
                             />
                             <div className="space-y-2">
                                {m.dishes.map((d, di) => (
                                   <input 
                                     key={di} 
                                     value={d} 
                                     onChange={(e) => {
                                        const up = [...pendingPlans];
                                        up[i].meals[mi].dishes[di] = e.target.value;
                                        setPendingPlans(up);
                                     }} 
                                     className="w-full text-sm font-bold bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:border-emerald-500 outline-none shadow-sm" 
                                   />
                                ))}
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              ))}
           </div>

           <button onClick={handleApproveAllPending} className="fixed bottom-10 right-10 bg-slate-900 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl z-50 hover:bg-emerald-600 hover:scale-105 transition-all flex items-center gap-2">
              <CheckCircle2 size={20} /> Commit All Plans
           </button>
        </div>
      )}

      {view === 'CALENDAR' && (
         <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/40">
               <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
               <div className="flex items-center bg-white p-2 rounded-2xl border-2 border-slate-100 shadow-sm">
                  <button onClick={() => shiftMonth(-1)} className="p-3 text-slate-400 hover:text-slate-900 transition-colors"><ChevronLeft size={20} /></button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-6 py-2 text-[10px] font-black uppercase text-slate-500 hover:text-emerald-500 tracking-widest">Current</button>
                  <button onClick={() => shiftMonth(1)} className="p-3 text-slate-400 hover:text-slate-900 transition-colors"><ChevronRight size={20} /></button>
               </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100 bg-white sticky top-0 z-10 shadow-sm">
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
               ))}
            </div>

            <div className="grid grid-cols-7 bg-slate-50/30">
               {renderCalendar()}
            </div>
         </div>
      )}

      {isDayModalOpen && selectedDate && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[85vh] animate-in zoom-in-95">
               <div className="bg-slate-900 p-8 text-white shrink-0 flex justify-between items-center">
                  <div>
                     <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] mb-1">Day Inspector</p>
                     <h3 className="text-2xl font-black tracking-tight">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                  </div>
                  <button onClick={() => setIsDayModalOpen(false)} className="p-3 bg-white/10 rounded-xl hover:bg-rose-500 transition-all"><X size={20} /></button>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white space-y-6">
                  {entryMode === 'VIEW' && (
                      <>
                        {dayPlan ? (
                            <div className="space-y-6">
                                {dayPlan.type === 'event' ? (
                                    <div className="bg-purple-50 p-8 rounded-[2rem] text-center border-2 border-purple-100">
                                        <PartyPopper size={48} className="text-purple-500 mx-auto mb-4" />
                                        <h4 className="text-2xl font-black text-purple-900">{dayPlan.eventName}</h4>
                                        <p className="text-sm font-bold text-purple-700/70 mt-3 leading-relaxed">{dayPlan.notes || 'Special operational event scheduled.'}</p>
                                    </div>
                                ) : (
                                    <div className={`p-8 rounded-[2rem] text-center border-2 transition-colors ${dayPlan.isConsumed ? 'bg-slate-100 border-slate-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <ChefHat size={48} className={`mx-auto mb-4 ${dayPlan.isConsumed ? 'text-slate-400' : 'text-emerald-500'}`} />
                                        <h4 className={`text-2xl font-black ${dayPlan.isConsumed ? 'text-slate-600' : 'text-emerald-900'}`}>Production Batch</h4>
                                        <div className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mt-4 ${dayPlan.isConsumed ? 'bg-slate-200 text-slate-500' : 'bg-emerald-500 text-slate-900'}`}>
                                            {dayPlan.isConsumed ? 'Cycle Fulfilled' : 'Active Cycle'}
                                        </div>
                                    </div>
                                )}

                                {dayPlan.type !== 'event' && (
                                    <div className="space-y-6">
                                        {dayPlan.meals.map((meal, i) => (
                                            <div key={i} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">{meal.mealType}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {meal.dishes.map((dish, d) => (
                                                        <span key={d} className="bg-slate-50 border-2 border-slate-100 px-4 py-2 rounded-xl text-sm font-black text-slate-700">{dish}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 pt-4">
                                    {!dayPlan.isConsumed && dayPlan.type === 'production' && (
                                        <button onClick={() => toggleConsumption(dayPlan.id)} className="col-span-2 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all shadow-xl">Confirm Consumption</button>
                                    )}
                                    <button onClick={() => deletePlan(dayPlan.id)} className="col-span-2 py-4 text-rose-500 hover:bg-rose-50 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                                        <Trash2 size={16} /> Wipe Plan
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                <div className="bg-slate-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-200">
                                    <CalendarCheck size={40} />
                                </div>
                                <h4 className="text-xl font-black text-slate-900">Vacant Cycle</h4>
                                <p className="text-slate-400 font-bold text-sm mt-1">No production data for this window.</p>
                                
                                <div className="grid grid-cols-2 gap-4 mt-12">
                                    <button onClick={() => setEntryMode('CREATE_MEAL')} className="p-6 rounded-3xl bg-white border-4 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-3">
                                        <ChefHat size={32} className="text-slate-400" />
                                        <span className="font-black text-[10px] uppercase tracking-widest">New Cycle</span>
                                    </button>
                                    <button onClick={() => setEntryMode('CREATE_EVENT')} className="p-6 rounded-3xl bg-white border-4 border-slate-100 hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-3">
                                        <PartyPopper size={32} className="text-slate-400" />
                                        <span className="font-black text-[10px] uppercase tracking-widest">Add Event</span>
                                    </button>
                                </div>
                            </div>
                        )}
                      </>
                  )}

                  {(entryMode === 'CREATE_MEAL' || entryMode === 'CREATE_EVENT') && (
                     <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        {entryMode === 'CREATE_MEAL' ? (
                            manualMeals.map((meal, idx) => (
                               <div key={idx} className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-100">
                                  <h5 className="text-[10px] font-black uppercase text-slate-400 mb-3">{meal.mealType}</h5>
                                  <input 
                                    type="text" 
                                    placeholder="Enter Dish Name..." 
                                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner"
                                    value={meal.dishes[0]}
                                    onChange={(e) => {
                                        const updated = [...manualMeals];
                                        updated[idx].dishes[0] = e.target.value;
                                        setManualMeals(updated);
                                    }}
                                  />
                               </div>
                            ))
                        ) : (
                            <div className="space-y-6">
                                <input 
                                  type="text" 
                                  placeholder="Event Title..." 
                                  className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-6 py-4 text-lg font-black text-slate-900 outline-none focus:border-purple-500 transition-all shadow-inner"
                                  value={manualEventName}
                                  onChange={(e) => setManualEventName(e.target.value)}
                                />
                                <textarea 
                                  placeholder="Special instructions or notes..." 
                                  className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 outline-none focus:border-purple-500 transition-all resize-none h-32 shadow-inner"
                                  value={manualNotes}
                                  onChange={(e) => setManualNotes(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="flex gap-4 pt-4">
                           <button onClick={() => setEntryMode('VIEW')} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors">Abort</button>
                           <button onClick={handleSaveManualPlan} className={`flex-1 ${entryMode === 'CREATE_EVENT' ? 'bg-purple-500' : 'bg-emerald-500'} text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 transition-all`}>
                             Initialize Plan
                           </button>
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