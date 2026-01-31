
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, AlertTriangle, CheckCircle, X, PlusCircle, Printer, FileText, Loader2, CheckSquare, Square, ArrowRight, Building2
} from 'lucide-react';
import { PendingProcurement, PurchaseOrder, InventoryItem, Vendor, POTemplateConfig, Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, writeBatch, doc, getDoc } from 'firebase/firestore';

interface AuditItem { receivedQty: number; qualityPassed: boolean; notes: string; }

// Define a type-safe interface for PO line items
interface POLineItem {
  id: string;
  ingredientName: string;
  brand?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export const ProcurementManagement: React.FC = () => {
  const [procurements, setProcurements] = useState<PendingProcurement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeTab, setActiveTab] = useState<'SHORTAGES' | 'PENDING' | 'COMPLETED'>('SHORTAGES');
  const [poConfig, setPoConfig] = useState<POTemplateConfig | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approvingItems, setApprovingItems] = useState<PendingProcurement[] | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkVendorId, setBulkVendorId] = useState('');
  // Use POLineItem interface for type safety to fix 'unknown' errors
  const [poLineItems, setPoLineItems] = useState<Record<string, POLineItem>>({});

  useEffect(() => {
    // Sync All Procurement Data from Cloud
    const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => {
      const invData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(invData);
      // Correcting autoShortages to match PendingProcurement interface requirements by adding currentStock and shortageQty
      const autoShortages: PendingProcurement[] = invData.filter(i => (i.quantity || 0) <= (i.reorderLevel || 0)).map(i => ({
        id: `SHORT-${i.id}`,
        ingredientName: i.name,
        brand: i.brand,
        requiredQty: i.reorderLevel * 2,
        currentStock: i.quantity || 0,
        shortageQty: Math.max(0, (i.reorderLevel * 2) - (i.quantity || 0)),
        unit: i.unit,
        requiredByDate: new Date().toISOString().split('T')[0],
        status: 'pending' as const,
        createdAt: Date.now()
      }));
      setProcurements(autoShortages);
    });

    const unsubVendors = onSnapshot(collection(db, "vendors"), (snap) => {
      setVendors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
    });

    const unsubPOs = onSnapshot(query(collection(db, "purchaseOrders"), orderBy("createdAt", "desc")), (snap) => {
      setPurchaseOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder)));
    });

    const unsubConfig = onSnapshot(doc(db, "settings", "po_config"), (snap) => {
      if (snap.exists()) setPoConfig(snap.data() as POTemplateConfig);
    });

    return () => { unsubInv(); unsubVendors(); unsubPOs(); unsubConfig(); };
  }, []);

  const totalSelectedValue = useMemo(() => {
    return procurements.filter(p => selectedIds.has(p.id)).reduce((acc, curr) => {
      const price = vendors.find(v => v.priceLedger?.find(pl => pl.itemName === curr.ingredientName))?.priceLedger?.find(pl => pl.itemName === curr.ingredientName)?.price || 0;
      return acc + (curr.requiredQty * price);
    }, 0);
  }, [selectedIds, procurements, vendors]);

  const toggleSelection = (id: string) => {
    const n = new Set(selectedIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelectedIds(n);
  };

  const handleInitiateBulkPurchase = () => {
    const items = procurements.filter(p => selectedIds.has(p.id));
    if (items.length === 0) return;
    const lines: Record<string, POLineItem> = {};
    // Fix: Explicitly define the objects according to the POLineItem interface
    items.forEach(i => lines[i.id] = { 
      id: i.id,
      ingredientName: i.ingredientName, 
      brand: i.brand,
      quantity: i.requiredQty, 
      unit: i.unit, 
      unitPrice: 0 
    });
    setPoLineItems(lines);
    setApprovingItems(items);
  };

  const finalizeBulkPO = async () => {
    if (!bulkVendorId) return alert("Select Vendor.");
    setIsSubmitting(true);
    try {
      const vendor = vendors.find(v => v.id === bulkVendorId);
      const num = `PO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      // Fix: Use Typed state values to avoid 'unknown' operator and property errors
      const lineValues = Object.values(poLineItems);
      const total = lineValues.reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0);
      const newPO = {
        orderNumber: num,
        vendorId: bulkVendorId,
        vendorName: vendor?.name || 'Vendor',
        items: lineValues.map(l => ({ 
          ingredientName: l.ingredientName, 
          quantity: l.quantity, 
          unit: l.unit, 
          priceAtOrder: l.unitPrice, 
          brand: l.brand 
        })),
        status: 'pending',
        createdAt: Date.now(),
        totalCost: total
      };
      const ref = doc(collection(db, "purchaseOrders"));
      const batch = writeBatch(db);
      batch.set(ref, newPO);
      await batch.commit();
      setApprovingItems(null);
      setSelectedIds(new Set());
      setActiveTab('PENDING');
    } catch (e) { alert("Cloud Sync Failed."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-8 no-print">
        <h2 className="text-3xl font-black flex items-center gap-3"><ShoppingCart className="text-emerald-500" size={32} /> Procurement Hub</h2>
        <div className="bg-white p-1.5 rounded-2xl border flex gap-1 shadow-sm">
          {['SHORTAGES', 'PENDING', 'COMPLETED'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>{tab}</button>
          ))}
        </div>
      </div>

      {activeTab === 'SHORTAGES' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
          {procurements.map(p => (
            <div key={p.id} onClick={() => toggleSelection(p.id)} className={`p-8 rounded-[3rem] border-2 cursor-pointer transition-all flex flex-col justify-between h-full min-h-[300px] ${selectedIds.has(p.id) ? 'bg-emerald-50 border-emerald-500 ring-4' : 'bg-white hover:shadow-xl'}`}>
               <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center"><AlertTriangle size={28} /></div>
                  <p className="text-sm font-black text-slate-900">{p.requiredQty} {p.unit}</p>
               </div>
               <h3 className="text-xl font-black mb-1">{p.ingredientName}</h3>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Brand: {p.brand || 'Any'}</p>
            </div>
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl flex items-center gap-8 no-print z-50 animate-in slide-in-from-bottom-10">
           <div>
              <p className="text-3xl font-black">₹{totalSelectedValue.toLocaleString()}</p>
              <p className="text-[10px] uppercase font-black opacity-50">{selectedIds.size} Items Selected</p>
           </div>
           <button onClick={handleInitiateBulkPurchase} className="bg-emerald-500 text-slate-950 px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-xs flex items-center gap-2">Generate PO <ArrowRight size={18} /></button>
        </div>
      )}

      {viewingPO && poConfig && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6 no-print-modal">
           <div className="bg-white w-full max-w-4xl p-12 rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-start mb-12">
                 <div>
                    {poConfig.logoUrl ? <img src={poConfig.logoUrl} className="h-16 mb-4" /> : <div className="bg-slate-900 text-white p-4 rounded-xl inline-block"><Building2 /></div>}
                    <h2 className="text-2xl font-black uppercase tracking-tighter">{poConfig.companyName}</h2>
                    <p className="text-xs text-slate-500 whitespace-pre-wrap">{poConfig.address}</p>
                 </div>
                 <div className="text-right">
                    <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">PO</h1>
                    <p className="text-lg font-black">#{viewingPO.orderNumber}</p>
                    <p className="text-sm font-bold text-slate-400">{new Date(viewingPO.createdAt).toLocaleDateString()}</p>
                 </div>
              </div>
              <table className="w-full text-left mb-12">
                 <thead className="border-b-2 border-slate-900">
                    <tr className="text-[10px] font-black uppercase tracking-widest">
                       <th className="py-4">Item</th>
                       <th className="py-4 text-center">Qty</th>
                       <th className="py-4 text-right">Price</th>
                       <th className="py-4 text-right">Total</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y">
                    {viewingPO.items.map((i, idx) => (
                       <tr key={idx}>
                          <td className="py-6"><p className="font-black">{i.ingredientName}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{i.brand}</p></td>
                          <td className="py-6 text-center font-bold">{i.quantity} {i.unit}</td>
                          <td className="py-6 text-right font-bold">₹{i.priceAtOrder}</td>
                          <td className="py-6 text-right font-black">₹{(i.quantity * (i.priceAtOrder || 0)).toLocaleString()}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
              <div className="flex justify-between items-end border-t pt-10">
                 <p className="text-[10px] text-slate-400 font-bold max-w-xs">{poConfig.terms}</p>
                 <div className="text-right bg-slate-900 text-white p-8 rounded-3xl">
                    <p className="text-[10px] font-black uppercase opacity-50 mb-1">Grand Total</p>
                    <p className="text-4xl font-black">₹{viewingPO.totalCost?.toLocaleString()}</p>
                 </div>
              </div>
              <div className="mt-12 flex gap-4 no-print">
                 <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black uppercase text-xs">Print PDF</button>
                 <button onClick={() => setViewingPO(null)} className="bg-slate-100 text-slate-400 px-8 py-4 rounded-xl font-black uppercase text-xs">Close</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
