
import React, { useState, useEffect } from 'react';
import { Tag, PlusCircle, Search, Trash2, Edit3, X, Save, CheckCircle2, Database } from 'lucide-react';
import { Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';

export const BrandManagement: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', category: '' });

  useEffect(() => {
    const q = query(collection(db, "brands"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!formData.name) return alert("Brand name is required.");
    try {
      if (editingBrand) {
        await updateDoc(doc(db, "brands", editingBrand.id), formData);
      } else {
        await addDoc(collection(db, "brands"), formData);
      }
      setIsModalOpen(false);
      setFormData({ name: '', description: '', category: '' });
      setEditingBrand(null);
    } catch (e) {
      alert("Error saving brand.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this brand?")) {
      await deleteDoc(doc(db, "brands", id));
    }
  };

  const populateSamples = async () => {
    if (!confirm("This will add sample brands to your registry. Continue?")) return;
    
    const samples = [
        { name: 'Amul', category: 'Dairy', description: 'Leading dairy cooperative in India known for butter, cheese, and milk.' },
        { name: 'Tata Sampann', category: 'Spices & Pulses', description: 'High quality unpolished pulses and natural spices.' },
        { name: 'India Gate', category: 'Rice', description: 'Premium Basmati rice varieties for commercial kitchens.' },
        { name: 'Everest', category: 'Spices', description: 'Wide range of ground spices and blended masalas.' },
        { name: 'Fortune', category: 'Oil & Staples', description: 'Edible oils, soya chunks, and wheat flour supplies.' },
        { name: 'Nandini', category: 'Dairy', description: 'Fresh milk and curd supplies from KMF.' },
        { name: 'Aashirvaad', category: 'Flour', description: 'Premium wheat flour and multigrain options.' },
        { name: 'MDH', category: 'Spices', description: 'Traditional spice blends and pure spices.' },
        { name: 'Daawat', category: 'Rice', description: 'Everyday and premium basmati rice options.' },
        { name: 'Gowardhan', category: 'Dairy', description: 'Ghee and paneer products.' }
    ];

    try {
        const batch = writeBatch(db);
        samples.forEach(brand => {
            const docRef = doc(collection(db, "brands"));
            batch.set(docRef, brand);
        });
        await batch.commit();
        alert("Sample brands added successfully.");
    } catch (e) {
        console.error(e);
        alert("Failed to add samples.");
    }
  };

  const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Tag className="text-emerald-500" size={32} />
            Brand Registry
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Master Brand List for Sourcing & Quality Control</p>
        </div>
        <div className="flex gap-4">
            <button 
              onClick={populateSamples}
              className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm active:scale-95"
            >
              <Database size={18} />
              Load Samples
            </button>
            <button 
              onClick={() => { setEditingBrand(null); setFormData({ name: '', description: '', category: '' }); setIsModalOpen(true); }}
              className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95"
            >
              <PlusCircle size={18} />
              New Brand
            </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
        <Search className="ml-4 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Filter brands..." 
          className="w-full py-4 text-slate-900 font-bold outline-none bg-transparent"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBrands.map(brand => (
          <div key={brand.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
                  <Tag size={20} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingBrand(brand); setFormData({ name: brand.name, description: brand.description || '', category: brand.category || '' }); setIsModalOpen(true); }} className="text-slate-400 hover:text-emerald-600 p-2"><Edit3 size={18} /></button>
                  <button onClick={() => handleDelete(brand.id)} className="text-slate-400 hover:text-rose-600 p-2"><Trash2 size={18} /></button>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-1">{brand.name}</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{brand.category || 'General'}</p>
              {brand.description && <p className="mt-4 text-slate-600 text-sm font-medium leading-relaxed">{brand.description}</p>}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black uppercase tracking-tight">{editingBrand ? 'Edit Brand' : 'Register Brand'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner" placeholder="e.g. Dairy, Spices" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Short Description</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner h-24 resize-none" />
              </div>
              <button onClick={handleSave} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl flex items-center justify-center gap-3">
                <CheckCircle2 size={18} /> Commit Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
