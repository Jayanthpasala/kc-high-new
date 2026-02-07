import React, { useState, useEffect } from 'react';
import { 
  Package, Search, AlertTriangle, CheckCircle2, Edit3, Trash2, X, PlusCircle, Scale, RefreshCcw, FileText, Loader2, TrendingUp, Banknote, Database, Tag, Truck, Upload, ArrowRight, ShieldAlert, AlertCircle, Save
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
      setFormData(INITIAL_FORM_STATE);
      setEditingItem(null);
    } catch (err) {
      alert("Error saving item.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Permanently remove this material from registry?")) {
      await deleteDoc(doc(db, "inventory", id));
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
           batch.set(docRef, { ...item, status: 'healthy', createdAt: Date.now(), lastRestocked: new Date().toISOString().split('T')[0] });
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

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b pb-8">
        <div>
          <h2 className="text-3xl font-black flex items-center gap-3"><Package className="text-emerald-500" size={32} /> Inventory Hub</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Stock Levels & Material Registry</p>
        </div>
        <div className="flex flex-wrap gap-4">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search inventory..." 
                className="pl-12 pr-6 py-4 rounded-2xl bg-white border-2 border-slate-100 font-bold text-sm focus:border-emerald-500 outline-none transition-all w-64 shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <input type="file" id="inv-upload" className="hidden" accept="image/*" onChange={handleFileUpload} />
           <label htmlFor="inv-upload" className="bg-white border-2 border-slate-200 text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
              <Upload size={18} /> Bulk Import
           </label>
           <button onClick={() => { setEditingItem(null); setFormData(INITIAL_FORM_STATE); setIsModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl active:scale-95">Register Item</button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border-2 border-slate-100 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
           <thead className="bg-slate-50/50">
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                 <th className="px-10 py-8">Material Identity</th>
                 <th className="px-8 py-8">Status</th>
                 <th className="px-8 py-8 text-right">Available Stock</th>
                 <th className="px-8 py-8 text-right">Assessed Value</th>
                 <th className="px-10 py-8 text-right">Operational Actions</th>
              </tr>
           </thead>
           <tbody className="divide-y">
              {filteredItems.map(item => (
                 <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-10 py-8">
                       <p className="font-black text-slate-900 text-lg">{item.name}</p>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{item.brand || 'Generic Market'}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span>
                       </div>
                    </td>
                    <td className="px-8 py-8">
                       <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border-2 ${
                          item.status === 'healthy' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          item.status === 'low' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                       }`}>
                          {item.status === 'healthy' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {item.status} Stock
                       </div>
                    </td>
                    <td className="px-8 py-8 text-right">
                       <p className="font-black text-slate-900 text-xl">{item.quantity} <span className="text-xs text-slate-400 uppercase">{item.unit}</span></p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Min. Required: {item.reorderLevel} {item.unit}</p>
                    </td>
                    <td className="px-8 py-8 text-right">
                       <p className="font-black text-slate-900 text-lg">₹{((item.quantity || 0) * (item.lastPrice || 0)).toLocaleString()}</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Last Rate: ₹{item.lastPrice || 0}/{item.unit}</p>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-emerald-500 rounded-xl shadow-sm transition-all"><Edit3 size={18} /></button>
                          <button onClick={() => handleDelete(item.id)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-rose-500 rounded-xl shadow-sm transition-all"><Trash2 size={18} /></button>
                       </div>
                    </td>
                 </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-10 py-32 text-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-200">
                         <Package size={40} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900">No Materials Found</h3>
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">Adjust your search filters or register a new material identity.</p>
                   </td>
                </tr>
              )}
           </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl mx-auto overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-2xl font-black uppercase tracking-tight">{editingItem ? 'Update Registry' : 'Register Material'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Material Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Basmati Rice" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Identity</label>
                  <input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="e.g., India Gate" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner">
                    {['Produce', 'Dairy', 'Dry Goods', 'Frozen', 'Spices', 'Staples', 'Cleaning', 'Equipment'].map(cat => (
                       <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Stock Level</label>
                  <div className="flex gap-2">
                    <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} className="flex-1 px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" />
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-24 px-4 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-black text-[10px] uppercase focus:border-emerald-500 outline-none transition-all shadow-inner">
                       {['kg', 'L', 'g', 'ml', 'pcs', 'box', 'tray'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Safety Threshold (Reorder)</label>
                  <input type="number" value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: parseFloat(e.target.value) || 0})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Market Rate (per {formData.unit})</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">₹</span>
                    <input type="number" value={formData.lastPrice} onChange={e => setFormData({...formData, lastPrice: parseFloat(e.target.value) || 0})} className="w-full pl-10 pr-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" />
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Vendor</label>
                   <input type="text" value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} placeholder="Assigned Supplier" className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" />
                </div>
              </div>

              <button onClick={handleSave} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 active:scale-95">
                <Save size={18} /> Commit to Registry
              </button>
            </div>
          </div>
        </div>
      )}

      {isReviewOpen && (
         <div className="fixed inset-0 z-[110] bg-slate-950/90 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
            <div className="bg-white w-full max-w-4xl p-12 rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
               <div className="flex justify-between items-center mb-8 shrink-0">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">Validate Bulk Entry</h3>
                  <button onClick={() => setIsReviewOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X size={24} /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-4">
                  {importItems.map((item, i) => (
                     <div key={i} className="p-6 bg-slate-50 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-transparent hover:border-emerald-200 transition-colors">
                        <div>
                           <span className="font-black text-slate-900 text-lg block">{item.name}</span>
                           <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{item.brand || 'Unspecified'} • {item.category || 'General'}</span>
                        </div>
                        <div className="flex items-center gap-6 self-end sm:self-center">
                           <div className="text-right">
                              <span className="text-sm font-black text-slate-900">{item.quantity} {item.unit}</span>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Input Qty</p>
                           </div>
                           <div className="text-right">
                              <span className="text-sm font-black text-emerald-600">₹{item.lastPrice || 0}</span>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Input Rate</p>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
               
               <div className="mt-10 flex flex-col sm:flex-row justify-end gap-6 border-t pt-8 shrink-0">
                  <button onClick={() => setIsReviewOpen(false)} className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors">Discard Draft</button>
                  <button onClick={commitImport} disabled={isProcessing} className="bg-emerald-500 text-slate-950 px-12 py-5 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:scale-105 transition-all flex items-center gap-3">
                     {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
                     Verify & Push to Registry
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};