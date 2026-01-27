
import React from 'react';
import { ChevronLeft, ChevronRight, ChefHat } from 'lucide-react';
import { NAV_ITEMS } from '../constants';
import { PageId } from '../types';

interface SidebarProps {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activePage, 
  setActivePage, 
  isCollapsed, 
  setIsCollapsed 
}) => {
  return (
    <div 
      className={`bg-slate-900 text-slate-300 h-screen transition-all duration-300 ease-in-out flex flex-col fixed left-0 top-0 z-50 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <ChefHat className="text-emerald-400 shrink-0" size={28} />
        {!isCollapsed && (
          <span className="ml-3 font-bold text-xl text-white tracking-tight">CulinaOps</span>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`w-full flex items-center px-3 py-3 rounded-lg transition-colors group relative ${
              activePage === item.id 
                ? 'bg-emerald-600 text-white' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="shrink-0">{item.icon}</div>
            {!isCollapsed && (
              <span className="ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300">
                {item.label}
              </span>
            )}
            {isCollapsed && (
              <div className="absolute left-16 bg-slate-800 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="p-4 hover:bg-slate-800 border-t border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
      >
        {isCollapsed ? <ChevronRight size={20} /> : <div className="flex items-center space-x-2"><ChevronLeft size={20} /><span>Collapse Sidebar</span></div>}
      </button>
    </div>
  );
};
