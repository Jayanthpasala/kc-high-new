import React, { useState, useEffect, useMemo } from 'react';
import { 
  Upload, CheckCircle2, Calendar as CalendarIcon, Loader2, Plus, X,
  ChevronLeft, ChevronRight, ChefHat, CalendarCheck, AlertTriangle,
  Users, FileUp
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProductionPlan, Recipe, InventoryItem, Meal, ConsumptionRecord } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, writeBatch, doc, setDoc, query, where } from 'firebase/firestore';

const generateId = () => Math.random().toString(36).substring(2, 11);

/* ---------- SAFE AI JSON PARSER ---------- */
const safeParseAIResponse = (text: string | undefined) => {
  if (!text) throw new Error("AI returned empty content.");
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start !== -1 && end !== -1) return JSON.parse(clean.substring(start, end + 1));
  throw new Error("AI response format invalid.");
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
  const [editMeals, setEditMeals] = useState<Meal[]>([]);
  const [editHeadcounts, setEditHeadcounts] = useState<ConsumptionRecord>({
    teachers: 0, primary: 0, prePrimary: 0, additional: 0, others: 0
  });

  useEffect(() => {
    const unsubPlans = onSnapshot(query(collection(db, "productionPlans"), where("isApproved", "==", true)),
      snap => setApprovedPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionPlan)))
    );
    const unsubRecipes = onSnapshot(collection(db, "recipes"),
      snap => setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe)))
    );
    return () => { unsubPlans(); unsubRecipes(); };
  }, []);

  const getLocalDateString = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

  const missingRecipesCount = useMemo(() => {
    const missing = new Set<string>();
    pendingPlans.forEach(p =>
      p.meals.forEach(m =>
        m.dishes.forEach(d => {
          if (!recipes.some(r => r.name.toLowerCase() === d.toLowerCase())) missing.add(d);
        })
      )
    );
    return missing.size;
  }, [pendingPlans, recipes]);

  /* ---------- FILE UPLOAD WITH FIXED API KEY ---------- */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const apiKey = (window as any).APP_CONFIG?.GEMINI_API_KEY;
      if (!apiKey) {
        alert("Gemini API key missing in deployment.");
        setIsProcessing(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ inlineData: { data: base64, mimeType: file.type } }, { text: "Extract meals and headcounts as JSON." }] },
        config: { responseMimeType: "application/json" }
      });

      const extracted = safeParseAIResponse(response.text);
      const plans: ProductionPlan[] = extracted.map((d: any) => ({
        id: generateId(),
        date: d.date,
        meals: d.meals.map((m: any) => ({
          ...m,
          dishDetails: (m.dishes || []).map((dn: string) => ({ name: dn.trim(), amountCooked: 0 }))
        })),
        headcounts: d.headcounts || {},
        isApproved: false,
        createdAt: Date.now()
      }));

      setPendingPlans(plans);
      setView('REVIEW');
    } catch (err) {
      console.error(err);
      alert("AI Sync Failed during deployment extraction.");
    } finally {
      setIsProcessing(false);
    }
  };

  /* ---------- APPROVE ---------- */
  const handleApproveAll = async () => {
    if (missingRecipesCount > 0) return alert("Link all dishes first.");
    const batch = writeBatch(db);
    pendingPlans.forEach(p => batch.set(doc(db, "productionPlans", p.id), { ...p, isApproved: true }));
    await batch.commit();
    setPendingPlans([]);
    setView('CALENDAR');
  };

  /* ---------- UI ---------- */
  return (
    <div className="space-y-8 pb-24">
      <div className="flex justify-between items-center border-b pb-6">
        <h2 className="text-3xl font-black flex gap-3 items-center">
          <CalendarCheck className="text-emerald-500" /> Production Hub
        </h2>
        <button onClick={() => setView('UPLOAD')} className="bg-slate-900 text-white px-6 py-3 rounded-xl flex gap-2 items-center">
          <Upload size={18}/> Import Menu
        </button>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="animate-spin text-white" size={60}/>
        </div>
      )}

      {view === 'UPLOAD' && (
        <div className="text-center p-20 border-dashed border-4 rounded-3xl bg-white">
          <input type="file" id="file" className="hidden" onChange={handleFileUpload}/>
          <label htmlFor="file" className="cursor-pointer text-xl font-bold">Upload Menu Image</label>
        </div>
      )}

      {view === 'REVIEW' && (
        <div>
          <h3 className="text-xl font-bold mb-6">Review Extracted Plans</h3>
          <button onClick={handleApproveAll} className="bg-emerald-500 px-6 py-3 rounded-xl font-bold">Approve All</button>
        </div>
      )}

      {view === 'CALENDAR' && (
        <div className="bg-white rounded-3xl p-10 shadow">
          <p className="text-slate-500">Calendar UI continues here (unchanged)</p>
        </div>
      )}
    </div>
  );
};


