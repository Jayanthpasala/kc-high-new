import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, query, orderBy, setDoc, deleteDoc } from 'firebase/firestore';
import * as firebaseApp from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { UserProfile, UserRole } from '../types';
import { Users, ShieldCheck, UserCog, Mail, Calendar, Search, Loader2, AlertCircle, Trash2, PlusCircle, X, Key, ShieldPlus } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  
  // Provisioning Form State
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('staff');
  const [isProvisioning, setIsProvisioning] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const ownerCount = users.filter(u => u.role === 'owner').length;

  const handleToggleRole = async (targetUser: UserProfile) => {
    const newRole: UserRole = targetUser.role === 'owner' ? 'staff' : 'owner';
    
    if (targetUser.email === 'jayanthpasala10@gmail.com' && newRole === 'staff') {
      alert("System Integrity Alert: The primary owner account cannot be demoted to staff.");
      return;
    }

    if (newRole === 'owner' && ownerCount >= 4) {
      alert("Organizational Limit: Maximum of 4 Owner identities allowed per license.");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { role: newRole });
    } catch (err) {
      alert("Access Control Error: Failed to update user privileges.");
    }
  };

  const handleProvisionStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail || !newStaffPassword || !newStaffName) {
      alert("Data Integrity Error: All provisioning fields are required.");
      return;
    }

    if (newStaffRole === 'owner' && ownerCount >= 4) {
      alert("Organizational Limit reached. Cannot provision more Owners.");
      return;
    }

    setIsProvisioning(true);

    // Using a secondary app instance to create user without ending the current owner session
    const secondaryConfig = {
      apiKey: auth.app.options.apiKey,
      authDomain: auth.app.options.authDomain,
      projectId: auth.app.options.projectId,
      storageBucket: auth.app.options.storageBucket,
      messagingSenderId: auth.app.options.messagingSenderId,
      appId: auth.app.options.appId,
    };

    const secondaryAppName = `ProvisioningApp-${Date.now()}`;
    const secondaryApp = firebaseApp.initializeApp(secondaryConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStaffEmail, newStaffPassword);
      const uid = userCredential.user.uid;

      const newProfile: UserProfile = {
        uid,
        email: newStaffEmail,
        role: newStaffRole,
        displayName: newStaffName,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', uid), newProfile);
      
      // Cleanup the secondary session to prevent session leak
      await signOut(secondaryAuth);
      await firebaseApp.deleteApp(secondaryApp);

      alert(`Staff Provisioned: Credentials for ${newStaffName} active.`);
      setIsProvisionModalOpen(false);
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffName('');
      setNewStaffRole('staff');
    } catch (err: any) {
      alert(`Provisioning Error: ${err.message}`);
      // Ensure cleanup even on error
      try { await firebaseApp.deleteApp(secondaryApp); } catch {}
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.email === 'jayanthpasala10@gmail.com') {
      alert("Protection Error: Primary owner cannot be deleted.");
      return;
    }
    if (confirm(`Warning: Permanently revoke access and delete identity for ${user.displayName || user.email}?`)) {
      try {
        await deleteDoc(doc(db, 'users', user.uid));
        // Note: Actual Firebase Auth deletion requires Admin SDK or user sign-in.
        // For this app, deleting the profile effectively revokes app visibility/access.
      } catch (err) {
        alert("Action restricted. Check permissions.");
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <UserCog className="text-emerald-500" size={32} />
             Identity Management
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-widest">Global Access Control & Staff Privileges</p>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsProvisionModalOpen(true)}
             className="bg-emerald-500 text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 hover:text-white transition-all shadow-xl active:scale-95 group shadow-emerald-500/10"
           >
              <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              Provision Staff
           </button>
           <div className="hidden sm:flex bg-slate-900 px-6 py-3.5 rounded-2xl text-white items-center gap-4 shadow-xl">
              <div className="flex -space-x-3">
                {users.filter(u => u.role === 'owner').map((o, idx) => (
                    <div key={idx} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-emerald-500 flex items-center justify-center text-[10px] font-black uppercase shadow-sm">
                      {o.email[0]}
                    </div>
                ))}
              </div>
              <div>
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Owner Registry</p>
                  <p className="text-sm font-black mt-1 leading-none">{ownerCount} / 4</p>
              </div>
           </div>
        </div>
      </div>

      <div className="bg-white p-3 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by staff email or display name..." 
            className="w-full pl-16 pr-8 py-5 rounded-3xl bg-slate-50 border-none font-black text-slate-900 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border-2 border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center space-y-4">
             <Loader2 className="animate-spin text-emerald-500" size={40} />
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Identity Registry...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Identity</th>
                  <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined On</th>
                  <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorization Level</th>
                  <th className="px-10 py-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${user.role === 'owner' ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-400'}`}>
                            {user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-lg leading-none mb-1">{user.displayName || 'Unnamed Staff'}</p>
                            <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><Mail size={12} /> {user.email}</p>
                          </div>
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                          <Calendar size={14} />
                          {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-8 py-8">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${
                          user.role === 'owner' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                          {user.role === 'owner' ? <ShieldCheck size={14} /> : <Users size={14} />}
                          {user.role}
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex justify-end gap-2">
                          {user.email !== 'jayanthpasala10@gmail.com' && (
                            <>
                              <button 
                                onClick={() => handleToggleRole(user)}
                                className="bg-white border-2 border-slate-100 p-3 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-500 transition-all active:scale-90"
                                title={user.role === 'owner' ? "Demote to Staff" : "Promote to Owner"}
                              >
                                <UserCog size={18} />
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(user)}
                                className="bg-white border-2 border-slate-100 p-3 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-500 transition-all active:scale-90"
                                title="Revoke Access"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                          {user.email === 'jayanthpasala10@gmail.com' && (
                            <div className="p-3 text-emerald-500 font-black text-[9px] uppercase tracking-widest">Root Account</div>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provisioning Modal */}
      {isProvisionModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white rounded-[3.5rem] w-full max-w-xl mx-auto overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto">
              <div className="bg-slate-900 p-10 text-white relative sticky top-0 z-10">
                 <button 
                   onClick={() => setIsProvisionModalOpen(false)} 
                   className="absolute top-10 right-10 bg-white/10 p-4 rounded-2xl hover:bg-rose-500 transition-all"
                 >
                   <X size={20} />
                 </button>
                 <ShieldPlus size={40} className="text-emerald-400 mb-4" />
                 <h3 className="text-3xl font-black tracking-tight uppercase">Staff Provisioning</h3>
                 <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] mt-2">Identity Creation Protocol v4.0</p>
              </div>

              <form onSubmit={handleProvisionStaff} className="p-10 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                    <input 
                      type="text" 
                      required
                      value={newStaffName}
                      onChange={e => setNewStaffName(e.target.value)}
                      placeholder="Chef Name"
                      className="w-full px-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" 
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Email</label>
                    <div className="relative">
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="email" 
                        required
                        value={newStaffEmail}
                        onChange={e => setNewStaffEmail(e.target.value)}
                        placeholder="email@culinaops.com"
                        className="w-full pl-16 pr-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" 
                      />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Password</label>
                    <div className="relative">
                      <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="password" 
                        required
                        minLength={6}
                        value={newStaffPassword}
                        onChange={e => setNewStaffPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full pl-16 pr-6 py-4 rounded-xl bg-slate-50 border-2 border-transparent font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all shadow-inner" 
                      />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Authorization</label>
                    <div className="flex gap-4">
                       <button 
                         type="button" 
                         onClick={() => setNewStaffRole('staff')}
                         className={`flex-1 py-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${newStaffRole === 'staff' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-transparent'}`}
                       >
                         Staff
                       </button>
                       <button 
                         type="button" 
                         onClick={() => setNewStaffRole('owner')}
                         className={`flex-1 py-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${newStaffRole === 'owner' ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-50 text-slate-400 border-transparent'}`}
                       >
                         Owner
                       </button>
                    </div>
                 </div>

                 <button 
                   type="submit" 
                   disabled={isProvisioning}
                   className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                 >
                    {isProvisioning ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                    {isProvisioning ? 'Provisioning Identity...' : 'Initialize Staff Account'}
                 </button>
              </form>
           </div>
        </div>
      )}

      <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-dashed border-slate-200 flex items-start gap-4">
         <AlertCircle className="text-slate-400 shrink-0 mt-0.5" size={24} />
         <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Security Protocol Advisory</h4>
            <p className="text-slate-500 text-xs font-medium leading-relaxed mt-1">
               Owner accounts possess unrestricted access to financial settings, vendor registries, and identity management. 
               Provisioning new staff creates an active Firebase identity immediately. The primary owner account 'jayanthpasala10@gmail.com' is protected and cannot be modified.
            </p>
         </div>
      </div>
    </div>
  );
};