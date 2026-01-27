
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Filter, 
  Clock, 
  Users, 
  ChefHat, 
  Edit3, 
  Trash2, 
  X, 
  PlusCircle, 
  Save, 
  ArrowRight,
  Flame,
  ChevronDown
} from 'lucide-react';
import { Recipe, Ingredient } from '../types';

const SAMPLE_RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Classic Margherita Pizza',
    category: 'Main Course',
    prepTime: 20,
    cookTime: 10,
    servings: 2,
    difficulty: 'Medium',
    ingredients: [
      { name: 'Pizza Dough', amount: 250, unit: 'g' },
      { name: 'San Marzano Tomatoes', amount: 100, unit: 'g' },
      { name: 'Fresh Mozzarella', amount: 125, unit: 'g' },
      { name: 'Fresh Basil', amount: 5, unit: 'leaves' }
    ],
    instructions: [
      'Preheat oven to 500°F (260°C).',
      'Roll out dough on a floured surface.',
      'Spread tomato sauce and top with mozzarella.',
      'Bake for 8-10 minutes until crust is charred.'
    ],
    image: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&w=800&q=80'
  }
];

const INITIAL_FORM_STATE: Partial<Recipe> = {
  name: '',
  category: 'Main Course',
  prepTime: 0,
  cookTime: 0,
  servings: 1,
  difficulty: 'Medium',
  ingredients: [{ name: '', amount: 0, unit: 'kg' }],
  instructions: ['']
};

interface RecipeManagementProps {
  initialDishName?: string;
  onComplete?: (name: string) => void;
}

