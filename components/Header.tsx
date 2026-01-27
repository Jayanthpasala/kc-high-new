
import React from 'react';
import { Search, Bell, UserCircle, Menu } from 'lucide-react';
import { NAV_ITEMS } from '../constants';
import { PageId } from '../types';

interface HeaderProps {
  activePage: PageId;
  isSidebarCollapsed: boolean;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activePage, isSidebarCollapsed }) => {
  const currentPage = NAV_ITEMS.find(item => item.id === activePage);

  return (
    <header 
      className={`h-16 bg-white border-b border-slate-200 fixed top-0 right-0 z-40 transition-all duration-300 flex items-center justify-between px-6 ${
        isSidebarCollapsed ? 'left-20' : 'left-64'
      }`}
    >
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold text-slate-800">{currentPage?.label}</h1>
      </div>

      <div className="flex items-center space-x-6">
        <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-1.5 w-64">
          <Search size={16} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search operations..." 
            className="bg-transparent border-none focus:outline-none focus:ring-0 ml-2 text-sm text-slate-600 w-full"
          />
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="text-slate-400 hover:text-emerald-600 transition-colors relative">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full border-2 border-white"></span>
          </button>
          
          <div className="flex items-center space-x-3 pl-4 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">Chef Ramsay</p>
              <p className="text-xs text-slate-400 mt-1">Kitchen Manager</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300">
              <img 
                src="https://picsum.photos/seed/chef/100/100" 
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
