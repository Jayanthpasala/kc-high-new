
import React, { useState, useEffect } from 'react';
import { PageId } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { PlaceholderPage } from './components/PlaceholderPage';
import { ProductionPlanning } from './components/ProductionPlanning';
import { InventoryManagement } from './components/InventoryManagement';
import { RecipeManagement } from './components/RecipeManagement';
import { PendingRecipes } from './components/PendingRecipes';
import { ProcurementManagement } from './components/ProcurementManagement';
import { Forecasting } from './components/Forecasting';

const App: React.FC = () => {
  const [