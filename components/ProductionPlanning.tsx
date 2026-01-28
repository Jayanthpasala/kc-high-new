
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
  Clock,
  PartyPopper,
  Save,
  FileText
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, InventoryReservation, Meal } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

// Helper to strip code fences from AI response
const cleanJson = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

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

export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW'>('CALENDAR');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data State
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  
  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Day Detail Modal State
  const [dayPlan, setDayPlan] = useState<ProductionPlan | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'VIEW' | 'CREATE_MEAL' | 'CREATE_EVENT'>('VIEW');
  
  // Manual Entry Form State
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
    window.addEventListener('storage', updatePlans);
    return () => window.removeEventListener('storage', updatePlans);
  }, [view]);

  // --- ACTIONS ---

  const handleDayClick = (date: Date) => {
    const dateStr = getLocalDateString(date);
    const existing = approvedPlans.find(p => p.date === dateStr);
    
    setSelectedDate(date);
    setDayPlan(existing || null);
    setEntryMode(existing ? 'VIEW' : 'VIEW'); // Default to view, if empty view handles "Empty State"
    // Reset manual form
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
      isApproved: true, // Manual entry is auto-approved
      createdAt: Date.now()
    };

    if (entryMode === 'CREATE_EVENT' && !manualEventName) {
        alert("Please enter an event name.");
        return;
    }

    mockFirestore.save(newPlan);
    
    // Trigger reservations for meals if needed
    if (newPlan.type === 'production') {
        processReservations([newPlan]);
    }

    updatePlans();
    setIsDayModalOpen(false);
    window.dispatchEvent(new Event('storage'));
  };

  // Logic to process reservations for a list of plans
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
          } else {
             if (!pendingRecipes.includes(dish)) {
                pendingRecipes.push(dish);
             }
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
    setDayPlan(updated); // Update local modal state
    window.dispatchEvent(new Event('storage'));
  };

  const deletePlan = (id: string) => {
     if(confirm("Are you sure you want to delete this scheduled plan?")) {
        mockFirestore.delete(id);
        updatePlans();
        setIsDayModalOpen(false);
     }
  };

  // AI Document Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      // 1. Try to get Key from Environment or LocalStorage
      let apiKey = process.env.API_KEY || localStorage.getItem('GEMINI_API_KEY');

      // 2. If missing, attempt to use the built-in AI Studio helper (Project IDX/etc)
      if (!apiKey && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
        // Re-read env after potential selection (though Shim handles it on reload, we need it now)
        // Note: process.env won't update dynamically without page reload in most shims, 
        // so we assume the user selected it and proceed or reload.
      }

      // 3. Last Resort: Ask User Directly
      if (!apiKey && !process.env.API_KEY) {
         const userKey = prompt("Gemini AI Key is required for this feature.\n\nPlease enter your API Key (from aistudio.google.com):");
         if (userKey) {
             localStorage.setItem('GEMINI_API_KEY', userKey.trim());
             apiKey = userKey.trim();
             // Update process.env for this session
             window.process.env.API_KEY = userKey.trim();
         } else {
             alert("Operation cancelled. API Key is required to scan menus.");
             setIsProcessing(false);
             e.target.value = '';
             return;
         }
      }

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });
      
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
          {
            parts: [
              { inlineData: { data: base64, mimeType: file.type } },
              { text: `Analyze this menu image. It is a schedule table where:
                1. Columns represent dates/days (e.g., '27 Monday').
                2. Rows represent meal types (Breakfast, Lunch, Snacks/Dinner).
                
                CRITICAL INSTRUCTIONS:
                - Identify the month from headers like "Menu - Oct 27-31" or column headers.
                - Combine the current year (${currentYear}), the identified month, and the day number to form a valid date (YYYY-MM-DD).
                - Extract all dishes listed for each meal type on each day.
                - Return the data as a JSON array.
                ` }
            ]
          }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
                  meals: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        mealType: { type: Type.STRING, description: "e.g. Breakfast, Lunch, Dinner" },
                        dishes: { 
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        }
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
      
      const text = response.text || '[]';
      console.log("AI Response:", text); // Debug log

      const cleanText = cleanJson(text);
      let extractedData;
      try {
          extractedData = JSON.parse(cleanText);
      } catch (parseError) {
          console.error("JSON Parse Error:", parseError, cleanText);
          throw new Error("Failed to parse AI response. The menu structure might be too complex.");
      }
      
      if (!Array.isArray(extractedData)) {
          throw new Error("Invalid data format returned by AI.");
      }

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
    } catch (error: any) {
      console.error("AI Processing Error:", error);
      alert(`Error processing menu: ${error.message || "Please check the image and try again."}`);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // Helpers
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const renderCalendar = () => {
      const days = daysInMonth(currentMonth);
      const startDay = startDayOfMonth(currentMonth);
      const grid = [];
      
      // Empty slots
      for (let i = 0; i < startDay; i++) {
          grid.push(<div key={`empty-${i}`} className="bg-slate-50/30 border-r border-b border-slate-100 h-24 sm:h-32 md:h-40"></div>);
      }

      // Days
      for (let day = 1; day <= days; day++) {
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
          const dateStr = getLocalDateString(date);
          const dayPlans = approvedPlans.filter(p => p.date === dateStr);
          const isToday = new Date().toDateString() === date.toDateString();
          const hasPlan = dayPlans.length > 0;
          const plan = dayPlans[0]; // Assuming 1 plan per day for simplicity

          grid.push(
              <div 
                key={day} 
                className={`border-r border-b border-slate-100 h-24 sm:h-32 md:h-40 p-2 relative group transition-all hover:bg-slate-50 cursor-pointer ${isToday ? 'bg-emerald-50/30' : 'bg-white'}`}
                onClick={() => handleDayClick(date)}
              >
                 <div className="flex justify-between items-start">
                     <span className={`text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{day}</span>
                     {hasPlan && (
                         <span className={`text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                             plan.type === 'event' 
                               ? 'bg-purple-100 text-purple-600' 
                               : plan.isConsumed 
                                 ? 'bg-slate-200 text-slate-500' 
                                 : 'bg-emerald-100 text-emerald-600'
                         }`}>
                            {plan.type === 'event' ? 'Event' : plan.isConsumed ? 'Done' : 'Active'}
                         </span>
                     )}
                 </div>
                 
                 {hasPlan && (
                     <div className="mt-2 space-y-1">
                         {plan.type === 'event' ? (
                             <div className="bg-purple-50 border border-purple-100 rounded-lg p-1.5 shadow-sm">
                                 <p className="text-[9px] font-bold text-purple-700 truncate">{plan.eventName}</p>
                             </div>
                         ) : (
                             <div className="space-y-1 overflow-y-auto max-h-[50px] custom-scrollbar">
                                {plan.meals.slice(0, 2).map((m, i) => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-lg p-1 px-2 shadow-sm flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.mealType.includes('Breakfast') ? 'bg-amber-400' : m.mealType.includes('Lunch') ? 'bg-blue-400' : 'bg-slate-400'}`}></div>
                                        <span className="text-[8px] font-bold text-slate-600 truncate">{m.dishes[0] || 'TBD'}</span>
                                    </div>
                                ))}
                                {plan.meals.length > 2 && <span className="text-[8px] text-slate-400 block text-center">+ more</span>}
                             </div>
                         )}
                     </div>
                 )}
              </div>
          );
      }
      return grid;
  };

  // --- RENDER HELPERS FOR MODAL ---
  const renderEntryForm = () => {
     if (entryMode === 'CREATE_MEAL') {
         return (
             <div className="space-y-6">
                 {manualMeals.map((meal, idx) => (
                     <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <h5 className="text-xs font-black uppercase text-slate-400 mb-2">{meal.mealType}</h5>
                         <input 
                           type="text" 
                           placeholder="Dish Name (e.g. Chicken Curry)" 
                           className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 transition-colors"
                           value={meal.dishes[0]}
                           onChange={(e) => {
                               const updated = [...manualMeals];
                               updated[idx].dishes[0] = e.target.value;
                               setManualMeals(updated);
                           }}
                         />
                     </div>
                 ))}
                 <div className="flex gap-3 pt-4">
                     <button onClick={() => setEntryMode('VIEW')} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">Cancel</button>
                     <button onClick={handleSaveManualPlan} className="flex-1 bg-emerald-500 text-slate-900 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-colors shadow-lg">Save Meal Plan</button>
                 </div>
             </div>
         );
     }
     if (entryMode === 'CREATE_EVENT') {
         return (
             <div className="space-y-6">
                 <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400">Event Title</label>
                     <input 
                       type="text" 
                       placeholder="e.g. Wedding Banquet, Staff Holiday" 
                       className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold text-slate-900 outline-none focus:border-purple-500 transition-colors"
                       value={manualEventName}
                       onChange={(e) => setManualEventName(e.target.value)}
                     />
                 </div>
                 <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-slate-400">Notes / Details</label>
                     <textarea 
                       placeholder="Additional details..." 
                       className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium text-slate-900 outline-none focus:border-purple-500 transition-colors resize-none h-32"
                       value={manualNotes}
                       onChange={(e) => setManualNotes(e.target.value)}
                     />
                 </div>
                 <div className="flex gap-3 pt-4">
                     <button onClick={() => setEntryMode('VIEW')} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">Cancel</button>
                     <button onClick={handleSaveManualPlan} className="flex-1 bg-purple-500 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-purple-600 transition-colors shadow-lg">Save Event</button>
                 </div>
             </div>
         );
     }
     return null;
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
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
          <button onClick={() => setView('UPLOAD')} className="flex items-center gap-2 bg-slate-900 text-white px-7 py-2.5 rounded-xl shadow-lg font-bold text-xs uppercase transition-all"><Upload size={16} /> Import Menu</button>
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

      {/* Upload View */}
      {view === 'UPLOAD' && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 sm:p-24 text-center">
          <CalendarIcon className="text-emerald-600 mx-auto mb-8" size={60} />
          <h3 className="text-3xl font-bold text-slate-900">Import Master Menu</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">Upload a PDF or Image of your weekly/monthly meal plan. The AI will extract dates and dishes automatically.</p>
          <input type="file" id="menu-upload" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
          <label htmlFor="menu-upload" className="mt-12 inline-flex items-center gap-3 cursor-pointer bg-slate-900 text-white px-12 py-5 rounded-2xl font-bold text-sm uppercase transition-all shadow-xl hover:bg-emerald-600">Select Document</label>
        </div>
      )}

      {/* Review View */}
      {view === 'REVIEW' && (
        <div className="space-y-8 animate-in fade-in duration-500">
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

           <button onClick={handleApproveAllPending} className="fixed bottom-10 right-10 bg-emerald-500 text-slate-900 px-10 py-5 rounded-3xl font-black uppercase shadow-2xl z-50 hover:scale-105 transition-transform flex items-center gap-2">
              <CheckCircle2 size={20} /> Approve All Plans
           </button>
        </div>
      )}

      {/* Calendar View */}
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

      {/* DAY SNIPPET MODAL (Day Detail Inspector) */}
      {isDayModalOpen && selectedDate && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[85vh]">
               <div className="bg-slate-900 p-8 text-white shrink-0 flex justify-between items-center">
                  <div>
                     <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">Day Inspector</p>
                     <h3 className="text-2xl font-bold">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                  </div>
                  <button onClick={() => setIsDayModalOpen(false)} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"><X size={20} /></button>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white space-y-6">
                  {/* VIEW MODE */}
                  {entryMode === 'VIEW' && (
                      <>
                        {dayPlan ? (
                            <div className="space-y-6">
                                {/* Plan Header */}
                                {dayPlan.type === 'event' ? (
                                    <div className="bg-purple-50 p-6 rounded-[2rem] text-center border-2 border-purple-100">
                                        <PartyPopper size={40} className="text-purple-500 mx-auto mb-3" />
                                        <h4 className="text-xl font-black text-purple-900">{dayPlan.eventName}</h4>
                                        <p className="text-sm font-medium text-purple-700 mt-2">{dayPlan.notes || 'No additional details.'}</p>
                                    </div>
                                ) : (
                                    <div className={`p-6 rounded-[2rem] text-center border-2 ${dayPlan.isConsumed ? 'bg-slate-100 border-slate-200' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <ChefHat size={40} className={`mx-auto mb-3 ${dayPlan.isConsumed ? 'text-slate-400' : 'text-emerald-500'}`} />
                                        <h4 className={`text-xl font-black ${dayPlan.isConsumed ? 'text-slate-600' : 'text-emerald-900'}`}>Production Schedule</h4>
                                        <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-2 ${dayPlan.isConsumed ? 'bg-slate-200 text-slate-500' : 'bg-emerald-200 text-emerald-800'}`}>
                                            {dayPlan.isConsumed ? 'Status: Consumed' : 'Status: Active'}
                                        </div>
                                    </div>
                                )}

                                {/* Plan Content */}
                                {dayPlan.type !== 'event' && (
                                    <div className="space-y-4">
                                        {dayPlan.meals.map((meal, i) => (
                                            <div key={i} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{meal.mealType}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {meal.dishes.map((dish, d) => (
                                                        <span key={d} className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700">{dish}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-3 pt-4">
                                    {!dayPlan.isConsumed && dayPlan.type === 'production' && (
                                        <button onClick={() => toggleConsumption(dayPlan.id)} className="col-span-2 bg-slate-900 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 transition-colors shadow-lg">Mark Consumed</button>
                                    )}
                                    <button onClick={() => deletePlan(dayPlan.id)} className="col-span-2 py-3 text-rose-500 hover:bg-rose-50 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-transparent hover:border-rose-100">
                                        <Trash2 size={16} /> Delete Entry
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-slate-100">
                                    <CalendarCheck size={32} className="text-slate-300" />
                                </div>
                                <h4 className="text-lg font-bold text-slate-900">Nothing Planned</h4>
                                <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">No production cycles or events are scheduled for this date.</p>
                                
                                <div className="grid grid-cols-2 gap-4 mt-8">
                                    <button onClick={() => setEntryMode('CREATE_MEAL')} className="p-4 rounded-2xl bg-white border-2 border-slate-100 hover:border-emerald-500 hover:text-emerald-600 transition-all group flex flex-col items-center gap-2 shadow-sm">
                                        <ChefHat size={24} className="text-slate-400 group-hover:text-emerald-500" />
                                        <span className="font-black text-[10px] uppercase tracking-widest">Add Meal Plan</span>
                                    </button>
                                    <button onClick={() => setEntryMode('CREATE_EVENT')} className="p-4 rounded-2xl bg-white border-2 border-slate-100 hover:border-purple-500 hover:text-purple-600 transition-all group flex flex-col items-center gap-2 shadow-sm">
                                        <PartyPopper size={24} className="text-slate-400 group-hover:text-purple-500" />
                                        <span className="font-black text-[10px] uppercase tracking-widest">Add Event</span>
                                    </button>
                                </div>
                            </div>
                        )}
                      </>
                  )}

                  {/* CREATE MODES */}
                  {entryMode !== 'VIEW' && renderEntryForm()}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
