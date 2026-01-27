
import React, { useState, useEffect } from 'react';
import { 
  Package, Search, AlertTriangle, CheckCircle2, Edit3, Trash2, X, PlusCircle, Scale, RefreshCcw, FileText, Loader2, TrendingUp, Banknote, Database, Tag, Truck, Upload, Table as TableIcon
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

export const InventoryManagement: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [syncing, setSyncing] = useState(true);
  
  const CATEGORIES = ['Produce', 'Dry Goods', 'Proteins', 'Dairy', 'Spices', 'Beverages', 'Packaging'];

  const INITIAL_FORM_STATE: Partial<InventoryItem> = {
    name: '', brand: '', category: 'Produce', quantity: 0, unit: 'kg', reorderLevel: 5, supplier: '', lastPrice: 0
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
    if (!formData.name) return alert('Material name is mandatory.');
    const currentReserved = editingItem?.reserved || 0;
    const status = getStatus(formData.quantity || 0, formData.reorderLevel || 0, currentReserved);
    const dataToSave = { 
      ...formData, 
      status, 
      lastRestocked: new Date().toISOString().split('T')[0], 
      reserved: currentReserved 
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, "inventory", editingItem.id), dataToSave);
      } else {
        await addDoc(collection(db, "inventory"), dataToSave);
      }
      setIsModalOpen(false);
      setFormData(INITIAL_FORM_STATE);
    } catch (err) {
      console.error(err);
      alert("Error saving inventory item.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Permanently delete this inventory record?")) {
      try {
        await deleteDoc(doc(db, "inventory", id));
      } catch (err) {
        alert("Error deleting record.");
      }
    }
  };

  const handleSmartImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiLoading(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: file.type } },
            { text: `Analyze this document. Extract inventory items. Output JSON array: [{name: string, category: string, quantity: number, unit: string, lastPrice: number, brand: string, supplier: string}]. Categories must be: Produce, Dry Goods, Proteins, Dairy, Spices, Beverages, Packaging.` }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const extracted = JSON.parse(response.text || '[]');
      for (const item of extracted) {
        await addDoc(collection(db, "inventory"), {
          ...item,
          reorderLevel: 5,
          status: 'healthy',
          lastRestocked: new Date().toISOString().split('T')[0],
          reserved: 0
        });
      }
      alert(`Successfully imported ${extracted.length} items.`);
    } catch (err) {
      console.error(err);
      alert("AI Processing failed. Ensure the file is clear.");
    } finally {
      setIsAiLoading(false);
      e.target.value = '';
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
            <Scale className="text-emerald-500" size={40} /> Raw Material Hub
          </h2>
          <p className="text-slate-500 font-bold mt-2 uppercase text-[11px] tracking-[0.2em]">Cloud Integrated Registry & Smart Cost Control</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <input type="file" id="bulk-import" className="hidden" accept=".pdf,image/*,.csv,.xlsx" onChange={handleSmartImport} />
          <label htmlFor="bulk-import" className="bg-white border-2 border-slate-900 text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-lg cursor-pointer active:scale-95 group">
            {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            <span>{isAiLoading ? 'AI Processing...' : 'Bulk Ingest (PDF/Excel)'}</span>
          </label>
          <button onClick={() => { setEditingItem(null); setFormData(INITIAL_FORM_STATE); setIsModalOpen(true); }} className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-xl active:scale-95 group">
            <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            Register Asset
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex flex-col lg:flex-row gap-4">
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
        <select 
          className="px-8 py-5 rounded-3xl bg-slate-50 font-black text-[11px] uppercase outline-none border-none cursor-pointer text-slate-900"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="All" className="text-slate-900">All Categories</option>
          {CATEGORIES.map(cat => <option key={cat} value={cat} className="text-slate-900">{cat}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-[3.5rem] border-2 border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
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
                   <div className={`px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 w-fit ${getStatus(item.quantity, item.reorderLevel, item.reserved || 0) === 'healthy' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : getStatus(item.quantity, item.reorderLevel, item.reserved || 0) === 'low' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                      {getStatus(item.quantity, item.reorderLevel, item.reserved || 0) === 'healthy' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {getStatus(item.quantity, item.reorderLevel, item.reserved || 0)}
                   </div>
                </td>
                <td className="px-10 py-8 text-right">
                   <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-4 bg-white border-2 border-slate-100 text-slate-400 hover:text-emerald-600 rounded-2xl transition-all shadow-sm active:scale-95"><Edit3 size={18} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-4 bg-white border-2 border-slate-100 text-slate-400 hover:text-rose-600 rounded-2xl transition-all shadow-sm active:scale-95"><Trash2 size={18} /></button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[95vh] flex flex-col">
            <div className="bg-slate-900 p-12 text-white relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-10 right-12 bg-white/10 p-4 rounded-3xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              <h3 className="text-4xl font-black uppercase tracking-tighter">{editingItem ? 'Update Asset' : 'New Asset'}</h3>
              <p className="text-emerald-400 font-black mt-2 text-[10px] uppercase tracking-[0.4em]">Core Supply Chain Interface</p>
            </div>
            
            <div className="p-12 space-y-8 overflow-y-auto">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Identity</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" placeholder="e.g. Tomato" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Association</label>
                    <select 
                      value={formData.brand} 
                      onChange={e => setFormData({...formData, brand: e.target.value})} 
                      className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner text-slate-900"
                    >
                      <option value="" className="text-slate-900">Unbranded / General</option>
                      {brands.filter(b => !formData.name || b.itemName === formData.name).map(b => (
                        <option key={b.id} value={b.name} className="text-slate-900">{b.name}</option>
                      ))}
                    </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                    <select 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner text-slate-900"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="text-slate-900">{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit of Measure</label>
                    <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" placeholder="kg, L, box" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Stock Level</label>
                    <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Market Price (₹)</label>
                    <input type="number" value={formData.lastPrice} onChange={e => setFormData({...formData, lastPrice: parseFloat(e.target.value) || 0})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
               </div>
            </div>

            <div className="p-12 border-t flex justify-end gap-6 bg-slate-50">
               <button onClick={() => setIsModalOpen(false)} className="font-black text-[10px] uppercase text-slate-400 hover:text-rose-500">Discard</button>
               <button onClick={handleSave} className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-emerald-600 transition-all">Commit Asset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
