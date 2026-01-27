
import React from 'react';
import { ChevronLeft, ChevronRight, ChefHat, X } from 'lucide-react';
import { NAV_ITEMS } from '../constants';
import { PageId } from '../types';

interface SidebarProps {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activePage, 
  setActivePage, 
  isCollapsed, 
  setIsCollapsed,
  isMobileOpen = false,
  setIsMobileOpen
}) => {
  return (
    <div 
      className={`bg-[#0f172a] text-slate-400 h-screen transition-all duration-500 ease-in-out flex flex-col fixed left-0 top-0 z-50 shadow-2xl
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/50">
        <div className="flex items-center">
          <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
            <ChefHat className="text-emerald-400 shrink-0" size={24} />
          </div>
          {(!isCollapsed || isMobileOpen) && (
            <span className="ml-3 font-bold text-lg text-white tracking-tight">Culina<span className="text-emerald-400">Ops</span></span>
          )}
        </div>
        {isMobileOpen && (
          <button 
            onClick={() => setIsMobileOpen?.(false)}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-300 group relative ${
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                  : 'hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <div className={`shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {item.icon}
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <span className={`ml-3 font-medium text-sm tracking-tight ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {item.label}
                </span>
              )}
              {isCollapsed && !isMobileOpen && (
                <div className="absolute left-16 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-semibold opacity-0 group-hover:opacity-100 pointer-events-none transition-all transform translate-x-[-10px] group-hover:translate-x-0 shadow-2xl whitespace-nowrap z-50 border border-slate-700">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop Collapse Toggle */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="hidden lg:flex p-4 hover:bg-slate-800/50 border-t border-slate-800/50 items-center justify-center text-slate-500 hover:text-emerald-400 transition-all duration-300"
      >
        {isCollapsed ? (
          <ChevronRight size={18} />
        ) : (
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100">
            <ChevronLeft size={14} />
            <span>Collapse View</span>
          </div>
        )}
      </button>
    </div>
  );
};
