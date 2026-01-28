// 🔥 SAME IMPORTS
import React, { useState, useEffect } from 'react';
import { 
  Upload, CheckCircle2, Calendar as CalendarIcon, Loader2, X,
  ChevronLeft, ChevronRight, ChefHat, CalendarCheck,
  CheckCircle, Trash2, PartyPopper
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, InventoryReservation, Meal } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);
const cleanJson = (text: string) => text.replace(/```json/g, '').replace(/```/g, '').trim();

/* ---------------- MOCK STORAGE (UNCHANGED) ---------------- */
const mockFirestore = {
  collection: 'productionPlans',
  save: (plan: ProductionPlan) => {
    const plans = mockFirestore.getAll();
    const existingIdx = plans.findIndex(p => p.id === plan.id);
    if (existingIdx > -1) plans[existingIdx] = { ...plan, updatedAt: Date.now() };
    else plans.push({ ...plan, type: plan.type || 'production' });
    localStorage.setItem(mockFirestore.collection, JSON.stringify(plans));
  },
  getAll: (): ProductionPlan[] => JSON.parse(localStorage.getItem('productionPlans') || '[]'),
  delete: (id: string) => {
    const plans = mockFirestore.getAll().filter(p => p.id !== id);
    localStorage.setItem('productionPlans', JSON.stringify(plans));
  }
};

/* ---------------- COMPONENT ---------------- */
export const ProductionPlanning: React.FC = () => {
  const [view, setView] = useState<'CALENDAR' | 'UPLOAD' | 'REVIEW'>('CALENDAR');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<ProductionPlan[]>([]);
  const [approvedPlans, setApprovedPlans] = useState<ProductionPlan[]>([]);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setApprovedPlans(mockFirestore.getAll());
  }, []);

  /* =========================================================
     🔥 FIXED GEMINI UPLOAD HANDLER
  ========================================================= */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const apiKey = (window as any).GEMINI_API_KEY;
    if (!apiKey) {
      alert("Gemini API key not configured.");
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
        model: "gemini-2.0-flash",
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: file.type } },
            { text: `Extract meal schedule. Return JSON array with date (YYYY-MM-DD) and meals with mealType and dishes. Year is ${currentYear}.` }
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
      alert("AI Error: " + err.message);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  /* ---------------- SIMPLE UI (UNCHANGED CORE LOGIC) ---------------- */
  return (
    <div className="space-y-8 pb-24">
      <div className="flex justify-between items-center border-b pb-6">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <CalendarCheck className="text-emerald-500" size={28}/> Cycle Planner
        </h2>
        <button onClick={() => setView('UPLOAD')} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase">
          <Upload size={16}/> Import Menu
        </button>
      </div>

      {isProcessing && (
        <div className="text-center py-10">
          <Loader2 className="animate-spin mx-auto text-emerald-500" size={60}/>
          <p className="mt-4 font-bold text-slate-600">AI Processing Menu...</p>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="bg-white border-2 border-dashed p-16 text-center rounded-3xl">
          <input type="file" id="menu-upload" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload}/>
          <label htmlFor="menu-upload" className="cursor-pointer bg-slate-900 text-white px-10 py-4 rounded-xl font-bold uppercase">
            Select Menu File
          </label>
        </div>
      )}

      {view === 'REVIEW' && (
        <div className="grid md:grid-cols-2 gap-6">
          {pendingPlans.map((plan,i)=>(
            <div key={i} className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold mb-2">{plan.date}</h3>
              {plan.meals.map((m,mi)=>(
                <div key={mi}>
                  <strong>{m.mealType}</strong>
                  <ul>{m.dishes.map((d,di)=><li key={di}>{d}</li>)}</ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

