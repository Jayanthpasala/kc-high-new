
import React from 'react';

export enum PageId {
  DASHBOARD = 'dashboard',
  PRODUCTION = 'production',
  RECIPES = 'recipes',
  PENDING_RECIPES = 'pending_recipes',
  INVENTORY = 'inventory',
  VENDORS = 'vendors',
  REPORTS = 'reports',
  USERS = 'users'
}

export interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
}

export type PlanType = 'production' | 'holiday' | 'event';

export interface Meal {
  mealType: string;
  dishes: string[];
}

export interface ProductionPlan {
  id: string;
  date: string; // YYYY-MM-DD
  meals: Meal[];
  isApproved: boolean;
  createdAt: number;
  updatedAt?: number;
  type?: PlanType;
  eventName?: string;
  isConsumed?: boolean;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  parLevel: number;
  lastRestocked: string;
  status: 'healthy' | 'low' | 'out';
  supplier: string;
  reserved?: number; // New field for reserved stock
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  prepTime: number; // minutes
  cookTime: number; // minutes
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  image?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface InventoryReservation {
  id: string;
  planId: string;
  date: string;
  ingredientName: string;
  quantity: number;
  unit: string;
}

export interface PendingProcurement {
  id: string;
  ingredientName: string;
  requiredQty: number;
  currentStock: number;
  shortageQty: number;
  unit: string;
  requiredByDate: string;
  status: 'pending' | 'ordered' | 'received';
  createdAt: number;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  categories: string[];
  rating: number;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  items: { ingredientName: string; quantity: number; unit: string }[];
  expectedDeliveryDate: string;
  status: 'draft' | 'ordered' | 'received';
  createdAt: number;
}
