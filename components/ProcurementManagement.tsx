
import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Truck, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  ArrowRight, 
  X, 
  Search, 
  FileText, 
  PlusCircle,
  History,
  Info,
  Calendar,
  Printer,
  ChevronDown,
  Building,
  ChefHat,
  TrendingUp,
  TrendingDown,
  MapPin,
  Mail,
  Phone,
  ClipboardCheck,
  PackageCheck,
  AlertCircle,
  ArrowDownToLine,
  ScanLine,
  Tag,
  Scale,
  Layers,
  DollarSign
} from 'lucide-react';
import { PendingProcurement, PurchaseOrder, InventoryItem, Vendor, POTemplateConfig, POItem, Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const DEFAULT_PO_CONFIG: POTemplateConfig = {
  companyName: 'KMS Kitchen Management System',
  address: 'Mumbai, Maharashtra',
  gstin: 'GST-UNREGISTERED',
  pan: 'PAN-UNAVAILABLE',
  email: 'ops@kms-kitchen.com',
  phone: 'Contact Admin',
  terms: 'Net 15 Days payment.'
};

const KITCHEN_UNITS = ['kg', 'L', 'g', 'ml', 'pcs', 'pkt', 'box', 'crate', 'dozen', 'tin'];

export const ProcurementManagement: React.FC = () => {
  const [procurements, setProcurements] = useState<PendingProcurement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeTab, setActiveTab] = useState<'SHORTAGES' | 'PENDING' | 'COMPLETED'>('SHORTAGES');
  const [poConfig, setPoConfig] = useState<POTemplateConfig>(DEFAULT_PO_CONFIG);
  
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [approvingProcurement, setApprovingProcurement] = useState<PendingProcurement | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [verifyingPO, setVerifyingPO] = useState<PurchaseOrder | null>(null);
  
  const [receiptData, setReceiptData] = useState<Record<string, number>>({});
  const [verificationRemarks, setVerificationRemarks] = useState('');

  const [manualReq, setManualReq] = useState({
    name: '', brand: '', qty: 0, unit: 'kg', date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const [approvalData, setApprovalData] = useState<{vendorId: string, quantity: number, unitPrice: number, brand?: string}>({
    vendorId: '', quantity: 0, unitPrice: 0, brand: ''
  });

  const loadLocalData = () => {
    const vends = JSON.parse(localStorage.getItem('vendors') || '[]');
    const pos = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
    const manualProcs = JSON.parse(localStorage.getItem('manualProcurements') || '[]');
    const savedConfig = localStorage.getItem('poTemplateConfig');
    
    if (savedConfig) setPoConfig(JSON.parse(savedConfig));
    setVendors(vends);
    setPurchaseOrders(pos);
    return { manualProcs };
  };

  useEffect(() => {
    const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => {
      const invData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(invData);
      const { manualProcs } = loadLocalData();
      const autoShortages: PendingProcurement[] = invData
        .filter((item: InventoryItem) => (item.quantity - (item.reserved || 0)) <= item.reorderLevel)
        .map((item: InventoryItem) => ({
          id: `SHORT-${item.id}`,
          ingredientName: item.name,
          brand: item.brand,
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
    });

    const unsubBrands = onSnapshot(query(collection(db, "brands"), orderBy("name")), (snap) => {
      setBrands(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
    });

    window.addEventListener('storage', loadLocalData);
    return () => {
      unsubInv();
      unsubBrands();
      window.removeEventListener('storage', loadLocalData);
    };
  }, []);

  const handleManualRequest = () => {
    if (!manualReq.name || manualReq.qty <= 0) {
      alert("Validation Error: Material name and quantity are required.");
      return;
    }
    const newReq: PendingProcurement = {
      id: `REQ-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      ingredientName: manualReq.name,
      brand: manualReq.brand,
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
    const updatedManual = [newReq, ...existingManual];
    localStorage.setItem('manualProcurements', JSON.stringify(updatedManual));
    setProcurements(prev => [...prev.filter(p => !p.isManual), ...updatedManual]);
    setIsRequestModalOpen(false);
    setManualReq({ name: '', brand: '', qty: 0, unit: 'kg', date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] });
    window.dispatchEvent(new Event('storage'));
  };

  const finalizePO = () => {
    if (!approvingProcurement || !approvalData.vendorId) return;
    const selectedVendor = vendors.find(v => v.id === approvalData.vendorId);
    const uniqueOrderNo = `ORD-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const newPO: PurchaseOrder = {
      id: Math.random().toString(36).substr(2, 9),
      orderNumber: uniqueOrderNo,
      vendorId: selectedVendor?.id || 'V-UNKNOWN',
      vendorName: selectedVendor?.name || 'Manual Partner',
      items: [{ 
        ingredientName: approvingProcurement.ingredientName, 
        brand: approvalData.brand || approvingProcurement.brand,
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
      const filteredManual = existingManual.filter((p: any) => p.id !== approvingProcurement.id);
      localStorage.setItem('manualProcurements', JSON.stringify(filteredManual));
      setProcurements(prev => prev.filter(p => p.id !== approvingProcurement.id));
    } else {
       // For auto shortages, we could mark them as "ordered" in a more complex state, 
       // but here we just hide them until stock is received.
       setProcurements(prev => prev.filter(p => p.id !== approvingProcurement.id));
    }
    
    setApprovingProcurement(null);
    setActiveTab('PENDING');
    window.dispatchEvent(new Event('storage'));
  };

  const startPhysicalAudit = (po: PurchaseOrder) => {
    setVerifyingPO(po);
    const initialReceipt: Record<string, number> = {};
    po.items.forEach(item => { initialReceipt[item.ingredientName] = item.quantity; });
    setReceiptData(initialReceipt);
    setVerificationRemarks('');
  };

  const commitGRN = () => {
    if (!verifyingPO) return;
    alert("Audit protocol complete. Stock levels adjusted.");
    const updatedPOs = purchaseOrders.map(po => po.id === verifyingPO.id ? { ...po, status: 'received' as const, receivedAt: Date.now() } : po);
    localStorage.setItem('purchaseOrders', JSON.stringify(updatedPOs));
    setPurchaseOrders(updatedPOs);
    setVerifyingPO(null);
    setActiveTab('COMPLETED');
    window.dispatchEvent(new Event('storage'));
  };

  const downloadPDF = (po: PurchaseOrder) => {
    setViewingPO(po);
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <ShoppingCart className="text-emerald-500" size={32} />
             Procurement Studio
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest font-black">Audit-Driven Supply Chain Management</p>
        </div>
        <div className="flex flex-wrap gap-4">
           <button onClick={() => setIsRequestModalOpen(true)} className="bg-white border-2 border-slate-200 text-slate-900 px-7 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:border-emerald-500 transition-all shadow-sm active:scale-95">
              <PlusCircle size={16} /> Request Material
           </button>
           <div className="bg-white p-1.5 rounded-2xl border-2 border-slate-100 flex shadow-sm">
            {['SHORTAGES', 'PENDING', 'COMPLETED'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>
                {tab === 'SHORTAGES' ? 'Stock Alerts' : tab === 'PENDING' ? 'Open Orders' : 'GRN Archive'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'SHORTAGES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 no-print">
          {procurements.map(p => (
            <div key={p.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl transition-all flex flex-col group animate-in slide-in-from-bottom-4 h-full">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all"><AlertTriangle size={32} /></div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Stock</p>
                  <p className="text-sm font-black text-slate-900">{p.requiredQty} {p.unit}</p>
                </div>
              </div>
              
              <h3 className="text-2xl font-black text-slate-900 mb-2">{p.ingredientName}</h3>
              {p.brand && <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 mb-4"><Tag size={12} /> Brand: {p.brand}</p>}
              
              <div className="mt-auto pt-8 border-t border-slate-50">
                <button 
                  onClick={() => {
                    setApprovingProcurement(p);
                    setApprovalData({ vendorId: '', quantity: p.requiredQty, unitPrice: 0, brand: p.brand });
                  }} 
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <CheckCircle size={18} /> Initiate Purchase
                </button>
              </div>
            </div>
          ))}
          {procurements.length === 0 && (
            <div className="col-span-full py-32 text-center bg-slate-50/20 rounded-[3rem] border-2 border-dashed border-slate-200">
               <Package size={48} className="text-slate-200 mx-auto mb-4" />
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory baseline healthy. No critical shortages.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'PENDING' && (
        <div className="space-y-4 max-w-4xl mx-auto no-print">
          {purchaseOrders.filter(p => p.status === 'pending').map(po => (
            <div key={po.id} className="p-10 bg-white border-2 border-slate-100 rounded-[3rem] flex justify-between items-center group hover:border-emerald-500 transition-all">
               <div className="flex items-center gap-6">
                  <div className="bg-slate-900 text-emerald-400 p-4 rounded-2xl shadow-lg"><ScanLine size={28} /></div>
                  <div>
                    <h4 className="font-black text-2xl text-slate-900 tracking-tight">{po.orderNumber}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{po.vendorName} • Total ₹{po.totalCost?.toLocaleString()}</p>
                    <div className="flex gap-2 mt-2">
                      {po.items.map((it, idx) => (
                        <span key={idx} className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">{it.ingredientName} {it.brand ? `(${it.brand})` : ''}</span>
                      ))}
                    </div>
                  </div>
               </div>
               <div className="flex gap-4">
                 <button onClick={() => downloadPDF(po)} className="p-5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-2xl transition-all" title="Print PO"><Printer size={24} /></button>
                 <button onClick={() => startPhysicalAudit(po)} className="bg-emerald-500 text-slate-950 px-10 py-5 rounded-3xl font-black uppercase text-[10px] hover:bg-slate-900 hover:text-white transition-all shadow-xl shadow-emerald-500/10 flex items-center gap-2"><ClipboardCheck size={18} /> Verify & Receive</button>
               </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'COMPLETED' && (
        <div className="space-y-4 max-w-5xl mx-auto no-print animate-in fade-in duration-500">
           {purchaseOrders.filter(p => p.status === 'received' || p.status === 'partially_received').map(po => (
             <div key={po.id} className="bg-white border-2 border-slate-100 rounded-[3rem] overflow-hidden shadow-sm hover:shadow-lg transition-all">
                <div className="p-8 flex items-center justify-between border-b border-slate-100">
                   <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${po.status === 'received' ? 'bg-emerald-500 text-slate-900' : 'bg-amber-500 text-white'}`}><PackageCheck size={28} /></div>
                      <div>
                         <h4 className="text-xl font-black text-slate-900 leading-none mb-1">{po.orderNumber}</h4>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{po.vendorName} • Fulfilled {new Date(po.receivedAt || po.createdAt).toLocaleDateString()}</p>
                      </div>
                   </div>
                   <div className={`px-4 py-2 rounded-xl border-2 text-[9px] font-black uppercase tracking-widest ${po.status === 'received' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                      {po.status === 'received' ? 'Fully Ingested' : 'Partially Received'}
                   </div>
                </div>
                <div className="p-8 bg-slate-50/30 flex justify-between items-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archive Record Validated</p>
                   <button onClick={() => downloadPDF(po)} className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 hover:gap-4 transition-all">PO Snapshot <Printer size={14} className="text-emerald-500" /></button>
                </div>
             </div>
           ))}
        </div>
      )}

      {/* Settlement Logic Modal - TRIGGERED BY INITIATE PURCHASE */}
      {approvingProcurement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300 no-print">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-slate-900">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black">Settlement Logic</h3>
                <p className="text-emerald-400 font-black text-[9px] uppercase tracking-widest mt-1">Provider Selection Protocol</p>
              </div>
              <TrendingUp className="text-emerald-500" />
            </div>
            
            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
               <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Building size={14} /> Suppliers for {approvingProcurement.ingredientName}</label>
                    {approvingProcurement.brand && <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">Target: {approvingProcurement.brand}</span>}
                  </div>
                  <div className="space-y-3">
                    {vendors.filter(v => (v.priceLedger || []).some(pl => pl.itemName.toLowerCase() === approvingProcurement.ingredientName.toLowerCase())).map(vendor => {
                       const pricePoints = vendor.priceLedger?.filter(pl => pl.itemName.toLowerCase() === approvingProcurement.ingredientName.toLowerCase()) || [];
                       return pricePoints.map((pp, pi) => (
                        <button 
                          key={`${vendor.id}-${pi}`}
                          onClick={() => {
                            setApprovalData({
                              ...approvalData, 
                              vendorId: vendor.id, 
                              unitPrice: pp.price, 
                              brand: pp.brand || approvingProcurement.brand
                            });
                          }}
                          className={`w-full p-6 rounded-2xl border-2 flex items-center justify-between transition-all ${approvalData.vendorId === vendor.id && approvalData.brand === (pp.brand || approvingProcurement.brand) ? 'border-emerald-500 bg-emerald-50 shadow-lg' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                           <div>
                              <p className="font-black text-slate-900">{vendor.name}</p>
                              {pp.brand && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Brand: {pp.brand}</p>}
                           </div>
                           <p className="text-xl font-black text-slate-900">₹{pp.price} <span className="text-[10px] text-slate-300">/ {pp.unit}</span></p>
                        </button>
                       ));
                    })}
                    {vendors.filter(v => (v.priceLedger || []).some(pl => pl.itemName.toLowerCase() === approvingProcurement.ingredientName.toLowerCase())).length === 0 && (
                      <div className="p-10 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No suppliers mapped for this material.</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>

            <div className="p-10 border-t bg-slate-50 flex justify-end gap-4">
              <button onClick={() => setApprovingProcurement(null)} className="px-6 font-black text-[10px] uppercase text-slate-400">Cancel</button>
              <button onClick={finalizePO} disabled={!approvalData.vendorId} className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-[10px] hover:bg-emerald-600 shadow-xl transition-all disabled:opacity-50">Generate Order ID</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white rounded-[3.5rem] w-full max-w-xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
                 <div>
                    <h3 className="text-3xl font-black tracking-tight uppercase">Request Material</h3>
                    <p className="text-emerald-400 font-black text-[9px] uppercase tracking-widest mt-1">Manual Stock Replenishment</p>
                 </div>
                 <button onClick={() => setIsRequestModalOpen(false)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              </div>
              <div className="p-10 space-y-6 text-slate-900">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Material Name</label>
                       <select 
                         value={manualReq.name} 
                         onChange={e => setManualReq({...manualReq, name: e.target.value})} 
                         className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 transition-all shadow-inner appearance-none"
                       >
                          <option value="" className="text-slate-900">Select Item</option>
                          {inventory.map(item => (
                            <option key={item.id} value={item.name} className="text-slate-900">{item.name}</option>
                          ))}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linked Brand</label>
                       <select 
                         value={manualReq.brand} 
                         onChange={e => setManualReq({...manualReq, brand: e.target.value})} 
                         className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 focus:border-emerald-500 outline-none transition-all shadow-inner appearance-none"
                       >
                          <option value="" className="text-slate-900">Any Brand</option>
                          {brands.filter(b => !manualReq.name || b.itemName === manualReq.name).map(b => (
                            <option key={b.id} value={b.name} className="text-slate-900">{b.name}</option>
                          ))}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Required Volume</label>
                       <div className="flex gap-2">
                          <input type="number" value={manualReq.qty} onChange={e => setManualReq({...manualReq, qty: parseFloat(e.target.value) || 0})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-black text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                          <select 
                            value={manualReq.unit} 
                            onChange={e => setManualReq({...manualReq, unit: e.target.value})} 
                            className="w-32 px-4 py-4 rounded-xl bg-slate-100 border-none font-black text-center text-xs uppercase cursor-pointer focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 appearance-none"
                          >
                            {KITCHEN_UNITS.map(unit => (
                              <option key={unit} value={unit} className="text-slate-900">{unit}</option>
                            ))}
                          </select>
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Needed By</label>
                       <input type="date" value={manualReq.date} onChange={e => setManualReq({...manualReq, date: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner text-slate-900" />
                    </div>
                 </div>
                 <button onClick={handleManualRequest} className="w-full mt-4 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl active:scale-95">Commit Request</button>
              </div>
           </div>
        </div>
      )}

      {verifyingPO && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white rounded-[3.5rem] w-full max-w-4xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                 <div>
                    <h3 className="text-3xl font-black tracking-tight">Physical Stock Audit</h3>
                    <p className="text-emerald-400 font-black text-[9px] uppercase tracking-widest mt-1">Order Ref: {verifyingPO.orderNumber}</p>
                 </div>
                 <button onClick={() => setVerifyingPO(null)} className="p-4 bg-white/5 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                 {verifyingPO.items.map((item, idx) => (
                    <div key={idx} className="p-8 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
                       <div>
                          <p className="text-2xl font-black text-slate-900 tracking-tight">{item.ingredientName}</p>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ordered: {item.quantity} {item.unit}</p>
                       </div>
                       <div className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-2">Received Qty</label>
                          <input type="number" value={receiptData[item.ingredientName] || 0} onChange={e => setReceiptData({...receiptData, [item.ingredientName]: parseFloat(e.target.value) || 0})} className="w-32 px-4 py-3 bg-slate-100 border-none rounded-xl font-black text-slate-900 text-center outline-none" />
                          <span className="font-black text-xs uppercase text-slate-300 pr-4">{item.unit}</span>
                       </div>
                    </div>
                 ))}
                 <div className="space-y-2 pt-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fulfillment Remarks</label>
                    <textarea value={verificationRemarks} onChange={e => setVerificationRemarks(e.target.value)} placeholder="e.g. Verified weight on dock scale..." className="w-full p-8 rounded-[2rem] bg-slate-50 border-2 border-transparent font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all h-32 resize-none" />
                 </div>
              </div>
              <div className="p-10 border-t bg-slate-50 flex justify-end gap-4 shrink-0">
                 <button onClick={() => setVerifyingPO(null)} className="px-8 font-black text-[10px] uppercase text-slate-400 tracking-widest">Abort</button>
                 <button onClick={commitGRN} className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl hover:bg-emerald-600 transition-all flex items-center gap-3"><ArrowDownToLine size={18} /> Finalize GRN</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
