
import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  BookOpen, 
  Package, 
  Truck, 
  BarChart3, 
  Users,
  ChefHat,
  AlertTriangle,
  History
} from 'lucide-react';
import { PageId, NavItem } from './types';

export const NAV_ITEMS: NavItem[] = [
  { id: PageId.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: PageId.PRODUCTION, label: 'Production Planning', icon: <CalendarRange size={20} /> },
  { id: PageId.RECIPES, label: 'Recipes', icon: <BookOpen size={20} /> },
  { id: PageId.INVENTORY, label: 'Inventory', icon: <Package size={20} /> },
  { id: PageId.VENDORS, label: 'Vendors', icon: <Truck size={20} /> },
  { id: PageId.REPORTS, label: 'Reports', icon: <BarChart3 size={20} /> },
  { id: PageId.USERS, label: 'User Management', icon: <Users size={20} /> },
];

export const DASHBOARD_CARDS = [
  {
    title: "Today's Production Plan",
    description: "Plan and track daily meal prep sessions.",
    icon: <ChefHat className="text-emerald-500" size={24} />,
    emptyMessage: "No production sessions scheduled for today."
  },
  {
    title: "Low Stock Alerts",
    description: "Items requiring immediate reordering.",
    icon: <AlertTriangle className="text-amber-500" size={24} />,
    emptyMessage: "All inventory levels are currently healthy."
  },
  {
    title: "Recent Activity",
    description: "Latest logs from kitchen staff operations.",
    icon: <History className="text-blue-500" size={24} />,
    emptyMessage: "No recent system activities to display."
  }
];
