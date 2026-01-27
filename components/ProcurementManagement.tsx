
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  Truck, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  ArrowRight, 
  Plus, 
  X, 
  Search, 
  FileText, 
  ChevronRight, 
  Inbox, 
  Banknote, 
  PlusCircle,
  ClipboardList,
  History,
  Info,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  Building,
  ChefHat,
  TrendingUp,
  TrendingDown,
  MapPin,
  Mail,
  Phone
} from 'lucide-react';
import { PendingProcurement, PurchaseOrder, InventoryItem, Vendor, POTemplateConfig } from '../types';

const DEFAULT_PO_CONFIG: POTemplateConfig = {
  companyName: 'CulinaOps ERP Systems',
  address: 'Mumbai, Maharashtra',
  gstin: 'GST-UNREGISTERED',
  pan: 'PAN-UNAVAILABLE',
  email: 'ops@culinaops.com',
  phone: 'Contact Admin',
  terms: 'Net 15 Days payment.'
};

export const ProcurementManagement: React.FC = () => {
  const [procurements, setProcurements] = useState<PendingProcurement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeTab, setActiveTab] = useState<'SHORTAGES' | 'PENDING' | 'COMPLETED'>('SHORTAGES');
  const [poConfig, setPoConfig] = useState<POTemplateConfig>(DEFAULT_PO_CONFIG);
  
  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [approvingProcurement, setApprovingProcurement] = useState<PendingProcurement | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  
  // Manual Request Form State
  const [manualReq, setManualReq] = useState({
    name: '',
    qty: 0,
    unit: 'kg',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // Approval Form State
  const [approvalData, setApprovalData] = useState<{vendorId: string, quantity: number, unitPrice: number}>({
    vendorId: '',
    quantity: 0,
    unitPrice: 0
  });

  useEffect(() => {
    const load = () => {
      const inv = JSON.parse(localStorage.getItem('inventory') || '[]');
      const vends = JSON.parse(localStorage.getItem('vendors') || '[]');
      const pos = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
      const manualProcs = JSON.parse(localStorage.getItem('manualProcurements') || '[]');
      const savedConfig = localStorage.getItem('poTemplateConfig');
      
      if (savedConfig) setPoConfig(JSON.parse(savedConfig));
      setInventory(inv);
      setVendors(vends);
      setPurchaseOrders(pos);

      const autoShortages: PendingProcurement[] = inv
        .filter((item: InventoryItem) => (item.quantity - (item.reserved || 0)) <= item.reorderLevel)
        .map((item: InventoryItem) => ({
          id: `SHORT-${item.id}`,
          ingredientName: item.name,
          requiredQty: item.reorderLevel * 2, 
          currentStock: item.quantity - (item.reserved || 0),
          shortageQty: item.reorderLevel - (item.quantity - (item.reserved || 0)),
          unit: item.unit,
          requiredByDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pending',
          createdAt: Date.now(),
          isManual: false
        }));
      
      setProcurements([...autoShortages, ...manualProcs]);
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const handleManualRequest = () => {
    if (!manualReq.name || manualReq.qty <= 0) return;
    const newReq: PendingProcurement = {
      id: `REQ-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      ingredientName: manualReq.name,
      requiredQty: manualReq.qty,
      currentStock: 0,
      shortageQty: manualReq.qty,
      unit: manualReq.unit,
      requiredByDate: manualReq.date,
      status: 'pending',
      createdAt: Date.now(),
      isManual: true
    };
    const existingManual = JSON.parse(localStorage.getItem('manualProcurements') || '[]');
    localStorage.setItem('manualProcurements', JSON.stringify([newReq, ...existingManual]));
    setProcurements(prev => [newReq, ...prev]);
    setIsRequestModalOpen(false);
    window.dispatchEvent(new Event('storage'));
  };

  const getLowestPriceVendor = (itemName: string) => {
    const capableVendors = vendors.filter(v => (v.priceLedger || []).some(p => p.itemName === itemName));
    if (capableVendors.length === 0) return null;
    return capableVendors.sort((a, b) => {
      const priceA = a.priceLedger?.find(p => p.itemName === itemName)?.price || Infinity;
      const priceB = b.priceLedger?.find(p => p.itemName === itemName)?.price || Infinity;
      return priceA - priceB;
    })[0];
  };

  const startApproval = (p: PendingProcurement) => {
    const cheapestVendor = getLowestPriceVendor(p.ingredientName) || vendors[0];
    const unitPrice = cheapestVendor?.priceLedger?.find(pl => pl.itemName === p.ingredientName)?.price || 0;
    
    setApprovingProcurement(p);
    setApprovalData({
      vendorId: cheapestVendor?.id || '',
      quantity: p.requiredQty,
      unitPrice
    });
  };

  const finalizePO = () => {
    if (!approvingProcurement || !approvalData.vendorId) return;
    const selectedVendor = vendors.find(v => v.id === approvalData.vendorId);
    
    const newPO: PurchaseOrder = {
      id: `PO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      vendorId: selectedVendor?.id || 'V-UNKNOWN',
      vendorName: selectedVendor?.name || 'Manual Partner',
      items: [{ 
        ingredientName: approvingProcurement.ingredientName, 
        quantity: approvalData.quantity, 
        unit: approvingProcurement.unit,
        priceAtOrder: approvalData.unitPrice
      }],
      expectedDeliveryDate: approvingProcurement.requiredByDate,
      status: 'pending',
      createdAt: Date.now(),
      totalCost: approvalData.quantity * approvalData.unitPrice
    };
    
    const updatedPOs = [newPO, ...purchaseOrders];
    localStorage.setItem('purchaseOrders', JSON.stringify(updatedPOs));
    setPurchaseOrders(updatedPOs);
    
    if (approvingProcurement.isManual) {
      const existingManual = JSON.parse(localStorage.getItem('manualProcurements') || '[]');
      localStorage.setItem('manualProcurements', JSON.stringify(existingManual.filter((p: any) => p.id !== approvingProcurement.id)));
    }
    
    setApprovingProcurement(null);
    setActiveTab('PENDING');
    window.dispatchEvent(new Event('storage'));
  };

  const markReceived = (po: PurchaseOrder) => {
    const storedInv: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
    let updatedInventory = [...storedInv];

    po.items.forEach(item => {
      const idx = updatedInventory.findIndex(i => i.name.toLowerCase() === item.ingredientName.toLowerCase());
      if (idx > -1) {
        updatedInventory[idx].quantity += item.quantity;
        if (item.priceAtOrder) updatedInventory[idx].lastPrice = item.priceAtOrder;
        updatedInventory[idx].lastRestocked = new Date().toISOString().split('T')[0];
        const it = updatedInventory[idx];
        it.status = (it.quantity - (it.reserved || 0)) <= it.reorderLevel ? 'low' : 'healthy';
      }
    });

    const updatedPOs = purchaseOrders.map(p => p.id === po.id ? { ...p, status: 'received' as any } : p);
    localStorage.setItem('inventory', JSON.stringify(updatedInventory));
    localStorage.setItem('purchaseOrders', JSON.stringify(updatedPOs));
    setPurchaseOrders(updatedPOs);
    window.dispatchEvent(new Event('storage'));
    setActiveTab('COMPLETED');
  };

  const downloadPDF = (po: PurchaseOrder) => {
    setViewingPO(po);
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <ShoppingCart className="text-emerald-500" size={32} />
             Procurement Studio
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest font-black">Comparative Cost Sourcing & restored logistics</p>
        </div>
        <div className="flex flex-wrap gap-4">
           <button onClick={() => setIsRequestModalOpen(true)} className="bg-white border-2 border-slate-200 text-slate-900 px-7 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:border-emerald-500 transition-all shadow-sm">
              <PlusCircle size={16} /> Request Material
           </button>
           <div className="bg-white p-1.5 rounded-2xl border-2 border-slate-100 flex shadow-sm">
            {['SHORTAGES', 'PENDING', 'COMPLETED'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>
                {tab === 'SHORTAGES' ? 'Stock Alerts' : tab === 'PENDING' ? 'In Flight' : 'Archive'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'SHORTAGES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 no-print">
          {procurements.map(p => {
             const cheapest = getLowestPriceVendor(p.ingredientName);
             return (
              <div key={p.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl transition-all flex flex-col group animate-in slide-in-from-bottom-4">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all"><AlertTriangle size={32} /></div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Cost</p>
                    <p className="text-sm font-black text-emerald-600">₹{((cheapest?.priceLedger?.find(pl => pl.itemName === p.ingredientName)?.price || 0) * p.requiredQty).toLocaleString()}</p>
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 mb-2">{p.ingredientName}</h3>
                
                {cheapest ? (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
                     <TrendingDown size={20} className="text-emerald-500 shrink-0" />
                     <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Cheapest Provider</p>
                        <p className="text-xs font-black text-slate-900">{cheapest.name} (₹{cheapest.priceLedger?.find(pl => pl.itemName === p.ingredientName)?.price}/u)</p>
                     </div>
                  </div>
                ) : (
                  <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                     <Info size={20} className="text-slate-400 shrink-0" />
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">No pricing data available for this asset. Manual selection required.</p>
                  </div>
                )}

                <button onClick={() => startApproval(p)} className="mt-8 w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95">
                  <CheckCircle size={18} /> Approve & Settle PO
                </button>
              </div>
             );
          })}
        </div>
      )}

      {/* Approval Modal */}
      {approvingProcurement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300 no-print">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-slate-900">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black">PO Finalization</h3>
                <p className="text-emerald-400 font-black text-[9px] uppercase tracking-widest mt-1">Vendor Cost Comparison Matrix</p>
              </div>
              <TrendingUp className="text-emerald-500" />
            </div>
            
            <div className="p-10 space-y-8">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Building size={14} /> Compare Suppliers for {approvingProcurement.ingredientName}</label>
                  <div className="space-y-3">
                    {vendors.filter(v => (v.priceLedger || []).some(pl => pl.itemName === approvingProcurement.ingredientName)).map(vendor => {
                       const price = vendor.priceLedger?.find(pl => pl.itemName === approvingProcurement.ingredientName)?.price || 0;
                       const isCheapest = getLowestPriceVendor(approvingProcurement.ingredientName)?.id === vendor.id;
                       return (
                        <button 
                          key={vendor.id} 
                          onClick={() => {
                            setApprovalData({...approvalData, vendorId: vendor.id, unitPrice: price});
                          }}
                          className={`w-full p-6 rounded-2xl border-2 flex items-center justify-between transition-all ${approvalData.vendorId === vendor.id ? 'border-emerald-500 bg-emerald-50 shadow-lg' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCheapest ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                 {isCheapest ? <TrendingDown size={20} /> : <Building size={20} />}
                              </div>
                              <div className="text-left">
                                 <p className="font-black text-slate-900">{vendor.name}</p>
                                 {isCheapest && <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Market Low Rate</span>}
                              </div>
                           </div>
                           <p className="text-xl font-black text-slate-900">₹{price} <span className="text-[10px] text-slate-300">/ {approvingProcurement.unit}</span></p>
                        </button>
                       );
                    })}
                  </div>
               </div>
            </div>

            <div className="p-10 border-t bg-slate-50 flex justify-end gap-4">
              <button onClick={() => setApprovingProcurement(null)} className="px-6 font-black text-[10px] uppercase text-slate-400">Cancel</button>
              <button onClick={finalizePO} disabled={!approvalData.vendorId} className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-[10px] hover:bg-emerald-600 shadow-xl transition-all disabled:opacity-50">Confirm Settlement</button>
            </div>
          </div>
        </div>
      )}

      {/* Pending POs */}
      {activeTab === 'PENDING' && (
        <div className="space-y-4 max-w-4xl mx-auto no-print">
          {purchaseOrders.filter(p => p.status === 'pending').map(po => (
            <div key={po.id} className="p-10 bg-white border-2 border-slate-100 rounded-[3rem] flex justify-between items-center group hover:border-emerald-500 transition-all">
               <div>
                  <h4 className="font-black text-2xl text-slate-900">PO #{po.id.split('-')[1]}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{po.vendorName} • Total ₹{po.totalCost?.toLocaleString()}</p>
               </div>
               <div className="flex gap-4">
                 <button onClick={() => downloadPDF(po)} className="p-5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-2xl transition-all"><Printer size={24} /></button>
                 <button onClick={() => markReceived(po)} className="bg-slate-900 text-white px-10 py-5 rounded-3xl font-black uppercase text-[10px] hover:bg-emerald-600 transition-all">Receive Stock</button>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Printable GST-Compliant PO Template */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-12 overflow-auto font-sans">
        {viewingPO && (
          <div className="max-w-4xl mx-auto">
             {/* Header with Branding */}
             <div className="flex justify-between items-start border-b-8 border-slate-900 pb-12 mb-12">
                <div className="flex items-center gap-6">
                   {poConfig.logoUrl ? (
                      <img src={poConfig.logoUrl} alt="Company Logo" className="h-24 w-auto object-contain" />
                   ) : (
                      <div className="bg-slate-900 text-white p-5 rounded-2xl"><ChefHat size={48} /></div>
                   )}
                   <div className="space-y-1">
                      <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{poConfig.companyName}</h1>
                      <div className="flex flex-col text-[11px] font-bold text-slate-500 space-y-0.5">
                         <p className="flex items-center gap-1.5"><MapPin size={10} /> {poConfig.address}</p>
                         <div className="flex gap-4">
                            <p className="flex items-center gap-1.5"><Mail size={10} /> {poConfig.email}</p>
                            <p className="flex items-center gap-1.5"><Phone size={10} /> {poConfig.phone}</p>
                         </div>
                         <div className="flex gap-4 mt-1 font-black text-slate-900 uppercase">
                            <span>GSTIN: {poConfig.gstin}</span>
                            <span>PAN: {poConfig.pan}</span>
                         </div>
                      </div>
                   </div>
                </div>
                <div className="text-right">
                   <h2 className="text-6xl font-black text-slate-100 uppercase tracking-tight leading-none mb-4">PURCHASE ORDER</h2>
                   <div className="bg-slate-900 text-white px-6 py-4 rounded-xl inline-block text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">PO Reference</p>
                      <p className="text-2xl font-black">{viewingPO.id}</p>
                   </div>
                   <p className="mt-2 text-xs font-black uppercase text-slate-400 tracking-widest">Date: {new Date(viewingPO.createdAt).toLocaleDateString()}</p>
                </div>
             </div>

             {/* Partner Grids */}
             <div className="grid grid-cols-2 gap-16 mb-16">
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 border-b border-slate-200 pb-2">Supplier Partner</h3>
                   <div className="space-y-2">
                      <p className="text-2xl font-black text-slate-900">{viewingPO.vendorName}</p>
                      <p className="text-xs font-bold text-slate-500">Partner ID: {viewingPO.vendorId}</p>
                      <div className="pt-4 space-y-1 text-xs font-medium text-slate-600">
                         <p>Authorized Fulfillment Center</p>
                         <p>Regional Logistics Bay</p>
                      </div>
                   </div>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-900">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 mb-6 border-b border-slate-900 pb-2">Deliver To</h3>
                   <div className="space-y-2">
                      <p className="text-2xl font-black text-slate-900">Main Receiving Dock</p>
                      <p className="text-xs font-bold text-slate-500">Attn: Kitchen Receiving Desk</p>
                      <p className="text-xs font-medium text-slate-600 mt-2">{poConfig.address}</p>
                   </div>
                </div>
             </div>

             {/* Material Grid */}
             <div className="mb-12">
                <table className="w-full text-left border-collapse border-b-2 border-slate-900">
                   <thead>
                      <tr className="bg-slate-900 text-white">
                         <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest">#</th>
                         <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest">HSN / Material Description</th>
                         <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-right">Volume</th>
                         <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-right">Unit Price</th>
                         <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-right">Taxable Value</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-200">
                      {viewingPO.items.map((item, idx) => {
                         const unitPrice = item.priceAtOrder || 0;
                         const taxableValue = unitPrice * item.quantity;
                         return (
                           <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-6 py-6 text-sm font-black text-slate-300">{idx + 1}</td>
                              <td className="px-6 py-6">
                                 <p className="font-black text-xl text-slate-900 leading-none mb-1">{item.ingredientName}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base Category Restock</p>
                              </td>
                              <td className="px-6 py-6 text-right font-black text-slate-900 text-lg">{item.quantity} <span className="text-[10px] uppercase text-slate-400">{item.unit}</span></td>
                              <td className="px-6 py-6 text-right font-bold text-slate-700">₹{unitPrice.toLocaleString()}</td>
                              <td className="px-6 py-6 text-right font-black text-slate-900 text-lg">₹{taxableValue.toLocaleString()}</td>
                           </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>

             {/* Calculation Summary */}
             <div className="grid grid-cols-2 gap-20 items-start">
                <div>
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4">Statutory Terms & Notes</h4>
                   <div className="bg-slate-50 p-6 rounded-2xl text-[10px] font-bold text-slate-500 leading-relaxed border border-slate-100">
                      {poConfig.terms.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between text-sm font-bold text-slate-500">
                      <span>Total Taxable Amount</span>
                      <span>₹{viewingPO.totalCost?.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between text-xs font-medium text-slate-400 border-b border-slate-100 pb-2">
                      <span>GST (Included/Exempted)*</span>
                      <span>₹0.00</span>
                   </div>
                   <div className="flex justify-between text-2xl font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                      <span className="uppercase tracking-tighter">Grand Total</span>
                      <span>₹{viewingPO.totalCost?.toLocaleString()}</span>
                   </div>
                   <p className="text-[9px] font-black text-right text-slate-300 uppercase tracking-widest italic pt-2">Amounts are net inclusive of shipping.</p>
                </div>
             </div>

             {/* Footer Signatures */}
             <div className="mt-32 grid grid-cols-2 gap-32">
                <div className="text-center">
                   <div className="h-px bg-slate-300 mb-4"></div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Manager</p>
                </div>
                <div className="text-center">
                   <div className="h-px bg-slate-900 mb-4"></div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Authorized Signatory</p>
                </div>
             </div>

             <footer className="mt-20 pt-10 border-t border-slate-100 text-center">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-loose">
                   Electronically generated by CulinaOps ERP Core Systems. Valid without physical stamp. <br/>
                   Internal Code: {viewingPO.id}-{Date.now()}
                </p>
             </footer>
          </div>
        )}
      </div>
    </div>
  );
};
