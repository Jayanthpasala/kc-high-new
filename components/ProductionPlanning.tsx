
import React, { useState, useEffect, useRef } from 'react';
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
  CalendarDays,
  ShoppingBag,
  ArrowRight,
  GripVertical,
  ListFilter,
  LayoutGrid,
  CalendarCheck,
  ClipboardList,
  PlusCircle
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

type ViewMode = 'MONTH' | 'AGENDA';

export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW'>('CALENDAR');
  const [viewMode, setViewMode] = useState<ViewMode>('MONTH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'plan' | 'consumption' | 'history'>('plan');
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const updatePlans = () => {
    setApprovedPlans(mockFirestore.getApproved().sort((a, b) => a.date.localeCompare(b.date)));
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
    let pendingRecipes: string[] = JSON.parse(localStorage.getItem('pendingRecipes') || '[]');

    approvedPlans.forEach(plan => {
      const dailyReqs: Record<string, { name: string, qty: number, unit: string }> = {};
      plan.meals.forEach(meal => {
        meal.dishes.forEach(dish => {
          const recipe = recipes.find(r => r.name.toLowerCase() === dish.toLowerCase());
          if (recipe) {
            recipe.ingredients.forEach(ing => {
              const key = ing.name.toLowerCase();
              if (!dailyReqs[key]) dailyReqs[key] = { name: ing.name, qty: 0, unit: ing.unit };
              // Use conversion factor if available for accurate procurement volume
              const volume = ing.amount * (ing.conversionFactor || 1.0);
              dailyReqs[key].qty += volume;
            });
          } else {
            if (!pendingRecipes.some(p => p.toLowerCase() === dish.toLowerCase())) {
              pendingRecipes.push(dish);
            }
          }
        });
      });

      Object.values(dailyReqs).forEach(req => {
        const invItem = inventory.find(i => i.name.toLowerCase() === req.name.toLowerCase());
        const currentStock = invItem ? invItem.quantity : 0;
        const currentReserved = invItem ? (invItem.reserved || 0) : 0;
        const available = currentStock - currentReserved;

        reservations.push({
          id: generateId(), planId: plan.id, date: plan.date, ingredientName: req.name, quantity: req.qty, unit: req.unit
        });

        if (invItem) {
          invItem.reserved = (invItem.reserved || 0) + req.qty;
          const availNow = invItem.quantity - invItem.reserved;
          if (availNow <= 0) invItem.status = 'out';
          else if (availNow < invItem.reorderLevel) invItem.status = 'low';
          else invItem.status = 'healthy';
        }

        if (req.qty > available) {
          const shortage = req.qty - available;
          const existingProc = procurements.find(p => p.ingredientName.toLowerCase() === req.name.toLowerCase() && p.status === 'pending');
          if (existingProc) {
            existingProc.requiredQty += req.qty;
            existingProc.shortageQty += shortage;
            if (new Date(plan.date) < new Date(existingProc.requiredByDate)) existingProc.requiredByDate = plan.date;
          } else {
            procurements.push({
              id: generateId(), ingredientName: req.name, requiredQty: req.qty, currentStock, shortageQty: shortage, unit: req.unit, requiredByDate: plan.date, status: 'pending', createdAt: Date.now()
            });
          }
        }
      });
    });

    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('inventoryReservations', JSON.stringify(reservations));
    localStorage.setItem('pendingProcurements', JSON.stringify(procurements));
    localStorage.setItem('pendingRecipes', JSON.stringify(pendingRecipes));
    window.dispatchEvent(new Event('storage'));
  };

  const handleDragStart = (e: React.DragEvent, planId: string) => {
    setDraggedPlanId(planId);
    e.dataTransfer.setData('planId', planId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    const planId = e.dataTransfer.getData('planId');
    if (!planId) return;

    const allPlans = mockFirestore.getAll();
    const planIndex = allPlans.findIndex(p => p.id === planId);
    
    if (planIndex > -1) {
      const updatedPlan = { ...allPlans[planIndex], date: targetDate };
      allPlans[planIndex] = updatedPlan;
      localStorage.setItem('productionPlans', JSON.stringify(allPlans));
      const reservations: InventoryReservation[] = JSON.parse(localStorage.getItem('inventoryReservations') || '[]');
      const updatedReservations = reservations.map(r => r.planId === planId ? { ...r, date: targetDate } : r);
      localStorage.setItem('inventoryReservations', JSON.stringify(updatedReservations));
      updatePlans();
      setDraggedPlanId(null);
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

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
      const extractedData = await extractMenuWithAI(base64, file.type);
      const safeData = Array.isArray(extractedData) ? extractedData : [];
      const newPlans: ProductionPlan[] = safeData.map((item: any) => {
        let finalDate = item.date || 'INVALID_DATE';
        return {
          id: generateId(), date: finalDate, type: 'production', meals: (item.meals || []).map((m: any) => ({
            mealType: m.mealType || 'Meal', dishes: Array.isArray(m.dishes) ? m.dishes : []
          })), isApproved: false, isConsumed: false, createdAt: Date.now()
        };
      });
      setPendingPlans(newPlans);
      setView('REVIEW');
    } catch (error) {
      alert("Error processing menu.");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
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
                // APPLY CONVERSION FACTOR FOR DEDUCTION
                const deduction = ing.amount * (ing.conversionFactor || 1.0);
                updatedInventory[invItemIdx].quantity = Math.max(0, updatedInventory[invItemIdx].quantity - deduction);
                updatedInventory[invItemIdx].reserved = Math.max(0, (updatedInventory[invItemIdx].reserved || 0) - deduction);
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
          <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm mr-2">
            <button onClick={() => setViewMode('MONTH')} className={`p-2 rounded-lg transition-all ${viewMode === 'MONTH' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
            <button onClick={() => setViewMode('AGENDA')} className={`p-2 rounded-lg transition-all ${viewMode === 'AGENDA' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><ListFilter size={18} /></button>
          </div>
          {view !== 'CALENDAR' && (
            <button onClick={() => setView('CALENDAR')} className="px-5 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase transition-all shadow-sm">Back</button>
          )}
          <button onClick={() => setView('UPLOAD')} className="flex items-center gap-2 bg-slate-900 text-white px-7 py-2.5 rounded-xl shadow-lg font-bold text-xs uppercase transition-all"><Upload size={16} /> Scan Cycle</button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center">
            <Loader2 size={80} className="text-emerald-500 animate-spin mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-slate-900">Synchronizing Data</h3>
            <p className="text-slate-500 mt-2 font-semibold text-xs uppercase tracking-widest">Applying conversion factors</p>
          </div>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-24 text-center">
          <CalendarIcon className="text-emerald-600 mx-auto mb-8" size={60} />
          <h3 className="text-3xl font-bold text-slate-900">Import Master Menu</h3>
          <input type="file" id="menu-upload" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
          <label htmlFor="menu-upload" className="mt-12 inline-flex items-center gap-3 cursor-pointer bg-slate-900 text-white px-12 py-5 rounded-2xl font-bold text-sm uppercase transition-all">Select Document <ArrowRight size={18} /></label>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-slate-900 p-8 rounded-[2rem] flex items-center justify-between border border-slate-800">
             <div className="flex items-center space-x-5">
               <AlertCircle className="text-emerald-400" size={24} />
               <h3 className="text-xl font-bold text-white uppercase tracking-tight">Final Verification Mode</h3>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingPlans.map((plan, planIdx) => (
              <div key={planIdx} className="bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col h-full">
                 <input type="date" value={plan.date} onChange={(e) => {
                   const updated = [...pendingPlans];
                   updated[planIdx].date = e.target.value;
                   setPendingPlans(updated);
                 }} className="font-bold text-lg p-2 bg-slate-50 rounded-lg border-none mb-6 outline-none text-slate-900" />
                 <div className="flex-1 space-y-5">
                   {plan.meals.map((m, mealIdx) => (
                     <div key={mealIdx} className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100">
                       <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">{m.mealType}</p>
                       <div className="space-y-3">
                         {m.dishes.map((d, dishIdx) => (
                           <p key={dishIdx} className="text-sm font-semibold text-slate-700 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>{d}</p>
                         ))}
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
            ))}
          </div>
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] flex gap-4">
             <button onClick={handleApproveAll} className="bg-emerald-500 text-slate-950 px-12 py-5 rounded-3xl font-bold uppercase text-sm shadow-2xl flex items-center gap-3 border-2 border-emerald-400">
               <CheckCircle2 size={18} /> Approve & Apply Factors
             </button>
          </div>
        </div>
      )}

      {view === 'CALENDAR' && viewMode === 'MONTH' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <div className="flex items-center bg-white p-2 rounded-2xl border border-slate-100">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-3 text-slate-400"><ChevronLeft size={20} /></button>
              <button onClick={() => setCurrentMonth(new Date())} className="px-6 py-2 text-[10px] font-bold uppercase text-slate-500">Today</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-3 text-slate-400"><ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100 bg-white">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-4 text-center text-[10px] font-bold text-slate-400 uppercase">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-slate-50/20">
            {calendarDays.map((date, i) => {
              const plan = date ? getPlanForDate(date) : null;
              const isToday = date?.toDateString() === new Date().toDateString();
              const dateStr = date ? getLocalDateString(date) : '';
              return (
                <div key={i} className={`min-h-[160px] border-r border-b border-slate-100/80 p-4 relative group cursor-pointer ${!date ? 'bg-slate-50/30' : 'bg-white hover:bg-emerald-50/20'}`} onDragOver={handleDragOver} onDrop={(e) => date && handleDrop(e, dateStr)} onClick={() => date && plan && setSelectedPlan(plan)}>
                  {date && (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-bold w-9 h-9 flex items-center justify-center rounded-xl ${isToday ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>{date.getDate()}</span>
                        {plan && <div className="p-2 rounded-xl text-white shadow-lg bg-emerald-500"><ChefHat size={14} /></div>}
                      </div>
                      {plan && (
                        <div draggable onDragStart={(e) => handleDragStart(e, plan.id)} className={`p-2 rounded-xl border border-slate-200 shadow-sm transition-all ${plan.isConsumed ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
                           <span className="text-[9px] font-black uppercase text-slate-900">Active Production</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative">
              <h3 className="text-3xl font-bold tracking-tight">{new Date(selectedPlan.date.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
              <button onClick={() => setSelectedPlan(null)} className="p-4 bg-white/10 text-white rounded-2xl"><X size={24} /></button>
            </div>
            <div className="flex border-b border-slate-100 bg-slate-50/50 px-6">
              <button onClick={() => setActiveTab('plan')} className={`px-8 py-5 text-xs font-bold uppercase transition-all border-b-2 ${activeTab === 'plan' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400'}`}>Items</button>
              <button onClick={() => setActiveTab('consumption')} className={`px-8 py-5 text-xs font-bold uppercase transition-all border-b-2 ${activeTab === 'consumption' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400'}`}>Consumption</button>
            </div>
            <div className="p-10 max-h-[50vh] overflow-y-auto">
              {activeTab === 'plan' && (
                <div className="space-y-6">
                  {selectedPlan.meals.map((meal, i) => (
                    <div key={i} className="bg-slate-50 p-7 rounded-[2rem] border border-slate-100 shadow-sm">
                      <h4 className="text-lg font-bold text-slate-900 mb-5">{meal.mealType}</h4>
                      <div className="flex flex-wrap gap-2.5">
                        {meal.dishes.map((dish, di) => (
                          <div key={di} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white border border-slate-100 text-slate-700">{dish}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'consumption' && (
                <div className="space-y-8 py-4">
                  <div className="bg-[#1e293b] text-white p-10 rounded-[2.5rem] flex items-center justify-between shadow-xl">
                    <h4 className="text-2xl font-bold">Mark for Service</h4>
                    <button onClick={() => toggleConsumption(selectedPlan.id)} className={`w-20 h-10 rounded-full transition-all duration-500 relative border-2 ${selectedPlan.isConsumed ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-700 border-slate-600'}`}>
                      <div className={`absolute top-1.5 w-6 h-6 rounded-full bg-white shadow-xl transition-all duration-500 ${selectedPlan.isConsumed ? 'left-12' : 'left-1.5'}`}></div>
                    </button>
                  </div>
                  {selectedPlan.isConsumed && (
                    <div className="p-10 border border-emerald-100 bg-emerald-50/50 rounded-[2.5rem] text-center">
                       <CheckCircle size={40} className="text-emerald-500 mx-auto mb-4" />
                       <h4 className="text-xl font-bold text-emerald-900">Inventory Settle Complete</h4>
                       <p className="text-emerald-700/70 text-sm mt-2">Deducted including wastage factors.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex justify-end">
               <button onClick={() => setSelectedPlan(null)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold text-xs uppercase shadow-xl">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
