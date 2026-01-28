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
import { BrandManagement } from './components/BrandManagement';
import { Login } from './components/Login';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import { Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 🔥 NEW: Read page from URL hash on load
  const getPageFromHash = (): PageId => {
    const hash = window.location.hash.replace("#", "");
    return Object.values(PageId).includes(hash as PageId)
      ? (hash as PageId)
      : PageId.DASHBOARD;
  };

  const [activePage, setActivePage] = useState<PageId>(getPageFromHash());

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (authLoading) setAuthLoading(false);
    }, 6000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(safetyTimeout);
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
              if (doc.exists()) setProfile(doc.data() as UserProfile);
            });
            return () => unsubProfile();
          }
        } catch {
          setPermissionError(true);
        }
      } else {
        setProfile(null);
        setPermissionError(false);
      }
      setAuthLoading(false);
    });

    const handleResize = () => {
      setIsSidebarCollapsed(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      unsubscribeAuth();
      window.removeEventListener('resize', handleResize);
      clearTimeout(safetyTimeout);
    };
  }, []);

  // 🔥 NEW: Update URL hash when page changes
  useEffect(() => {
    window.location.hash = activePage;
  }, [activePage]);

  const renderContent = () => {
    if (activePage === PageId.USERS && profile?.role !== 'owner') {
      return <PlaceholderPage title="Access Restricted" />;
    }

    switch (activePage) {
      case PageId.DASHBOARD: return <Dashboard onNavigate={setActivePage} />;
      case PageId.PRODUCTION: return <ProductionPlanning />;
      case PageId.RECIPES: return <RecipeManagement />;
      case PageId.PENDING_RECIPES: return <PendingRecipes />;
      case PageId.INVENTORY: return <InventoryManagement />;
      case PageId.PROCUREMENT: return <ProcurementManagement />;
      case PageId.BRANDS: return <BrandManagement />;
      case PageId.VENDORS: return <VendorManagement />;
      case PageId.REPORTS: return <Forecasting />;
      case PageId.PO_SETTINGS: return <POTemplateSettings />;
      case PageId.USERS: return <UserManagement />;
      default: return <Dashboard onNavigate={setActivePage} />;
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!user) return <Login />;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar 
        activePage={activePage} 
        setActivePage={(page) => { setActivePage(page); setIsMobileMenuOpen(false); }} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        userRole={profile?.role || 'staff'}
      />

      <div className="flex-1 flex flex-col">
        <Header activePage={activePage} isSidebarCollapsed={isSidebarCollapsed} onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 mt-16 p-6">
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default App;
