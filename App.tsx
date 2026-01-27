
import React, { useState } from 'react';
import { PageId } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { PlaceholderPage } from './components/PlaceholderPage';
import { ProductionPlanning } from './components/ProductionPlanning';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageId>(PageId.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const renderContent = () => {
    switch (activePage) {
      case PageId.DASHBOARD:
        return <Dashboard />;
      case PageId.PRODUCTION:
        return <ProductionPlanning />;
      case PageId.RECIPES:
        return (
          <PlaceholderPage 
            title="Recipe Management" 
            description="Create and manage recipes with ingredients, quantities, nutritional data, and allergy warnings." 
          />
        );
      case PageId.INVENTORY:
        return (
          <PlaceholderPage 
            title="Inventory Management" 
            description="Track stock levels of raw materials and ingredients. Set par levels and automated alerts." 
          />
        );
      case PageId.VENDORS:
        return (
          <PlaceholderPage 
            title="Vendor Management" 
            description="Manage suppliers and ingredient sourcing. Track delivery performance and pricing history." 
          />
        );
      case PageId.REPORTS:
        return (
          <PlaceholderPage 
            title="Reports & Analytics" 
            description="View production, consumption, and inventory reports. Analyze costs and wastage trends." 
          />
        );
      case PageId.USERS:
        return (
          <PlaceholderPage 
            title="User Management" 
            description="Manage staff accounts, assign permissions, and track operational access logs." 
          />
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-64'
        }`}
      >
        <Header 
          activePage={activePage} 
          isSidebarCollapsed={isSidebarCollapsed}
        />
        
        <main className="flex-1 mt-16 p-6 lg:p-10 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
        
        <footer className="py-4 px-10 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
          &copy; {new Date().getFullYear()} CulinaOps Kitchen Systems. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
};

export default App;
