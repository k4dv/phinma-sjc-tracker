import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../data/supabaseClient';
import { api } from '../services/api';
import * as XLSX from 'xlsx';
import { 
  Package, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  X,
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

export default function Supplies({ supplies = [], setSupplies, user, isDesktopView = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [toastMessage, setToastMessage] = useState('');

  const isAdmin = user?.role === 'admin';
  const isPcMode = isAdmin && isDesktopView;
  const animationsDisabled = localStorage.getItem('sjc_animations_disabled') === 'true';

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleUpdateQuantity = async (supplyId, delta) => {
    const target = supplies.find((s) => s.id === supplyId);
    if (!target) return;

    const updatedQty = Math.max(0, target.quantity + delta);

    if (setSupplies) {
      setSupplies((prev) =>
        prev.map((s) => (s.id === supplyId ? { ...s, quantity: updatedQty } : s))
      );
    }

    try {
      await api.updateSupplyQty(supplyId, updatedQty);
    } catch {
      await supabase.from('supplies').update({ quantity: updatedQty }).eq('id', supplyId);
    }
  };

  const handleDeleteSupply = async (supplyId, name) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete "${name}" from inventory?`)) return;

    if (setSupplies) {
      setSupplies((prev) => prev.filter((s) => s.id !== supplyId));
    }

    try {
      await api.deleteSupply(supplyId);
      showToast(`Removed "${name}" from stock.`);
    } catch {
      await supabase.from('supplies').delete().eq('id', supplyId);
      showToast(`Removed "${name}" from stock.`);
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = supplies.map((s) => ({
        'Item Name': s.name,
        Category: s.category || 'General',
        Quantity: s.quantity,
        Unit: s.unit,
        Threshold: s.threshold,
        'Stock Status': s.quantity <= s.threshold ? 'LOW STOCK' : 'STOCKED'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Campus Supplies');
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `SJC_Supplies_Report_${dateStr}.xlsx`);
      showToast('Supplies inventory exported to Excel!');
    } catch {
      alert('Could not export inventory spreadsheet.');
    }
  };

  const filteredSupplies = useMemo(() => {
    return supplies.filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || (item.category && item.category.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [supplies, selectedCategory, searchQuery]);

  const lowStockItems = supplies.filter((s) => s.quantity <= s.threshold);

  return (
    <div className={`p-4 pt-3 space-y-3.5 pb-28 text-slate-800 ${isPcMode ? '' : 'max-w-md mx-auto'}`}>
      
      {/* Apple Notification Stack In-Animation Keyframes */}
      <style>{`
        @keyframes iosNotificationIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 26px, 0) scale(0.96);
          }
          70% {
            opacity: 1;
            transform: translate3d(0, -1.5px, 0) scale(1.003);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        .anim-ios-notification {
          animation: iosNotificationIn 0.46s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }

        .disable-animations .anim-ios-notification {
          animation: none !important;
          transform: none !important;
          opacity: 1 !important;
        }
      `}</style>

      {/* Toast Alert */}
      {toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[150] max-w-sm mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className="pointer-events-auto p-3.5 bg-emerald-50/95 backdrop-blur-sm border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-3xl flex items-center gap-2.5 shadow-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="flex-1 font-medium">{toastMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Header Bar */}
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/90 hover:bg-emerald-100 text-[#176e57] border border-emerald-300 rounded-2xl text-xs font-bold transition shadow-2xs active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#176e57]" />
            <span>Export Excel</span>
          </button>

          <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50/90 text-[#176e57] border border-emerald-300 rounded-2xl text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#176e57]" />
            <span>{lowStockItems.length > 0 ? `${lowStockItems.length} Low` : 'Stocked'}</span>
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search supplies, bond paper, equipment..."
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-100 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#176e57] shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition active:scale-95 border ${
                isSelected
                  ? 'bg-[#176e57] text-white border-[#176e57] shadow-xs'
                  : 'bg-slate-100/90 text-slate-600 border-slate-200/80 hover:bg-slate-200 shadow-2xs'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Supplies Items List: Staggered Apple Notification Slide-Up */}
      {isPcMode ? (
        <div 
          key={`${selectedCategory}_pc_${searchQuery}`}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pt-1"
        >
          {filteredSupplies.map((item, index) => {
            const isLow = item.quantity <= item.threshold;

            return (
              <div
                key={item.id}
                style={{
                  animationDelay: !animationsDisabled ? `${Math.min(index * 35, 350)}ms` : '0ms'
                }}
                className={`bg-white rounded-3xl p-4 border shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-3 transition hover:shadow-md ${
                  !animationsDisabled ? 'anim-ios-notification' : ''
                } ${isLow ? 'border-rose-200 ring-1 ring-rose-200' : 'border-slate-100'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                    {item.category || 'General'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDeleteSupply(item.id, item.name)}
                    className="text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                    title="Delete supply"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 text-center py-1">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                      {item.quantity}
                    </span>
                    <span className="text-xs text-slate-400 font-medium font-sans">
                      {item.unit}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-xs truncate" title={item.name}>
                    {item.name}
                  </h3>

                  <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    isLow 
                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {isLow ? `Low (Min: ${item.threshold})` : 'Stock Healthy'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl font-extrabold flex items-center justify-center transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                    className="flex-1 py-1.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white rounded-xl font-extrabold flex items-center justify-center transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Mobile List: Notification Stagger */
        <div 
          key={`${selectedCategory}_mobile_${searchQuery}`}
          className="space-y-2.5 pt-1"
        >
          {filteredSupplies.map((item, index) => {
            return (
              <div
                key={item.id}
                style={{
                  animationDelay: !animationsDisabled ? `${Math.min(index * 38, 350)}ms` : '0ms'
                }}
                className={`bg-white rounded-3xl p-3.5 px-4 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3 text-xs ${
                  !animationsDisabled ? 'anim-ios-notification' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-800 truncate text-[13px]">
                      {item.name}
                    </span>
                    {item.category && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-md flex-shrink-0">
                        {item.category}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[11px] font-bold text-slate-600 font-sans mt-0.5">
                    {item.quantity} {item.unit}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-xl bg-white hover:bg-slate-100 active:scale-90 text-slate-500 border border-slate-200/60 shadow-2xs flex items-center justify-center transition"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>

                    <span className="font-mono font-bold text-xs px-1 min-w-[22px] text-center text-slate-700">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-xl bg-white hover:bg-slate-100 active:scale-90 text-slate-500 border border-slate-200/60 shadow-2xs flex items-center justify-center transition"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSupply(item.id, item.name)}
                      className="text-slate-400 hover:text-rose-600 active:scale-90 transition p-1 hover:bg-rose-50 rounded-xl"
                      title="Delete supply"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredSupplies.length === 0 && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center space-y-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-600">No supplies found</p>
          <p className="text-[10px] text-slate-400">Try searching with another item name or category</p>
        </div>
      )}

    </div>
  );
}