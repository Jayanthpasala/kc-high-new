
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
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const getPageFromHash = (): PageId => {
    const hash = window.location.hash.replace("#", "");
    return Object.values(PageId).includes(hash as PageId)
      ? (hash as PageId)
      : PageId.DASHBOARD;
  };

  const [activePage, setActivePage] = useState<PageId>(getPageFromHash());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setAuthLoading(false), 5000);

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(timeout);
      setUser(currentUser);

      if (currentUser) {
        try {
          const ref = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(ref);

          if (!snap.exists()) {
            const fallback: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              role: currentUser.email === 'jayanthpasala10@gmail.com' ? 'owner' : 'staff',
              displayName: currentUser.displayName || '',
              createdAt: Date.now()
            };
            await setDoc(ref, fallback);
            setProfile(fallback);
          } else {
            setProfile(snap.data() as UserProfile);
          }
        } catch {
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email || '',
            role: 'staff',
            displayName: currentUser.displayName || '',
            createdAt: Date.now()
          });
        }
      } else {
        setProfile(null);
      }

      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    window.location.hash = activePage;
  }, [activePage]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  if (!user) return <Login />;

  const renderContent = () => {
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

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <Header activePage={activePage} isSidebarCollapsed={isSidebarCollapsed} onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 mt-16 px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto">
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default App;
