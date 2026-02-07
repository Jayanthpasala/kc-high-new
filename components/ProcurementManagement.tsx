import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, AlertTriangle, CheckCircle, X, PlusCircle, Printer, FileText, Loader2, CheckSquare, Square, ArrowRight, Building2, Search, Calendar, Package, Save, Tag, Trash2, Truck, Download
} from 'lucide-react';
import { PendingProcurement, PurchaseOrder, InventoryItem, Vendor, POTemplateConfig, Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, writeBatch, doc, getDoc, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';

interface POLineItem {
  id: string;
  ingredientName: string;
  brand?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

const DEFAULT_PO_CONFIG: POTemplateConfig = {
  companyName: 'Kitchen Operations Management',
  address: 'Operations Headquarters',
  gstin: 'NOT_SET',
  pan: 'NOT_SET',
  email: 'ops@kms-system.local',
  phone: '000-000-0000',
  terms: '1. Material inspection required on delivery.\n2. Payment terms as per contract.\n3. Goods must match specification.'
};

export const ProcurementManagement: React.FC = () => {
  const [autoProcurements, setAutoProcurements] = useState<PendingProcurement[]>([]);
  const [manualProcurements, setManualProcurements] = useState<PendingProcurement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeTab, setActiveTab] = useState<'SHORTAGES' | 'PENDING' | 'COMPLETED'>('SHORTAGES');
  const [poConfig, setPoConfig] = useState<POTemplateConfig>(DEFAULT_PO_CONFIG);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approvingItems, setApprovingItems] = useState<PendingProcurement[] | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkVendorId, setBulkVendorId] = useState('');
  const [poLineItems, setPoLineItems] = useState<Record<string, POLineItem>>({});

  // New Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqSearch, setReqSearch] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [reqQty, setReqQty] = useState(0);
  const [reqDate, setReqDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingRequest, setIsSavingRequest] = useState(false);

  useEffect(() => {
    // Sync Inventory for automated shortages
    const unsubInv = onSnapshot(collection(db, "inventory"), (snap) => {
      const invData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(invData);
      
      const auto: PendingProcurement[] = invData
        .filter(i => (i.quantity || 0) <= (i.reorderLevel || 0))
        .map(i => ({
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
      setAutoProcurements(auto);
    });

    // Sync Manual Procurement Requests from Cloud
    const unsubManual = onSnapshot(collection(db, "procurements"), (snap) => {
      const manual = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingProcurement));
      setManualProcurements(manual);
    });

    const unsubVendors = onSnapshot(collection(db, "vendors"), (snap) => {
      setVendors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
    });

    const unsubPOs = onSnapshot(query(collection(db, "purchaseOrders"), orderBy("createdAt", "desc")), (snap) => {
      setPurchaseOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder)));
    });

    const unsubConfig = onSnapshot(doc(db, "settings", "po_config"), (snap) => {
      if (snap.exists()) {
        setPoConfig(snap.data() as POTemplateConfig);
      } else {
        setPoConfig(DEFAULT_PO_CONFIG);
      }
    });

    return () => { unsubInv(); unsubManual(); unsubVendors(); unsubPOs(); unsubConfig(); };
  }, []);

  const combinedProcurements = useMemo(() => {
    return [...autoProcurements, ...manualProcurements].sort((a, b) => b.createdAt - a.createdAt);
  }, [autoProcurements, manualProcurements]);

  const totalSelectedValue = useMemo(() => {
    return combinedProcurements.filter(p => selectedIds.has(p.id)).reduce((acc, curr) => {
      const price = vendors.find(v => v.priceLedger?.find(pl => pl.itemName === curr.ingredientName))?.priceLedger?.find(pl => pl.itemName === curr.ingredientName)?.price || 0;
      return acc + (curr.requiredQty * price);
    }, 0);
  }, [selectedIds, combinedProcurements, vendors]);

  const toggleSelection = (id: string) => {
    const n = new Set(selectedIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelectedIds(n);
  };

  const handleInitiateBulkPurchase = () => {
    const items = combinedProcurements.filter(p => selectedIds.has(p.id));
    if (items.length === 0) return;
    const lines: Record<string, POLineItem> = {};
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
      const lineValues = Object.values(poLineItems) as POLineItem[];
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
        totalCost: total,
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Default 1 week
      };

      const ref = doc(collection(db, "purchaseOrders"));
      const batch = writeBatch(db);
      batch.set(ref, newPO);

      // Clean up manual procurement requests if they were included in this PO
      lineValues.forEach(line => {
        if (!line.id.startsWith('SHORT-')) {
          batch.delete(doc(db, "procurements", line.id));
        }
      });

      await batch.commit();
      setApprovingItems(null);
      setSelectedIds(new Set());
      setActiveTab('PENDING');
    } catch (e) { 
      console.error(e);
      alert("Cloud Sync Failed."); 
    }
    finally { setIsSubmitting(false); }
  };

  const handleReceivePO = async (po: PurchaseOrder) => {
    if (!confirm("Are you sure you have received all items in this order? This will update your inventory stock levels.")) return;
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      // Update each item in inventory
      for (const item of po.items) {
        const invItem = inventory.find(i => 
          i.name.toLowerCase() === item.ingredientName.toLowerCase() && 
          (i.brand || '').toLowerCase() === (item.brand || '').toLowerCase()
        );
        
        if (invItem) {
          const newQty = (invItem.quantity || 0) + item.quantity;
          batch.update(doc(db, "inventory", invItem.id), {
            quantity: newQty,
            lastPrice: item.priceAtOrder || invItem.lastPrice,
            lastRestocked: new Date().toISOString().split('T')[0]
          });
        }
      }
      
      batch.update(doc(db, "purchaseOrders", po.id), {
        status: 'received',
        receivedAt: Date.now()
      });
      
      await batch.commit();
      alert("Inventory successfully updated.");
    } catch (e) {
      console.error(e);
      alert("Failed to update inventory.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePOPDF = (po: PurchaseOrder) => {
    try {
      const doc = new jsPDF();
      const config = poConfig || DEFAULT_PO_CONFIG;
      
      // Header Section
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(config.companyName.toUpperCase(), 20, 25);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      const addressLines = doc.splitTextToSize(config.address, 100);
      doc.text(addressLines, 20, 32);
      const addressHeight = addressLines.length * 5;
      doc.text(`GST: ${config.gstin || 'N/A'} | PAN: ${config.pan || 'N/A'}`, 20, 35 + addressHeight);
      
      // Right side metadata
      doc.setTextColor(0);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("PURCHASE ORDER", 120, 25);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`PO NUMBER: #${po.orderNumber}`, 120, 35);
      doc.setFont("helvetica", "normal");
      doc.text(`DATE ISSUED: ${new Date(po.createdAt).toLocaleDateString()}`, 120, 41);
      doc.text(`EXP. DELIVERY: ${po.expectedDeliveryDate || 'N/A'}`, 120, 47);

      // Main Horizontal Divider
      doc.setDrawColor(220);
      doc.line(20, 60, 190, 60);

      // Vendor Info
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("TO VENDOR:", 20, 70);
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text(po.vendorName.toUpperCase(), 20, 78);
      
      // Table Header
      let y = 95;
      doc.setFillColor(248, 250, 252);
      doc.rect(20, y, 170, 10, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("ITEM SPECIFICATION", 25, y + 6.5);
      doc.text("QTY", 110, y + 6.5);
      doc.text("RATE", 135, y + 6.5);
      doc.text("TOTAL (INR)", 165, y + 6.5);
      
      // Table Rows
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      y += 18;
      po.items.forEach(item => {
        if (y > 270) { doc.addPage(); y = 30; }

        doc.setFont("helvetica", "bold");
        doc.text(item.ingredientName, 25, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(item.brand || 'Standard Generic', 25, y + 4);
        
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(`${item.quantity} ${item.unit}`, 110, y + 2);
        doc.text(`Rs. ${(item.priceAtOrder || 0).toLocaleString()}`, 135, y + 2);
        
        doc.setFont("helvetica", "bold");
        doc.text(`Rs. ${((item.quantity || 0) * (item.priceAtOrder || 0)).toLocaleString()}`, 165, y + 2);
        
        y += 15;
      });
      
      // Totals Footer
      y = Math.max(y, 140);
      doc.setDrawColor(200);
      doc.line(120, y, 190, y);
      y += 10;
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text(`GRAND TOTAL: Rs. ${po.totalCost?.toLocaleString()}`, 120, y);
      
      // Terms
      y += 30;
      if (y > 250) { doc.addPage(); y = 30; }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("TERMS & CONDITIONS:", 20, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100);
      const termsLines = doc.splitTextToSize(config.terms || DEFAULT_PO_CONFIG.terms, 160);
      doc.text(termsLines, 20, y + 6);

      // Signature Area
      y += 40;
      if (y > 280) { doc.addPage(); y = 50; }
      doc.setDrawColor(200);
      doc.line(140, y, 190, y);
      doc.text("AUTHORIZED SIGNATORY", 142, y + 5);
      
      doc.save(`PO-${po.orderNumber}.pdf`);
    } catch (error) {
      console.error("PDF Fail:", error);
      alert("System PDF Error: Please ensure you have configured the PO Template in Settings first.");
    }
  };

  const handleSaveManualRequest = async () => {
    if (!selectedInventoryItem || reqQty <= 0) return alert("Select material and enter quantity.");
    setIsSavingRequest(true);
    try {
      const newReq: Partial<PendingProcurement> = {
        ingredientName: selectedInventoryItem.name,
        brand: selectedInventoryItem.brand || '',
        requiredQty: reqQty,
        currentStock: selectedInventoryItem.quantity || 0,
        shortageQty: reqQty, 
        unit: selectedInventoryItem.unit,
        requiredByDate: reqDate,
        status: 'pending',
        createdAt: Date.now(),
        isManual: true
      };
      await addDoc(collection(db, "procurements"), newReq);
      setIsRequestModalOpen(false);
      setSelectedInventoryItem(null);
      setReqQty(0);
      setReqSearch('');
    } catch (e) {
      alert("Failed to save request.");
    } finally {
      setIsSavingRequest(false);
    }
  };

  const filteredInventoryForRequest = inventory.filter(i => 
    i.name.toLowerCase().includes(reqSearch.toLowerCase()) || 
    (i.brand || '').toLowerCase().includes(reqSearch.toLowerCase())
  );

  const deleteManualRequest = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this manual request?")) {
      await deleteDoc(doc(db, "procurements", id));
      const n = new Set(selectedIds);
      n.delete(id);
      setSelectedIds(n);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-8 no-print gap-6">
        <div>
          <h2 className="text-3xl font-black flex items-center gap-3"><ShoppingCart className="text-emerald-500" size={32} /> Procurement Hub</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Acquisition & Supply Management</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white p-1.5 rounded-2xl border flex gap-1 shadow-sm">
            {['SHORTAGES', 'PENDING', 'COMPLETED'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)} 
                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setIsRequestModalOpen(true)}
            className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/10 active:scale-95"
          >
            <PlusCircle size={18} /> New Procurement
          </button>
        </div>
      </div>

      {activeTab === 'SHORTAGES' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
             <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
             <div>
                <h4 className="text-sm font-black text-amber-900 uppercase">Operational Notice</h4>
                <p className="text-xs font-medium text-amber-700 mt-1">Items below are either system-detected shortages or manual staff requests. Select items to generate consolidated Purchase Orders.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
            {combinedProcurements.map(p => (
              <div key={p.id} onClick={() => toggleSelection(p.id)} className={`p-8 rounded-[3rem] border-2 cursor-pointer transition-all flex flex-col justify-between h-full min-h-[320px] group relative ${selectedIds.has(p.id) ? 'bg-emerald-50 border-emerald-500 ring-4 ring-emerald-500/10' : 'bg-white hover:shadow-xl hover:border-slate-300'}`}>
                 <div className="flex justify-between items-start mb-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${p.isManual ? 'bg-blue-50 text-blue-500' : 'bg-rose-50 text-rose-500'}`}>
                      {p.isManual ? <FileText size={28} /> : <AlertTriangle size={28} />}
                    </div>
                    <div className="text-right">
                       <p className="text-lg font-black text-slate-900">{p.requiredQty} {p.unit}</p>
                       <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${p.isManual ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                         {p.isManual ? 'Manual Request' : 'Auto Shortage'}
                       </span>
                    </div>
                 </div>
                 
                 <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{p.ingredientName}</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                       <Tag size={10} /> {p.brand || 'No Preferred Brand'}
                    </p>
                 </div>

                 <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                       <Calendar size={14} />
                       <span className="text-[10px] font-black uppercase">By {p.requiredByDate}</span>
                    </div>
                    {p.isManual && (
                       <button onClick={(e) => deleteManualRequest(e, p.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={14} />
                       </button>
                    )}
                 </div>
                 
                 {selectedIds.has(p.id) && (
                   <div className="absolute top-6 right-6 bg-emerald-500 text-white p-1 rounded-full">
                     <CheckCircle size={16} />
                   </div>
                 )}
              </div>
            ))}
            
            {combinedProcurements.length === 0 && (
              <div className="col-span-full py-32 text-center bg-slate-50/50 rounded-[3.5rem] border-4 border-dashed border-slate-100">
                 <Package className="mx-auto text-slate-200 mb-6" size={64} />
                 <h3 className="text-2xl font-black text-slate-400">Registry Balanced</h3>
                 <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest mt-2">No active material requests detected.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW REQUEST MODAL */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white rounded-[3.5rem] w-full max-w-2xl mx-auto overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[90vh] flex flex-col">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center sticky top-0 z-10 shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="bg-emerald-500 p-3 rounded-2xl text-slate-950 shadow-lg"><ShoppingCart size={24} /></div>
                    <div>
                       <h3 className="text-2xl font-black uppercase tracking-tight">Manual Requisition</h3>
                       <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Internal Material Request Form</p>
                    </div>
                 </div>
                 <button onClick={() => setIsRequestModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
              </div>
              
              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                 {!selectedInventoryItem ? (
                   <div className="space-y-6">
                      <div className="relative">
                         <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                         <input 
                           type="text" 
                           placeholder="Search inventory materials..." 
                           value={reqSearch}
                           onChange={e => setReqSearch(e.target.value)}
                           className="w-full pl-16 pr-6 py-6 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 font-bold text-slate-900 outline-none transition-all shadow-inner"
                         />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                         {filteredInventoryForRequest.map(item => (
                           <button 
                             key={item.id} 
                             onClick={() => setSelectedInventoryItem(item)}
                             className="flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left group"
                           >
                              <div>
                                 <p className="font-black text-slate-900 text-lg leading-tight">{item.name}</p>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    {item.brand || 'Generic'} • {item.quantity} {item.unit} in stock
                                 </p>
                              </div>
                              <ArrowRight size={20} className="text-slate-200 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                           </button>
                         ))}
                      </div>
                   </div>
                 ) : (
                   <div className="space-y-8 animate-in slide-in-from-right-4">
                      <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Selected Material</p>
                            <h4 className="text-2xl font-black text-slate-900">{selectedInventoryItem.name}</h4>
                            <p className="text-xs font-bold text-emerald-600 mt-1 uppercase tracking-wide">{selectedInventoryItem.brand || 'Standard Specification'}</p>
                         </div>
                         <button onClick={() => setSelectedInventoryItem(null)} className="text-slate-400 hover:text-rose-500 font-black text-[10px] uppercase underline underline-offset-4 decoration-2">Change</button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Required Quantity</label>
                            <div className="relative">
                               <input 
                                 type="number" 
                                 value={reqQty} 
                                 onChange={e => setReqQty(parseFloat(e.target.value) || 0)}
                                 className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 font-black text-xl text-slate-900 outline-none transition-all shadow-inner" 
                               />
                               <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300 uppercase text-xs">{selectedInventoryItem.unit}</span>
                            </div>
                         </div>
                         
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Needed By Date</label>
                            <input 
                              type="date" 
                              value={reqDate}
                              onChange={e => setReqDate(e.target.value)}
                              className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-emerald-500 font-black text-sm text-slate-900 outline-none transition-all shadow-inner" 
                            />
                         </div>
                      </div>

                      <button 
                        onClick={handleSaveManualRequest}
                        disabled={isSavingRequest}
                        className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                      >
                         {isSavingRequest ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                         Initialize Requisition
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* BULK APPROVAL DRAWER / BAR */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl flex items-center gap-8 no-print z-50 animate-in slide-in-from-bottom-10 ring-8 ring-white/10">
           <div className="flex items-center gap-6 pr-8 border-r border-white/10">
              <div className="w-12 h-12 bg-emerald-500 text-slate-950 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">
                 {selectedIds.size}
              </div>
              <div>
                 <p className="text-lg font-black">Consolidated Value: ₹{totalSelectedValue.toLocaleString()}</p>
                 <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Awaiting Purchase Order Generation</p>
              </div>
           </div>
           <button onClick={handleInitiateBulkPurchase} className="bg-emerald-500 text-slate-950 px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-white transition-all shadow-xl active:scale-95">
             Generate PO <ArrowRight size={18} />
           </button>
        </div>
      )}

      {/* PO REVIEW MODAL */}
      {approvingItems && (
        <div className="fixed inset-0 z-[110] bg-slate-950/90 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md animate-in fade-in">
           <div className="bg-white rounded-[3.5rem] w-full max-w-5xl p-10 shadow-2xl border-4 border-slate-900 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8 shrink-0">
                 <h3 className="text-3xl font-black uppercase tracking-tighter">Draft Purchase Order</h3>
                 <button onClick={() => setApprovingItems(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-10">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Sourcing Partner</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                       {vendors.map(v => (
                          <button key={v.id} onClick={() => setBulkVendorId(v.id)} className={`p-6 rounded-[2rem] border-2 transition-all flex items-center gap-4 text-left ${bulkVendorId === v.id ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-300'}`}>
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bulkVendorId === v.id ? 'bg-white/10' : 'bg-white shadow-sm'}`}><Building2 size={18} /></div>
                             <span className="font-black text-xs uppercase truncate">{v.name}</span>
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Consolidated Line Items</label>
                    <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 overflow-hidden">
                       <table className="w-full text-left">
                          <thead className="border-b border-slate-200">
                             <tr className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                <th className="p-6">Material Specification</th>
                                <th className="p-6 text-center">Batch Qty</th>
                                <th className="p-6 text-right">Unit Rate (₹)</th>
                                <th className="p-6 text-right">Total (₹)</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {approvingItems.map(item => {
                                const line = poLineItems[item.id];
                                return (
                                   <tr key={item.id} className="bg-white/50">
                                      <td className="p-6">
                                         <p className="font-black text-slate-900">{item.ingredientName}</p>
                                         <p className="text-[9px] font-bold text-slate-400 uppercase">{item.brand}</p>
                                      </td>
                                      <td className="p-6 text-center font-black text-slate-600">{item.requiredQty} {item.unit}</td>
                                      <td className="p-6 text-right">
                                         <input 
                                           type="number" 
                                           value={line?.unitPrice || 0}
                                           onChange={e => setPoLineItems({...poLineItems, [item.id]: {...line!, unitPrice: parseFloat(e.target.value) || 0}})}
                                           className="w-24 px-3 py-2 rounded-lg bg-slate-50 border-none font-black text-right text-sm focus:ring-2 focus:ring-emerald-500/20" 
                                         />
                                      </td>
                                      <td className="p-6 text-right font-black text-emerald-600">
                                         ₹{((line?.unitPrice || 0) * item.requiredQty).toLocaleString()}
                                      </td>
                                   </tr>
                                );
                             })}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row justify-between items-center gap-6 border-t pt-8 shrink-0">
                 <div className="text-center sm:text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated PO Total</p>
                    <p className="text-4xl font-black text-slate-900">₹{(Object.values(poLineItems).reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0)).toLocaleString()}</p>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => setApprovingItems(null)} className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors">Discard Draft</button>
                    <button onClick={finalizeBulkPO} disabled={isSubmitting || !bulkVendorId} className="bg-slate-900 text-white px-12 py-5 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-3 disabled:opacity-30 active:scale-95">
                       {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckSquare size={18} />}
                       Authorize & Send PO
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* PO VIEW MODAL */}
      {viewingPO && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6 no-print-modal animate-in fade-in">
           <div className="bg-white w-full max-w-4xl p-12 rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-start mb-12">
                 <div>
                    {poConfig.logoUrl ? <img src={poConfig.logoUrl} className="h-16 mb-4" /> : <div className="bg-slate-900 text-white p-4 rounded-xl inline-block shadow-lg"><Building2 /></div>}
                    <h2 className="text-2xl font-black uppercase tracking-tighter mt-4">{poConfig.companyName || DEFAULT_PO_CONFIG.companyName}</h2>
                    <p className="text-xs text-slate-500 whitespace-pre-wrap mt-2">{poConfig.address || DEFAULT_PO_CONFIG.address}</p>
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
                       <th className="py-4">Item Specification</th>
                       <th className="py-4 text-center">Quantity</th>
                       <th className="py-4 text-right">Unit Rate</th>
                       <th className="py-4 text-right">Subtotal</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y">
                    {viewingPO.items.map((i, idx) => (
                       <tr key={idx}>
                          <td className="py-6"><p className="font-black text-slate-900">{i.ingredientName}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{i.brand}</p></td>
                          <td className="py-6 text-center font-bold">{i.quantity} {i.unit}</td>
                          <td className="py-6 text-right font-bold">₹{i.priceAtOrder}</td>
                          <td className="py-6 text-right font-black">₹{(i.quantity * (i.priceAtOrder || 0)).toLocaleString()}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
              <div className="flex justify-between items-end border-t pt-10">
                 <div className="max-w-xs">
                   <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Notice & Terms</p>
                   <p className="text-[10px] text-slate-400 font-bold leading-relaxed">{poConfig.terms || DEFAULT_PO_CONFIG.terms}</p>
                 </div>
                 <div className="text-right bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                    <p className="text-[10px] font-black uppercase opacity-50 mb-1">Grand Total (INR)</p>
                    <p className="text-4xl font-black">₹{viewingPO.totalCost?.toLocaleString()}</p>
                 </div>
              </div>
              <div className="mt-12 flex gap-4 no-print border-t pt-8">
                 <button onClick={() => generatePOPDF(viewingPO)} className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg">
                    <Download size={16} /> Export PO Document
                 </button>
                 <button onClick={() => setViewingPO(null)} className="bg-slate-100 text-slate-500 px-8 py-4 rounded-xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Close Viewer</button>
              </div>
           </div>
        </div>
      )}

      {/* PENDING TAB CONTENT */}
      {activeTab === 'PENDING' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {purchaseOrders.filter(po => po.status === 'pending').map(po => (
              <div key={po.id} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all group border-t-8 border-t-amber-400 flex flex-col h-full">
                 <div className="flex justify-between items-start mb-6">
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order Number</p>
                       <h4 className="text-xl font-black text-slate-900">#{po.orderNumber}</h4>
                    </div>
                    <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">Awaiting Delivery</span>
                 </div>
                 
                 <div className="space-y-4 mb-8 flex-1">
                    <div className="flex items-center gap-3">
                       <Building2 size={16} className="text-slate-400" />
                       <span className="text-sm font-bold text-slate-600">{po.vendorName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase">
                       <Package size={16} /> {po.items.length} Unique Materials
                    </div>
                 </div>

                 <div className="space-y-3 pt-6 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                       <p className="text-xl font-black text-slate-900">₹{po.totalCost?.toLocaleString()}</p>
                       <button onClick={() => setViewingPO(po)} className="text-slate-400 hover:text-slate-900 transition-colors">
                          <FileText size={22} />
                       </button>
                    </div>
                    <button 
                      onClick={() => handleReceivePO(po)}
                      disabled={isSubmitting}
                      className="w-full bg-emerald-500 text-slate-950 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                       {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Truck size={14} />}
                       Log Inward Delivery
                    </button>
                 </div>
              </div>
           ))}
           {purchaseOrders.filter(po => po.status === 'pending').length === 0 && (
             <div className="col-span-full py-32 text-center text-slate-300">
                <p className="font-black uppercase text-[10px] tracking-widest">No active purchase orders in queue</p>
             </div>
           )}
        </div>
      )}

      {/* COMPLETED TAB CONTENT */}
      {activeTab === 'COMPLETED' && (
        <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden">
           <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-200">
                 <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <th className="p-8">PO Ref</th>
                    <th className="p-8">Vendor Partner</th>
                    <th className="p-8">Order Date</th>
                    <th className="p-8 text-right">Total Outlay</th>
                    <th className="p-8 text-center">Status</th>
                    <th className="p-8 text-right">Archive</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {purchaseOrders.filter(po => po.status === 'received').map(po => (
                    <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                       <td className="p-8 font-black text-slate-900">#{po.orderNumber}</td>
                       <td className="p-8">
                          <p className="font-bold text-slate-700">{po.vendorName}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase">{po.items.length} Items</p>
                       </td>
                       <td className="p-8 text-slate-500 text-sm font-bold">{new Date(po.createdAt).toLocaleDateString()}</td>
                       <td className="p-8 text-right font-black text-slate-900">₹{po.totalCost?.toLocaleString()}</td>
                       <td className="p-8 text-center">
                          <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">GRN Generated</span>
                       </td>
                       <td className="p-8 text-right">
                          <button onClick={() => setViewingPO(po)} className="text-slate-400 hover:text-emerald-500 transition-colors">
                             <FileText size={18} />
                          </button>
                       </td>
                    </tr>
                 ))}
                 {purchaseOrders.filter(po => po.status === 'received').length === 0 && (
                   <tr>
                      <td colSpan={6} className="p-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Archive Empty</td>
                   </tr>
                 )}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
};