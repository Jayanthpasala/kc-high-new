
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Truck, Clock, AlertTriangle, CheckCircle, Package, ArrowRight, Plus, X, Search, FileText } from 'lucide-react';
import { PendingProcurement, PurchaseOrder, InventoryItem } from '../types';

export const ProcurementManagement: React.FC = () => {
  const [procurements, setProcurements] = useState<PendingProcurement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'SHORTAGES' | 'ORDERS'>('SHORTAGES');

  useEffect(() => {
    const load = () => {
      setProcurements(JSON.parse(localStorage.getItem('pendingProcurements') || '[]'));
      setPurchaseOrders(JSON.parse(localStorage.getItem('purchaseOrders') || '[]'));
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const handleCreatePO = (procurement: PendingProcurement) => {
    const newPO: PurchaseOrder = {
      id: `PO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      vendorId: 'auto-select',
      items: [{ ingredientName: procurement.ingredientName, quantity: procurement.shortageQty, unit: procurement.unit }],
      expectedDeliveryDate: procurement.requiredByDate,
      status: 'draft',
      createdAt: Date.now()
    };
    
    const updatedPOs = [newPO, ...purchaseOrders];
    localStorage.setItem('purchaseOrders', JSON.stringify(updatedPOs));
    
    // Update procurement status
    const updatedProc = procurements.map(p => p.id === procurement.id ? { ...p, status: 'ordered' as any } : p);
    localStorage.setItem('pendingProcurements', JSON.stringify(updatedProc));
    
    window.dispatchEvent(new Event('storage'));
    setActiveTab('ORDERS');
  };

  const markReceived = (po: PurchaseOrder) => {
    const inventory: InventoryItem[] = JSON.parse(localStorage.getItem('inventory') || '[]');
    let updatedInventory = [...inventory];

    po.items.forEach(item => {
      const idx = updatedInventory.findIndex(i => i.name.toLowerCase() === item.ingredientName.toLowerCase());
      if (idx > -1) {
        updatedInventory[idx].quantity += item.quantity;
        // Update status
        const it = updatedInventory[idx];
        if (it.quantity > it.parLevel) it.status = 'healthy';
      }
    });

    const updatedPOs = purchaseOrders.map(p => p.id === po.id ? { ...p, status: 'received' as any } : p);
    localStorage.setItem('inventory', JSON.stringify(updatedInventory));
    localStorage.setItem('purchaseOrders', JSON.stringify(updatedPOs));
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Truck className="text-emerald-500" size={32} /> Purchasing & Logistics</h2>
          <p className="text-slate-500 font-medium">Automated shortages, vendor linking, and receiving.</p>
        </div>
        <div className="bg-white p-1 rounded-2xl border flex gap-1">
          <button onClick={() => setActiveTab('SHORTAGES')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'SHORTAGES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}>Shortages</button>
          <button onClick={() => setActiveTab('ORDERS')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ORDERS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}>Purchase Orders</button>
        </div>
      </div>

      {activeTab === 'SHORTAGES' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {procurements.filter(p => p.status === 'pending').map(p => (
            <div key={p.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center"><AlertTriangle size={28} /></div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Required By</p>
                   <p className="font-bold text-slate-900">{p.requiredByDate}</p>
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">{p.ingredientName}</h3>
              <div className="space-y-2 mb-8">
                 <div className="flex justify-between text-sm font-bold"><span className="text-slate-400">Total Required:</span><span>{p.requiredQty} {p.unit}</span></div>
                 <div className="flex justify-between text-sm font-bold"><span className="text-slate-400">Current Stock:</span><span>{p.currentStock} {p.unit}</span></div>
                 <div className="flex justify-between text-sm font-bold pt-2 border-t text-rose-600"><span className="uppercase text-[10px] font-black tracking-widest">Calculated Shortage:</span><span className="text-lg font-black">{p.shortageQty} {p.unit}</span></div>
              </div>
              <button onClick={() => handleCreatePO(p)} className="mt-auto w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                <Plus size={16} /> Generate Purchase Order
              </button>
            </div>
          ))}
          {procurements.filter(p => p.status === 'pending').length === 0 && (
             <div className="col-span-full py-32 text-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-white">
                <div className="bg-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-xl"><CheckCircle size={40} /></div>
                <h4 className="text-2xl font-black text-slate-900">Inventory Satiated</h4>
                <p className="text-slate-500 font-bold mt-2">All future production plans are fully stocked.</p>
             </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map(po => (
            <div key={po.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 flex items-center justify-between group hover:border-emerald-500 transition-all">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black">{po.id}</div>
                  <div>
                    <h4 className="font-black text-xl text-slate-900">{po.items[0].ingredientName} <span className="text-slate-300 font-medium">({po.items[0].quantity} {po.items[0].unit})</span></h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Status: {po.status} • Ordered: {new Date(po.createdAt).toLocaleDateString()}</p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  {po.status === 'draft' && <button onClick={() => {
                     const updated = purchaseOrders.map(p => p.id === po.id ? {...p, status: 'ordered' as any} : p);
                     localStorage.setItem('purchaseOrders', JSON.stringify(updated));
                     window.dispatchEvent(new Event('storage'));
                  }} className="px-8 py-3 bg-emerald-500 text-slate-900 font-black rounded-xl text-[10px] uppercase tracking-widest">Send to Vendor</button>}
                  
                  {po.status === 'ordered' && <button onClick={() => markReceived(po)} className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-600">Mark as Received</button>}
                  
                  {po.status === 'received' && <div className="flex items-center gap-2 text-emerald-500 font-black uppercase text-[10px] tracking-widest"><CheckCircle size={16} /> Fully Stocked</div>}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
