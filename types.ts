
import React from 'react';

export enum PageId {
  DASHBOARD = 'dashboard',
  PRODUCTION = 'production',
  RECIPES = 'recipes',
  PENDING_RECIPES = 'pending_recipes',
  INVENTORY = 'inventory',
  PROCUREMENT = 'procurement',
  VENDORS = 'vendors',
  REPORTS = 'reports',
  USERS = 'users',
  PO_SETTINGS = 'po_settings'
}

export type UserRole = 'owner' | 'staff';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  createdAt: number;
}

export interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  ownerOnly?: boolean; 
}

export interface POTemplateConfig {
  companyName: string;
  address: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  logoUrl?: string;
  terms: string;
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
  brand?: string; // New field for brand tracking
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number; 
  expiryDate?: string;   
  lastRestocked: string;
  status: 'healthy' | 'low' | 'out';
  supplier: string;
  reserved?: number;
  lastPrice?: number;
}

export interface Ingredient {
  name: string;
  brand?: string; // New field for recipe-specific brand requirements
  amount: number;
  unit: string;
  inventoryItemId?: string;
  conversionFactor?: number; 
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  outputUnit: 'kg' | 'L';
  ingredients: Ingredient[];
  instructions: string[];
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
  brand?: string; // Brand tracking for requests
  requiredQty: number;
  currentStock: number;
  shortageQty: number;
  unit: string;
  requiredByDate: string;
  status: 'pending' | 'ordered' | 'received';
  createdAt: number;
  isManual?: boolean;
}

export interface VendorPricePoint {
  itemName: string;
  brand?: string; // Price points tied to specific brands
  price: number;
  unit: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  categories: string[];
  rating: number;
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
  };
  suppliedItems: string[];
  priceLedger?: VendorPricePoint[];
}

export interface POItem {
  ingredientName: string;
  brand?: string;
  quantity: number;
  unit: string;
  priceAtOrder?: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  items: POItem[];
  expectedDeliveryDate: string;
  status: 'draft' | 'pending' | 'received' | 'partially_received'; 
  createdAt: number;
  totalCost?: number;
  receivedAt?: number;
  remarks?: string;
}
