
import React, { useState, useEffect } from 'react';
import { 
  Package, Search, AlertTriangle, CheckCircle2, Edit3, Trash2, X, PlusCircle, Scale, RefreshCcw, FileText, Loader2, TrendingUp, Banknote, Database, Tag, Truck, Upload, ArrowRight
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';

export const InventoryManagement: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'low' | 'out'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Import State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [importItems, setImportItems] = useState<Partial<InventoryItem>[]>([]);

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [syncing, setSyncing] = useState(true);
  
  const INITIAL_FORM_STATE: Partial<InventoryItem> = {
    name: '', brand: '', category: 'Produce', quantity: 0, unit: 'kg', reorderLevel: 0, supplier: '', lastPrice: 0
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
    if (!formData.name) return alert('Name is mandatory.');
    const currentReserved = editingItem?.reserved || 0;
    const status = getStatus(formData.quantity || 0, formData.reorderLevel || 0, currentReserved);
    const dataToSave = { ...formData, status, lastRestocked: new Date().toISOString().split('T')[0], reserved: currentReserved };

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

  // --- AI IMPORT LOGIC ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      alert("For Excel files, please save as CSV or PDF before uploading.");
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    try {
      // Ensure API Key is available
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
      }

      let prompt = `Extract inventory items from this file. Return a JSON array of objects with these properties:
      - name (string): Item name
      - quantity (number): Current stock amount
      - unit (string): Unit of measure (e.g., kg, L, pcs)
      - lastPrice (number): Unit price if available (default 0)
      - brand (string): Brand name if available
      - category (string): Infer category (e.g., Produce, Dairy, Spices, Meat, Dry Goods)
      `;

      let parts: any[] = [];
      
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const text = await file.text();
        parts = [{ text: prompt + `\n\nCSV DATA:\n${text}` }];
      } else {
        // Image or PDF
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.readAsDataURL(file);
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
        });
        parts = [
           { inlineData: { data: base64, mimeType: file.type } },
           { text: prompt }
        ];
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
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

      const parsed = JSON.parse(response.text || '[]');
      // Add defaults
      const sanitized = parsed.map((p: any) => ({
         name: p.name || 'Unknown Item',
         quantity: p.quantity || 0,
         unit: p.unit || 'units',
         lastPrice: p.lastPrice || 0,
         brand: p.brand || '',
         category: p.category || 'Uncategorized',
         reorderLevel: 5, // Default
         status: 'healthy'
      }));

      setImportItems(sanitized);
      setIsReviewOpen(true);
    } catch (error) {
      console.error(error);
      alert("Failed to process document. Please try a clear image, PDF, or CSV.");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const commitImport = async () => {
     if (importItems.length === 0) return;
     setIsProcessing(true);
     try {
        const batch = writeBatch(db);
        
        importItems.forEach(item => {
           const docRef = doc(collection(db, "inventory"));
           const status = getStatus(item.quantity || 0, item.reorderLevel || 5, 0);
           batch.set(docRef, {
             ...item,
             status,
             reorderLevel: item.reorderLevel || 5,
             lastRestocked: new Date().toISOString().split('T')[0],
             reserved: 0
           });
        });

        await batch.commit();
        setIsReviewOpen(false);
        setImportItems([]);
        alert("Inventory imported successfully.");
     } catch (e) {
        alert("Database commit failed.");
     } finally {
        setIsProcessing(false);
     }
  };

  const removeImportItem = (idx: number) => {
    setImportItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateImportItem = (idx: number, field: keyof InventoryItem, value: any) => {
    setImportItems(prev => {
       const updated = [...prev];
       updated[idx] = { ...updated[idx], [field]: value };
       return updated;
    });
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
            <Scale className="text-emerald-500" size={40} /> Raw Material Hub
          </h2>
          <p className="text-slate-500 font-bold mt-2 uppercase text-[11px] tracking-[0.2em]">Cloud Integrated Registry & Smart Cost Control</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <input type="file" id="inv-import" className="hidden" accept=".csv,application/pdf,image/*" onChange={handleFileUpload} />
          <label htmlFor="inv-import" className={`bg-white border-2 border-slate-200 text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm active:scale-95 group cursor-pointer ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
             {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
             {isProcessing ? 'Analyzing...' : 'Import List'}
          </label>

          <button onClick={() => { setEditingItem(null); setFormData(INITIAL_FORM_STATE); setIsModalOpen(true); }} className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-xl active:scale-95 group">
            <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            Register Asset
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={22} />
          <input 
            type="text" 
            placeholder="Search by material, brand, or vendor..." 
            className="w-full pl-16 pr-12 py-5 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-slate-900 outline-none focus:bg-white focus:border-slate-900 transition-all placeholder:text-slate-300 placeholder:font-bold" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Identity</th>
                <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
                <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Health</th>
                <th className="px-10 py-8 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-10 py-8">
                    <p className="font-black text-slate-900 text-xl tracking-tight mb-1">{item.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">{item.category}</span>
                      {item.brand && <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1"><Tag size={10} /> {item.brand}</span>}
                    </div>
                  </td>
                  <td className="px-8 py-8 text-right">
                    <p className="font-black text-slate-900 text-2xl tracking-tighter">{item.quantity} <span className="text-xs font-medium text-slate-400 uppercase">{item.unit}</span></p>
                  </td>
                  <td className="px-8 py-8 text-right font-black text-slate-900 text-xl">₹{item.lastPrice}</td>
                  <td className="px-8 py-8">
                     <div className={`px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 w-fit ${getStatus(item.quantity, item.reorderLevel, item.reserved || 0) === 'healthy' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {getStatus(item.quantity, item.reorderLevel, item.reserved || 0) === 'healthy' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        {getStatus(item.quantity, item.reorderLevel, item.reserved || 0)}
                     </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                     <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-4 bg-white border-2 border-slate-100 text-slate-400 hover:text-emerald-600 rounded-2xl transition-all shadow-sm active:scale-95"><Edit3 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[95vh] flex flex-col">
            <div className="bg-slate-900 p-8 sm:p-12 text-white relative shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-10 right-12 bg-white/10 p-4 rounded-3xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter">{editingItem ? 'Update Asset' : 'New Asset'}</h3>
              <p className="text-emerald-400 font-black mt-2 text-[10px] uppercase tracking-[0.4em]">Core Supply Chain Interface</p>
            </div>
            
            <div className="p-8 sm:p-12 space-y-8 overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Identity</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Selection</label>
                    <select 
                      value={formData.brand} 
                      onChange={e => setFormData({...formData, brand: e.target.value})} 
                      className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner"
                    >
                      <option value="" className="text-slate-900">Unbranded / General</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.name} className="text-slate-900">{b.name}</option>
                      ))}
                    </select>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Market Price (₹)</label>
                    <input type="number" value={formData.lastPrice} onChange={e => setFormData({...formData, lastPrice: parseFloat(e.target.value) || 0})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Stock</label>
                    <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
               </div>
               <div className="p-4 border-t flex justify-end gap-6 bg-slate-50 mt-8">
                  <button onClick={handleSave} className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-emerald-600 transition-all">Commit Asset</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {isReviewOpen && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-4xl h-[85vh] overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 flex flex-col">
               <div className="bg-slate-900 p-8 sm:p-10 text-white flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tight">Import Review</h3>
                    <p className="text-emerald-400 font-black text-[9px] uppercase tracking-widest mt-1">Found {importItems.length} items from document</p>
                  </div>
                  <button onClick={() => { setIsReviewOpen(false); setImportItems([]); }} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-8 sm:p-10 custom-scrollbar space-y-4">
                  {importItems.map((item, idx) => (
                     <div key={idx} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 flex flex-col md:flex-row gap-6 items-start md:items-center group hover:border-emerald-400 transition-colors">
                        <div className="flex-1 space-y-2 w-full">
                           <input 
                             value={item.name} 
                             onChange={(e) => updateImportItem(idx, 'name', e.target.value)}
                             className="w-full bg-transparent border-none p-0 text-lg font-black text-slate-900 focus:ring-0 placeholder:text-slate-300"
                             placeholder="Item Name"
                           />
                           <div className="flex flex-wrap gap-4">
                              <input 
                                value={item.brand || ''}
                                onChange={(e) => updateImportItem(idx, 'brand', e.target.value)}
                                className="bg-white px-3 py-1.5 rounded-lg border-none text-xs font-bold text-slate-500 w-full md:w-auto"
                                placeholder="Brand"
                              />
                              <input 
                                value={item.category || ''}
                                onChange={(e) => updateImportItem(idx, 'category', e.target.value)}
                                className="bg-white px-3 py-1.5 rounded-lg border-none text-xs font-bold text-slate-500 w-full md:w-auto"
                                placeholder="Category"
                              />
                           </div>
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                           <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                              <input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => updateImportItem(idx, 'quantity', parseFloat(e.target.value))}
                                className="w-20 text-right font-black text-slate-900 border-none focus:ring-0 p-0"
                              />
                              <input 
                                value={item.unit} 
                                onChange={(e) => updateImportItem(idx, 'unit', e.target.value)}
                                className="w-12 text-xs font-bold text-slate-400 border-none focus:ring-0 p-0 uppercase"
                              />
                           </div>
                           <button onClick={() => removeImportItem(idx)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                        </div>
                     </div>
                  ))}
               </div>

               <div className="p-8 border-t border-slate-100 flex justify-end gap-4 shrink-0 bg-slate-50/50">
                  <button onClick={() => { setIsReviewOpen(false); setImportItems([]); }} className="px-8 py-4 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-rose-500 transition-colors">Discard</button>
                  <button onClick={commitImport} className="bg-emerald-500 text-slate-950 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-900 hover:text-white transition-all flex items-center gap-3">
                     <CheckCircle2 size={18} /> Confirm Import
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
