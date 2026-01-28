
import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { PendingProcurement, PurchaseOrder, InventoryItem, Vendor, POTemplateConfig, Brand } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, writeBatch, doc } from 'firebase/firestore';

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

// Fallback vendors to ensure the dropdown is never empty
const DEFAULT_VENDORS: Vendor[] = [
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

interface AuditItem {
  receivedQty: number;
  qualityPassed: boolean;
  notes: string;
}

export const ProcurementManagement: React.FC = () => {
  const [procurements, setProcurements] = useState<PendingProcurement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeTab, setActiveTab] = useState<'SHORTAGES' | 'PENDING' | 'COMPLETED'>('SHORTAGES');
  const [poConfig, setPoConfig] = useState<POTemplateConfig>(DEFAULT_PO_CONFIG);
  
  // Modals / Focused states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [approvingProcurement, setApprovingProcurement] = useState<PendingProcurement | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [verifyingPO, setVerifyingPO] = useState<PurchaseOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Verification / Audit state
  const [auditData, setAuditData] = useState<Record<string, AuditItem>>({});
  const [verificationRemarks, setVerificationRemarks] = useState('');

  // Manual Request Form State
  const [manualReq, setManualReq] = useState({
    name: '',
    brand: '',
    qty: 0,
    unit: 'kg',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // Approval Form State
  const [approvalData, setApprovalData] = useState<{vendorId: string, quantity: number, unitPrice: number, brand?: string}>({
    vendorId: '',
    quantity: 0,
    unitPrice: 0
  });

  const loadLocalData = () => {
    let vends = JSON.parse(localStorage.getItem('vendors') || '[]');
    // Seed vendors if empty to prevent PO errors
    if (vends.length === 0) {
      vends = DEFAULT_VENDORS;
      localStorage.setItem('vendors', JSON.stringify(vends));
    }
    
    const pos = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
    const manualProcs = JSON.parse(localStorage.getItem('manualProcurements') || '[]');
    const savedConfig = localStorage.getItem('poTemplateConfig');
    
    if (savedConfig) setPoConfig(JSON.parse(savedConfig));
    setVendors(vends);
    setPurchaseOrders(pos);
    return { manualProcs };
  };

  useEffect(() => {
    // Inventory and Brands from Firestore
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
    
    // Refresh local list immediately
    setProcurements(prev => {
      const autos = prev.filter(p => !p.isManual);
      return [...autos, ...updatedManual];
    });

    setIsRequestModalOpen(false);
    setManualReq({
      name: '',
      brand: '',
      qty: 0,
      unit: 'kg',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    window.dispatchEvent(new Event('storage'));
  };

  const handleInitiatePurchase = (p: PendingProcurement) => {
    setApprovingProcurement(p);
    
    // Smart Logic: Find the best vendor automatically to prevent validation errors
    let suggestedVendorId = '';
    let suggestedPrice = 0;

    // 1. Look for vendor who supplies this specific item
    const supplier = vendors.find(v => v.suppliedItems?.some(item => item.toLowerCase() === p.ingredientName.toLowerCase()));
    
    if (supplier) {
      suggestedVendorId = supplier.id;
    } else if (vendors.length > 0) {
       // 2. Fallback to first vendor if available
       suggestedVendorId = vendors[0].id;
    }

    // 3. Find price from ledger if available
    if (suggestedVendorId) {
       const v = vendors.find(ven => ven.id === suggestedVendorId);
       const entry = v?.priceLedger?.find(pl => pl.itemName.toLowerCase() === p.ingredientName.toLowerCase());
       if (entry) suggestedPrice = entry.price;
    }

    setApprovalData({ 
       vendorId: suggestedVendorId, 
       quantity: p.requiredQty, 
       unitPrice: suggestedPrice, 
       brand: p.brand 
    });
  };

  const finalizePO = async () => {
    if (!approvingProcurement) return;

    // VALIDATION: Ensure vendor is selected
    if (!approvalData.vendorId) {
        alert("Action Required: Please select a vendor from the list to generate a Purchase Order.");
        return;
    }
    
    setIsSubmitting(true);
    try {
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
      }
      
      setApprovingProcurement(null);
      setActiveTab('PENDING');
      window.dispatchEvent(new Event('storage'));
      // Small delay to ensure UI updates before alert
      setTimeout(() => alert(`Purchase Order ${uniqueOrderNo} created successfully!`), 100);
    } catch (err) {
      console.error(err);
      alert("Failed to generate Purchase Order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startPhysicalAudit = (po: PurchaseOrder) => {
    setVerifyingPO(po);
    const initialAudit: Record<string, AuditItem> = {};
    if (po.items) {
      po.items.forEach(item => {
        // Initialize with full quantity, passing quality by default
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

  const updateAuditItem = (itemName: string, field: keyof AuditItem, value: any) => {
    setAuditData(prev => ({
      ...prev,
      [itemName]: {
        ...prev[itemName],
        [field]: value
      }
    }));
  };

  const commitGRN = async () => {
    if (!verifyingPO) return;
    
    const itemsFailedQuality = Object.values(auditData).some((item: AuditItem) => !item.qualityPassed);
    if (itemsFailedQuality) {
       if (!confirm("Attention: Some items failed quality checks. Proceed with partial inventory update?")) {
         return;
       }
    }

    setIsSubmitting(true);

    // Generate Unique GRN
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
    
    try {
      const batch = writeBatch(db);
      
      // Update inventory based on received items
      for (const item of verifyingPO.items) {
         const audit = auditData[item.ingredientName];
         if (!audit) continue;
         
         // Only add to inventory if quality passed and qty > 0
         if (audit.receivedQty <= 0 || !audit.qualityPassed) continue;

         // Find inventory item by name match (case-insensitive)
         const invItem = inventory.find(i => i.name.toLowerCase() === item.ingredientName.toLowerCase());
         
         if (invItem) {
            const newQty = (invItem.quantity || 0) + audit.receivedQty;
            const status = newQty <= 0 ? 'out' : newQty <= (invItem.reorderLevel || 0) ? 'low' : 'healthy';
            const ref = doc(db, "inventory", invItem.id);
            batch.update(ref, {
               quantity: newQty,
               lastPrice: item.priceAtOrder || invItem.lastPrice,
               lastRestocked: new Date().toISOString().split('T')[0],
               status
            });
         } else {
            // Create new item if not exists
            const newRef = doc(collection(db, "inventory"));
            batch.set(newRef, {
               name: item.ingredientName,
               brand: item.brand || '',
               category: 'Procured Stock',
               quantity: audit.receivedQty,
               unit: item.unit,
               reorderLevel: 5,
               lastPrice: item.priceAtOrder || 0,
               lastRestocked: new Date().toISOString().split('T')[0],
               status: 'healthy',
               supplier: verifyingPO.vendorName
            });
         }
      }
      
      await batch.commit();

      // Update PO status locally
      const updatedPOs = purchaseOrders.map(po => 
         po.id === verifyingPO.id 
         ? { 
             ...po, 
             status: 'received' as const, 
             receivedAt: Date.now(), 
             remarks: verificationRemarks,
             grnNumber: grnNumber,
             // Save the actual audit data into the items for record
             items: po.items.map(i => ({
               ...i, 
               receivedQuantity: auditData[i.ingredientName]?.receivedQty || 0
             }))
           } 
         : po
      );
      localStorage.setItem('purchaseOrders', JSON.stringify(updatedPOs));
      setPurchaseOrders(updatedPOs);

      setVerifyingPO(null);
      setActiveTab('COMPLETED');
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => alert(`GRN Generated: ${grnNumber}\nInventory Master Updated Successfully.`), 100);
    } catch (error) {
      console.error("Error committing GRN:", error);
      alert("Failed to update inventory database. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
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
           <button onClick={() => setIsRequestModalOpen(true)} className="bg-white border-2 border-slate-200 text-slate-900 px-7 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:border-emerald-500 transition-all shadow-sm">
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
          {procurements.map(p => {
             return (
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
                    onClick={() => handleInitiatePurchase(p)} 
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    <CheckCircle size={18} /> Initiate Purchase
                  </button>
                </div>
              </div>
             );
          })}
          {procurements.length === 0 && (
            <div className="col-span-full py-32 text-center bg-slate-50/20 rounded-[3rem] border-2 border-dashed border-slate-200">
               <Package size={48} className="text-slate-200 mx-auto mb-4" />
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory baseline healthy. No critical shortages.</p>
            </div>
          )}
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
              <div className="p-10 space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Material Name</label>
                       <input type="text" value={manualReq.name} onChange={e => setManualReq({...manualReq, name: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner placeholder:text-slate-300" placeholder="e.g. Rice, Milk" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Preference</label>
                       <select 
                         value={manualReq.brand} 
                         onChange={e => setManualReq({...manualReq, brand: e.target.value})} 
                         className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner"
                       >
                          <option value="" className="text-slate-900">Any Brand</option>
                          {brands.map(b => (
                            <option key={b.id} value={b.name} className="text-slate-900">{b.name}</option>
                          ))}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Required Volume</label>
                       <div className="flex gap-2">
                          <input 
                            type="number" 
                            value={manualReq.qty} 
                            onChange={e => setManualReq({...manualReq, qty: parseFloat(e.target.value) || 0})} 
                            className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-black text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" 
                          />
                          <select 
                            value={manualReq.unit} 
                            onChange={e => setManualReq({...manualReq, unit: e.target.value})} 
                            className="w-32 px-4 py-4 rounded-xl bg-slate-100 border-none font-black text-center text-xs uppercase cursor-pointer focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900"
                          >
                            {KITCHEN_UNITS.map(unit => (
                              <option key={unit} value={unit} className="text-slate-900">{unit}</option>
                            ))}
                          </select>
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Needed By</label>
                       <input type="date" value={manualReq.date} onChange={e => setManualReq({...manualReq, date: e.target.value})} className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                    </div>
                 </div>
                 <button onClick={handleManualRequest} className="w-full mt-4 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl active:scale-95">Commit Request</button>
              </div>
           </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvingProcurement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500">
              <div className="bg-slate-900 p-10 text-white flex justify-between items-center">
                 <div>
                    <h3 className="text-3xl font-black tracking-tight uppercase">Approve Purchase</h3>
                    <p className="text-emerald-400 font-black text-[9px] uppercase tracking-widest mt-1">Generating Purchase Order</p>
                 </div>
                 <button onClick={() => setApprovingProcurement(null)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
              </div>
              <div className="p-10 space-y-8">
                 <div className="flex gap-6 items-center p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm"><Package size={32} className="text-slate-400" /></div>
                    <div>
                       <h4 className="text-xl font-black text-slate-900">{approvingProcurement.ingredientName}</h4>
                       <p className="text-sm font-bold text-slate-500">Required: {approvingProcurement.requiredQty} {approvingProcurement.unit}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Supplier</label>
                       <select 
                         value={approvalData.vendorId} 
                         onChange={e => setApprovalData({...approvalData, vendorId: e.target.value})}
                         className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner"
                       >
                          <option value="">Select Vendor...</option>
                          {vendors.map(v => (
                             <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand (Optional)</label>
                       <input 
                         type="text"
                         value={approvalData.brand || ''}
                         onChange={e => setApprovalData({...approvalData, brand: e.target.value})}
                         className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner"
                       />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Order Quantity</label>
                       <input 
                         type="number" 
                         value={approvalData.quantity} 
                         onChange={e => setApprovalData({...approvalData, quantity: parseFloat(e.target.value) || 0})}
                         className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-black text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Price (₹)</label>
                       <input 
                         type="number" 
                         value={approvalData.unitPrice} 
                         onChange={e => setApprovalData({...approvalData, unitPrice: parseFloat(e.target.value) || 0})}
                         className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-black text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner"
                       />
                    </div>
                 </div>
                 
                 <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cost</p>
                       <p className="text-2xl font-black text-slate-900">₹{(approvalData.quantity * approvalData.unitPrice).toLocaleString()}</p>
                    </div>
                    <button 
                      onClick={finalizePO} 
                      disabled={isSubmitting}
                      className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={18} />}
                      {isSubmitting ? 'Generating...' : 'Confirm PO'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* View PO Modal (Printable) */}
      {viewingPO && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl overflow-y-auto">
            <div className="bg-white w-full max-w-3xl min-h-[90vh] shadow-2xl relative animate-in zoom-in-95 duration-500">
               <button onClick={() => setViewingPO(null)} className="absolute top-4 right-4 p-3 bg-slate-100 hover:bg-rose-500 hover:text-white rounded-full transition-all no-print"><X size={20} /></button>
               
               <div className="p-12 space-y-8" id="po-print-area">
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
                     <div>
                        {poConfig.logoUrl && <img src={poConfig.logoUrl} alt="Logo" className="h-16 object-contain mb-4" />}
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{poConfig.companyName}</h1>
                        <p className="text-xs font-medium text-slate-500 mt-2 max-w-xs leading-relaxed">{poConfig.address}</p>
                        <div className="mt-4 space-y-1 text-xs font-bold text-slate-700">
                           <p>GSTIN: {poConfig.gstin}</p>
                           <p>PAN: {poConfig.pan}</p>
                           <p>Email: {poConfig.email}</p>
                           <p>Phone: {poConfig.phone}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <h2 className="text-4xl font-black text-slate-200 uppercase tracking-tighter">Purchase Order</h2>
                        <p className="text-lg font-black text-slate-900 mt-2">{viewingPO.orderNumber}</p>
                        {viewingPO.grnNumber && <p className="text-sm font-black text-emerald-600 mt-1">{viewingPO.grnNumber}</p>}
                        <p className="text-xs font-bold text-slate-500 mt-1">Date: {new Date(viewingPO.createdAt).toLocaleDateString()}</p>
                        <div className="mt-8 bg-slate-50 p-4 rounded-xl border border-slate-200 text-left w-64 ml-auto">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Vendor Details</p>
                           <p className="font-bold text-slate-900">{viewingPO.vendorName}</p>
                           <p className="text-xs text-slate-500 mt-1">Vendor ID: {viewingPO.vendorId}</p>
                        </div>
                     </div>
                  </div>

                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b-2 border-slate-900">
                           <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Item Description</th>
                           <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Quantity</th>
                           {viewingPO.status === 'received' && <th className="py-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Received</th>}
                           <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Unit Price</th>
                           <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Total</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-200">
                        {viewingPO.items.map((item, idx) => (
                           <tr key={idx}>
                              <td className="py-4">
                                 <p className="font-bold text-slate-900">{item.ingredientName}</p>
                                 {item.brand && <p className="text-xs text-slate-500">Brand: {item.brand}</p>}
                              </td>
                              <td className="py-4 text-right font-medium text-slate-700">{item.quantity} {item.unit}</td>
                              {viewingPO.status === 'received' && <td className="py-4 text-right font-bold text-emerald-600">{item.receivedQuantity} {item.unit}</td>}
                              <td className="py-4 text-right font-medium text-slate-700">₹{item.priceAtOrder}</td>
                              <td className="py-4 text-right font-bold text-slate-900">₹{item.quantity * (item.priceAtOrder || 0)}</td>
                           </tr>
                        ))}
                     </tbody>
                     <tfoot>
                        <tr className="border-t-2 border-slate-900">
                           <td colSpan={viewingPO.status === 'received' ? 4 : 3} className="py-6 text-right font-black text-slate-900 uppercase tracking-widest">Grand Total</td>
                           <td className="py-6 text-right font-black text-2xl text-slate-900">₹{viewingPO.totalCost?.toLocaleString()}</td>
                        </tr>
                     </tfoot>
                  </table>

                  <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200">
                     <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-2">Terms & Conditions</h4>
                        <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{poConfig.terms}</p>
                     </div>
                     <div className="text-right pt-16">
                        <div className="inline-block border-t border-slate-900 px-8 pt-2">
                           <p className="text-xs font-bold text-slate-900 uppercase">Authorized Signatory</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Physical Check / GRN Modal */}
      {verifyingPO && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] w-full max-w-4xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[90vh] flex flex-col">
               <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                  <div>
                     <h3 className="text-3xl font-black tracking-tight uppercase">Physical Verification</h3>
                     <p className="text-emerald-400 font-black text-[9px] uppercase tracking-widest mt-1">Goods Receipt Note (GRN) Generation</p>
                  </div>
                  <button onClick={() => setVerifyingPO(null)} className="p-4 bg-white/10 rounded-2xl hover:bg-rose-500 transition-all"><X size={24} /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex justify-between items-center">
                     <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</p>
                        <p className="font-black text-slate-900 text-lg">{verifyingPO.vendorName}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PO Ref</p>
                        <p className="font-black text-slate-900 text-lg">{verifyingPO.orderNumber}</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="grid grid-cols-12 gap-4 px-4 pb-2 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        <div className="col-span-4">Item Details</div>
                        <div className="col-span-2 text-center">Ordered</div>
                        <div className="col-span-2 text-center">Received</div>
                        <div className="col-span-2 text-center">Quality Check</div>
                        <div className="col-span-2 text-right">Status</div>
                     </div>
                     
                     {verifyingPO.items.map((item, idx) => {
                        const audit = auditData[item.ingredientName] || { receivedQty: 0, qualityPassed: false, notes: '' };
                        const discrepancy = audit.receivedQty - item.quantity;
                        const hasDiscrepancy = discrepancy !== 0;
                        const isQualityFail = !audit.qualityPassed;

                        return (
                           <div key={idx} className={`grid grid-cols-12 gap-4 items-center p-4 rounded-2xl border-2 transition-all ${
                              isQualityFail ? 'bg-rose-50 border-rose-100' : hasDiscrepancy ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'
                           }`}>
                              <div className="col-span-4">
                                 <p className="font-bold text-slate-900">{item.ingredientName}</p>
                                 <p className="text-xs text-slate-500">{item.brand || 'No Brand'}</p>
                              </div>
                              <div className="col-span-2 text-center font-bold text-slate-500">
                                 {item.quantity} {item.unit}
                              </div>
                              <div className="col-span-2">
                                 <input 
                                   type="number" 
                                   value={audit.receivedQty} 
                                   onChange={(e) => updateAuditItem(item.ingredientName, 'receivedQty', parseFloat(e.target.value) || 0)}
                                   className={`w-full px-3 py-2 rounded-lg font-bold text-center outline-none border-2 focus:ring-2 ${
                                      hasDiscrepancy ? 'bg-white border-amber-200 focus:border-amber-500' : 'bg-slate-50 border-transparent focus:border-emerald-500'
                                   }`}
                                 />
                              </div>
                              <div className="col-span-2 flex justify-center">
                                 <button 
                                    onClick={() => updateAuditItem(item.ingredientName, 'qualityPassed', !audit.qualityPassed)}
                                    className={`p-2 rounded-xl border-2 transition-all ${
                                       audit.qualityPassed 
                                       ? 'bg-emerald-500 text-white border-emerald-500' 
                                       : 'bg-white text-rose-500 border-rose-200 hover:border-rose-500'
                                    }`}
                                 >
                                    {audit.qualityPassed ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
                                 </button>
                              </div>
                              <div className="col-span-2 text-right">
                                 {isQualityFail ? (
                                    <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-100 px-2 py-1 rounded-md">Rejected</span>
                                 ) : hasDiscrepancy ? (
                                    <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-100 px-2 py-1 rounded-md">
                                       {discrepancy > 0 ? `+${discrepancy}` : discrepancy} {item.unit}
                                    </span>
                                 ) : (
                                    <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">Matched</span>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Audit Remarks</label>
                     <textarea 
                       value={verificationRemarks}
                       onChange={(e) => setVerificationRemarks(e.target.value)}
                       className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner h-24 resize-none"
                       placeholder="Note any damages, shortages, or quality issues..."
                     />
                  </div>
               </div>
               
               <div className="p-8 bg-slate-50 border-t border-slate-200 shrink-0">
                  <button 
                    onClick={commitGRN} 
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                     {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} 
                     {isSubmitting ? 'Syncing Inventory...' : 'Generate GRN & Update Inventory'}
                  </button>
               </div>
            </div>
         </div>
      )}

      {activeTab === 'PENDING' && (
         <div className="space-y-6 no-print">
            {purchaseOrders.filter(po => po.status === 'pending').map(po => (
               <div key={po.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-6">
                     <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><Truck size={28} /></div>
                     <div>
                        <h4 className="text-xl font-black text-slate-900">{po.vendorName}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">PO: {po.orderNumber} • {new Date(po.createdAt).toLocaleDateString()}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <button onClick={() => downloadPDF(po)} className="p-4 bg-slate-50 text-slate-500 rounded-2xl hover:text-slate-900 hover:bg-slate-200 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <Printer size={16} /> Print
                     </button>
                     <button onClick={() => startPhysicalAudit(po)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg flex items-center gap-2">
                        <ClipboardCheck size={16} /> Verify Receipt
                     </button>
                  </div>
               </div>
            ))}
            {purchaseOrders.filter(po => po.status === 'pending').length === 0 && (
               <div className="py-20 text-center">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No pending orders. Check shortages.</p>
               </div>
            )}
         </div>
      )}

      {activeTab === 'COMPLETED' && (
         <div className="space-y-6 no-print">
            {purchaseOrders.filter(po => po.status === 'received').map(po => (
               <div key={po.id} className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 opacity-80 hover:opacity-100 transition-all">
                  <div className="flex items-center gap-6">
                     <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center"><CheckCircle size={28} /></div>
                     <div>
                        <h4 className="text-xl font-black text-slate-900">{po.vendorName}</h4>
                        <div className="flex flex-col gap-1 mt-1">
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Completed: {new Date(po.receivedAt || 0).toLocaleDateString()}</p>
                           {po.grnNumber && <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{po.grnNumber}</p>}
                        </div>
                     </div>
                  </div>
                  <button onClick={() => downloadPDF(po)} className="text-slate-400 hover:text-slate-900 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                     <FileText size={16} /> View Record
                  </button>
               </div>
            ))}
         </div>
      )}
    </div>
  );
};
