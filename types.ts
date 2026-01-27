
import React from 'react';

export enum PageId {
  DASHBOARD = 'dashboard',
  PRODUCTION = 'production',
  RECIPES = 'recipes',
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
  // Fix: Adding optional updatedAt field to resolve assignment errors in ProductionPlanning.tsx
  updatedAt?: number;
}
