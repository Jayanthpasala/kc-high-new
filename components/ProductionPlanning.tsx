import React, { useState, useEffect, useMemo } from 'react';
import { 
  Upload, 
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
  FileText,
  Download,
  BarChart3,
  History as HistoryIcon,
  ExternalLink,
  Search
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, Meal, ConsumptionRecord } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, writeBatch, doc, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { jsPDF } from 'jspdf';

const generateId = () => Math.random().toString(36).substring(2, 11);

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
    throw new Error("Data formatting mismatch.");
  }
};

export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW' | 'HISTORY'>('CALENDAR');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
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

  const generatePDFReport = (plan: ProductionPlan) => {
    const doc = new jsPDF();
    const totalPax = Object.values(plan.headcounts || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    
    doc.setFontSize(22);
    doc.text("Production Report", 20, 30);
    doc.setFontSize(12);
    doc.text(`Date: ${plan.date}`, 20, 40);
    doc.text(`Total Attendance: ${totalPax} PAX`, 20, 47);
    
    let y = 60;
    plan.meals.forEach(meal => {
      doc.setFont("helvetica", "bold");
      doc.text(meal.mealType.toUpperCase(), 20, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      (meal.dishDetails || []).forEach(dish => {
        doc.text(`- ${dish.name}: ${dish.amountCooked || 0}kg cooked`, 25, y);
        y += 7;
      });
      y += 5;
    });

    doc.text("Status: Finalized & Stock Deducted", 20, y + 10);
    doc.save(`KMS-Report-${plan.date}.pdf`);
  };

  const generatePeriodSummary = (type: 'WEEK' | 'MONTH') => {
    const doc = new jsPDF();
    const title = type === 'WEEK' ? "Weekly Production Summary" : "Monthly Production Summary";
    doc.setFontSize(22);
    doc.text(title, 20, 30);
    
    const now = new Date();
    const filtered = approvedPlans.filter(p => {
      const pDate = new Date(p.date);
      if (type === 'MONTH') return pDate.getMonth() === currentMonth.getMonth() && pDate.getFullYear() === currentMonth.getFullYear();
      // Simple week filter for current 7 days
      const diff = Math.abs(now.getTime() - pDate.getTime());
      return diff < (7 * 24 * 60 * 60 * 1000);
    });

    let y = 50;
    let grandPax = 0;
    filtered.forEach(p => {
      const pax = Object.values(p.headcounts || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      grandPax += pax;
      doc.text(`${p.date}: ${pax} Total PAX`, 20, y);
      y += 7;
    });

    doc.text(`Total Period Volume: ${grandPax} PAX`, 20, y + 10);
    doc.save(`KMS-Summary-${type}-${new Date().toISOString().split('T')[0]}.pdf`);
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
      console.error("Cloud Error", e);
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
      alert("Inventory synced successfully.");
    } catch (e) {
      console.error(e);
    } finally { setIsProcessing(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const presentYear = new Date().getFullYear();
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
            { text: `Extract menu for year ${presentYear}. JSON format only.` }
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
      setPendingPlans(extracted.map((d: any) => ({
        id: generateId(),
        date: d.date,
        meals: d.meals.map((m: any) => ({ ...m, dishDetails: (m.dishes || []).map((dn: string) => ({ name: dn, amountCooked: 0 })) })),
        headcounts: d.headcounts || { teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0 },
        isApproved: false,
        createdAt: Date.now()
      })));
      setView('REVIEW');
    } catch (err) {
      alert("Upload error.");
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-200 pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <CalendarCheck className="text-emerald-500" size={32} /> Production Hub
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Operational Menu & Audit History</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setView('HISTORY')} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50">
            <HistoryIcon size={18} /> Audit History
          </button>
          <button onClick={() => setView('UPLOAD')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-emerald-600 transition-all">
            <Upload size={18} /> Import Schedule
          </button>
          {view !== 'CALENDAR' && (
            <button onClick={() => setView('CALENDAR')} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <CalendarIcon size={18} /> Calendar
            </button>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-sm w-full">
            <Loader2 className="animate-spin mx-auto text-emerald-500 mb-6" size={64} />
            <h3 className="text-2xl font-black">Syncing Cloud...</h3>
          </div>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="max-w-4xl mx-auto space-y-12 py-10 animate-in slide-in-from-bottom-10">
           <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-sm"><FileUp size={48} /></div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">AI Menu Integration</h3>
           </div>
           <div className="relative group">
              <input type="file" id="schedule-upload" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
              <label htmlFor="schedule-upload" className="flex flex-col items-center justify-center border-4 border-dashed border-slate-200 rounded-[4rem] p-24 bg-white hover:border-emerald-500 hover:bg-emerald-50/30 cursor-pointer">
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Drop Document or Click</p>
              </label>
           </div>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-10 animate-in fade-in">
           <h3 className="text-2xl font-black text-slate-900 uppercase">Review & Edit Imported Plans</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {pendingPlans.map((plan, pi) => (
                <div key={pi} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm relative group">
                   <h4 className="font-black text-xl mb-6">{new Date(plan.date).toDateString()}</h4>
                   <div className="space-y-4">
                     {plan.meals.map((m, mi) => (
                       <div key={mi} className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[9px] font-black text-emerald-600 uppercase mb-2">{m.mealType}</p>
                          <div className="space-y-1">
                             {m.dishes.map((d, di) => <div key={di} className="text-xs font-bold text-slate-700">• {d}</div>)}
                          </div>
                       </div>
                     ))}
                   </div>
                   <div className="mt-6 flex gap-2">
                     <button onClick={() => handleDayClick(new Date(plan.date), plan)} className="flex-1 bg-slate-100 p-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-900 hover:text-white transition-all">Edit Details</button>
                     <button onClick={() => setPendingPlans(pendingPlans.filter((_, i) => i !== pi))} className="p-3 text-slate-300 hover:text-rose-500"><X size={16} /></button>
                   </div>
                </div>
              ))}
           </div>
           <button onClick={async () => {
              const batch = writeBatch(db);
              pendingPlans.forEach(p => batch.set(doc(db, "productionPlans", p.id), { ...p, isApproved: true }));
              await batch.commit();
              setPendingPlans([]);
              setView('CALENDAR');
           }} className="bg-slate-900 text-white px-12 py-5 rounded-3xl font-black uppercase text-xs shadow-2xl hover:bg-emerald-600 transition-all">Commit All Approved Plans</button>
        </div>
      )}

      {view === 'HISTORY' && (
        <div className="space-y-10 animate-in fade-in">
           <div className="flex justify-between items-center">
             <h3 className="text-2xl font-black text-slate-900 uppercase">Archived Production Logs</h3>
             <div className="flex gap-4">
                <button onClick={() => generatePeriodSummary('WEEK')} className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-emerald-100 shadow-sm flex items-center gap-2 hover:bg-emerald-100">
                  <BarChart3 size={16} /> Weekly Summary
                </button>
                <button onClick={() => generatePeriodSummary('MONTH')} className="bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-blue-100 shadow-sm flex items-center gap-2 hover:bg-blue-100">
                  <BarChart3 size={16} /> Monthly Summary
                </button>
             </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {approvedPlans.filter(p => p.isConsumed).sort((a,b) => b.date.localeCompare(a.date)).map(plan => (
                <div key={plan.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm relative hover:border-emerald-500 transition-all group">
                   <div className="flex justify-between items-start mb-6">
                      <h4 className="font-black text-xl">{new Date(plan.date).toDateString()}</h4>
                      <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg"><CheckCircle size={16} /></div>
                   </div>
                   <div className="space-y-4 mb-6">
                      {plan.meals.slice(0, 2).map((m, mi) => (
                        <div key={mi} className="text-xs font-bold text-slate-500 tracking-tight flex items-center gap-2">
                           <div className="w-1 h-1 bg-slate-300 rounded-full"></div> {m.dishes[0] || 'Menu Set'}
                        </div>
                      ))}
                   </div>
                   <div className="flex gap-2 border-t pt-6">
                      <button onClick={() => handleDayClick(new Date(plan.date), plan)} className="flex-1 bg-slate-50 p-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-900 hover:text-white transition-all">Review Log</button>
                      <button onClick={() => generatePDFReport(plan)} className="p-3 text-slate-400 hover:text-emerald-500 transition-colors" title="Download Audit Report"><Download size={18} /></button>
                   </div>
                </div>
              ))}
           </div>
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
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const days = new Date(year, month + 1, 0).getDate();
                const start = new Date(year, month, 1).getDay();
                const grid = [];
                for (let i = 0; i < start; i++) grid.push(<div key={`e-${i}`} className="bg-slate-50/20 border-r border-b border-slate-100 h-32 md:h-44"></div>);
                for (let d = 1; d <= days; d++) {
                  const date = new Date(year, month, d);
                  const dateStr = getLocalDateString(date);
                  const plan = approvedPlans.find(p => p.date === dateStr);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const totalPax = plan ? Object.values(plan.headcounts || {}).reduce((a, b) => a + (Number(b) || 0), 0) : 0;

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
                               <span className="text-[8px] font-black text-slate-700 truncate">{m.dishes[0] || 'Menu'}</span>
                             </div>
                           ))}
                           <div className="mt-2 text-[7px] font-black uppercase text-slate-300">{plan.isConsumed ? '✓ Consumed' : 'Pending'}</div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white rounded-[4rem] w-full max-w-4xl overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col max-h-[95vh] animate-in zoom-in-95">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500 rounded-2xl text-slate-950"><CalendarIcon size={24} /></div>
                    <div>
                       <h3 className="text-3xl font-black">{selectedDate.toDateString()}</h3>
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Production Register & Audit</p>
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
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-4"><div className="w-8 h-px bg-slate-200"></div> {m.mealType} Service</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {(m.dishDetails || []).map((dish, di) => (
                                      <div key={di} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 flex flex-col justify-between shadow-sm">
                                         <input 
                                           type="text" 
                                           value={dish.name} 
                                           onChange={e => {
                                             const up = [...editMeals];
                                             up[mi].dishDetails![di].name = e.target.value;
                                             setEditMeals(up);
                                           }}
                                           disabled={dayPlan.isConsumed}
                                           className="w-full text-lg font-black text-slate-900 bg-transparent border-none focus:ring-0 p-0 outline-none"
                                         />
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
                                                 className="w-20 px-3 py-2 rounded-xl bg-slate-50 border-none font-black text-center text-sm" 
                                                 placeholder="0.0" 
                                               />
                                               <span className="text-[9px] font-black text-slate-400 uppercase">kg</span>
                                            </div>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          ))}
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                          {dayPlan.isConsumed ? (
                             <>
                               <button onClick={() => generatePDFReport(dayPlan)} className="bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl flex items-center justify-center gap-3">
                                  <Download size={20} /> Download Report
                               </button>
                               <div className="bg-emerald-50 text-emerald-700 flex items-center justify-center gap-3 font-black uppercase text-xs rounded-3xl">
                                  <CheckCircle size={20} /> Operational History Logged
                               </div>
                             </>
                          ) : (
                             <>
                               <button onClick={handleSaveDay} className="bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl flex items-center justify-center gap-3">
                                  <Save size={20} /> Update Register
                               </button>
                               <button onClick={() => toggleConsumption(dayPlan)} className="bg-white border-2 border-slate-900 text-slate-900 py-6 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-emerald-50 transition-all flex items-center justify-center gap-3">
                                  <UserCheck size={20} /> Finalize & Deduct Stock
                               </button>
                             </>
                          )}
                       </div>
                    </div>
                 ) : (
                    <div className="py-24 text-center space-y-8">
                       <h4 className="text-3xl font-black text-slate-900 tracking-tight">Empty Schedule</h4>
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