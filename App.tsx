
import React, { useState, useEffect } from 'react';
import { PageId } from './types';
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

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageId>(PageId.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarCollapsed(true);
      else setIsSidebarCollapsed(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderContent = () => {
    switch (activePage) {
      case PageId.DASHBOARD: return <Dashboard />;
      case PageId.PRODUCTION: return <ProductionPlanning />;
      case PageId.RECIPES: return <RecipeManagement />;
      case PageId.PENDING_RECIPES: return <PendingRecipes />;
      case PageId.INVENTORY: return <InventoryManagement />;
      case PageId.VENDORS: return <ProcurementManagement />;
      case PageId.REPORTS: return <Forecasting />;
      case PageId.USERS:
        return (
          <PlaceholderPage 
            title="User Management" 
            description="Manage staff accounts, assign permissions, and track operational access logs." 
          />
        );
      default: return <Dashboard />;
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen flex bg-slate-50 font-['Inter']">
      <Sidebar 
        activePage={activePage} 
        setActivePage={(page) => { setActivePage(page); closeMobileMenu(); }} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={closeMobileMenu} />
      )}
      
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Header activePage={activePage} isSidebarCollapsed={isSidebarCollapsed} onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 mt-16 p-4 md:p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">{renderContent()}</div>
        </main>
        <footer className="py-6 px-4 md:px-10 text-center text-[10px] font-black text-slate-400 border-t bg-white uppercase tracking-widest">&copy; {new Date().getFullYear()} CulinaOps ERP • Production-Ready Kitchen Systems</footer>
      </div>
    </div>
  );
};

export default App;
