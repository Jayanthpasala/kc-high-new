
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Trash2, 
  ChevronDown,
  X,
  PlusCircle,
  Settings2,
  Save,
  Lock
} from 'lucide-react';
import { InventoryItem } from '../types';

export const InventoryManagement: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '', category: 'Produce', quantity: 0, unit: 'kg', parLevel: 0, supplier: ''
  });

  useEffect(() => {
    const load = () => {
        const data = localStorage.getItem('inventory');
        if (data) setItems(JSON.parse(data));
        else {
            const initial = [
                { id: '1', name: 'All-Purpose Flour', category: 'Dry Goods', quantity: 45, unit: 'kg', parLevel: 20, lastRestocked: '2024-05-15', status: 'healthy', supplier: 'Grain Masters', reserved: 10 },
                { id: '2', name: 'Fresh Roma Tomatoes', category: 'Produce', quantity: 8, unit: 'kg', parLevel: 15, lastRestocked: '2024-05-18', status: 'low', supplier: 'Green Valley', reserved: 12 },
            ] as InventoryItem[];
            setItems(initial);
            localStorage.setItem('inventory', JSON.stringify(initial));
        }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const saveToStorage = (updated: InventoryItem[]) => {
    localStorage.setItem('inventory', JSON.stringify(updated));
    setItems(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const categories = ['All', 'Produce', 'Dry Goods', 'Proteins', 'Dairy', 'Oils & Vinegars'];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatus = (qty: number, par: number, reserved: number): InventoryItem['status'] => {
    const available = qty - (reserved || 0);
    if (available <= 0) return 'out';
    // 'low' status is only triggered if available stock is BELOW par level
    if (available < par) return 'low';
    return 'healthy';
  };

  const handleSave = () => {
    if (!formData.name || !formData.supplier) { alert('Fill required fields'); return; }
    
    const currentReserved = editingItem?.reserved || 0;
    const status = getStatus(formData.quantity || 0, formData.parLevel || 0, currentReserved);
    const dateStr = new Date().toISOString().split('T')[0];

    if (editingItem) {
      const updated = items.map(item => item.id === editingItem.id ? { ...item, ...formData, status, lastRestocked: dateStr } as InventoryItem : item);
      saveToStorage(updated);
    } else {
      const newItem: InventoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        lastRestocked: dateStr,
        status,
        reserved: 0,
        ...(formData as Omit<InventoryItem, 'id' | 'lastRestocked' | 'status'>)
      };
      saveToStorage([newItem, ...items]);
    }
    setIsModalOpen(false);
  };

  const getStatusStyles = (status: InventoryItem['status']) => {
    switch (status) {
      case 'healthy': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'low': return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      case 'out': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Package className="text-emerald-500" size={32} /> Inventory</h2>
          <p className="text-slate-500 font-medium">Real-time oversight of reserved & physical stock.</p>
        </div>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase flex items-center gap-3"><PlusCircle size={20} />New Stock</button>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search stock..." className="w-full pl-14 pr-4 py-4 rounded-2xl bg-slate-50 border-none font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <select className="px-6 py-4 rounded-2xl bg-slate-50 font-black text-[10px] uppercase outline-none" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingredient</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Stock</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reserved</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Available</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-10 py-6 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map(item => {
              // Calculate status dynamically for the UI to ensure accurate display
              const currentStatus = getStatus(item.quantity, item.parLevel, item.reserved || 0);
              const available = item.quantity - (item.reserved || 0);
              
              return (
                <tr key={item.id} className="hover:bg-slate-50/50 group">
                  <td className="px-10 py-7">
                    <p className="font-black text-slate-900 text-lg">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{item.supplier}</p>
                  </td>
                  <td className="px-8 py-7 font-bold text-slate-900">{item.quantity} <span className="text-xs text-slate-400">{item.unit}</span></td>
                  <td className="px-8 py-7">
                    <div className="flex items-center gap-2 text-amber-600 font-bold">
                      <Lock size={14} /> {item.reserved || 0} <span className="text-xs text-amber-400/60">{item.unit}</span>
                    </div>
                  </td>
                  <td className="px-8 py-7">
                      <p className={`text-lg font-black ${available < item.parLevel ? 'text-rose-500' : 'text-slate-900'}`}>
                          {available} <span className="text-xs text-slate-400">{item.unit}</span>
                      </p>
                  </td>
                  <td className="px-8 py-7">
                    <span className={`px-4 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase ${getStatusStyles(currentStatus)}`}>{currentStatus}</span>
                  </td>
                  <td className="px-10 py-7 text-right">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-2">
                          <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-3 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-all"><Edit3 size={18} /></button>
                          <button onClick={() => saveToStorage(items.filter(i => i.id !== item.id))} className="p-3 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"><Trash2 size={18} /></button>
                      </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl border-4 border-slate-900">
            <div className="bg-slate-900 p-10 text-white relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 bg-white/10 p-3 rounded-2xl"><X /></button>
              <h3 className="text-3xl font-black">{editingItem ? 'Edit Stock' : 'New Stock'}</h3>
            </div>
            <div className="p-10 space-y-6">
               <input type="text" placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-emerald-500" />
               <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Qty" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} className="px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold" />
                  <input type="number" placeholder="Par" value={formData.parLevel} onChange={e => setFormData({...formData, parLevel: parseFloat(e.target.value) || 0})} className="px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold" />
               </div>
            </div>
            <div className="p-10 bg-slate-50 border-t flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase">Cancel</button>
              <button onClick={handleSave} className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black uppercase hover:bg-emerald-600">Save Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
