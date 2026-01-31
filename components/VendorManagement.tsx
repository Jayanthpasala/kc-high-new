
import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  Star, 
  Phone, 
  Mail, 
  CreditCard, 
  Package, 
  Trash2, 
  Edit3, 
  X, 
  PlusCircle, 
  Building2, 
  ArrowUpRight,
  User,
  CheckCircle2,
  DollarSign,
  BarChart3,
  Award,
  TrendingUp
} from 'lucide-react';
import { Vendor, InventoryItem } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, setDoc, doc, deleteDoc } from 'firebase/firestore';

type ModalTab = 'identity' | 'supply' | 'financial' | 'pricing' | 'performance';

export const VendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('identity');
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  useEffect(() => {
    // Sync Vendors from Firestore
    const unsubVendors = onSnapshot(collection(db, "vendors"), (snap) => {
      setVendors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
    });

    // Sync Inventory for Linkages
    const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => {
      setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });
    
    // Sync POs for stats
    const unsubPOs = onSnapshot(collection(db, "purchaseOrders"), (snap) => {
      setPurchaseOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubVendors();
      unsubInv();
      unsubPOs();
    };
  }, []);

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.categories.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenEdit = (vendor: Vendor) => {
    setEditingVendor({ ...vendor, priceLedger: vendor.priceLedger || [] });
    setActiveTab('identity');
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingVendor({
      name: '',
      contact: '',
      email: '',
      phone: '',
      categories: [],
      rating: 5.0,
      bankDetails: { bankName: '', accountName: '', accountNumber: '', ifscCode: '' },
      suppliedItems: [],
      priceLedger: []
    });
    setActiveTab('identity');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingVendor?.name) {
      alert('Business identity error: Name is required.');
      return;
    }

    const vendorId = editingVendor.id || `V-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    try {
      await setDoc(doc(db, "vendors", vendorId), { ...editingVendor, id: vendorId });
      setIsModalOpen(false);
    } catch (e) {
      alert("Failed to sync vendor to cloud.");
    }
  };

  const updatePricePoint = (itemName: string, newPrice: number) => {
    if (!editingVendor) return;
    const ledger = [...(editingVendor.priceLedger || [])];
    const idx = ledger.findIndex(p => p.itemName === itemName);
    if (idx > -1) {
      ledger[idx].price = newPrice;
    } else {
      const invItem = inventory.find(i => i.name === itemName);
      ledger.push({ itemName, price: newPrice, unit: invItem?.unit || 'kg' });
    }
    setEditingVendor({ ...editingVendor, priceLedger: ledger });
  };

  const toggleSuppliedItem = (itemName: string) => {
    if (!editingVendor) return;
    const current = editingVendor.suppliedItems || [];
    const exists = current.includes(itemName);
    
    setEditingVendor({
      ...editingVendor,
      suppliedItems: exists 
        ? current.filter(i => i !== itemName)
        : [...current, itemName],
      priceLedger: exists 
        ? (editingVendor.priceLedger || []).filter(p => p.itemName !== itemName)
        : [...(editingVendor.priceLedger || []), { itemName, price: 0, unit: inventory.find(i => i.name === itemName)?.unit || 'kg' }]
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('CRITICAL: Permanently remove this partner from the supply registry?')) {
      try {
        await deleteDoc(doc(db, "vendors", id));
      } catch (e) {
        alert("Failed to delete vendor.");
      }
    }
  };

  const getVendorStats = (vendorId: string) => {
     const orders = purchaseOrders.filter(po => po.vendorId === vendorId);
     const totalSpend = orders.reduce((acc, po) => acc + (po.totalCost || 0), 0);
     return { count: orders.length, totalSpend, lastOrder: orders.length > 0 ? new Date(orders[0].createdAt).toLocaleDateString() : 'N/A' };
  };

  const getMarketAnalysis = () => {
    const analysis: Record<string, { vendorName: string, price: number, unit: string }[]> = {};
    vendors.forEach(v => {
      v.priceLedger?.forEach(item => {
        if (!analysis[item.itemName]) analysis[item.itemName] = [];
        analysis[item.itemName].push({ vendorName: v.name, price: item.price, unit: item.unit });
      });
    });
    return Object.entries(analysis).map(([itemName, prices]) => {
      const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
      return {
        itemName,
        quotes: sortedPrices,
        bestPrice: sortedPrices[0]
      };
    });
  };

  const filteredInventory = inventory.filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase()));
  const marketData = getMarketAnalysis();

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Truck className="text-emerald-500" size={32} />
            Supply Chain Registry
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest font-black">Cloud-Synced Regional Logistics & Comparative Cost Analysis</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => setIsAnalysisOpen(true)} className="bg-white border-2 border-slate-200 text-slate-700 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm group">
            <BarChart3 size={18} />
            <span>Market Analysis</span>
          </button>
          <button onClick={handleOpenAdd} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95 group">
            <PlusCircle size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Onboard New Partner</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Filter suppliers..." 
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {filteredVendors.map(vendor => (
          <div key={vendor.id} className="bg-white rounded-[3rem] border-2 border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl hover:border-emerald-200 transition-all group flex flex-col">
            <div className="p-8 flex-1">
              <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shrink-0">
                    <Building2 size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{vendor.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center text-amber-500">
                        <Star size={14} fill="currentColor" />
                        <span className="ml-1 text-xs font-black">{vendor.rating}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                         Spent: ₹{(getVendorStats(vendor.id).totalSpend / 1000).toFixed(1)}k
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 self-end sm:self-start">
                  <button onClick={() => handleOpenEdit(vendor)} className="p-3 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                  <button onClick={() => handleDelete(vendor.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Phone size={12} /> Contact
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-slate-700">{vendor.contact}</p>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <Mail size={12} /> {vendor.email}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Package size={12} /> Pricing Ledger
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {vendor.priceLedger?.slice(0, 2).map((p, idx) => (
                      <span key={idx} className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight border border-slate-100">
                        {p.itemName}: ₹{p.price}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && editingVendor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-7xl h-[85vh] overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col lg:flex-row animate-in zoom-in-95 duration-500 max-h-[90vh] lg:max-h-full overflow-y-auto">
            <div className="w-full lg:w-80 bg-slate-900 p-8 sm:p-10 flex flex-col shrink-0 overflow-y-auto max-h-[30vh] lg:max-h-full">
               <nav className="flex-1 space-y-3">
                  {[
                    { id: 'identity', label: 'Identity', icon: <User size={18} /> },
                    { id: 'pricing', label: 'Pricing Matrix', icon: <DollarSign size={18} />, badge: editingVendor.priceLedger?.length },
                    { id: 'supply', label: `Inventory Link`, icon: <Package size={18} /> }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as ModalTab)}
                      className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        activeTab === tab.id ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-4">{tab.icon} {tab.label}</div>
                    </button>
                  ))}
               </nav>
               <button onClick={handleSave} className="w-full bg-emerald-500 text-slate-950 py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:scale-105 transition-all">Sync to Cloud</button>
            </div>

            <div className="flex-1 flex flex-col bg-white overflow-hidden p-10">
               {activeTab === 'identity' && (
                 <div className="space-y-8 animate-in fade-in">
                    <input type="text" value={editingVendor.name} onChange={e => setEditingVendor({...editingVendor, name: e.target.value})} placeholder="Vendor Name" className="w-full px-8 py-6 rounded-3xl bg-slate-50 font-black text-xl" />
                    <input type="text" value={editingVendor.contact} onChange={e => setEditingVendor({...editingVendor, contact: e.target.value})} placeholder="Contact Lead" className="w-full px-8 py-6 rounded-3xl bg-slate-50 font-bold" />
                 </div>
               )}
               {activeTab === 'pricing' && (
                  <div className="space-y-4 overflow-y-auto custom-scrollbar">
                    {editingVendor.suppliedItems?.map(item => (
                       <div key={item} className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center">
                          <span className="font-black">{item}</span>
                          <input type="number" value={editingVendor.priceLedger?.find(p => p.itemName === item)?.price || 0} onChange={(e) => updatePricePoint(item, parseFloat(e.target.value) || 0)} className="w-24 px-4 py-2 rounded-xl text-center font-black" />
                       </div>
                    ))}
                  </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
