
import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  CheckCircle2, 
  Calendar as CalendarIcon, 
  Loader2, 
  Plus, 
  Trash2, 
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  History,
  ChefHat,
  Star,
  Palmtree,
  Zap,
  CheckCircle,
  Circle,
  CalendarDays,
  ShoppingBag
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { PageId, ProductionPlan, Meal, PlanType, Recipe, InventoryItem, InventoryReservation, PendingProcurement } from '../types';

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

export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW'>('CALENDAR');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'plan' | 'consumption' | 'history'>('plan');

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const updatePlans = () => {
    setApprovedPlans(mockFirestore.getApproved());
  };

  useEffect(() => {
    updatePlans();
    window.addEventListener('storage', updatePlans);
    return () => window.removeEventListener('storage', updatePlans);
  }, [view]);

  // --- AUTOMATION ENGINE ---
  const runProcurementAutomation = (approvedPlans: ProductionPlan[]) => {
    const recipes: Recipe[] = JSON.parse(localStorage.getItem('recipes') || '[]');
    const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
    let reservations: InventoryReservation[] = JSON.parse(localStorage.getItem('inventoryReservations') || '[]');
    let procurements: PendingProcurement[] = JSON.parse(localStorage.getItem('pendingProcurements') || '[]');

    approvedPlans.forEach(plan => {
      // Aggregate ingredients for this specific plan
      const dailyReqs: Record<string, { name: string, qty: number, unit: string }> = {};

      plan.meals.forEach(meal => {
        meal.dishes.forEach(dish => {
          const recipe = recipes.find(r => r.name.toLowerCase() === dish.toLowerCase());
          if (recipe) {
            recipe.ingredients.forEach(ing => {
              const key = ing.name.toLowerCase();
              if (!dailyReqs[key]) {
                dailyReqs[key] = { name: ing.name, qty: 0, unit: ing.unit };
              }
              dailyReqs[key].qty += ing.amount;
            });
          }
        });
      });

      // Step 3 & 4: Check stock and reserve/procure
      Object.values(dailyReqs).forEach(req => {
        const invItem = inventory.find(i => i.name.toLowerCase() === req.name.toLowerCase());
        const currentStock = invItem ? invItem.quantity : 0;
        const currentReserved = invItem ? (invItem.reserved || 0) : 0;
        const available = currentStock - currentReserved;

        // Create Reservation Document
        reservations.push({
          id: generateId(),
          planId: plan.id,
          date: plan.date,
          ingredientName: req.name,
          quantity: req.qty,
          unit: req.unit
        });

        // Update Inventory Object's reserved field for UI
        if (invItem) {
          invItem.reserved = (invItem.reserved || 0) + req.qty;
        }

        // Check if shortage exists
        if (req.qty > available) {
          const shortage = req.qty - available;
          
          // Check for existing procurement entry to avoid duplicates
          const existingProc = procurements.find(p => p.ingredientName.toLowerCase() === req.name.toLowerCase() && p.status === 'pending');
          
          if (existingProc) {
            existingProc.requiredQty += req.qty;
            existingProc.shortageQty += shortage;
            // Update requiredByDate if this one is earlier
            if (new Date(plan.date) < new Date(existingProc.requiredByDate)) {
                existingProc.requiredByDate = plan.date;
            }
          } else {
            procurements.push({
              id: generateId(),
              ingredientName: req.name,
              requiredQty: req.qty,
              currentStock: currentStock,
              shortageQty: shortage,
              unit: req.unit,
              requiredByDate: plan.date,
              status: 'pending',
              createdAt: Date.now()
            });
          }
        }
      });
    });

    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('inventoryReservations', JSON.stringify(reservations));
    localStorage.setItem('pendingProcurements', JSON.stringify(procurements));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      const extractedData = await extractMenuWithAI(base64, file.type);
      const safeData = Array.isArray(extractedData) ? extractedData : [];
      const newPlans: ProductionPlan[] = safeData.map((item: any) => ({
        id: generateId(),
        date: item.date || 'INVALID_DATE',
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
      alert("Error processing menu.");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const extractMenuWithAI = async (base64: string, mimeType: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Extract kitchen menu. Output JSON array: [{date: "YYYY-MM-DD", meals: [{mealType: string, dishes: string[]}]}]` }
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
    return JSON.parse(response.text || '[]');
  };

  const handleApproveAll = () => {
    const approvedBatch: ProductionPlan[] = [];
    pendingPlans.forEach(plan => {
      const fullPlan = { ...plan, isApproved: true };
      mockFirestore.save(fullPlan);
      approvedBatch.push(fullPlan);
    });

    // Run the automated requirement and procurement logic
    runProcurementAutomation(approvedBatch);
    
    setPendingPlans([]);
    updatePlans();
    setView('CALENDAR');
    window.dispatchEvent(new Event('storage'));
  };

  const toggleConsumption = (id: string) => {
    const plan = approvedPlans.find(p => p.id === id);
    if (!plan) return;
    const newIsConsumed = !plan.isConsumed;

    if (newIsConsumed) {
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
                // Deduct physical quantity
                updatedInventory[invItemIdx].quantity = Math.max(0, updatedInventory[invItemIdx].quantity - ing.amount);
                // Reduce reservation count
                updatedInventory[invItemIdx].reserved = Math.max(0, (updatedInventory[invItemIdx].reserved || 0) - ing.amount);
                
                // Update item status
                const item = updatedInventory[invItemIdx];
                if (item.quantity <= 0) item.status = 'out';
                else if (item.quantity <= item.parLevel) item.status = 'low';
                else item.status = 'healthy';
              }
            });
          }
        });
      });

      // Step 6: Clear associated reservations
      reservations = reservations.filter(r => r.planId !== plan.id);

      localStorage.setItem('inventory', JSON.stringify(updatedInventory));
      localStorage.setItem('inventoryReservations', JSON.stringify(reservations));
    }

    const updated = { ...plan, isConsumed: newIsConsumed };
    mockFirestore.save(updated);
    updatePlans();
    setSelectedPlan(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const calendarDays = [];
  const daysCount = daysInMonth(currentMonth);
  const startDay = startDayOfMonth(currentMonth);
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysCount; i++) calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
  
  const getPlanForDate = (date: Date) => {
    const dateStr = getLocalDateString(date);
    return approvedPlans.find(p => p.date === dateStr);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <CalendarDays className="text-emerald-500" size={32} />
             Kitchen Calendar
          </h2>
          <p className="text-slate-500 font-semibold mt-1">Automated ingredient planning & meal scheduling.</p>
        </div>
        <div className="flex space-x-3">
          {view !== 'CALENDAR' && (
            <button onClick={() => setView('CALENDAR')} className="px-6 py-3 text-slate-700 bg-white border-2 border-slate-200 rounded-xl font-bold transition-all">Back</button>
          )}
          <button onClick={() => setView('UPLOAD')} className="flex items-center space-x-2 bg-slate-900 text-white px-8 py-3 rounded-xl shadow-lg font-black transition-all">
            <Upload size={20} /><span>Bulk Scan</span>
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-4 border-emerald-500">
            <Loader2 size={48} className="text-emerald-500 animate-spin mx-auto mb-6" />
            <h3 className="text-2xl font-black text-slate-900">Automation Engine...</h3>
            <p className="text-slate-500 mt-2 font-bold text-xs uppercase tracking-widest">Calculating Stock & Procurement</p>
          </div>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="bg-white border-4 border-dashed border-slate-200 rounded-[3rem] p-20 text-center hover:border-emerald-500 transition-all bg-slate-50/30">
          <div className="bg-emerald-100 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8"><CalendarIcon className="text-emerald-600" size={40} /></div>
          <h3 className="text-3xl font-black text-slate-900">Upload Menu Plan</h3>
          <p className="text-slate-600 max-w-md mx-auto mt-4 font-bold text-lg leading-relaxed">System will auto-link recipes and calculate total ingredient requirements.</p>
          <input type="file" id="menu-upload" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
          <label htmlFor="menu-upload" className="mt-10 inline-block cursor-pointer bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-lg hover:bg-emerald-600 transition-all shadow-xl">Start Scan</label>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          <div className="bg-slate-900 text-white p-8 rounded-[2rem] flex items-center justify-between shadow-xl">
             <div className="flex items-center space-x-5"><AlertCircle className="text-emerald-400" size={32} /><p className="font-black text-xl uppercase tracking-tight">Requirement Forecast Review</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {pendingPlans.map((plan, idx) => (
              <div key={idx} className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm">
                 <input type="date" value={plan.date} onChange={(e) => {
                   const updated = [...pendingPlans];
                   updated[idx].date = e.target.value;
                   setPendingPlans(updated);
                 }} className="font-black text-lg mb-4 p-2 border-b-2 border-slate-200 outline-none w-full" />
                 {plan.meals.map((m, mi) => (
                   <div key={mi} className="mb-4">
                     <p className="text-xs font-black text-emerald-600 uppercase mb-2">{m.mealType}</p>
                     <ul className="space-y-1">{m.dishes.map((d, di) => <li key={di} className="text-sm font-bold text-slate-700">• {d}</li>)}</ul>
                   </div>
                 ))}
              </div>
            ))}
          </div>
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60]">
             <button onClick={handleApproveAll} className="bg-emerald-500 text-slate-900 px-12 py-5 rounded-2xl font-black uppercase shadow-2xl hover:scale-105 transition-all flex items-center gap-3">
               <CheckCircle2 /> Approve & Plan Procurement
             </button>
          </div>
        </div>
      )}

      {view === 'CALENDAR' && (
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center bg-slate-50/40 gap-6">
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <div className="flex items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-3 hover:bg-slate-50 rounded-xl transition-all"><ChevronLeft size={24} /></button>
              <button onClick={() => setCurrentMonth(new Date())} className="px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-800">Today</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-3 hover:bg-slate-50 rounded-xl transition-all"><ChevronRight size={24} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100 bg-white">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (<div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{day}</div>))}
          </div>
          <div className="grid grid-cols-7 bg-slate-50/20">
            {calendarDays.map((date, i) => {
              const plan = date ? getPlanForDate(date) : null;
              const isToday = date?.toDateString() === new Date().toDateString();
              let bgColor = 'bg-white';
              if (plan?.isConsumed) bgColor = 'bg-slate-100';
              return (
                <div key={i} className={`min-h-[160px] border-r border-b border-slate-100 p-4 transition-all relative group cursor-pointer ${!date ? 'bg-slate-50/10' : `${bgColor} hover:brightness-95`}`}
                  onClick={() => date && plan && setSelectedPlan(plan)}>
                  {date && (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-black w-8 h-8 flex items-center justify-center rounded-xl ${isToday ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 group-hover:text-slate-900'}`}>{date.getDate()}</span>
                        {plan && <div className="p-1.5 rounded-lg text-white shadow-sm bg-emerald-500"><ChefHat size={12} /></div>}
                      </div>
                      <div className="space-y-1">
                        {plan?.meals.slice(0, 3).map((m, idx) => (
                          <div key={idx} className="text-[9px] font-black uppercase text-slate-500 truncate flex items-center"><span className="w-1 h-3 mr-1 rounded-full bg-emerald-500"></span>{m.mealType}</div>
                        ))}
                        {plan?.isConsumed && <div className="mt-2 flex items-center text-[10px] font-black text-emerald-600 uppercase"><CheckCircle size={12} className="mr-1" /> Prepared</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
              <h3 className="text-4xl font-black">{new Date(selectedPlan.date.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
              <button onClick={() => setSelectedPlan(null)} className="p-3 bg-white/10 hover:bg-rose-500 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <div className="flex border-b-2 border-slate-100 bg-slate-50 px-6">
              {[{ id: 'plan', label: 'Production', icon: <ChefHat size={16} /> }, { id: 'consumption', label: 'Prep Confirmation', icon: <Zap size={16} /> }].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-4 flex items-center space-x-2 text-xs font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400'}`}>
                  {tab.icon}<span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="p-10 max-h-[50vh] overflow-y-auto">
              {activeTab === 'plan' && (
                <div className="space-y-8">
                  {selectedPlan.meals.map((meal, i) => (
                    <div key={i} className="bg-slate-50 p-6 rounded-[2rem] border-2 border-white shadow-sm">
                      <h4 className="text-xl font-black text-slate-800 mb-4">{meal.mealType}</h4>
                      <div className="flex flex-wrap gap-2">{meal.dishes.map((dish, di) => (<div key={di} className="px-4 py-2 rounded-xl text-sm font-bold shadow-sm bg-white border border-slate-100">{dish}</div>))}</div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'consumption' && (
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-8 rounded-[2rem] flex items-center justify-between">
                    <div><h4 className="text-2xl font-black">Mark as Prepared</h4><p className="text-slate-400 font-bold">Confirms usage of reserved ingredients.</p></div>
                    <button onClick={() => toggleConsumption(selectedPlan.id)} className={`w-16 h-8 rounded-full transition-all relative border-2 ${selectedPlan.isConsumed ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700'}`}>
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${selectedPlan.isConsumed ? 'left-9' : 'left-1'}`}></div>
                    </button>
                  </div>
                  {selectedPlan.isConsumed && <div className="p-8 border-2 border-emerald-100 bg-emerald-50 rounded-[2rem] flex items-center text-emerald-700 font-black uppercase text-sm"><CheckCircle className="mr-2" /> Stock Deducted & Reservation Cleared</div>}
                </div>
              )}
            </div>
            <div className="p-10 border-t-2 border-slate-100 bg-slate-50 flex justify-end">
               <button onClick={() => setSelectedPlan(null)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
