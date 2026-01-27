
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
      className={`bg-slate-900 text-slate-300 h-screen transition-all duration-300 ease-in-out flex flex-col fixed left-0 top-0 z-50 
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
        <div className="flex items-center">
          <ChefHat className="text-emerald-400 shrink-0" size={28} />
          {(!isCollapsed || isMobileOpen) && (
            <span className="ml-3 font-bold text-xl text-white tracking-tight">CulinaOps</span>
          )}
        </div>
        {/* Mobile Close Button */}
        {isMobileOpen && (
          <button 
            onClick={() => setIsMobileOpen?.(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center px-3 py-3 rounded-xl transition-all group relative mb-1 ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`}
            >
              <div className="shrink-0 transition-transform group-hover:scale-110">
                {item.icon}
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <span className="ml-3 font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 text-sm tracking-wide">
                  {item.label}
                </span>
              )}
              {/* Tooltip for collapsed desktop view */}
              {isCollapsed && !isMobileOpen && (
                <div className="absolute left-16 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 pointer-events-none transition-all transform translate-x-[-10px] group-hover:translate-x-0 shadow-xl whitespace-nowrap z-50 border border-slate-700">
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
        className="hidden lg:flex p-4 hover:bg-slate-800 border-t border-slate-800 items-center justify-center text-slate-400 hover:text-white transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight size={20} />
        ) : (
          <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-widest">
            <ChevronLeft size={16} />
            <span>Collapse</span>
          </div>
        )}
      </button>
    </div>
  );
};
