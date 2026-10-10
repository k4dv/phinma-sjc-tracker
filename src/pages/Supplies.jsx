import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../data/supabaseClient';
import { api } from '../services/api';
import { 
  Search, 
  AlertCircle, 
  Plus, 
  Minus, 
  Trash2,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

const CATEGORIES = [
  'All', 
  'Paper & Printing', 
  'Chemicals', 
  'Equipment', 
  'Disposables', 
  'Hygiene', 
  'PPE'
];

export default function Supplies({ supplies = [], setSupplies, user }) {
  const isAdmin = user?.role === 'admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredSupplies = supplies.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const lowStockCount = supplies.filter((s) => s.quantity <= s.threshold).length;

  const handleUpdateQuantity = async (supplyId, change) => {
    const target = supplies.find((s) => s.id === supplyId);
    if (!target) return;

    const newQty = Math.max(0, target.quantity + change);

    // Optimistic UI update
    if (setSupplies) {
      setSupplies((prev) =>
        prev.map((s) => (s.id === supplyId ? { ...s, quantity: newQty } : s))
      );
    }

    try {
      // Routed through Node.js Express Controller via Model
      await api.updateSupplyQty(supplyId, newQty);
    } catch (err) {
      console.warn('Express API unavailable, using Supabase fallback:', err);
      try {
        await supabase.from('supplies').update({ quantity: newQty }).eq('id', supplyId);
      } catch (fallbackErr) {
        console.error('Failed to update stock quantity:', fallbackErr);
      }
    }
  };

  const handleDeleteSupply = async (supplyId, supplyName) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete "${supplyName}" from central inventory?`)) return;

    // Optimistic UI update
    if (setSupplies) {
      setSupplies((prev) => prev.filter((s) => s.id !== supplyId));
    }

    try {
      // Routed through Node.js Express Controller via Model
      await api.deleteSupply(supplyId);
    } catch (err) {
      console.warn('Express API unavailable, using Supabase fallback:', err);
      try {
        await supabase.from('supplies').delete().eq('id', supplyId);
      } catch (fallbackErr) {
        console.error('Failed to delete supply:', fallbackErr);
      }
    }
  };

  const handleExportExcel = () => {
    const exportData = supplies.map((item) => ({
      'Item Name': item.name,
      'Category': item.category || 'General',
      'Current In Stock': item.quantity,
      'Unit': item.unit || 'pcs',
      'Alert Threshold': item.threshold,
      'Status': item.quantity <= item.threshold ? 'CRITICAL RESTOCK NEEDED' : 'OK'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 10 },
      { wch: 16 },
      { wch: 26 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stockroom Inventory');

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `SJC_Dimasalang_Supplies_Report_${today}.xlsx`);
  };

  return (
    <div className="p-4 space-y-3.5 pb-24">
      
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            Stockroom Items
          </h2>
          <p className="text-[11px] text-slate-400">
            {supplies.length} items recorded
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            title="Download Excel Spreadsheet"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-[#176e57] border border-emerald-300 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#176e57]" />
            <span>Export Excel</span>
          </button>

          {lowStockCount > 0 ? (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              {lowStockCount} Low
            </span>
          ) : (
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Stocked
            </span>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search supplies, bond paper, equipment..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#176e57] shadow-xs"
        />
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium active:scale-95 transition-all duration-150 ${
                isSelected
                  ? 'bg-[#176e57] text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Supplies List */}
      <div className="space-y-2.5 pt-1">
        {filteredSupplies.length > 0 ? (
          filteredSupplies.map((item) => {
            const isLow = item.quantity <= item.threshold;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-3.5 border transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-between ${
                  isLow ? 'border-amber-300 bg-amber-50/20' : 'border-slate-100'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-800 truncate">
                      {item.name}
                    </h3>
                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex-shrink-0">
                      {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[11px] font-bold ${isLow ? 'text-amber-700' : 'text-slate-700'}`}>
                      {item.quantity} {item.unit}
                    </span>

                    {isLow && (
                      <span className="text-[9px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" /> Low Stock
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      title="Use 1 unit"
                      disabled={item.quantity <= 0}
                      className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:bg-slate-200 active:scale-90 flex items-center justify-center transition disabled:opacity-40"
                    >
                      <Minus className="w-3 h-3" />
                    </button>

                    <span className="w-6 text-center text-xs font-bold font-mono text-slate-800">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      title="Add 1 unit"
                      className="w-6 h-6 rounded-lg bg-white text-slate-700 hover:bg-slate-200 active:scale-90 flex items-center justify-center transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSupply(item.id, item.name)}
                      title={`Delete ${item.name}`}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl active:scale-90 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 text-slate-400 text-xs">
            No supplies matching "{searchTerm}"
          </div>
        )}
      </div>

    </div>
  );
}