export const RecipeManagement: React.FC<RecipeManagementProps> = ({ initialDishName, onComplete }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formData, setFormData] = useState<Partial<Recipe>>(INITIAL_FORM_STATE);

  useEffect(() => {
    const load = () => {
      const data = localStorage.getItem('recipes');
      if (data) setRecipes(JSON.parse(data));
      else {
        setRecipes(SAMPLE_RECIPES);
        localStorage.setItem('recipes', JSON.stringify(SAMPLE_RECIPES));
      }
    };
    load();
    
    // Auto-open modal if initialDishName is provided
    if (initialDishName) {
      setEditingRecipe(null);
      setFormData({ ...INITIAL_FORM_STATE, name: initialDishName });
      setIsModalOpen(true);
    }

    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, [initialDishName]);

  const saveToStorage = (updated: Recipe[]) => {
    localStorage.setItem('recipes', JSON.stringify(updated));
    setRecipes(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const categories = ['All', 'Appetizer', 'Main Course', 'Side Dish', 'Dessert', 'Beverage'];

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAdd = () => {
    setEditingRecipe(null);
    setFormData(INITIAL_FORM_STATE);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormData({ ...recipe });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this recipe permanentely?')) {
      const updated = recipes.filter(r => r.id !== id);
      saveToStorage(updated);
    }
  };

  const handleSave = () => {
    if (!formData.name || formData.ingredients?.some(i => !i.name)) {
      alert('Please fill in the recipe name and all ingredient names.');
      return;
    }

    let updatedRecipes: Recipe[];
    if (editingRecipe) {
      updatedRecipes = recipes.map(r => r.id === editingRecipe.id ? { ...r, ...formData } as Recipe : r);
    } else {
      const newRecipe: Recipe = {
        id: Math.random().toString(36).substr(2, 9),
        ...(formData as Omit<Recipe, 'id'>)
      };
      updatedRecipes = [newRecipe, ...recipes];
    }
    
    saveToStorage(updatedRecipes);
    setIsModalOpen(false);
    
    if (onComplete && formData.name) {
      onComplete(formData.name);
    }
  };

  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), { name: '', amount: 0, unit: 'kg' }]
    }));
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients?.filter((_, i) => i !== index)
    }));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    setFormData(prev => {
      const newIngs = [...(prev.ingredients || [])];
      newIngs[index] = { ...newIngs[index], [field]: value };
      return { ...prev, ingredients: newIngs };
    });
  };

  const addInstruction = () => {
    setFormData(prev => ({
      ...prev,
      instructions: [...(prev.instructions || []), '']
    }));
  };

  const updateInstruction = (index: number, value: string) => {
    setFormData(prev => {
      const newInst = [...(prev.instructions || [])];
      newInst[index] = value;
      return { ...prev, instructions: newInst };
    });
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <BookOpen className="text-emerald-500" size={32} />
            Recipe Management
          </h2>
          <p className="text-slate-500 font-medium mt-1">Design, scale, and standardize your kitchen offerings.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl active:scale-95 group"
        >
          <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>New Recipe</span>
        </button>
      </div>

      <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search recipes..." 
            className="w-full pl-14 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-900 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-6 py-4 rounded-2xl bg-slate-50 border-none text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white transition-all appearance-none pr-12 relative"
          >
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-emerald-600 transition-all">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredRecipes.map(recipe => (
          <div key={recipe.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full">
            <div className="relative h-48 overflow-hidden">
              <img 
                src={recipe.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=800&q=80'} 
                alt={recipe.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
              <div className="absolute bottom-4 left-6">
                <span className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg">
                  {recipe.category}
                </span>
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col">
              <h3 className="text-xl font-black text-slate-900 mb-4 group-hover:text-emerald-600 transition-colors">{recipe.name}</h3>
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock size={16} />
                  <span className="text-xs font-bold">{recipe.prepTime + recipe.cookTime}m</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Users size={16} />
                  <span className="text-xs font-bold">{recipe.servings} Servings</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Flame size={16} />
                  <span className="text-xs font-bold">{recipe.difficulty}</span>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-100">
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEdit(recipe)} className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                  <button onClick={() => handleDelete(recipe.id)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                </div>
                <button className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 hover:gap-3 transition-all">
                  View Recipe <ArrowRight size={14} className="text-emerald-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-2xl border-4 border-slate-900 animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="bg-slate-900 p-8 md:p-12 text-white relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 bg-white/10 hover:bg-rose-500 p-4 rounded-3xl transition-all"><X size={24} /></button>
              <div className="flex items-center gap-4 text-emerald-400 mb-4"><ChefHat size={24} /><span className="text-[10px] font-black uppercase tracking-[0.4em]">Recipe Master</span></div>
              <h3 className="text-4xl font-black tracking-tight">{editingRecipe ? 'Edit Recipe' : 'Design New Recipe'}</h3>
            </div>
            <div className="p-8 md:p-12 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-2 col-span-full lg:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipe Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 outline-none focus:border-emerald-500 transition-all font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                  <select value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none">
                    {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Servings</label>
                  <input type="number" value={formData.servings} onChange={(e) => setFormData(prev => ({ ...prev, servings: parseInt(e.target.value) || 0 }))} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <h4 className="text-xl font-black text-slate-900">Ingredients</h4>
                  <button onClick={addIngredient} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2 hover:bg-emerald-50 px-4 py-2 rounded-xl transition-all"><Plus size={16} /> Add Ingredient</button>
                </div>
                <div className="space-y-3">
                  {formData.ingredients?.map((ing, idx) => (
                    <div key={idx} className="flex gap-4 items-center animate-in slide-in-from-left-2">
                      <input type="text" placeholder="Name" value={ing.name} onChange={(e) => updateIngredient(idx, 'name', e.target.value)} className="flex-[3] px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold" />
                      <input type="number" placeholder="Qty" value={ing.amount} onChange={(e) => updateIngredient(idx, 'amount', parseFloat(e.target.value) || 0)} className="flex-1 px-4 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold text-center" />
                      <select value={ing.unit} onChange={(e) => updateIngredient(idx, 'unit', e.target.value)} className="flex-1 px-4 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold appearance-none text-center">
                        <option value="kg">kg</option><option value="g">g</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option>
                      </select>
                      <button onClick={() => removeIngredient(idx)} className="p-4 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-8 md:p-12 bg-slate-50 border-t-2 border-slate-100 flex flex-col md:flex-row gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 px-8 py-5 text-slate-400 hover:text-slate-900 font-black uppercase tracking-widest text-xs transition-all">Cancel</button>
              <button onClick={handleSave} className="flex-[2] bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3"><Save size={18} />Save Master Recipe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
