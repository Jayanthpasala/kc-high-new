
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
  AlertCircle, 
  LayoutGrid,
  ListFilter,
  ChefHat,
  CalendarCheck,
  CheckCircle,
  MoreVertical,
  Trash2,
  Clock
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, InventoryReservation, PendingProcurement } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

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
    localStorage.setItem(mockFirestore.collection, JSON.stringify(plans));
  },
  getAll: (): ProductionPlan[] => {
    try {
      const data = localStorage.getItem(mockFirestore.collection);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },
  getApproved: (): ProductionPlan[] => {
    return mockFirestore.getAll().filter(p => p.isApproved);
  },
  delete: (id: string) => {
    const plans = mockFirestore.getAll().filter(p => p.id !== id);
    localStorage.setItem(mockFirestore.collection, JSON.stringify(plans));
  }
};

type ViewMode = 'MONTH' | 'AGENDA';

export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW'>('CALENDAR');
  const [viewMode, setViewMode] = useState<ViewMode>('MONTH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'plan' | 'consumption'>('plan');
  
  const currentYear = new Date().getFullYear();

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getDate()).length === 1 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
    // Fix month/day padding properly
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
    window.addEventListener('storage', updatePlans);
    return () => window.removeEventListener('storage', updatePlans);
  }, [view]);

  // --- AUTOMATION ENGINE ---
  const handleApproveAll = () => {
    const recipes: Recipe[] = JSON.parse(localStorage.getItem('recipes') || '[]');
    let pendingRecipes: string[] = JSON.parse(localStorage.getItem('pendingRecipes') || '[]');
    let reservations: InventoryReservation[] = JSON.parse(localStorage.getItem('inventoryReservations') || '[]');
    const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');

    const approvedBatch: ProductionPlan[] = [];

    pendingPlans.forEach(plan => {
      const fullPlan = { ...plan, isApproved: true };
      mockFirestore.save(fullPlan);
      approvedBatch.push(fullPlan);

      // --- LOGIC: CHECK EXISTING RECIPES & RESERVE STOCK ---
      plan.meals.forEach(meal => {
        meal.dishes.forEach(dish => {
          // 1. Check if recipe exists
          const recipe = recipes.find(r => r.name.toLowerCase() === dish.toLowerCase());
          
          if (recipe) {
             // 2. If exists, calculate ingredients and soft-reserve
             recipe.ingredients.forEach(ing => {
                const invItem = inventory.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
                if (invItem) {
                   const qtyNeeded = ing.amount * (ing.conversionFactor || 1);
                   
                   // Add to reservation ledger
                   reservations.push({
                      id: generateId(),
                      planId: plan.id,
                      date: plan.date,
                      ingredientName: ing.name,
                      quantity: qtyNeeded,
                      unit: ing.unit
                   });
                   
                   // Note: We don't deduct hard stock yet, only when 'Consumed'.
                   // But we update the 'reserved' field on inventory.
                   invItem.reserved = (invItem.reserved || 0) + qtyNeeded;
                }
             });
          } else {
             // 3. If NOT exists, add to pendingRecipes (only if not already there)
             if (!pendingRecipes.includes(dish)) {
                pendingRecipes.push(dish);
             }
          }
        });
      });
    });

    // Save updated states
    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('inventoryReservations', JSON.stringify(reservations));
    localStorage.setItem('pendingRecipes', JSON.stringify(pendingRecipes));

    setPendingPlans([]);
    updatePlans();
    setView('CALENDAR');
    window.dispatchEvent(new Event('storage'));
  };

  const toggleConsumption = (id: string) => {
    const plan = approvedPlans.find(p => p.id === id);
    if (!plan) return;
    
    // Only allow consumption once
    if (plan.isConsumed) return; 

    const recipes: Recipe[] = JSON.parse(localStorage.getItem('recipes') || '[]');
    const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
    let reservations: InventoryReservation[] = JSON.parse(localStorage.getItem('inventoryReservations') || '[]');
    let updatedInventory = [...inventory];
    
    // Hard Deduction Logic
    plan.meals.forEach(meal => {
      meal.dishes.forEach(dish => {
        const recipe = recipes.find(r => r.name.toLowerCase() === dish.toLowerCase());
        if (recipe) {
          recipe.ingredients.forEach(ing => {
            const invItemIdx = updatedInventory.findIndex(item => item.name.toLowerCase() === ing.name.toLowerCase());
            if (invItemIdx > -1) {
              const deduction = ing.amount * (ing.conversionFactor || 1.0);
              
              // Reduce Reserved
              updatedInventory[invItemIdx].reserved = Math.max(0, (updatedInventory[invItemIdx].reserved || 0) - deduction);
              // Reduce Actual
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

    // Clear reservations for this plan
    reservations = reservations.filter(r => r.planId !== plan.id);
    
    const updated = { ...plan, isConsumed: true };
    mockFirestore.save(updated);
    
    localStorage.setItem('inventory', JSON.stringify(updatedInventory));
    localStorage.setItem('inventoryReservations', JSON.stringify(reservations));
    
    updatePlans();
    setSelectedPlan(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const deletePlan = (id: string) => {
     if(confirm("Are you sure you want to delete this scheduled plan?")) {
        mockFirestore.delete(id);
        updatePlans();
        setSelectedPlan(null);
     }
  }

  // File Upload & AI Parsing (Kept similar but polished)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: file.type } },
            { text: `Extract kitchen menu. The current year is ${currentYear}. If the document does not explicitly state the year, assume it is ${currentYear}. Return dates strictly in YYYY-MM-DD format. Output JSON array: [{date: "YYYY-MM-DD", meals: [{mealType: string, dishes: string[]}]}]` }
          ]
        },
        config: {
            responseMimeType: "application/json"
        }
      });
      
      const extractedData = JSON.parse(response.text || '[]');
      const newPlans: ProductionPlan[] = extractedData.map((item: any) => ({
        id: generateId(), 
        date: item.date || new Date().toISOString().split('T')[0], 
        type: 'production', 
        meals: (item.meals || []).map((m: any) => ({
          mealType: m.mealType || 'Meal', 
          dishes: Array.isArray(m.dishes) ? m.dishes : []
        })), 
        isApproved: false, 
        isConsumed: false, 
        createdAt: Date.now()
      }));

      setPendingPlans(newPlans);
      setView('REVIEW');
    } catch (error) {
      alert("Error processing menu. Please try again.");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // Calendar Helpers
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const renderCalendar = () => {
      const days = daysInMonth(currentMonth);
      const startDay = startDayOfMonth(currentMonth);
      const grid = [];
      
      // Empty slots for previous month
      for (let i = 0; i < startDay; i++) {
          grid.push(<div key={`empty-${i}`} className="bg-slate-50/30 border-r border-b border-slate-100 h-24 sm:h-32 md:h-40"></div>);
      }

      // Days
      for (let day = 1; day <= days; day++) {
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          const dateStr = getLocalDateString(date);
          const dayPlans = approvedPlans.filter(p => p.date === dateStr);
          const isToday = new Date().toDateString() === date.toDateString();

          grid.push(
              <div 
                key={day} 
                className={`border-r border-b border-slate-100 h-24 sm:h-32 md:h-40 p-2 relative group transition-all hover:bg-slate-50 cursor-pointer ${isToday ? 'bg-emerald-50/30' : 'bg-white'}`}
                onClick={() => {
                   if (dayPlans.length > 0) setSelectedPlan(dayPlans[0]);
                }}
              >
                 <div className="flex justify-between items-start">
                     <span className={`text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{day}</span>
                     {dayPlans.length > 0 && (
                         <span className={`text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${dayPlans[0].isConsumed ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
                            {dayPlans[0].isConsumed ? 'Done' : 'Active'}
                         </span>
                     )}
                 </div>
                 
                 <div className="mt-2 space-y-1 overflow-y-auto max-h-[50px] sm:max-h-[80px] custom-scrollbar">
                     {dayPlans.map(plan => (
                         <div key={plan.id} className="bg-white border border-slate-200 rounded-lg p-1.5 sm:p-2 shadow-sm hover:border-emerald-500 transition-colors">
                            {plan.meals.slice(0, 2).map((m, i) => (
                                <div key={i} className="flex gap-1 items-center mb-1">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.mealType.includes('Breakfast') ? 'bg-amber-400' : m.mealType.includes('Lunch') ? 'bg-blue-400' : 'bg-purple-400'}`}></div>
                                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-700 truncate w-full">{m.dishes[0]}</span>
                                </div>
                            ))}
                            {plan.meals.length > 2 && <span className="text-[8px] text-slate-400 block text-center">+ {plan.meals.length - 2} more</span>}
                         </div>
                     ))}
                 </div>
              </div>
          );
      }

      return grid;
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
             <CalendarCheck className="text-emerald-500" size={32} />
             Cycle Planner
          </h2>
          <p className="text-slate-500 font-medium mt-1">Manage production schedules and stock fulfillment logic.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {view !== 'CALENDAR' && (
            <button onClick={() => setView('CALENDAR')} className="px-5 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase transition-all shadow-sm">Back</button>
          )}
          <button onClick={() => setView('UPLOAD')} className="flex items-center gap-2 bg-slate-900 text-white px-7 py-2.5 rounded-xl shadow-lg font-bold text-xs uppercase transition-all"><Upload size={16} /> Import Plan</button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center">
            <Loader2 size={80} className="text-emerald-500 animate-spin mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-slate-900">Synchronizing Data</h3>
            <p className="text-slate-500 mt-2 font-semibold text-xs uppercase tracking-widest">Checking Recipe Database...</p>
          </div>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 sm:p-24 text-center">
          <CalendarIcon className="text-emerald-600 mx-auto mb-8" size={60} />
          <h3 className="text-3xl font-bold text-slate-900">Import Master Menu</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">Upload a PDF or Image of your weekly/monthly meal plan. The AI will extract dates and dishes automatically.</p>
          <input type="file" id="menu-upload" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
          <label htmlFor="menu-upload" className="mt-12 inline-flex items-center gap-3 cursor-pointer bg-slate-900 text-white px-12 py-5 rounded-2xl font-bold text-sm uppercase transition-all shadow-xl hover:bg-emerald-600">Select Document</label>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           {/* Same Review UI as before, just kept concise for this response block */}
           <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-center gap-4">
              <CheckCircle className="text-emerald-500" size={32} />
              <div>
                 <h3 className="text-lg font-bold text-emerald-900">Review Detected Plans</h3>
                 <p className="text-sm text-emerald-700">Please verify dates and dish names before approving. Approved plans will automatically reserve inventory.</p>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingPlans.map((plan, i) => (
                 <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="mb-4">
                       <label className="text-[10px] font-black uppercase text-slate-400">Date</label>
                       <input type="date" value={plan.date} onChange={(e) => {
                          const up = [...pendingPlans];
                          up[i].date = e.target.value;
                          setPendingPlans(up);
                       }} className="w-full font-bold text-lg bg-transparent border-b border-slate-200 focus:border-emerald-500 outline-none" />
                    </div>
                    <div className="space-y-4">
                       {plan.meals.map((m, mi) => (
                          <div key={mi} className="bg-slate-50 p-4 rounded-xl">
                             <input value={m.mealType} onChange={(e) => {
                                const up = [...pendingPlans];
                                up[i].meals[mi].mealType = e.target.value;
                                setPendingPlans(up);
                             }} className="font-bold text-sm bg-transparent border-none w-full text-emerald-700 mb-2" />
                             <div className="space-y-2">
                                {m.dishes.map((d, di) => (
                                   <input key={di} value={d} onChange={(e) => {
                                      const up = [...pendingPlans];
                                      up[i].meals[mi].dishes[di] = e.target.value;
                                      setPendingPlans(up);
                                   }} className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2" />
                                ))}
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              ))}
           </div>

           <button onClick={handleApproveAll} className="fixed bottom-10 right-10 bg-emerald-500 text-slate-900 px-10 py-5 rounded-3xl font-black uppercase shadow-2xl z-50 hover:scale-105 transition-transform flex items-center gap-2">
              <CheckCircle2 size={20} /> Approve All Plans
           </button>
        </div>
      )}

      {view === 'CALENDAR' && (
         <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/40">
               <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
               <div className="flex items-center bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-3 text-slate-400 hover:text-slate-900"><ChevronLeft size={20} /></button>
                  <button onClick={() => setCurrentMonth(new Date())} className="px-6 py-2 text-[10px] font-bold uppercase text-slate-500 hover:text-emerald-500">Today</button>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-3 text-slate-400 hover:text-slate-900"><ChevronRight size={20} /></button>
               </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-100 bg-white sticky top-0 z-10">
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-4 text-center text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
               ))}
            </div>

            <div className="grid grid-cols-7 bg-slate-50/30">
               {renderCalendar()}
            </div>
         </div>
      )}

      {/* Detail Modal */}
      {selectedPlan && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
               <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                  <div>
                     <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">Production Schedule</p>
                     <h3 className="text-2xl font-bold">{new Date(selectedPlan.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => deletePlan(selectedPlan.id)} className="p-3 bg-white/10 rounded-xl hover:bg-rose-500 transition-colors"><Trash2 size={20} /></button>
                     <button onClick={() => setSelectedPlan(null)} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"><X size={20} /></button>
                  </div>
               </div>

               <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                  {selectedPlan.isConsumed ? (
                     <div className="bg-slate-100 p-4 rounded-xl flex items-center gap-3 text-slate-500 text-xs font-bold">
                        <CheckCircle size={16} /> Production Completed & Stock Deducted
                     </div>
                  ) : (
                     <div className="bg-emerald-50 p-4 rounded-xl flex items-center gap-3 text-emerald-700 text-xs font-bold border border-emerald-100">
                        <Clock size={16} /> Scheduled - Stock Reserved
                     </div>
                  )}

                  {selectedPlan.meals.map((meal, i) => (
                     <div key={i} className="border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                        <h4 className="text-lg font-black text-slate-900 mb-3">{meal.mealType}</h4>
                        <div className="flex flex-wrap gap-2">
                           {meal.dishes.map((dish, di) => (
                              <div key={di} className="px-4 py-2 bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 border border-slate-200">
                                 {dish}
                              </div>
                           ))}
                        </div>
                     </div>
                  ))}
               </div>

               <div className="p-8 bg-slate-50 border-t border-slate-200 shrink-0">
                  {!selectedPlan.isConsumed ? (
                     <button onClick={() => toggleConsumption(selectedPlan.id)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2">
                        <CheckCircle2 size={18} /> Mark Production Complete
                     </button>
                  ) : (
                     <button disabled className="w-full bg-slate-200 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest cursor-not-allowed">
                        Production Closed
                     </button>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
