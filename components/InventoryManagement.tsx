import React, { useState, useEffect } from 'react';
import { 
  Package, Search, AlertTriangle, CheckCircle2, Edit3, Trash2, X, PlusCircle, Scale, RefreshCcw, FileText, Loader2, TrendingUp, Banknote, Database, Tag, Truck, Upload, ArrowRight, ShieldAlert, AlertCircle
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch, getDocs, where } from 'firebase/firestore';

export const InventoryManagement: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [importItems, setImportItems] = useState<Partial<InventoryItem>[]>([]);

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [syncing, setSyncing] = useState(true);
  
  const INITIAL_FORM_STATE: Partial<InventoryItem> = {
    name: '', 
    brand: '', 
    category: 'Produce', 
    quantity: 0, 
    unit: 'kg', 
    reorderLevel: 5, 
    supplier: '', 
    lastPrice: 0
  };

  const [formData, setFormData] = useState<Partial<InventoryItem>>(INITIAL_FORM_STATE);

  useEffect(() => {
    const qInv = query(collection(db, "inventory"), orderBy("name"));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
      setSyncing(false);
    });

    const qBrands = query(collection(db, "brands"), orderBy("name"));
    const unsubBrands = onSnapshot(qBrands, (snap) => {
      setBrands(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
    });

    return () => { unsubInv(); unsubBrands(); };
  }, []);

  const getStatus = (qty: number, reorder: number, reserved: number): InventoryItem['status'] => {
    const available = qty - (reserved || 0);
    if (available <= 0) return 'out';
    if (available <= reorder) return 'low';
    return 'healthy';
  };

  const handleSave = async () => {
    if (!formData.name) return alert('Material Identity (Name) is mandatory.');
    
    const status = getStatus(formData.quantity || 0, formData.reorderLevel || 0, editingItem?.reserved || 0);
    const dataToSave = { 
      ...formData, 
      status, 
      lastRestocked: new Date().toISOString().split('T')[0]
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, "inventory", editingItem.id), dataToSave);
      } else {
        await addDoc(collection(db, "inventory"), dataToSave);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert("Error saving item.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: file.type } },
            { text: "Extract inventory items as JSON: {name, quantity, unit, lastPrice, brand, category}." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                lastPrice: { type: Type.NUMBER },
                brand: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ["name", "quantity", "unit"]
            }
          }
        }
      });

      const rawResults = JSON.parse(response.text || '[]');
      setImportItems(rawResults);
      setIsReviewOpen(true);
    } catch (error) {
      alert("Failed to process document.");
    } finally {
      setIsProcessing(false);
    }
  };

  const commitImport = async () => {
     setIsProcessing(true);
     try {
        const batch = writeBatch(db);
        importItems.forEach(item => {
           const docRef = doc(collection(db, "inventory"));
           batch.set(docRef, { ...item, status: 'healthy', createdAt: Date.now() });
        });
        await batch.commit();
        setIsReviewOpen(false);
        setImportItems([]);
     } catch (e) {
        alert("Sync failed.");
     } finally {
        setIsProcessing(false);
     }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-end border-b pb-8">
        <div>
          <h2 className="text-3xl font-black flex items-center gap-3"><Package className="text-emerald-500" size={32} /> Inventory Hub</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Stock Levels & Material Registry</p>
        </div>
        <div className="flex gap-4">
           <input type="file" id="inv-upload" className="hidden" accept="image/*" onChange={handleFileUpload} />
           <label htmlFor="inv-upload" className="bg-white border-2 border-slate-200 text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 cursor-pointer">
              <Upload size={18} /> Bulk Import
           </label>
           <button onClick={() => { setEditingItem(null); setFormData(INITIAL_FORM_STATE); setIsModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Register Item</button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border-2 border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
           <thead className="bg-slate-50/50">
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <th className="px-10 py-8">Material</th>
                 <th className="px-8 py-8 text-right">Stock</th>
                 <th className="px-8 py-8 text-right">Value</th>
                 <th className="px-10 py-8 text-right">Actions</th>
              </tr>
           </thead>
           <tbody className="divide-y">
              {items.map(item => (
                 <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-10 py-8">
                       <p className="font-black text-slate-900 text-lg">{item.name}</p>
                       <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{item.brand || 'Generic'}</p>
                    </td>
                    <td className="px-8 py-8 text-right">
                       <p className="font-black text-slate-900 text-xl">{item.quantity} {item.unit}</p>
                    </td>
                    <td className="px-8 py-8 text-right font-black">₹{((item.quantity || 0) * (item.lastPrice || 0)).toLocaleString()}</td>
                    <td className="px-10 py-8 text-right">
                       <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-3 text-slate-400 hover:text-emerald-500"><Edit3 size={18} /></button>
                    </td>
                 </tr>
              ))}
           </tbody>
        </table>
      </div>

      {isReviewOpen && (
         <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-4xl p-10 rounded-[3rem] shadow-2xl overflow-y-auto max-h-[85vh]">
               <h3 className="text-3xl font-black mb-8 uppercase">Review Import</h3>
               <div className="space-y-4">
                  {importItems.map((item, i) => (
                     <div key={i} className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center">
                        <span className="font-black">{item.name}</span>
                        <span className="font-bold text-slate-400">{item.quantity} {item.unit}</span>
                     </div>
                  ))}
               </div>
               <div className="mt-10 flex justify-end gap-4">
                  <button onClick={() => setIsReviewOpen(false)} className="px-8 font-black uppercase text-xs">Cancel</button>
                  <button onClick={commitImport} className="bg-emerald-500 text-slate-950 px-10 py-5 rounded-2xl font-black uppercase text-xs">Verify & Push</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};