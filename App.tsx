
import React, { useState, useEffect } from 'react';
import { PageId, UserProfile, UserRole } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { PlaceholderPage } from './components/PlaceholderPage';
import { ProductionPlanning } from './components/ProductionPlanning';
import { InventoryManagement } from './components/InventoryManagement';
import { RecipeManagement } from './components/RecipeManagement';
import { PendingRecipes } from './components/PendingRecipes';
import { ProcurementManagement } from './components/ProcurementManagement';
import { Forecasting } from './components/Forecasting';
import { VendorManagement } from './components/VendorManagement';
import { POTemplateSettings } from './components/POTemplateSettings';
import { UserManagement } from './components/UserManagement';
import { Login } from './components/Login';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import { Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activePage, setActivePage] = useState<PageId>(PageId.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            const ownersQuery = query(collection(db, 'users'), where('role', '==', 'owner'));
            const ownersSnapshot = await getDocs(ownersQuery);
            const ownerCount = ownersSnapshot.size;

            let assignedRole: UserRole = 'staff';
            if (currentUser.email === 'jayanthpasala10@gmail.com' || ownerCount === 0) {
              assignedRole = 'owner';
            }

            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              role: assignedRole,
              displayName: currentUser.displayName || '',
              createdAt: Date.now()
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          } else {
            const data = userDoc.data() as UserProfile;
            setProfile(data);
            
            const unsubProfile = onSnapshot(userDocRef, (doc) => {
              if (doc.exists()) {
                setProfile(doc.data() as UserProfile);
              }
            }, (error) => {
              console.warn("Firestore listener restricted:", error.message);
            });
            return () => unsubProfile();
          }
        } catch (e) {
          console.error("Firebase Permission or Network Error:", e);
          setPermissionError(true);
          // Fallback Profile: Allow jayanthpasala10@gmail.com to be owner even if DB is restricted
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email || '',
            role: currentUser.email === 'jayanthpasala10@gmail.com' ? 'owner' : 'staff',
            displayName: currentUser.displayName || '',
            createdAt: Date.now()
          });
        }
      } else {
        setProfile(null);
        setPermissionError(false);
      }
      setAuthLoading(false);
    });

    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarCollapsed(true);
      else setIsSidebarCollapsed(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      unsubscribeAuth();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const renderContent = () => {
    if (activePage === PageId.USERS && profile?.role !== 'owner') {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm animate-in fade-in duration-500">
           <div className="bg-rose-50 p-6 rounded-full text-rose-500 mb-6 border border-rose-100">
              <ShieldAlert size={48} />
           </div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
           <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-widest">Ownership Privileges Required to Manage Users</p>
           <button 
             onClick={() => setActivePage(PageId.DASHBOARD)} 
             className="mt-10 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl"
           >
             Return to Dashboard
           </button>
        </div>
      );
    }

    switch (activePage) {
      case PageId.DASHBOARD: return <Dashboard />;
      case PageId.PRODUCTION: return <ProductionPlanning />;
      case PageId.RECIPES: return <RecipeManagement />;
      case PageId.PENDING_RECIPES: return <PendingRecipes />;
      case PageId.INVENTORY: return <InventoryManagement />;
      case PageId.PROCUREMENT: return <ProcurementManagement />;
      case PageId.VENDORS: return <VendorManagement />;
      case PageId.REPORTS: return <Forecasting />;
      case PageId.PO_SETTINGS: return <POTemplateSettings />;
      case PageId.USERS: return <UserManagement />;
      default: return <Dashboard />;
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center space-y-6">
        <Loader2 className="text-emerald-500 animate-spin" size={64} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Initializing KMS Kitchen Management System</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 font-['Inter']">
      <Sidebar 
        activePage={activePage} 
        setActivePage={(page) => { setActivePage(page); closeMobileMenu(); }} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        userRole={profile?.role || 'staff'}
      />
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={closeMobileMenu} />
      )}
      
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Header activePage={activePage} isSidebarCollapsed={isSidebarCollapsed} onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 mt-16 p-4 md:p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {permissionError && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4">
                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest leading-relaxed">
                  Database Link Limited: Please ensure Firebase Firestore Rules are set to 'allow read, write: if request.auth != null;'. Using local fallback profile.
                </p>
              </div>
            )}
            {renderContent()}
          </div>
        </main>
        <footer className="py-6 px-4 md:px-10 text-center text-[10px] font-black text-slate-400 border-t bg-white uppercase tracking-widest">
          &copy; {new Date().getFullYear()} KMS Kitchen Management System • {profile?.role?.toUpperCase()} ACCESS • {user.email}
        </footer>
      </div>
    </div>
  );
};

export default App;
