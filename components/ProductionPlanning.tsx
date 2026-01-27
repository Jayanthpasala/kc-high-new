
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
  AlertCircle
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { PageId, ProductionPlan, Meal } from '../types';

/**
 * Mock Firestore Implementation
 * Uses LocalStorage to simulate persistent storage as per initial constraints.
 * Structures data as requested: date, meals, isApproved, createdAt.
 */
const mockFirestore = {
  collection: 'productionPlans',
  
  save: (plan: ProductionPlan) => {
    const plans = mockFirestore.getAll();
    const existingIdx = plans.findIndex(p => p.id === plan.id);
    if (existingIdx > -1) {
      plans[existingIdx] = { ...plan, updatedAt: Date.now() };
    } else {
      plans.push(plan);
    }
    localStorage.setItem(mockFirestore.collection, JSON.stringify(plans));
  },
  
  getAll: (): ProductionPlan[] => {
    const data = localStorage.getItem(mockFirestore.collection);
    return data ? JSON.parse(data) : [];
  },
  
  getApproved: (): ProductionPlan[] => {
    return mockFirestore.getAll().filter(p => p.isApproved);
  }
};

type ViewState = 'CALENDAR' | 'UPLOAD' | 'REVIEW';

export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<ViewState>('CALENDAR');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Real-time "listener" effect
  useEffect(() => {
    const updatePlans = () => {
      setApprovedPlans(mockFirestore.getApproved());
    };
    updatePlans();
    // Simulate real-time updates when tab focuses or storage changes
    window.addEventListener('storage', updatePlans);
    return () => window.removeEventListener('storage', updatePlans);
  }, [view]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      const extractedData = await extractMenuWithAI(base64, file.type);
      
      const newPlans: ProductionPlan[] = extractedData.map((item: any) => ({
        id: crypto.randomUUID(),
        date: item.date || 'INVALID_DATE',
        meals: item.meals || [],
        isApproved: false,
        createdAt: Date.now()
      }));

      setPendingPlans(newPlans);
      setView('REVIEW');
    } catch (error) {
      console.error("AI Processing Error:", error);
      alert("Failed to process menu. Please ensure the image is clear and contains dates or days of the week.");
    } finally {
      setIsProcessing(false);
      // Clear input so same file can be uploaded again if needed
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
    const currentYear = new Date().getFullYear();
    const todayISO = new Date().toISOString().split('T')[0];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: `Extract the kitchen menu from this document. 
          
          IMPORTANT RULES:
          1. The current year is ${currentYear}. Always assume the present year unless the document explicitly states otherwise.
          2. If the document lists days of the week (e.g., "Monday"), map them to the corresponding dates starting from today (${todayISO}).
          3. If no year is mentioned, use ${currentYear}.
          4. Identify different meals (Breakfast, Lunch, Dinner, Snacks).
          5. Output ONLY a JSON array.
          
          Format: [{"date": "YYYY-MM-DD", "meals": [{"mealType": "Lunch", "dishes": ["Dish 1"]}]}]` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "Date in YYYY-MM-DD format. Use INVALID_DATE if not detectable." },
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    mealType: { type: Type.STRING, description: "e.g., Breakfast, Lunch, Snacks, Dinner" },
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

    return JSON.parse(response.text);
  };

  const handleApproveAll = () => {
    // Flag check for invalid dates
    const hasInvalidDates = pendingPlans.some(p => p.date === 'INVALID_DATE' || !p.date);
    if (hasInvalidDates) {
      alert("Please fix all invalid or missing dates before approving.");
      return;
    }

    pendingPlans.forEach(plan => {
      mockFirestore.save({ ...plan, isApproved: true });
    });
    setPendingPlans([]);
    setView('CALENDAR');
  };

  const updatePendingPlan = (index: number, updated: ProductionPlan) => {
    const newPlans = [...pendingPlans];
    newPlans[index] = updated;
    setPendingPlans(newPlans);
  };

  // Calendar Logic
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const calendarDays = [];
  const daysCount = daysInMonth(currentMonth);
  const startDay = startDayOfMonth(currentMonth);

  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysCount; i++) calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));

  const getPlanForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return approvedPlans.find(p => p.date === dateStr);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Production Planning</h2>
          <p className="text-slate-500">AI-powered menu scheduling for {new Date().getFullYear()}.</p>
        </div>
        <div className="flex space-x-3">
          {view !== 'CALENDAR' && (
            <button 
              onClick={() => setView('CALENDAR')}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
            >
              Back to Calendar
            </button>
          )}
          <button 
            onClick={() => setView('UPLOAD')}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg shadow-sm transition-all transform hover:scale-[1.02] active:scale-95 font-medium"
          >
            <Upload size={18} />
            <span>AI Menu Upload</span>
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
            <Loader2 size={48} className="text-emerald-500 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800">Reading Menu...</h3>
            <p className="text-slate-500 mt-2">Gemini AI is identifying dishes and dates for your production plan.</p>
          </div>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-emerald-400 transition-colors group">
          <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
            <Upload className="text-emerald-600" size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Upload Menu Image or PDF</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">
            Upload your kitchen menu. We'll automatically schedule all meals into the {new Date().getFullYear()} calendar.
          </p>
          <input 
            type="file" 
            id="menu-upload" 
            className="hidden" 
            accept="image/*,application/pdf"
            onChange={handleFileUpload}
          />
          <label 
            htmlFor="menu-upload"
            className="mt-8 inline-block cursor-pointer bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg"
          >
            Choose File
          </label>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-amber-800">Chef Review Step</p>
              <p className="text-sm text-amber-700">Verify extraction results. Any "Missing Date" flags must be manually filled with a valid {new Date().getFullYear()} date.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingPlans.map((plan, planIdx) => (
              <div key={plan.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${plan.date === 'INVALID_DATE' ? 'border-red-400 ring-1 ring-red-100' : 'border-slate-200'}`}>
                <div className={`px-6 py-4 border-b flex justify-between items-center ${plan.date === 'INVALID_DATE' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center space-x-3">
                    <input 
                      type="date" 
                      value={plan.date === 'INVALID_DATE' ? '' : plan.date}
                      onChange={(e) => updatePendingPlan(planIdx, { ...plan, date: e.target.value })}
                      className={`font-bold text-slate-800 bg-white border-slate-200 p-1.5 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm ${plan.date === 'INVALID_DATE' ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                    />
                    {plan.date === 'INVALID_DATE' && (
                      <span className="text-[10px] font-bold text-red-600 uppercase bg-red-100 px-2 py-1 rounded-full animate-pulse">
                        Missing Date
                      </span>
                    )}
                  </div>
                  <button onClick={() => setPendingPlans(pendingPlans.filter(p => p.id !== plan.id))} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  {plan.meals.map((meal, mealIdx) => (
                    <div key={mealIdx} className="space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{meal.mealType}</span>
                        <button 
                          onClick={() => {
                            const newMeals = [...plan.meals];
                            newMeals[mealIdx].dishes.push("New Dish");
                            updatePendingPlan(planIdx, { ...plan, meals: newMeals });
                          }}
                          className="text-slate-400 hover:text-emerald-600 text-[10px] flex items-center font-bold uppercase"
                        >
                          <Plus size={12} className="mr-1" /> Add Dish
                        </button>
                      </div>
                      <div className="space-y-2">
                        {meal.dishes.map((dish, dishIdx) => (
                          <div key={dishIdx} className="group flex items-center space-x-2">
                            <input 
                              type="text" 
                              value={dish}
                              onChange={(e) => {
                                const newMeals = [...plan.meals];
                                newMeals[mealIdx].dishes[dishIdx] = e.target.value;
                                updatePendingPlan(planIdx, { ...plan, meals: newMeals });
                              }}
                              className="flex-1 text-sm bg-slate-50 border-transparent px-3 py-2 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 group-hover:bg-slate-100 transition-all"
                            />
                            <button 
                              onClick={() => {
                                const newMeals = [...plan.meals];
                                newMeals[mealIdx].dishes.splice(dishIdx, 1);
                                updatePendingPlan(planIdx, { ...plan, meals: newMeals });
                              }}
                              className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => {
                      const newMeals = [...plan.meals, { mealType: 'New Category', dishes: ['New Dish'] }];
                      updatePendingPlan(planIdx, { ...plan, meals: newMeals });
                    }}
                    className="w-full py-2.5 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-xs font-bold uppercase hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center justify-center tracking-widest"
                  >
                    <Plus size={16} className="mr-2" /> Add Meal Category
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border-t border-slate-200 p-6 flex justify-end items-center space-x-4 sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
             <div className="mr-auto hidden sm:block">
                <p className="text-sm font-medium text-slate-500">
                  Total Items: <span className="text-slate-900 font-bold">{pendingPlans.length} Days</span>
                </p>
             </div>
             <button 
                onClick={() => setPendingPlans([])}
                className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors"
              >
                Discard Draft
              </button>
              <button 
                onClick={handleApproveAll}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transform hover:scale-[1.02] transition-all flex items-center"
              >
                <CheckCircle2 className="mr-2" size={20} /> Approve & Schedule
              </button>
          </div>
        </div>
      )}

      {view === 'CALENDAR' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Calendar Header */}
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all border border-transparent hover:border-slate-200"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentMonth(new Date())}
                className="px-4 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg text-sm font-bold text-slate-600 transition-all"
              >
                Today
              </button>
              <button 
                onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all border border-transparent hover:border-slate-200"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, i) => {
              const plan = date ? getPlanForDate(date) : null;
              const isToday = date?.toDateString() === new Date().toDateString();

              return (
                <div 
                  key={i} 
                  className={`min-h-[160px] border-r border-b border-slate-100 p-3 hover:bg-slate-50 transition-all relative group cursor-pointer ${!date ? 'bg-slate-50/30' : ''}`}
                  onClick={() => date && plan && setSelectedPlan(plan)}
                >
                  {date && (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-xs font-black inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${isToday ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-slate-400 group-hover:text-slate-600'}`}>
                          {date.getDate()}
                        </span>
                        {plan && (
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        )}
                      </div>
                      
                      {plan && (
                        <div className="space-y-1.5 mt-1">
                          {plan.meals.slice(0, 3).map((meal, mIdx) => (
                            <div key={mIdx} className="px-2 py-1 rounded-md bg-white text-[10px] text-slate-700 font-bold flex items-center justify-between border border-slate-100 shadow-sm group-hover:border-emerald-200 group-hover:text-emerald-700 transition-all truncate">
                              <span className="truncate max-w-[80%]">{meal.mealType}</span>
                              <span className="shrink-0 ml-1 opacity-40 text-[9px]">{meal.dishes.length}</span>
                            </div>
                          ))}
                          {plan.meals.length > 3 && (
                            <div className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest pt-1">
                              + {plan.meals.length - 3} More
                            </div>
                          )}
                        </div>
                      )}

                      {!plan && date && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setView('UPLOAD'); }}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-white/40 backdrop-blur-[1px]"
                        >
                          <div className="bg-emerald-600 text-white p-2 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                             <Plus size={20} />
                          </div>
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Plan Detail Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 px-10 py-8 text-white flex justify-between items-start relative overflow-hidden">
              {/* Decorative Background Element */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              
              <div className="relative z-10">
                <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.2em] mb-2">Production Blueprint</p>
                <h3 className="text-4xl font-bold tracking-tight">
                  {new Date(selectedPlan.date).toLocaleDateString('en-US', { weekday: 'long' })}
                </h3>
                <p className="text-slate-400 font-medium mt-1">
                  {new Date(selectedPlan.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPlan(null)} 
                className="relative z-10 bg-white/10 hover:bg-white/20 p-2.5 rounded-2xl transition-all hover:rotate-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-10 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/30">
              <div className="space-y-10">
                {selectedPlan.meals.map((meal, i) => (
                  <div key={i} className="relative">
                    <div className="flex items-center space-x-4 mb-5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-xs">
                        {meal.mealType.charAt(0)}
                      </div>
                      <h4 className="text-xl font-bold text-slate-800 tracking-tight">
                        {meal.mealType}
                        <span className="ml-4 text-[10px] bg-slate-200 text-slate-600 px-3 py-1 rounded-full font-black uppercase tracking-widest">
                          {meal.dishes.length} Items
                        </span>
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {meal.dishes.map((dish, di) => (
                        <div key={di} className="flex items-center space-x-3 bg-white p-5 rounded-2xl border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all group">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform"></div>
                          <span className="text-slate-700 font-semibold text-sm leading-tight">{dish}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white px-10 py-8 border-t border-slate-100 flex justify-between items-center">
              <button 
                onClick={() => {
                  setPendingPlans([selectedPlan]);
                  setSelectedPlan(null);
                  setView('REVIEW');
                }}
                className="text-slate-500 font-bold hover:text-emerald-600 transition-colors flex items-center space-x-2 text-sm uppercase tracking-widest"
              >
                <Edit3 size={18} />
                <span>Refine Plan</span>
              </button>
              <button 
                onClick={() => setSelectedPlan(null)}
                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
