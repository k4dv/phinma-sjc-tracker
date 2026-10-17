import React, { useState, useMemo, useRef } from 'react';
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
  AlertCircle,
  X,
  FileSpreadsheet,
  Camera,
  Users,
  Activity,
  Clock,
  ArrowRight,
  ShieldAlert
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

// Fallback staff roster for avatar display & demo requisition history
const DEFAULT_STAFF_USERS = [
  { id: '001', name: 'Kuya Bert', avatar: '' },
  { id: '002', name: 'Ate Linda', avatar: '' },
  { id: '003', name: 'Kuya Jun', avatar: '' },
  { id: '004', name: 'Ate Marites', avatar: '' },
  { id: '005', name: 'Kuya Jomar', avatar: '' }
];

export default function Supplies({ supplies = [], setSupplies, user, isDesktopView = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [toastMessage, setToastMessage] = useState('');
  
  // Enlarged modal state (Centers on screen)
  const [activeEnlargedItem, setActiveEnlargedItem] = useState(null);

  // Requisition deduction popup state
  const [deductModalItem, setDeductModalItem] = useState(null);
  const [deductQuantityInput, setDeductQuantityInput] = useState('1');
  const [deductError, setDeductError] = useState('');
  const [isDeducting, setIsDeducting] = useState(false);

  // Hidden file input ref for supply photo uploads
  const fileInputRef = useRef(null);
  const [uploadTargetSupplyId, setUploadTargetSupplyId] = useState(null);

  // Cached item images dictionary
  const [supplyPhotos, setSupplyPhotos] = useState(() => {
    try {
      const cached = localStorage.getItem('sjc_supply_photos');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Requisition history state per item
  const [usageHistory, setUsageHistory] = useState(() => {
    try {
      const cached = localStorage.getItem('sjc_supplies_usage_history');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  const isAdmin = user?.role === 'admin' || Number(user?.access_level) >= 2;
  const isPcMode = isAdmin && isDesktopView;
  const animationsDisabled = localStorage.getItem('sjc_animations_disabled') === 'true';

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Helper to retrieve staff avatar from localStorage
  const getStaffAvatar = (staffId) => {
    return localStorage.getItem(`sjc_avatar_${staffId}`) || '';
  };

  // Compress image down to ~25KB thumbnail
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle uploading an item photo
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetSupplyId) return;

    try {
      const compressedBase64 = await compressImage(file);

      const updatedPhotos = {
        ...supplyPhotos,
        [uploadTargetSupplyId]: compressedBase64
      };
      setSupplyPhotos(updatedPhotos);
      localStorage.setItem('sjc_supply_photos', JSON.stringify(updatedPhotos));

      try {
        await supabase
          .from('supplies')
          .update({ image_url: compressedBase64 })
          .eq('id', uploadTargetSupplyId);
      } catch (err) {
        console.warn('Supabase photo column notice:', err);
      }

      showToast('Item photo uploaded successfully!');
    } catch {
      alert('Failed to process image file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadTargetSupplyId(null);
    }
  };

  const triggerUpload = (e, supplyId) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setUploadTargetSupplyId(supplyId);
    fileInputRef.current?.click();
  };

  // Open the Deduction Popup
  const handleOpenDeductModal = (item, e) => {
    if (e) e.stopPropagation();
    if (item.quantity <= 0) {
      showToast(`"${item.name}" is completely out of stock.`);
      return;
    }
    setDeductModalItem(item);
    setDeductQuantityInput('1');
    setDeductError('');
  };

  // Execute the Requisition Deduction
  const handleConfirmDeduction = async (e) => {
    e.preventDefault();
    if (!deductModalItem) return;

    const count = parseInt(deductQuantityInput, 10);
    if (isNaN(count) || count <= 0) {
      setDeductError('Please enter a valid positive quantity.');
      return;
    }

    if (count > deductModalItem.quantity) {
      setDeductError(`Cannot reduce by ${count}. Only ${deductModalItem.quantity} ${deductModalItem.unit} remaining.`);
      return;
    }

    setIsDeducting(true);
    const updatedQty = deductModalItem.quantity - count;
    const supplyId = deductModalItem.id;

    // 1. Optimistic State Update
    if (setSupplies) {
      setSupplies((prev) =>
        prev.map((s) => (s.id === supplyId ? { ...s, quantity: updatedQty } : s))
      );
    }

    if (activeEnlargedItem?.id === supplyId) {
      setActiveEnlargedItem((prev) => ({ ...prev, quantity: updatedQty }));
    }

    // 2. Canva-Style Stack Log Entry
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentUserName = user?.name || (isAdmin ? 'Facilities Supervisor' : 'Staff Member');
    const currentUserId = user?.id || '001';

    const newRecord = {
      userId: currentUserId,
      userName: currentUserName,
      avatar: getStaffAvatar(currentUserId),
      time: now,
      amount: count
    };

    const existingRecords = usageHistory[supplyId] || [];
    const updatedItemHistory = [newRecord, ...existingRecords.slice(0, 8)];
    const nextFullHistory = {
      ...usageHistory,
      [supplyId]: updatedItemHistory
    };

    setUsageHistory(nextFullHistory);
    localStorage.setItem('sjc_supplies_usage_history', JSON.stringify(nextFullHistory));

    // 3. Persist to Backend API / Database
    try {
      await api.updateSupplyQty(supplyId, updatedQty);
    } catch {
      await supabase.from('supplies').update({ quantity: updatedQty }).eq('id', supplyId);
    } finally {
      setIsDeducting(false);
      showToast(`Checked out ${count} ${deductModalItem.unit} of ${deductModalItem.name}!`);
      setDeductModalItem(null);
    }
  };

  // Direct Admin-Only Add Stock (+ button)
  const handleAdminAddStock = async (supplyId, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;

    const target = supplies.find((s) => s.id === supplyId);
    if (!target) return;

    const updatedQty = target.quantity + 1;

    if (setSupplies) {
      setSupplies((prev) =>
        prev.map((s) => (s.id === supplyId ? { ...s, quantity: updatedQty } : s))
      );
    }

    if (activeEnlargedItem?.id === supplyId) {
      setActiveEnlargedItem((prev) => ({ ...prev, quantity: updatedQty }));
    }

    try {
      await api.updateSupplyQty(supplyId, updatedQty);
    } catch {
      await supabase.from('supplies').update({ quantity: updatedQty }).eq('id', supplyId);
    }
  };

  const handleDeleteSupply = async (supplyId, name, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (!window.confirm(`Delete "${name}" from inventory?`)) return;

    if (activeEnlargedItem?.id === supplyId) {
      setActiveEnlargedItem(null);
    }

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

  // Resolves Canva-style profile avatar stack for a given supply item
  const getItemUserStack = (supplyId) => {
    const recorded = usageHistory[supplyId];
    if (recorded && recorded.length > 0) {
      return recorded;
    }
    const hashNum = String(supplyId).charCodeAt(0) || 1;
    return DEFAULT_STAFF_USERS.slice(hashNum % 2, (hashNum % 2) + 3).map((st) => ({
      userId: st.id,
      userName: st.name,
      avatar: getStaffAvatar(st.id),
      time: 'Earlier today',
      amount: 1
    }));
  };

  return (
    <div className={`p-4 pt-3 space-y-3.5 pb-28 text-slate-800 ${isPcMode ? '' : 'max-w-md mx-auto'}`}>
      
      {/* Hidden File Input for Admin Image Uploads */}
      <input 
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

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

        /* Hover Aura Glow & Micro-Enlarge Effect */
        .supply-aura-card {
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.22s ease;
        }
        .supply-aura-card:hover,
        .supply-aura-card:active {
          transform: scale(1.02);
          box-shadow: 0 0 24px rgba(23, 110, 87, 0.26), 0 4px 14px rgba(0, 0, 0, 0.04);
          border-color: rgba(52, 211, 153, 0.8) !important;
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
            const itemImg = supplyPhotos[item.id] || item.image_url;
            const stackUsers = getItemUserStack(item.id);

            return (
              <div
                key={item.id}
                onClick={() => setActiveEnlargedItem(item)}
                style={{
                  animationDelay: !animationsDisabled ? `${Math.min(index * 35, 350)}ms` : '0ms'
                }}
                className={`bg-white rounded-3xl p-4 border shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-3 cursor-pointer select-none supply-aura-card ${
                  !animationsDisabled ? 'anim-ios-notification' : ''
                } ${isLow ? 'border-rose-200 ring-1 ring-rose-200' : 'border-slate-100'}`}
              >
                {/* Card Top: Category, Delete, and Photo Upload Square */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 truncate max-w-[100px]">
                    {item.category || 'General'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Photo Upload Rounded Square */}
                    <div 
                      onClick={(e) => triggerUpload(e, item.id)}
                      title={isAdmin ? "Upload item photo" : "Item picture"}
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center overflow-hidden transition relative group/square ${
                        itemImg 
                          ? 'border-emerald-300 bg-slate-900 shadow-2xs' 
                          : 'border-slate-200 bg-slate-50 hover:border-[#176e57]'
                      } ${isAdmin ? 'cursor-pointer active:scale-90' : 'cursor-default'}`}
                    >
                      {itemImg ? (
                        <img 
                          src={itemImg} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <Package className="w-5 h-5 text-slate-400 group-hover/square:text-[#176e57] transition" />
                      )}

                      {isAdmin && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/square:opacity-100 flex items-center justify-center transition rounded-2xl">
                          <Camera className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSupply(item.id, item.name, e)}
                        className="text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                        title="Delete supply"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Body */}
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

                {/* Canva-Style Profile Avatar Stack on Card Face */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                  <div className="flex items-center -space-x-1.5">
                    {stackUsers.slice(0, 3).map((st, sIdx) => {
                      const pfp = st.avatar || getStaffAvatar(st.userId);
                      return (
                        <div
                          key={sIdx}
                          title={`${st.userName} checked out ${st.amount} ${item.unit}`}
                          className="w-6 h-6 rounded-full ring-2 ring-white bg-[#176e57] text-white flex items-center justify-center font-bold text-[9px] overflow-hidden flex-shrink-0"
                        >
                          {pfp ? (
                            <img src={pfp} alt={st.userName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{st.userName[0]}</span>
                          )}
                        </div>
                      );
                    })}
                    {stackUsers.length > 3 && (
                      <div className="w-6 h-6 rounded-full ring-2 ring-white bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[8px] flex-shrink-0">
                        +{stackUsers.length - 3}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                    Stats &rarr;
                  </span>
                </div>

                {/* Card Controls */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={(e) => handleOpenDeductModal(item, e)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl font-extrabold flex items-center justify-center transition gap-1"
                    title="Check out / Reduce stock"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Use</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => handleAdminAddStock(item.id, e)}
                      className="flex-1 py-1.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white rounded-xl font-extrabold flex items-center justify-center transition gap-1"
                      title="Add stock (Admin only)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Add</span>
                    </button>
                  )}
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
            const isLow = item.quantity <= item.threshold;
            const itemImg = supplyPhotos[item.id] || item.image_url;
            const stackUsers = getItemUserStack(item.id);

            return (
              <div
                key={item.id}
                onClick={() => setActiveEnlargedItem(item)}
                style={{
                  animationDelay: !animationsDisabled ? `${Math.min(index * 38, 350)}ms` : '0ms'
                }}
                className={`bg-white rounded-3xl p-3.5 px-4 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3 text-xs cursor-pointer select-none supply-aura-card ${
                  !animationsDisabled ? 'anim-ios-notification' : ''
                } ${isLow ? 'border-rose-200 ring-1 ring-rose-200/60' : ''}`}
              >
                {/* Left Side: Photo Square, Name & Canva Stack */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Photo Upload Rounded Square */}
                  <div 
                    onClick={(e) => triggerUpload(e, item.id)}
                    title={isAdmin ? "Upload item photo" : "Item picture"}
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center overflow-hidden transition relative group/square flex-shrink-0 ${
                      itemImg 
                        ? 'border-emerald-300 bg-slate-900 shadow-2xs' 
                        : 'border-slate-200 bg-slate-50'
                    } ${isAdmin ? 'active:scale-90' : ''}`}
                  >
                    {itemImg ? (
                      <img 
                        src={itemImg} 
                        alt={item.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <Package className="w-5 h-5 text-slate-400" />
                    )}

                    {isAdmin && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/square:opacity-100 flex items-center justify-center transition rounded-2xl">
                        <Camera className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-800 truncate text-[13px]">
                        {item.name}
                      </span>
                      {item.category && (
                        <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-md flex-shrink-0">
                          {item.category}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] font-bold text-slate-700 font-sans">
                        {item.quantity} {item.unit}
                      </p>

                      {/* Canva Stack */}
                      <div className="flex items-center -space-x-1.5">
                        {stackUsers.slice(0, 3).map((st, sIdx) => {
                          const pfp = st.avatar || getStaffAvatar(st.userId);
                          return (
                            <div
                              key={sIdx}
                              title={`${st.userName} checked out ${st.amount}`}
                              className="w-5 h-5 rounded-full ring-2 ring-white bg-[#176e57] text-white flex items-center justify-center font-bold text-[8px] overflow-hidden flex-shrink-0"
                            >
                              {pfp ? (
                                <img src={pfp} alt={st.userName} className="w-full h-full object-cover" />
                              ) : (
                                <span>{st.userName[0]}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Quantity Stepper */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={(e) => handleOpenDeductModal(item, e)}
                      title="Check out units"
                      className="w-7 h-7 rounded-xl bg-white hover:bg-slate-100 active:scale-90 text-slate-700 border border-slate-200/60 shadow-2xs flex items-center justify-center transition"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>

                    <span className="font-mono font-bold text-xs px-1 min-w-[22px] text-center text-slate-700">
                      {item.quantity}
                    </span>

                    {/* Only Admin can add stock (+) */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleAdminAddStock(item.id, e)}
                        title="Add 1 unit (Supervisor only)"
                        className="w-7 h-7 rounded-xl bg-[#176e57] hover:bg-[#135c49] active:scale-90 text-white shadow-2xs flex items-center justify-center transition"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
                      </button>
                    )}
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSupply(item.id, item.name, e)}
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

      {/* ============================================================== */}
      {/* 🌟 ENLARGED 30% SCREEN CENTER CARD MODAL                        */}
      {/* ============================================================== */}
      {activeEnlargedItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => setActiveEnlargedItem(null)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-pop overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                {/* Large Rounded Photo Square */}
                <div 
                  onClick={(e) => triggerUpload(e, activeEnlargedItem.id)}
                  title={isAdmin ? "Upload item photo" : "Item picture"}
                  className={`w-14 h-14 rounded-2xl border flex items-center justify-center overflow-hidden transition relative group/modal-square ${
                    supplyPhotos[activeEnlargedItem.id] || activeEnlargedItem.image_url
                      ? 'border-emerald-300 bg-slate-900 shadow-md'
                      : 'border-slate-200 bg-slate-50 hover:border-[#176e57]'
                  } ${isAdmin ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  {supplyPhotos[activeEnlargedItem.id] || activeEnlargedItem.image_url ? (
                    <img 
                      src={supplyPhotos[activeEnlargedItem.id] || activeEnlargedItem.image_url} 
                      alt={activeEnlargedItem.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Package className="w-7 h-7 text-slate-400" />
                  )}

                  {isAdmin && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/modal-square:opacity-100 flex items-center justify-center transition rounded-2xl">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                      {activeEnlargedItem.category || 'General'}
                    </span>
                    {activeEnlargedItem.quantity <= activeEnlargedItem.threshold && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-600" /> Restock Alert
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-1 leading-tight">
                    {activeEnlargedItem.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveEnlargedItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats & Stock Health Gauge */}
            <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#176e57]" />
                  Stock Health & Inventory Level
                </span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  {activeEnlargedItem.quantity} {activeEnlargedItem.unit}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    activeEnlargedItem.quantity <= activeEnlargedItem.threshold 
                      ? 'bg-rose-500' 
                      : 'bg-[#176e57]'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(8, (activeEnlargedItem.quantity / Math.max(activeEnlargedItem.threshold * 3, 10)) * 100))}%`
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5 font-medium">
                <span>Critical Threshold: <strong>{activeEnlargedItem.threshold} {activeEnlargedItem.unit}</strong></span>
                <span className={activeEnlargedItem.quantity <= activeEnlargedItem.threshold ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
                  {activeEnlargedItem.quantity <= activeEnlargedItem.threshold ? 'Critical Deficit' : 'Optimal Capacity'}
                </span>
              </div>
            </div>

            {/* Requisition Personnel Canva-Style Avatar Stacking Feed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#176e57]" />
                  Recent Draw Personnel
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">
                  Shift Requisitions
                </span>
              </div>

              {/* Overlapping Avatar Bar with Details */}
              <div className="p-3 bg-white border border-slate-200/80 rounded-2xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center -space-x-2">
                    {getItemUserStack(activeEnlargedItem.id).map((st, idx) => {
                      const pfp = st.avatar || getStaffAvatar(st.userId);
                      return (
                        <div
                          key={idx}
                          title={st.userName}
                          className="w-8 h-8 rounded-full ring-2 ring-white bg-[#176e57] text-white flex items-center justify-center font-bold text-xs overflow-hidden shadow-xs"
                        >
                          {pfp ? (
                            <img src={pfp} alt={st.userName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{st.userName[0]}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active Handover
                  </span>
                </div>

                {/* Detailed Logs of Recent Requisitions */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 max-h-36 overflow-y-auto pr-1">
                  {getItemUserStack(activeEnlargedItem.id).map((log, lIdx) => (
                    <div key={lIdx} className="flex items-center justify-between text-[11px] p-1.5 rounded-xl bg-slate-50/70">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{log.userName}</span>
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {log.time}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        -{log.amount} {activeEnlargedItem.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick In-Modal Stock Adjustment Controls */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Stock Checkout
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {isAdmin ? 'Check out or replenish:' : 'Check out items used:'}
                </span>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={(e) => handleOpenDeductModal(activeEnlargedItem, e)}
                  title="Check out units"
                  className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 active:scale-90 text-slate-700 font-bold flex items-center justify-center transition shadow-2xs"
                >
                  <Minus className="w-4 h-4 stroke-[2.2]" />
                </button>

                <span className="w-8 text-center text-xs font-bold font-mono text-slate-800">
                  {activeEnlargedItem.quantity}
                </span>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => handleAdminAddStock(activeEnlargedItem.id, e)}
                    title="Add stock (Admin only)"
                    className="w-8 h-8 rounded-xl bg-[#176e57] hover:bg-[#135c49] active:scale-90 text-white font-bold flex items-center justify-center transition shadow-2xs"
                  >
                    <Plus className="w-4 h-4 stroke-[2.2]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================== */}
      {/* 📋 STAFF QUANTITY CHECKOUT / REDUCTION POPUP MODAL              */}
      {/* ============================================================== */}
      {deductModalItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => setDeductModalItem(null)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-sheet-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Record Item Checkout
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {deductModalItem.name} ({deductModalItem.quantity} {deductModalItem.unit} in stock)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDeductModalItem(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {deductError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span className="text-[11px] leading-tight">{deductError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDeduction} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  How many units were used?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={deductModalItem.quantity}
                    required
                    autoFocus
                    value={deductQuantityInput}
                    onChange={(e) => {
                      setDeductQuantityInput(e.target.value);
                      setDeductError('');
                    }}
                    placeholder="e.g. 1, 2, 5"
                    className="w-full text-center text-xl font-bold font-mono py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:border-[#176e57] focus:ring-1 focus:ring-[#176e57]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    {deductModalItem.unit}
                  </span>
                </div>
              </div>

              {/* Quick Increment Preset Chips */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Quick Select Quantity:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={preset > deductModalItem.quantity}
                      onClick={() => {
                        setDeductQuantityInput(String(preset));
                        setDeductError('');
                      }}
                      className={`py-1.5 rounded-xl font-bold text-xs border transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
                        deductQuantityInput === String(preset)
                          ? 'bg-[#176e57] text-white border-[#176e57]'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'
                      }`}
                    >
                      {preset} {deductModalItem.unit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff Requisition Identity Footnote */}
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/70 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Accountable Personnel:</span>
                <strong className="text-slate-800 font-semibold">
                  {user?.name || 'Staff Member'}
                </strong>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeductModalItem(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-2xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeducting || !deductQuantityInput}
                  className="flex-1 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <span>{isDeducting ? 'Updating Stock...' : 'Confirm Deduction'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}