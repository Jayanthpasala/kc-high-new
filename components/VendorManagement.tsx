
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
  ShieldCheck,
  Globe,
  ArrowUpRight,
  User,
  CheckCircle2,
  ChevronRight,
  Zap,
  Banknote,
  Layers,
  Info,
  DollarSign,
  BarChart3,
  TrendingDown,
  ArrowRightLeft,
  Award,
  AlertOctagon
} from 'lucide-react';
import { Vendor, InventoryItem, VendorPricePoint } from '../types';

const MOCK_VENDORS: Vendor[] = [
  {
    id: 'V1',
    name: 'Maharashtra Agri-Cooperative',
    contact: 'Sunil Deshmukh',
    email: 'orders@maicoop.org.in',
    phone: '+91 98200 12345',
    categories: ['Produce', 'Vegetables'],
    rating: 4.8,
    bankDetails: {
      bankName: 'State Bank of India',
      accountName: 'Maharashtra Agri-Coop Society',
      accountNumber: '**** **** 1122',
      ifscCode: 'SBIN0000300'
    },
    suppliedItems: ['Premium Basmati Rice', 'Fresh Paneer (Malai)'],
    priceLedger: [
      { itemName: 'Premium Basmati Rice', price: 95, unit: 'kg' },
      { itemName: 'Fresh Paneer (Malai)', price: 420, unit: 'kg' }
    ]
  },
  {
    id: 'V2',
    name: 'Bharat Grains & Pulses',
    contact: 'Rahul Verma',
    email: 'verma.rahul@bharatgrains.com',
    phone: '+91 11 2345 6789',
    categories: ['Dry Goods', 'Flour', 'Rice'],
    rating: 4.5,
    bankDetails: {
      bankName: 'HDFC Bank',
      accountName: 'Bharat Grains Wholesale Ltd',
      accountNumber: '**** **** 4490',
      ifscCode: 'HDFC0001234'
    },
    suppliedItems: ['Organic Ghee (1L)', 'Premium Basmati Rice'],
    priceLedger: [
      { itemName: 'Organic Ghee (1L)', price: 580, unit: 'L' },
      { itemName: 'Premium Basmati Rice', price: 105, unit: 'kg' }
    ]
  }
];

type ModalTab = 'identity' | 'supply' | 'financial' | 'pricing';

