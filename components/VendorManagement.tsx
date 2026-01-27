
import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  Star, 
  CreditCard, 
  Package, 
  Trash2, 
  Edit3, 
  X, 
  PlusCircle, 
  Building2, 
  CheckCircle2, 
  ArrowUpRight, 
  User, 
  Banknote, 
  DollarSign,
  History,
  TrendingUp,
  FileText,
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react';
import { Vendor, InventoryItem, PurchaseOrder } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy
} from 'firebase/firestore';

type ModalTab = 'identity' | 'supply' | 'financial' | 'pricing' | 'history';

export const VendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('identity');
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null);
  const [invSearch, setInvSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Sync Vendors from Firestore
    const unsubVendors = onSnapshot(query(collection(db, "vendors"), orderBy("name")), (snap) => {
      setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
      setLoading(false);
    });

    // 2. Sync Inventory from Firestore (for linking)
    const unsubInv = onSnapshot(query(collection(db, "inventory"), orderBy("name")), (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    });

    // 3. Sync Purchase Orders from Firestore (for analytics)
    const unsubPOs = onSnapshot(collection(db, "purchaseOrders"), (snap) => {
      setPurchaseOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    });

    return () => {
      unsubVendors();
      unsubInv();
      unsubPOs();
    };
  }, []);

  const getVendorStats = (vendorId: string) => {
    const vendorPOs = purchaseOrders.filter(po => po.vendorId === vendorId);
    const totalSpend = vendorPOs.reduce((acc, po) => acc + (po.totalCost || 0), 0);
    const orderCount = vendorPOs.length;
    const pendingCount = vendorPOs.filter(po => po.status === 'pending' || po.status === 'draft').length;
    return { totalSpend, orderCount, pendingCount, history: vendorPOs };
  };

  const handleSave = async () => {
    if (!editingVendor?.name) return alert('Name is mandatory.');
    
    try {
      if (editingVendor.id) {
        await updateDoc(doc(db, "vendors", editingVendor.id), editingVendor);
      } else {
        await addDoc(collection(db, "vendors"), {
          ...editingVendor,
          rating: 5.0,
          createdAt: Date.now()
        });
      }
      setIsModalOpen(false);
    } catch (e) {
      alert("Error saving partner details.");
    }
  };

  const toggleSuppliedItem = (item: InventoryItem) => {
    if (!editingVendor) return;
    const current = editingVendor.suppliedItems || [];
    const exists = current.includes(item.name);
    
    const newSupplied = exists ? current.filter(i => i !== item.name) : [...current, item.name];
    const newLedger = exists 
      ? (editingVendor.priceLedger || []).filter(p => p.itemName !== item.name)
      : [...(editingVendor.priceLedger || []), { itemName: item.name, brand: item.brand || '', price: item.lastPrice || 0, unit: item.unit }];

    setEditingVendor({
      ...editingVendor,
      suppliedItems: newSupplied,
      priceLedger: newLedger
    });
  };

  const updatePricePoint = (itemName: string, field: 'price' | 'brand', value: any) => {
    if (!editingVendor) return;
    const ledger = (editingVendor.priceLedger || []).map(p => 
      p.itemName === itemName ? { ...p, [field]: value } : p
    );
    setEditingVendor({ ...editingVendor, priceLedger: ledger });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Permanently remove this partner from the supply registry?')) {
      await deleteDoc(doc(db, "vendors", id));
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.categories?.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Truck className="text-emerald-500" size={32} />
            Supply Chain Registry
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest font-black">Regional Logistics & Comparative Cost Analysis</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => {
              setEditingVendor({ name: '', contact: '', email: '', phone: '', categories: [], bankDetails: { bankName: '', accountName: '', accountNumber: '', ifscCode: '' }, suppliedItems: [], priceLedger: [] });
              setActiveTab('identity');
              setIsModalOpen(true);
            }}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95"
          >
            <PlusCircle size={18} />
            Onboard Partner
          </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
        <Search className="ml-4 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Filter suppliers by material or location hub..." 
          className="w-full py-4 text-slate-900 font-bold outline-none bg-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-emerald-500" size={48} />
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Syncing Partner Cloud...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredVendors.map(vendor => {
            const stats = getVendorStats(vendor.id);
            return (
              <div key={vendor.id} className="bg-white rounded-[3rem] border-2 border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group flex flex-col">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center">
                        <Building2 size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{vendor.name}</h3>
                        <div className="flex items-center gap-3 mt-1 font-black text-[9px] uppercase tracking-widest text-slate-400">
                          <span className="flex items-center gap-1 text-amber-500"><Star size={12} fill="currentColor" /> {vendor.rating || 5.0}</span>
                          <span>|</span>
                          <span>{vendor.contact}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingVendor(vendor); setIsModalOpen(true); }} className="p-3 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                      <button onClick={() => handleDelete(vendor.id)} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Procurement</p>
                      <p className="text-2xl font-black text-slate-900">₹{stats.totalSpend.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-2xl shadow-lg">
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Active Ledger</p>
                      <p className="text-2xl font-black text-white">{vendor.suppliedItems?.length || 0} <span className="text-xs text-slate-500">Items</span></p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 px-8 py-4 flex justify-between items-center border-t border-slate-100">
                   <div className="flex gap-2">
                     {(vendor.categories || []).slice(0, 2).map(cat => (
                       <span key={cat} className="text-[9px] font-black uppercase text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-md">{cat}</span>
                     ))}
                   </div>
                   <button onClick={() => { setEditingVendor(vendor); setIsModalOpen(true); }} className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 hover:gap-4 transition-all">
                     View Studio <ArrowUpRight size={14} className="text-emerald-500" />
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && editingVendor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-7xl h-[85vh] overflow-hidden shadow-2xl border-4 border-slate-900 flex animate-in zoom-in-95 duration-500">
            {/* Sidebar Navigation */}
            <div className="w-80 bg-slate-900 p-10 flex flex-col shrink-0">
               <div className="mb-12">
                  <div className="w-16 h-16 bg-emerald-500 text-slate-950 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                     <Building2 size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight leading-none">Partner Studio</h3>
                  <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest mt-2">Compliance & Logistics</p>
               </div>

               <nav className="flex-1 space-y-3">
                  {[
                    { id: 'identity', label: 'Identity', icon: <User size={18} /> },
                    { id: 'financial', label: 'Bank Details', icon: <CreditCard size={18} /> },
                    { id: 'supply', label: `Supply Map`, icon: <Package size={18} />, badge: editingVendor.suppliedItems?.length },
                    { id: 'pricing', label: 'Rate Card', icon: <DollarSign size={18} /> },
                    { id: 'history', label: 'History', icon: <History size={18} /> }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as ModalTab)}
                      className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        activeTab === tab.id 
                          ? 'bg-white text-slate-900 shadow-xl' 
                          : 'text-slate-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {tab.icon} {tab.label}
                      </div>
                      {tab.badge ? <span className="bg-emerald-500 text-slate-950 px-2 rounded-md">{tab.badge}</span> : null}
                    </button>
                  ))}
               </nav>

               <div className="pt-10 border-t border-white/5">
                  <button onClick={handleSave} className="w-full bg-emerald-500 text-slate-950 py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3">
                    <CheckCircle2 size={18} /> Commit Changes
                  </button>
               </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
               <header className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/20 shrink-0">
                  <div>
                    <h4 className="text-4xl font-black text-slate-900 tracking-tight">{editingVendor.name || 'New Onboarding'}</h4>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white border-2 border-slate-100 text-slate-400 hover:text-rose-500 rounded-2xl shadow-sm"><X size={24} /></button>
               </header>

               <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                  {activeTab === 'identity' && (
                    <div className="space-y-10 animate-in fade-in duration-500 text-slate-900">
                       <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade Name</label>
                             <input type="text" value={editingVendor.name} onChange={e => setEditingVendor({...editingVendor, name: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Person</label>
                             <input type="text" value={editingVendor.contact} onChange={e => setEditingVendor({...editingVendor, contact: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                             <input type="email" value={editingVendor.email} onChange={e => setEditingVendor({...editingVendor, email: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile/Phone</label>
                             <input type="text" value={editingVendor.phone} onChange={e => setEditingVendor({...editingVendor, phone: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none" />
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'financial' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                       <div className="bg-emerald-500 p-8 rounded-[2rem] text-slate-900 flex justify-between items-center shadow-lg shadow-emerald-500/10">
                          <div>
                             <h5 className="text-xl font-black uppercase tracking-tight">Settlement Credentials</h5>
                             <p className="text-slate-900/60 text-[9px] font-black uppercase tracking-widest mt-1">Bank details for financial transfers</p>
                          </div>
                          <Banknote size={32} />
                       </div>

                       <div className="grid grid-cols-2 gap-8 text-slate-900">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Name</label>
                             <input type="text" value={editingVendor.bankDetails?.bankName} onChange={e => setEditingVendor({...editingVendor, bankDetails: { ...editingVendor.bankDetails!, bankName: e.target.value }})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none" placeholder="e.g. HDFC Bank" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Beneficiary Name</label>
                             <input type="text" value={editingVendor.bankDetails?.accountName} onChange={e => setEditingVendor({...editingVendor, bankDetails: { ...editingVendor.bankDetails!, accountName: e.target.value }})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none" placeholder="Registered Company Name" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Number</label>
                             <input type="text" value={editingVendor.bankDetails?.accountNumber} onChange={e => setEditingVendor({...editingVendor, bankDetails: { ...editingVendor.bankDetails!, accountNumber: e.target.value }})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IFSC / Swift Code</label>
                             <input type="text" value={editingVendor.bankDetails?.ifscCode} onChange={e => setEditingVendor({...editingVendor, bankDetails: { ...editingVendor.bankDetails!, ifscCode: e.target.value }})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none" />
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'supply' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                       <div className="flex justify-between items-center">
                          <h5 className="text-2xl font-black text-slate-900 tracking-tight">Ingredient Mapping</h5>
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="text" placeholder="Search master pantry..." value={invSearch} onChange={e => setInvSearch(e.target.value)} className="w-64 pl-10 pr-6 py-3 bg-slate-50 rounded-xl border-none font-bold text-xs text-slate-900" />
                          </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {inventory.filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase())).map(item => {
                             const isLinked = editingVendor.suppliedItems?.includes(item.name);
                             return (
                               <button 
                                 key={item.id} 
                                 onClick={() => toggleSuppliedItem(item)}
                                 className={`p-6 rounded-2xl border-2 text-left flex items-center justify-between group transition-all ${isLinked ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                               >
                                  <div className="flex flex-col">
                                     <span className="font-black text-sm text-slate-900">{item.name}</span>
                                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.category} • {item.brand || 'Unbranded'}</span>
                                  </div>
                                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isLinked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200'}`}>
                                     {isLinked && <CheckCircle2 size={16} className="text-white" />}
                                  </div>
                               </button>
                             );
                          })}
                       </div>
                    </div>
                  )}

                  {activeTab === 'pricing' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                       <div className="bg-slate-900 p-8 rounded-[2rem] text-white flex justify-between items-center">
                          <div>
                             <h5 className="text-xl font-black uppercase tracking-tight">Contractual Rate Ledger</h5>
                             <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest mt-1">Negotiated price per unit</p>
                          </div>
                          <DollarSign className="text-emerald-500" size={32} />
                       </div>
                       
                       <div className="space-y-4">
                          {(editingVendor.priceLedger || []).map((point, idx) => (
                              <div key={idx} className="p-6 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-between">
                                 <div>
                                    <h6 className="font-black text-slate-900">{point.itemName}</h6>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{point.brand || 'Any Brand'}</p>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="text-right">
                                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Unit Rate (₹)</label>
                                       <input 
                                         type="number" 
                                         value={point.price || 0} 
                                         onChange={(e) => updatePricePoint(point.itemName, 'price', parseFloat(e.target.value) || 0)}
                                         className="w-32 px-4 py-2 rounded-lg bg-slate-100 border-none font-black text-slate-900 text-center"
                                       />
                                    </div>
                                    <span className="text-slate-300 font-black text-xs uppercase pt-4">/ {point.unit || 'kg'}</span>
                                 </div>
                              </div>
                          ))}
                          {(editingVendor.suppliedItems?.length || 0) === 0 && (
                            <div className="p-20 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                               <Package size={48} className="text-slate-100 mx-auto mb-4" />
                               <p className="text-slate-400 font-black text-xs uppercase tracking-widest">No items mapped. Link materials in the 'Supply Map' tab.</p>
                            </div>
                          )}
                       </div>
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                       <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-200">
                          <div className="flex items-center gap-4 mb-8">
                             <TrendingUp className="text-emerald-500" size={32} />
                             <h5 className="text-2xl font-black text-slate-900 tracking-tight">Procurement Volume</h5>
                          </div>
                          <div className="grid grid-cols-3 gap-6">
                             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Spent</p>
                                <p className="text-3xl font-black text-slate-900">₹{getVendorStats(editingVendor.id!).totalSpend.toLocaleString()}</p>
                             </div>
                             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Orders Fulfilled</p>
                                <p className="text-3xl font-black text-slate-900">{getVendorStats(editingVendor.id!).orderCount}</p>
                             </div>
                             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending Audit</p>
                                <p className="text-3xl font-black text-rose-500">{getVendorStats(editingVendor.id!).pendingCount}</p>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Audit History</h6>
                          {getVendorStats(editingVendor.id!).history.map(po => (
                            <div key={po.id} className="p-6 bg-white border border-slate-100 rounded-2xl flex items-center justify-between hover:border-emerald-200 transition-all">
                               <div className="flex items-center gap-5 text-slate-900">
                                  <div className={`p-3 rounded-xl ${po.status === 'received' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                                     <FileText size={18} />
                                  </div>
                                  <div>
                                     <p className="font-black text-sm uppercase">{po.orderNumber}</p>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(po.createdAt).toLocaleDateString()}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="font-black text-slate-900 text-lg">₹{po.totalCost?.toLocaleString()}</p>
                                  <span className={`text-[8px] font-black uppercase tracking-widest ${po.status === 'received' ? 'text-emerald-500' : 'text-amber-500'}`}>{po.status}</span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
