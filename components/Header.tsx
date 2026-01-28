
import React from 'react';
import { Search, Bell, UserCircle, Menu, LogOut } from 'lucide-react';
import { NAV_ITEMS } from '../constants';
import { PageId } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface HeaderProps {
  activePage: PageId;
  isSidebarCollapsed: boolean;
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activePage, isSidebarCollapsed, onMenuClick }) => {
  const currentPage = NAV_ITEMS.find(item => item.id === activePage);
  const user = auth.currentUser || (localStorage.getItem('kms_demo_mode') === 'true' ? { displayName: 'Demo Chef', email: 'demo@local' } : null);

  const handleLogout = async () => {
      if (localStorage.getItem('kms_demo_mode') === 'true') {
          localStorage.removeItem('kms_demo_mode');
          window.location.reload();
      } else {
          await signOut(auth);
      }
  };

  return (
    <header 
      className={`h-16 bg-white border-b border-slate-200 fixed top-0 right-0 z-40 transition-all duration-300 flex items-center justify-between px-4 md:px-6 ${
        isSidebarCollapsed ? 'lg:left-20' : 'lg:left-64'
      } left-0`}
    >
      <div className="flex items-center space-x-3 md:space-x-4">
        {/* Hamburger Menu Toggle (Mobile Only) */}
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap">{currentPage?.label}</h1>
      </div>

      <div className="flex items-center space-x-2 md:space-x-6">
        {/* Search Bar - Hidden on small mobile */}
        <div className="hidden sm:flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-1.5 w-40 md:w-64 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
          <Search size={16} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search master records..." 
            className="bg-transparent border-none focus:outline-none focus:ring-0 ml-2 text-sm text-slate-600 w-full"
          />
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          <button className="p-2 text-slate-400 hover:text-emerald-600 transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 bg-rose-500 w-2 h-2 rounded-full border-2 border-white"></span>
          </button>
          
          <div className="flex items-center space-x-3 pl-2 md:pl-4 border-l border-slate-200">
            <div className="text-right hidden lg:block">
              <p className="text-sm font-bold text-slate-900 leading-none">{user?.displayName || user?.email?.split('@')[0] || 'Chef User'}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">Authorized Staff</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
              title="End Session"
            >
              <LogOut size={20} />
            </button>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm ring-2 ring-slate-50">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'Ajay'}`} 
                alt="User Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