export const VendorManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('identity');
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invSearch, setInvSearch] = useState('');

  useEffect(() => {
    const loadData = () => {
      const storedVendors = localStorage.getItem('vendors');
      if (storedVendors) {
        setVendors(JSON.parse(storedVendors));
      } else {
        setVendors(MOCK_VENDORS);
        localStorage.setItem('vendors', JSON.stringify(MOCK_VENDORS));
      }

      const storedInv = localStorage.getItem('inventory');
      if (storedInv) setInventory(JSON.parse(storedInv));
    };
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
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

  const handleSave = () => {
    if (!editingVendor?.name) {
      alert('Business identity error: Name is required.');
      return;
    }

    setVendors(prev => {
      let updated: Vendor[];
      if (editingVendor.id) {
        updated = prev.map(v => v.id === editingVendor.id ? editingVendor as Vendor : v);
      } else {
        const newVendor = { ...editingVendor, id: `V-${Math.random().toString(36).substr(2, 5).toUpperCase()}` } as Vendor;
        updated = [newVendor, ...prev];
      }
      localStorage.setItem('vendors', JSON.stringify(updated));
      return updated;
    });

    setIsModalOpen(false);
    window.dispatchEvent(new Event('storage'));
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

  const handleDelete = (id: string) => {
    if (window.confirm('CRITICAL: Permanently remove this partner from the supply registry?')) {
      const updated = vendors.filter(v => v.id !== id);
      setVendors(updated);
      localStorage.setItem('vendors', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    }
  };

  // --- MARKET ANALYSIS LOGIC ---
  const getMarketAnalysis = () => {
    const analysis: Record<string, { vendorName: string, price: number, unit: string }[]> = {};
    
    vendors.forEach(v => {
      v.priceLedger?.forEach(item => {
        if (!analysis[item.itemName]) analysis[item.itemName] = [];
        analysis[item.itemName].push({
          vendorName: v.name,
          price: item.price,
          unit: item.unit
        });
      });
    });

    // Convert to array and sort entries by lowest price
    return Object.entries(analysis).map(([itemName, prices]) => {
      const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
      return {
        itemName,
        quotes: sortedPrices,
        bestPrice: sortedPrices[0],
        priceSpread: sortedPrices.length > 1 ? sortedPrices[sortedPrices.length - 1].price - sortedPrices[0].price : 0
      };
    });
  };

  const filteredInventory = inventory.filter(i => 
    i.name.toLowerCase().includes(invSearch.toLowerCase())
  );

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
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest font-black">Regional Logistics & Comparative Cost Analysis</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsAnalysisOpen(true)}
            className="bg-white border-2 border-slate-200 text-slate-700 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm active:scale-95 group"
          >
            <BarChart3 size={18} />
            <span>Market Analysis</span>
          </button>
          <button 
            onClick={handleOpenAdd}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95 group"
          >
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
            placeholder="Filter suppliers by material or location hub..." 
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredVendors.map(vendor => (
          <div key={vendor.id} className="bg-white rounded-[3rem] border-2 border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl hover:border-emerald-200 transition-all group flex flex-col">
            <div className="p-8 flex-1">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg">
                    <Building2 size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{vendor.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center text-amber-500">
                        <Star size={14} fill="currentColor" />
                        <span className="ml-1 text-xs font-black">{vendor.rating}</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">REG: {vendor.id}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEdit(vendor)} className="p-3 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                  <button onClick={() => handleDelete(vendor.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Phone size={12} /> Communication Hub
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
                    <span className="bg-emerald-500 text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest">
                      {vendor.priceLedger?.length || 0} Rates
                    </span>
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

            <div className="bg-slate-50 px-8 py-4 flex justify-between items-center border-t border-slate-100">
               <div className="flex gap-2">
                 {vendor.categories.map(cat => (
                   <span key={cat} className="text-[9px] font-black uppercase text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                     {cat}
                   </span>
                 ))}
               </div>
               <button onClick={() => handleOpenEdit(vendor)} className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 hover:gap-4 transition-all group/btn">
                 Cost Matrix <ArrowUpRight size={14} className="text-emerald-500 group-hover/btn:translate-x-0.5 transition-transform" />
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* MARKET ANALYSIS MODAL */}
      {isAnalysisOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl border-4 border-slate-900 flex flex-col animate-in zoom-in-95 duration-500">
             <div className="bg-slate-900 p-10 text-white shrink-0 flex justify-between items-start">
               <div>
                 <div className="flex items-center gap-3 mb-2">
                   <div className="bg-blue-500 p-2 rounded-xl text-white"><BarChart3 size={24} /></div>
                   <h3 className="text-3xl font-black tracking-tight">Market Intelligence</h3>
                 </div>
                 <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] ml-1">Cross-Vendor Price Arbitrage & Item Mapping</p>
               </div>
               <button onClick={() => setIsAnalysisOpen(false)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
             </div>

             <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {marketData.length === 0 && (
                     <div className="col-span-full py-20 text-center">
                       <AlertOctagon size={48} className="mx-auto text-slate-300 mb-4" />
                       <p className="text-slate-500 font-bold">No pricing data available. Add vendors and price points to see analysis.</p>
                     </div>
                   )}
                   {marketData.map((data, idx) => (
                     <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-6">
                           <div>
                              <h4 className="text-xl font-black text-slate-900">{data.itemName}</h4>
                              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{data.quotes.length} Suppliers Found</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Best Rate</p>
                              <p className="text-2xl font-black text-emerald-500">₹{data.bestPrice.price}</p>
                              <p className="text-[10px] font-bold text-slate-300 uppercase">Per {data.bestPrice.unit}</p>
                           </div>
                        </div>

                        <div className="space-y-3">
                           {data.quotes.map((quote, qIdx) => (
                             <div key={qIdx} className={`p-4 rounded-2xl flex justify-between items-center border-2 ${qIdx === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                   {qIdx === 0 && <Award size={16} className="text-emerald-500" />}
                                   <span className={`font-bold text-sm ${qIdx === 0 ? 'text-emerald-900' : 'text-slate-600'}`}>{quote.vendorName}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                   {qIdx > 0 && (
                                     <span className="text-[10px] font-black text-rose-400 bg-rose-50 px-2 py-1 rounded-md">
                                       +{(quote.price - data.bestPrice.price).toFixed(2)}
                                     </span>
                                   )}
                                   <span className="font-black text-slate-900">₹{quote.price}</span>
                                </div>
                             </div>
                           ))}
                        </div>
                        
                        {data.quotes.length > 1 && (
                          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400">
                             <div className="flex items-center gap-2">
                               <ArrowRightLeft size={14} />
                               <span>Price Variance</span>
                             </div>
                             <span>₹{data.priceSpread} Spread</span>
                          </div>
                        )}
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Modern Vendor Studio Modal */}
      {isModalOpen && editingVendor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-7xl h-[85vh] overflow-hidden shadow-2xl border-4 border-slate-900 flex animate-in zoom-in-95 duration-500">
            <div className="w-80 bg-slate-900 p-10 flex flex-col shrink-0">
               <div className="mb-12">
                  <div className="w-16 h-16 bg-emerald-500 text-slate-950 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                     <Building2 size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Partner Studio</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">v4.1 Finance Integrated</p>
               </div>

               <nav className="flex-1 space-y-3">
                  {[
                    { id: 'identity', label: 'Identity', icon: <User size={18} /> },
                    { id: 'pricing', label: 'Pricing Matrix', icon: <DollarSign size={18} />, badge: editingVendor.priceLedger?.length },
                    { id: 'supply', label: `Inventory Link`, icon: <Package size={18} /> },
                    { id: 'financial', label: 'Settlement', icon: <CreditCard size={18} /> }
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
                      {tab.badge && (
                        <span className={`px-2 py-0.5 rounded-md ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-white/10 text-emerald-400'}`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
               </nav>

               <div className="pt-10 border-t border-white/5 space-y-4">
                  <button onClick={handleSave} className="w-full bg-emerald-500 text-slate-950 py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3">
                    <CheckCircle2 size={18} /> Commit Spec
                  </button>
               </div>
            </div>

            <div className="flex-1 flex flex-col bg-white overflow-hidden">
               <header className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/20 shrink-0">
                  <h4 className="text-4xl font-black text-slate-900 tracking-tight">{editingVendor.name || 'Vendor Registry'}</h4>
                  <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white border-2 border-slate-100 text-slate-400 hover:text-rose-500 rounded-2xl shadow-sm"><X size={24} /></button>
               </header>

               <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                  {activeTab === 'identity' && (
                    <div className="space-y-12 animate-in fade-in duration-500">
                       <div className="grid grid-cols-12 gap-10">
                          <div className="col-span-7 space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Trade Name</label>
                             <input type="text" value={editingVendor.name} onChange={e => setEditingVendor({...editingVendor, name: e.target.value})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-black text-slate-900 text-xl outline-none focus:border-emerald-500 transition-all shadow-inner" />
                          </div>
                          <div className="col-span-5 space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Lead</label>
                             <input type="text" value={editingVendor.contact} onChange={e => setEditingVendor({...editingVendor, contact: e.target.value})} className="w-full px-8 py-6 rounded-3xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 text-lg outline-none focus:border-emerald-500 transition-all shadow-inner" />
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'pricing' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                       <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white flex justify-between items-center shadow-xl">
                          <div>
                             <h5 className="text-2xl font-black tracking-tight">Active Price Matrix</h5>
                             <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest mt-1">Managed item costs for this supplier</p>
                          </div>
                          <DollarSign className="text-emerald-500" size={40} />
                       </div>
                       
                       <div className="space-y-4">
                          {editingVendor.suppliedItems?.map(item => {
                            const point = editingVendor.priceLedger?.find(p => p.itemName === item);
                            return (
                              <div key={item} className="p-8 bg-white border-2 border-slate-100 rounded-[2rem] flex items-center justify-between group hover:border-emerald-500 transition-all">
                                 <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors"><Package size={24} /></div>
                                    <h6 className="font-black text-lg text-slate-900">{item}</h6>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate (₹)</span>
                                    <input 
                                      type="number" 
                                      value={point?.price || 0} 
                                      onChange={(e) => updatePricePoint(item, parseFloat(e.target.value) || 0)}
                                      className="w-32 px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-black text-slate-900 text-lg text-center outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner" 
                                    />
                                    <span className="text-slate-300 font-black text-xs uppercase">/ {point?.unit || 'kg'}</span>
                                 </div>
                              </div>
                            );
                          })}
                       </div>
                    </div>
                  )}

                  {activeTab === 'supply' && (
                    <div className="space-y-8">
                       <div className="flex justify-between items-center">
                          <h5 className="text-2xl font-black text-slate-900 tracking-tight">Supply Mapping</h5>
                          <input type="text" placeholder="Search inventory..." value={invSearch} onChange={e => setInvSearch(e.target.value)} className="w-64 px-6 py-3 bg-slate-50 rounded-xl border-none font-bold text-xs" />
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filteredInventory.map(item => {
                             const isLinked = editingVendor.suppliedItems?.includes(item.name);
                             return (
                               <button 
                                 key={item.id} 
                                 onClick={() => toggleSuppliedItem(item.name)}
                                 className={`p-6 rounded-2xl border-2 text-left flex items-center justify-between group ${isLinked ? 'border-emerald-500 bg-emerald-50' : 'border-slate-50 bg-white hover:border-slate-100'}`}
                               >
                                  <span className="font-black text-sm">{item.name}</span>
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isLinked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-100 group-hover:border-slate-200'}`}>
                                     {isLinked && <CheckCircle2 size={12} className="text-white" />}
                                  </div>
                               </button>
                             );
                          })}
                       </div>
                    </div>
                  )}

                  {activeTab === 'financial' && (
                    <div className="p-10 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center">
                       <CreditCard size={60} className="text-slate-200 mb-6" />
                       <h5 className="text-2xl font-black text-slate-900">Settlement Profiles</h5>
                       <p className="text-slate-500 max-w-sm mx-auto mt-2 font-medium">Bank details and tax credentials for regional fulfillment compliance.</p>
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
