
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, 
  Truck, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  X, 
  PlusCircle,
  Printer,
  FileText,
  ClipboardCheck,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Tag,
  Loader2,
  CheckSquare,
  Square,
  ArrowRight,
  Download,
  Building2
} from 'lucide-react';
import { PendingProcurement, PurchaseOrder, InventoryItem, Vendor, POTemplateConfig, Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, writeBatch, doc } from 'firebase/firestore';

// Define AuditItem interface for tracking physical audit of received goods
interface AuditItem {
  receivedQty: number;
  qualityPassed: boolean;
  notes: string;
}

const DEFAULT_PO_CONFIG: POTemplateConfig = {
  companyName: 'KMS Kitchen Management System',
  address: 'Mumbai, Maharashtra',
  gstin: 'GST-UNREGISTERED',
  pan: 'PAN-UNAVAILABLE',
  email: 'ops@kms-kitchen.com',
  phone: 'Contact Admin',
  terms: 'Net 15 Days payment.'
};

export const ProcurementManagement: React.FC = () => {
  const [procurements, setProcurements] = useState<PendingProcurement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeTab, setActiveTab] = useState<'SHORTAGES' | 'PENDING' | 'COMPLETED'>('SHORTAGES');
  const [poConfig, setPoConfig] = useState<POTemplateConfig>(DEFAULT_PO_CONFIG);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [approvingItems, setApprovingItems] = useState<PendingProcurement[] | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [verifyingPO, setVerifyingPO] = useState<PurchaseOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditData, setAuditData] = useState<Record<string, AuditItem>>({});
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [manualReq, setManualReq] = useState({
    name: '', brand: '', qty: 0, unit: 'kg',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [bulkVendorId, setBulkVendorId] = useState('');
  const [poLineItems, setPoLineItems] = useState<Record<string, any>>({});

  const loadLocalData = () => {
    let vends = JSON.parse(localStorage.getItem('vendors') || '[]');
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

  const totalSelectedValue = useMemo(() => {
     return procurements
      .filter(p => selectedIds.has(p.id))
      .reduce((acc: number, curr) => {
         const vendorPrice = vendors.find(v => v.priceLedger?.find(pl => pl.itemName === curr.ingredientName))?.priceLedger?.find(pl => pl.itemName === curr.ingredientName)?.price || 0;
         return acc + (curr.requiredQty * vendorPrice);
      }, 0);
  }, [selectedIds, procurements, vendors]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

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
    setManualReq({
      name: '', brand: '', qty: 0, unit: 'kg',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    window.dispatchEvent(new Event('storage'));
  };

  const handleInitiateBulkPurchase = () => {
    const itemsToOrder = procurements.filter(p => selectedIds.has(p.id));
    if (itemsToOrder.length === 0) return;
    const lineItems: Record<string, any> = {};
    itemsToOrder.forEach(item => {
       lineItems[item.id] = {
         id: item.id,
         quantity: item.requiredQty,
         unitPrice: 0,
         brand: item.brand,
         ingredientName: item.ingredientName,
         unit: item.unit
       };
    });
    setPoLineItems(lineItems);
    setApprovingItems(itemsToOrder);
    setBulkVendorId('');
  };

  useEffect(() => {
    if (!bulkVendorId || !approvingItems) return;
    const vendor = vendors.find(v => v.id === bulkVendorId);
    if (!vendor) return;
    setPoLineItems(prev => {
       const updated = { ...prev };
       Object.keys(updated).forEach(key => {
          const item = updated[key];
          const pricePoint = vendor.priceLedger?.find(p => p.itemName.toLowerCase() === item.ingredientName.toLowerCase());
          if (pricePoint) {
             updated[key] = { ...item, unitPrice: pricePoint.price };
          }
       });
       return updated;
    });
  }, [bulkVendorId, approvingItems, vendors]);

  const updateLineItem = (id: string, field: string, value: any) => {
     setPoLineItems(prev => ({
        ...prev,
        [id]: { ...prev[id], [field]: value }
     }));
  };

  const finalizeBulkPO = async () => {
    if (!approvingItems || approvingItems.length === 0) return;
    if (!bulkVendorId) {
        alert("Action Required: Please select a supplier for this consolidated order.");
        return;
    }
    setIsSubmitting(true);
    try {
      const selectedVendor = vendors.find(v => v.id === bulkVendorId);
      const uniqueOrderNo = `PO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      let grandTotal = 0;
      const finalItems = Object.values(poLineItems).map((line: any) => {
         grandTotal += (line.quantity * line.unitPrice);
         return {
            ingredientName: line.ingredientName,
            brand: line.brand,
            quantity: line.quantity,
            unit: line.unit,
            priceAtOrder: line.unitPrice
         };
      });
      const newPO: PurchaseOrder = {
        id: Math.random().toString(36).substr(2, 9),
        orderNumber: uniqueOrderNo,
        vendorId: selectedVendor?.id || 'V-UNKNOWN',
        vendorName: selectedVendor?.name || 'Manual Partner',
        items: finalItems,
        expectedDeliveryDate: approvingItems[0].requiredByDate,
        status: 'pending',
        createdAt: Date.now(),
        totalCost: grandTotal
      };
      const updatedPOs = [newPO, ...purchaseOrders];
      localStorage.setItem('purchaseOrders', JSON.stringify(updatedPOs));
      setPurchaseOrders(updatedPOs);
      const manualIdsToRemove = approvingItems.filter(p => p.isManual).map(p => p.id);
      if (manualIdsToRemove.length > 0) {
        const existingManual = JSON.parse(localStorage.getItem('manualProcurements') || '[]');
        const filteredManual = existingManual.filter((p: any) => !manualIdsToRemove.includes(p.id));
        localStorage.setItem('manualProcurements', JSON.stringify(filteredManual));
      }
      setSelectedIds(new Set());
      setApprovingItems(null);
      setBulkVendorId('');
      setActiveTab('PENDING');
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => alert(`Consolidated Order ${uniqueOrderNo} Generated!`), 100);
    } catch (err) {
      alert("Failed to generate Purchase Order.");
    } finally { setIsSubmitting(false); }
  };

  const startPhysicalAudit = (po: PurchaseOrder) => {
    setVerifyingPO(po);
    const initialAudit: Record<string, AuditItem> = {};
    if (po.items) {
      po.items.forEach(item => {
        initialAudit[item.ingredientName] = {
          receivedQty: item.quantity,
          qualityPassed: true,
          notes: ''
        };
      });
    }
    setAuditData(initialAudit);
    setVerificationRemarks('');
  };

  const updateAuditItem = (itemName: string, field: string, value: any) => {
    setAuditData(prev => ({
      ...prev,
      [itemName]: { ...prev[itemName], [field]: value }
    }));
  };

  const commitGRN = async () => {
    if (!verifyingPO) return;
    setIsSubmitting(true);
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
    try {
      const batch = writeBatch(db);
      for (const item of verifyingPO.items) {
         const audit = auditData[item.ingredientName];
         if (!audit || audit.receivedQty <= 0 || !audit.qualityPassed) continue;
         const invItem = inventory.find(i => i.name.toLowerCase() === item.ingredientName.toLowerCase());
         if (invItem) {
            const newQty = (invItem.quantity || 0) + audit.receivedQty;
            batch.update(doc(db, "inventory", invItem.id), {
               quantity: newQty,
               lastPrice: item.priceAtOrder || invItem.lastPrice,
               lastRestocked: new Date().toISOString().split('T')[0],
               status: newQty <= (invItem.reorderLevel || 0) ? 'low' : 'healthy'
            });
         }
      }
      await batch.commit();
      const updatedPOs = purchaseOrders.map(po => 
         po.id === verifyingPO.id 
         ? { ...po, status: 'received' as const, receivedAt: Date.now(), grnNumber } 
         : po
      );
      localStorage.setItem('purchaseOrders', JSON.stringify(updatedPOs));
      setPurchaseOrders(updatedPOs);
      setVerifyingPO(null);
      setActiveTab('COMPLETED');
      window.dispatchEvent(new Event('storage'));
      alert(`GRN Generated: ${grnNumber}`);
    } catch (error) { alert("Failed to update inventory."); }
    finally { setIsSubmitting(false); }
  };

  const downloadPDF = (po: PurchaseOrder) => {
    setViewingPO(po);
    // Give time for modal to render before print
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500 relative">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <ShoppingCart className="text-emerald-500" size={32} />
             Procurement Studio
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest font-black">Audit-Driven Supply Chain Management</p>
        </div>
        <div className="flex flex-wrap gap-4">
           <button onClick={() => setIsRequestModalOpen(true)} className="bg-white border-2 border-slate-200 text-slate-900 px-7 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:border-emerald-500 transition-all shadow-sm">
              <PlusCircle size={16} /> Request Material
           </button>
           <div className="bg-white p-1.5 rounded-2xl border-2 border-slate-100 flex shadow-sm flex-wrap gap-1">
            {['SHORTAGES', 'PENDING', 'COMPLETED'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 sm:px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>
                {tab === 'SHORTAGES' ? 'Stock Alerts' : tab === 'PENDING' ? 'Open Orders' : 'GRN Archive'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'SHORTAGES' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 no-print pb-16">
          {procurements.map(p => {
             const isSelected = selectedIds.has(p.id);
             return (
              <div key={p.id} onClick={() => toggleSelection(p.id)} className={`p-6 sm:p-8 rounded-[3rem] border-2 shadow-sm transition-all flex flex-col justify-between group animate-in slide-in-from-bottom-4 h-full cursor-pointer relative overflow-hidden min-h-[320px] ${isSelected ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-white border-slate-100 hover:shadow-xl'}`}>
                {isSelected && <div className="absolute top-0 right-0 p-6 bg-emerald-500 rounded-bl-[2rem] text-white"><CheckCircle size={24} /></div>}
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-white text-emerald-500' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}`}><AlertTriangle size={28} /></div>
                  <div className="text-right pr-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Needed</p>
                    <p className="text-sm font-black text-slate-900">{p.requiredQty} {p.unit}</p>
                  </div>
                </div>
                <div>
                   <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 leading-tight">{p.ingredientName}</h3>
                   {p.brand && <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 mb-4"><Tag size={12} /> Brand: {p.brand}</p>}
                </div>
                <div className="mt-auto pt-8 border-t border-slate-200/50 flex items-center gap-2 text-slate-400">
                   {isSelected ? <CheckSquare size={20} className="text-emerald-500" /> : <Square size={20} />}
                   <span className="text-[10px] font-black uppercase tracking-widest">{isSelected ? 'Selected for Order' : 'Click to Select'}</span>
                </div>
              </div>
             );
          })}
        </div>
      )}

      {selectedIds.size > 0 && activeTab === 'SHORTAGES' && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl px-4 animate-in slide-in-from-bottom-10 fade-in no-print">
            <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between border-4 border-white/10 backdrop-blur-md">
               <div className="flex items-center gap-4 pl-4">
                  <div className="bg-emerald-500 text-slate-900 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0">{selectedIds.size}</div>
                  <div className="flex flex-col">
                     <span className="text-sm font-bold">Items Selected</span>
                     <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest hidden sm:inline">Est. Value: ₹{totalSelectedValue.toLocaleString()}</span>
                  </div>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => setSelectedIds(new Set())} className="px-4 sm:px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-black uppercase text-[10px] tracking-widest transition-all">Clear</button>
                  <button onClick={handleInitiateBulkPurchase} className="px-6 sm:px-8 py-3 rounded-2xl bg-emerald-500 text-slate-900 hover:bg-emerald-400 font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2">Generate PO <ArrowRight size={16} /></button>
               </div>
            </div>
         </div>
      )}

      {/* PO View Modal - Standard A4 Print Template */}
      {viewingPO && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 bg-slate-950/90 backdrop-blur-md overflow-y-auto no-print-modal">
          <div className="bg-white w-full max-w-4xl min-h-screen md:min-h-0 md:rounded-[2rem] shadow-2xl relative p-6 md:p-12 print:p-0 print:shadow-none print:rounded-none">
            {/* Action Header - Hidden on Print */}
            <div className="flex justify-between items-center mb-10 border-b pb-6 no-print">
              <div className="flex items-center gap-3">
                <div className="bg-slate-900 text-white p-2 rounded-lg"><FileText size={20} /></div>
                <h4 className="text-lg font-black uppercase tracking-tight">PO Document Preview</h4>
              </div>
              <div className="flex gap-3">
                <button onClick={() => window.print()} className="px-6 py-3 bg-emerald-500 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg flex items-center gap-2"><Printer size={16} /> Print / Save PDF</button>
                <button onClick={() => setViewingPO(null)} className="p-3 bg-slate-100 hover:bg-rose-500 hover:text-white rounded-xl transition-all"><X size={20} /></button>
              </div>
            </div>

            {/* Print Header */}
            <div className="flex justify-between items-start mb-12">
              <div className="space-y-4">
                {poConfig.logoUrl ? (
                  <img src={poConfig.logoUrl} alt="Logo" className="h-20 object-contain" />
                ) : (
                  <div className="bg-slate-900 text-white p-4 rounded-2xl inline-block"><Building2 size={40} /></div>
                )}
                <div>
                  <h1 className="text-2xl font-black text-slate-900 leading-tight">{poConfig.companyName}</h1>
                  <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap max-w-xs">{poConfig.address}</p>
                </div>
              </div>
              <div className="text-right space-y-2">
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-4">Purchase Order</h2>
                <div className="bg-slate-50 p-4 rounded-2xl inline-block text-left border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order Reference</p>
                  <p className="text-lg font-black text-slate-900">#{viewingPO.orderNumber}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Date Issued</p>
                  <p className="text-sm font-bold text-slate-700">{new Date(viewingPO.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* statutory Info & Addresses */}
            <div className="grid grid-cols-2 gap-12 mb-12">
              <div className="space-y-4">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Billing & Statutory</h5>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase">GSTIN:</span>
                    <span className="text-xs font-black text-slate-900">{poConfig.gstin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase">PAN:</span>
                    <span className="text-xs font-black text-slate-900">{poConfig.pan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Email:</span>
                    <span className="text-xs font-black text-slate-900">{poConfig.email}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Supplier Details</h5>
                <div>
                  <p className="text-lg font-black text-slate-900">{viewingPO.vendorName}</p>
                  <p className="text-xs text-slate-500 mt-1">Authorized Vendor Registry ID: {viewingPO.vendorId}</p>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-12 border border-slate-900 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest">Material Spec / Brand</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-center">Qty</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-right">Unit Rate</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {viewingPO.items.map((item, idx) => (
                    <tr key={idx} className="print:bg-transparent">
                      <td className="py-4 px-6">
                        <p className="font-black text-slate-900">{item.ingredientName}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.brand || 'Consolidated Generic'}</p>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-slate-700">{item.quantity} {item.unit}</td>
                      <td className="py-4 px-6 text-right font-bold text-slate-700">₹{item.priceAtOrder?.toLocaleString()}</td>
                      <td className="py-4 px-6 text-right font-black text-slate-900">₹{(item.quantity * (item.priceAtOrder || 0)).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary & Terms */}
            <div className="grid grid-cols-2 gap-12 items-start">
              <div className="space-y-4">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Terms & Conditions</h5>
                <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">{poConfig.terms}</p>
              </div>
              <div className="bg-slate-900 text-white p-8 rounded-[2rem] flex flex-col items-end">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Grand Total (Incl. GST)</p>
                <p className="text-5xl font-black tracking-tighter">₹{viewingPO.totalCost?.toLocaleString()}</p>
                <div className="w-full h-px bg-white/10 my-6"></div>
                <div className="w-full text-right">
                  <p className="text-[8px] font-bold uppercase opacity-40">Authorized Signatory</p>
                  <div className="h-16 mt-2 border-b border-dashed border-white/20"></div>
                  <p className="text-[9px] font-black uppercase tracking-widest mt-2 text-emerald-400">{poConfig.companyName}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-16 text-center border-t pt-8">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">KMS Digital Supply Hub • Integrated ERP Output</p>
            </div>
          </div>
        </div>
      )}

      {/* Other tabs/modals... (keeping original structure but fixing PO composer line items types) */}
      {approvingItems && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300 no-print">
           <div className="bg-white rounded-[3.5rem] w-full max-w-6xl mx-auto h-[85vh] overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 flex flex-col">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                 <div>
                    <h3 className="text-2xl font-black tracking-tight uppercase">Bulk Order Composer</h3>
                    <p className="text-emerald-400 font-black text-[9px] uppercase tracking-widest mt-1">Consolidate {approvingItems.length} items</p>
                 </div>
                 <button onClick={() => setApprovingItems(null)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                 <div className="w-full lg:w-80 bg-slate-50 border-r border-slate-200 p-8 overflow-y-auto shrink-0 max-h-[30vh] lg:max-h-full">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Select Supplier</label>
                    <div className="space-y-3">
                       {vendors.map(v => (
                          <button key={v.id} onClick={() => setBulkVendorId(v.id)} className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${bulkVendorId === v.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'}`}>
                             <div className="font-bold text-sm">{v.name}</div>
                          </button>
                       ))}
                    </div>
                 </div>
                 <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                       <div className="overflow-x-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-slate-50">
                                <tr className="border-b border-slate-100">
                                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Details</th>
                                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Price</th>
                                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {approvingItems.map(item => {
                                  const line = poLineItems[item.id] || { quantity: 0, unitPrice: 0 };
                                  return (
                                    <tr key={item.id}>
                                        <td className="py-4 px-4">
                                          <p className="font-bold text-slate-900">{item.ingredientName}</p>
                                          <p className="text-xs text-slate-400">{item.brand || 'Any Brand'}</p>
                                        </td>
                                        <td className="py-4 px-4">
                                          <input type="number" value={line.quantity} onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-20 px-3 py-2 bg-slate-100 rounded-lg font-bold text-center" />
                                        </td>
                                        <td className="py-4 px-4">
                                          <input type="number" value={line.unitPrice} onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold" />
                                        </td>
                                        <td className="py-4 px-4 text-right font-black text-slate-900">₹{(line.quantity * line.unitPrice).toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                       </div>
                    </div>
                    <div className="p-8 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                       <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{Object.values(poLineItems).reduce((acc: number, curr: any) => acc + (curr.quantity * curr.unitPrice), 0).toLocaleString()}</p>
                       <button onClick={finalizeBulkPO} disabled={isSubmitting} className="w-full sm:w-auto bg-slate-900 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3">
                         {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />} Generate Bill
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
