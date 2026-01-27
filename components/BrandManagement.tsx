
import React, { useState, useEffect } from 'react';
import { Tag, PlusCircle, Search, Trash2, Edit3, X, Save, CheckCircle2, Box } from 'lucide-react';
import { Brand, InventoryItem } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

export const BrandManagement: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    itemId: '', 
    itemName: '',
    category: '' 
  });

  const CATEGORIES = ['Produce', 'Dry Goods', 'Proteins', 'Dairy', 'Spices', 'Beverages', 'Packaging'];

  useEffect(() => {
    // Fetch Brands
    const qBrands = query(collection(db, "brands"), orderBy("name"));
    const unsubBrands = onSnapshot(qBrands, (snapshot) => {
      setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
    });

    // Fetch Inventory Items for linking
    const qInv = query(collection(db, "inventory"), orderBy("name"));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });

    return () => {
      unsubBrands();
      unsubInv();
    };
  }, []);

  const handleItemSelect = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (item) {
      setFormData({
        ...formData,
        itemId: item.id,
        itemName: item.name,
        category: item.category // Auto-link category from item
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.itemId) {
      alert("Brand Name and Linked Item are compulsory.");
      return;
    }
    
    try {
      if (editingBrand) {
        await updateDoc(doc(db, "brands", editingBrand.id), formData);
      } else {
        await addDoc(collection(db, "brands"), formData);
      }
      setIsModalOpen(false);
      setFormData({ name: '', description: '', itemId: '', itemName: '', category: '' });
      setEditingBrand(null);
    } catch (e) {
      alert("Error saving brand record.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Permanently delete this brand link?")) {
      await deleteDoc(doc(db, "brands", id));
    }
  };

  const filteredBrands = brands.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Tag className="text-emerald-500" size={32} />
            Brand-Item Registry
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Compulsory Item & Brand Association Hub</p>
        </div>
        <button 
          onClick={() => { 
            setEditingBrand(null); 
            setFormData({ name: '', description: '', itemId: '', itemName: '', category: '' }); 
            setIsModalOpen(true); 
          }}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95"
        >
          <PlusCircle size={18} />
          Create Link
        </button>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
        <Search className="ml-4 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Filter by brand name or linked material..." 
          className="w-full py-4 text-slate-900 font-bold outline-none bg-transparent"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBrands.map(brand => (
          <div key={brand.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between border-t-4 border-t-emerald-500">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
                  <Tag size={20} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { 
                    setEditingBrand(brand); 
                    setFormData({ 
                      name: brand.name, 
                      description: brand.description || '', 
                      itemId: brand.itemId, 
                      itemName: brand.itemName,
                      category: brand.category || '' 
                    }); 
                    setIsModalOpen(true); 
                  }} className="text-slate-400 hover:text-emerald-600 p-2"><Edit3 size={18} /></button>
                  <button onClick={() => handleDelete(brand.id)} className="text-slate-400 hover:text-rose-600 p-2"><Trash2 size={18} /></button>
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">{brand.name}</h3>
              
              <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                 <div className="flex items-center gap-2 text-slate-400">
                    <Box size={14} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Linked Material</p>
                 </div>
                 <p className="text-sm font-black text-slate-900">{brand.itemName}</p>
                 <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">
                      {brand.category}
                    </span>
                 </div>
              </div>
            </div>
          </div>
        ))}
        {filteredBrands.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
             <Tag size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No brand-item associations found.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-tight">{editingBrand ? 'Modify Association' : 'New Association'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand Name</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Amul, Everest"
                  className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link to Material (Compulsory)</label>
                <select 
                  value={formData.itemId} 
                  onChange={e => handleItemSelect(e.target.value)}
                  className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner appearance-none cursor-pointer"
                >
                  <option value="" className="text-slate-900">-- Select Inventory Item --</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id} className="text-slate-900">{item.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category Association</label>
                <select 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner appearance-none cursor-pointer"
                >
                  <option value="" className="text-slate-900">Select Category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="text-slate-900">{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes (Optional)</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner h-20 resize-none" 
                />
              </div>

              <button onClick={handleSave} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95">
                <CheckCircle2 size={18} /> Commit Association
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
