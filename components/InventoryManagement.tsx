
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  X,
  PlusCircle,
  Lock,
  Calendar,
  ArrowDownCircle,
  Clock,
  Truck,
  Layers,
  Filter,
  RefreshCcw,
  Scale,
  Zap,
  ChevronDown,
  FileText,
  Upload,
  Loader2,
  TrendingUp,
  Banknote,
  Database,
  Tag
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query,
  orderBy 
} from 'firebase/firestore';

export const InventoryManagement: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'low' | 'out'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const INITIAL_FORM_STATE: Partial<InventoryItem> = {
    name: '', 
    brand: '',
    category: 'Produce', 
    quantity: 0, 
    unit: 'kg', 
    reorderLevel: 0, 
    supplier: '', 
    expiryDate: '',
    lastPrice: 0
  };

  const [formData, setFormData] = useState<Partial<InventoryItem>>(INITIAL_FORM_STATE);

  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inventoryList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setItems(inventoryList);
      setSyncing(false);
      setPermissionDenied(false);
    }, (error) => {
      console.error("Inventory Fetch Error:", error);
      setSyncing(false);
      if (error.code === 'permission-denied') {
        setPermissionDenied(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const getStatus = (qty: number, reorder: number, reserved: number): InventoryItem['status'] => {
    const available = qty - (reserved || 0);
    if (available <= 0) return 'out';
    if (available <= reorder) return 'low';
    return 'healthy';
  };

  const categories = ['All', 'Produce', 'Dry Goods', 'Proteins', 'Dairy', 'Spices'];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesStatus = statusFilter === 'all' || getStatus(item.quantity, item.reorderLevel, item.reserved || 0) === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({ ...item }); 
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData(INITIAL_FORM_STATE);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.supplier) { 
      alert('Operational Error: Item name and supplier are mandatory fields.'); 
      return; 
    }
    
    const currentReserved = editingItem?.reserved || 0;
    const status = getStatus(formData.quantity || 0, formData.reorderLevel || 0, currentReserved);
    const dateStr = new Date().toISOString().split('T')[0];

    const dataToSave = {
      ...formData,
      status,
      lastRestocked: dateStr,
      reserved: currentReserved
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, "inventory", editingItem.id), dataToSave);
      } else {
        await addDoc(collection(db, "inventory"), dataToSave);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(`Database Error: ${err.message || "Could not save inventory item."}`);
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Permanently remove this asset from the database?")) return;
    try {
      await deleteDoc(doc(db, "inventory", id));
    } catch (err: any) {
      alert(`Database Error: ${err.message || "Could not delete item."}`);
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
            { text: `Analyze this inventory document/PDF/Invoice. Extract raw material data. 
              Output JSON array: [{name: string, brand: string, category: string, quantity: number, unit: string, lastPrice: number, supplier: string}].
              Infer category from item names (Produce, Dry Goods, Proteins, Dairy, Spices).` }
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
                brand: { type: Type.STRING },
                category: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                lastPrice: { type: Type.NUMBER },
                supplier: { type: Type.STRING }
              },
              required: ["name", "quantity", "unit"]
            }
          }
        }
      });

      const parsedData = JSON.parse(response.text || '[]');
      
      for (const newItem of parsedData) {
        const existing = items.find(i => i.name.toLowerCase() === newItem.name.toLowerCase());
        if (existing) {
          await updateDoc(doc(db, "inventory", existing.id), {
            quantity: existing.quantity + newItem.quantity,
            brand: newItem.brand || existing.brand || '',
            lastPrice: newItem.lastPrice || existing.lastPrice || 0,
            lastRestocked: new Date().toISOString().split('T')[0]
          });
        } else {
          await addDoc(collection(db, "inventory"), {
            name: newItem.name,
            brand: newItem.brand || '',
            category: newItem.category || 'Produce',
            quantity: newItem.quantity,
            unit: newItem.unit,
            reorderLevel: Math.ceil(newItem.quantity * 0.2),
            status: 'healthy',
            supplier: newItem.supplier || 'Imported Source',
            lastRestocked: new Date().toISOString().split('T')[0],
            lastPrice: newItem.lastPrice || 0,
            reserved: 0
          });
        }
      }

      alert(`Successfully ingested ${parsedData.length} inventory records via AI Cloud Sync.`);
    } catch (err) {
      console.error(err);
      alert("AI Processing Failed: Could not parse document structure.");
    } finally {
      setIsAiLoading(false);
      if(e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
            <Scale className="text-emerald-500" size={40} /> 
            Raw Material Hub
            {syncing && <Loader2 className="animate-spin text-slate-300" size={24} />}
          </h2>
          <p className="text-slate-500 font-bold mt-2 uppercase text-[11px] tracking-[0.2em]">Cloud Integrated Registry & Smart Cost Control</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <input type="file" id="ai-inventory" className="hidden" accept="image/*,application/pdf" onChange={handleSmartImport} />
          <label 
            htmlFor="ai-inventory"
            className="bg-white border-2 border-slate-900 text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-lg cursor-pointer active:scale-95 group"
          >
            {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
            <span>{isAiLoading ? 'AI Processing...' : 'AI Bulk Ingest'}</span>
          </label>
          <button 
            onClick={handleOpenAdd} 
            className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-xl active:scale-95 group shadow-emerald-500/10"
          >
            <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Register Asset</span>
          </button>
        </div>
      </div>

      {permissionDenied ? (
        <div className="p-20 bg-white rounded-[3.5rem] border-2 border-dashed border-amber-200 text-center flex flex-col items-center">
          <Database size={64} className="text-amber-300 mb-6" />
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Cloud Database Restricted</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 font-bold uppercase text-[10px] tracking-widest">
            Firestore permissions are missing. Please update your Firebase Security Rules to 'allow read, write: if request.auth != null;'. Using local fallback profile.
          </p>
        </div>
      ) : (
        <>
          {/* Stats Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl overflow-hidden relative group">
                <div className="absolute right-0 top-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Banknote size={100} /></div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Asset Value</p>
                  <h4 className="text-3xl font-black mt-2">₹{items.reduce((acc, curr) => acc + (curr.quantity * (curr.lastPrice || 0)), 0).toLocaleString()}</h4>
                </div>
                <TrendingUp size={32} className="text-emerald-500" />
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 flex justify-between items-center group">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Low Stock Warning</p>
                  <h4 className="text-3xl font-black mt-2 text-rose-500">{items.filter(i => getStatus(i.quantity, i.reorderLevel, i.reserved || 0) === 'low').length}</h4>
                </div>
                <AlertTriangle size={32} className="text-rose-500 opacity-20 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 flex justify-between items-center group">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registry Health</p>
                  <h4 className="text-3xl font-black mt-2 text-slate-900">{items.length} SKUs</h4>
                </div>
                <RefreshCcw size={32} className="text-slate-200" />
            </div>
          </div>

          {/* Search Bar */}
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
            <div className="flex gap-3">
              <select 
                className="px-8 py-5 rounded-3xl bg-slate-50 font-black text-[10px] uppercase outline-none border-none cursor-pointer" 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-[3.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Identity</th>
                  <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty On-Hand</th>
                  <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Base Price</th>
                  <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Health</th>
                  <th className="px-10 py-8 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => {
                  const currentStatus = getStatus(item.quantity, item.reorderLevel, item.reserved || 0);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-all group">
                      <td className="px-10 py-8">
                        <p className="font-black text-slate-900 text-xl tracking-tight mb-1">{item.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">{item.category}</span>
                          {item.brand && <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1"><Tag size={10} /> {item.brand}</span>}
                          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1"><Truck size={10} /> {item.supplier}</span>
                        </div>
                      </td>
                      <td className="px-8 py-8 text-right">
                        <p className="font-black text-slate-900 text-2xl tracking-tighter">{item.quantity} <span className="text-xs font-medium text-slate-400 uppercase">{item.unit}</span></p>
                      </td>
                      <td className="px-8 py-8 text-right">
                        <p className="font-black text-slate-900 text-xl">₹{item.lastPrice || 0} <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">/ {item.unit}</span></p>
                      </td>
                      <td className="px-8 py-8">
                        <div className={`px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 w-fit ${
                          currentStatus === 'healthy' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                          currentStatus === 'low' ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' : 
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {currentStatus === 'healthy' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                          {currentStatus}
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(item)} className="p-4 bg-white border-2 border-slate-100 text-slate-400 hover:text-emerald-600 hover:border-emerald-500 rounded-2xl transition-all shadow-sm active:scale-95"><Edit3 size={18} /></button>
                          <button onClick={() => handleDelete(item.id)} className="p-4 bg-white border-2 border-slate-100 text-slate-400 hover:text-rose-600 hover:border-rose-500 rounded-2xl transition-all shadow-sm active:scale-95"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Manual Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[95vh] flex flex-col">
            <div className="bg-slate-900 p-12 text-white relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-10 right-12 bg-white/10 p-4 rounded-3xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              <h3 className="text-4xl font-black uppercase tracking-tighter">{editingItem ? 'Update Asset' : 'New Asset'}</h3>
              <p className="text-emerald-400 font-black mt-2 text-[10px] uppercase tracking-[0.4em]">Core Supply Chain Interface v4.2 Cloud</p>
            </div>
            
            <div className="p-12 space-y-8 overflow-y-auto">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Identity</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Specification</label>
                    <input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" placeholder="e.g. Amul, Everest" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Level</label>
                    <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Market Price (₹)</label>
                    <input type="number" value={formData.lastPrice} onChange={e => setFormData({...formData, lastPrice: parseFloat(e.target.value) || 0})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier</label>
                    <input type="text" value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alert Level</label>
                    <input type="number" value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: parseFloat(e.target.value) || 0})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-2xl text-slate-900 outline-none focus:border-rose-500 transition-all shadow-inner" />
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
