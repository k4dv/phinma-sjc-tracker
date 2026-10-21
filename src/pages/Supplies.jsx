import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../data/supabaseClient';
import { api } from '../services/api';
import XLSX from 'xlsx-js-style';
import { 
  Package, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Camera,
  Users,
  Activity,
  Clock,
  ArrowRight,
  Loader2,
  UploadCloud,
  Pencil,
  Check,
  History
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

const META_DELIMITER = '|||SJC_META|||';

// Context-aware relative time formatter
export const formatRelativeTime = (timestamp, fallbackTime = '') => {
  if (!timestamp && !fallbackTime) return 'recorded';

  let dateObj = null;
  if (typeof timestamp === 'number' || (!isNaN(Number(timestamp)) && String(timestamp).length >= 10)) {
    dateObj = new Date(Number(timestamp));
  } else if (timestamp && !isNaN(new Date(timestamp).getTime())) {
    dateObj = new Date(timestamp);
  }

  // Graceful fallback for older items that only stored "10:00 PM"
  if (!dateObj || isNaN(dateObj.getTime())) {
    return fallbackTime || String(timestamp || 'recorded');
  }

  const now = Date.now();
  const diffSec = Math.floor((now - dateObj.getTime()) / 1000);

  if (diffSec < 45) return 'just now';
  if (diffSec < 90) return '1m ago';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isToday = dateObj.toDateString() === new Date().toDateString();
  if (isToday) {
    return `${diffHours}h ago (${timeFormatted})`;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = dateObj.toDateString() === yesterday.toDateString();
  if (isYesterday) {
    return `Yesterday at ${timeFormatted}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    const dayName = dateObj.toLocaleDateString([], { weekday: 'short' });
    return `${diffDays}d ago (${dayName} ${timeFormatted})`;
  }

  const dateMonthDay = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateMonthDay} at ${timeFormatted}`;
};

// Unpacks embedded cloud photo and stack from unit string
export const unpackSupplyItem = (row) => {
  if (!row) return row;
  const rawUnit = String(row.raw_unit || row.unit || 'pcs');
  let cleanUnit = String(row.unit || 'pcs').split(META_DELIMITER)[0] || 'pcs';
  let metaImg = row.image_url || row.image || '';
  let metaStack = row.cloud_stack || null;

  if (rawUnit.includes(META_DELIMITER)) {
    const parts = rawUnit.split(META_DELIMITER);
    cleanUnit = parts[0] || 'pcs';
    try {
      const parsed = JSON.parse(parts[1]);
      if (parsed.img) metaImg = parsed.img;
      if (Array.isArray(parsed.stack)) metaStack = parsed.stack;
    } catch (_) {}
  }

  return {
    ...row,
    unit: cleanUnit,
    raw_unit: rawUnit,
    image_url: metaImg,
    cloud_stack: metaStack
  };
};

// Packs clean unit + cloud photo + stack into database string
export const packSupplyUnit = (cleanUnit, img, stack) => {
  const baseUnit = String(cleanUnit || 'pcs').split(META_DELIMITER)[0] || 'pcs';
  if (!img && (!stack || stack.length === 0)) {
    return baseUnit;
  }
  const payload = {};
  if (img) payload.img = img;
  if (Array.isArray(stack) && stack.length > 0) {
    payload.stack = stack.slice(0, 10);
  }
  return `${baseUnit}${META_DELIMITER}${JSON.stringify(payload)}`;
};

export default function Supplies({ supplies = [], setSupplies, user, isDesktopView = false }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  
  // Enlarged center screen modal state
  const [activeEnlargedItem, setActiveEnlargedItem] = useState(null);

  // In-Modal Supply Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // In-app Delete Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeletingSupply, setIsDeletingSupply] = useState(false);

  // Add New Supply Item Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Chemicals');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('bottles');
  const [newItemThreshold, setNewItemThreshold] = useState('5');
  const [newItemPhoto, setNewItemPhoto] = useState('');
  const [isAddingSupply, setIsAddingSupply] = useState(false);
  const newItemFileInputRef = useRef(null);

  // Requisition deduction popup state
  const [deductModalItem, setDeductModalItem] = useState(null);
  const [deductQuantityInput, setDeductQuantityInput] = useState('1');
  const [deductError, setDeductError] = useState('');
  const [isDeducting, setIsDeducting] = useState(false);

  // Hover timer state
  const [hoveredFullNameId, setHoveredFullNameId] = useState(null);
  const hoverTimerRef = useRef(null);

  // Drag-and-drop tracking
  const [dragOverTargetId, setDragOverTargetId] = useState(null);
  const [isModalDragOver, setIsModalDragOver] = useState(false);

  // Photo upload loading ref
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const uploadTargetIdRef = useRef(null);

  // Real-time Cloud Photos dictionary
  const [supplyPhotos, setSupplyPhotos] = useState(() => {
    try {
      const cached = localStorage.getItem('sjc_supply_photos');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Cloud-synced Staff Avatars
  const [staffAvatarsMap, setStaffAvatarsMap] = useState({});

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

  const showToast = (msg, type = 'success') => {
    setToastType(type);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    if (!supplies || supplies.length === 0) return;

    const newPhotos = {};
    const newStacks = {};

    supplies.forEach((raw) => {
      const item = unpackSupplyItem(raw);
      if (item.image_url) newPhotos[item.id] = item.image_url;
      if (item.cloud_stack && item.cloud_stack.length > 0) newStacks[item.id] = item.cloud_stack;
    });

    if (Object.keys(newPhotos).length > 0) {
      setSupplyPhotos((prev) => {
        const next = { ...prev, ...newPhotos };
        try { localStorage.setItem('sjc_supply_photos', JSON.stringify(next)); } catch (_) {}
        return next;
      });
    }

    if (Object.keys(newStacks).length > 0) {
      setUsageHistory((prev) => {
        const next = { ...prev, ...newStacks };
        try { localStorage.setItem('sjc_supplies_usage_history', JSON.stringify(next)); } catch (_) {}
        return next;
      });
    }
  }, [supplies]);

  useEffect(() => {
    const fetchCloudData = async () => {
      try {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, name, avatar');

        if (profileRows && profileRows.length > 0) {
          const avatarMap = {};
          profileRows.forEach((p) => {
            if (p.avatar) {
              avatarMap[String(p.id).toLowerCase()] = p.avatar;
              avatarMap[String(p.id).replace(/^0+/, '').toLowerCase()] = p.avatar;
              if (p.name) avatarMap[String(p.name).toLowerCase()] = p.avatar;
            }
          });
          setStaffAvatarsMap(avatarMap);
        }

        const { data: metaRows } = await supabase
          .from('logs')
          .select('*')
          .eq('id', 'keep_table_structure')
          .maybeSingle();

        if (metaRows && metaRows.text) {
          try {
            const parsedMeta = JSON.parse(metaRows.text);
            if (parsedMeta.photos) {
              setSupplyPhotos((prev) => {
                const next = { ...prev, ...parsedMeta.photos };
                try { localStorage.setItem('sjc_supply_photos', JSON.stringify(next)); } catch (_) {}
                return next;
              });
            }
            if (parsedMeta.stacks) {
              setUsageHistory((prev) => {
                const next = { ...prev, ...parsedMeta.stacks };
                try { localStorage.setItem('sjc_supplies_usage_history', JSON.stringify(next)); } catch (_) {}
                return next;
              });
            }
          } catch (_) {}
        }

        const { data: supplyRows } = await supabase
          .from('supplies')
          .select('*')
          .order('id', { ascending: true });

        if (supplyRows && supplyRows.length > 0) {
          const unpackedList = supplyRows.map(unpackSupplyItem);
          if (setSupplies) setSupplies(unpackedList);
        }
      } catch (err) {
        console.warn('Cloud sync initialization notice:', err);
      }
    };

    fetchCloudData();
  }, [setSupplies]);

  useEffect(() => {
    const channel = supabase
      .channel('supplies-live-multi-device-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplies' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const unpacked = unpackSupplyItem(payload.new);

          if (unpacked.image_url) {
            setSupplyPhotos((prev) => {
              const next = { ...prev, [unpacked.id]: unpacked.image_url };
              try { localStorage.setItem('sjc_supply_photos', JSON.stringify(next)); } catch (_) {}
              return next;
            });
          }

          if (unpacked.cloud_stack) {
            setUsageHistory((prev) => {
              const next = { ...prev, [unpacked.id]: unpacked.cloud_stack };
              try { localStorage.setItem('sjc_supplies_usage_history', JSON.stringify(next)); } catch (_) {}
              return next;
            });
          }

          if (setSupplies) {
            setSupplies((prev) =>
              prev.map((s) => (s.id === unpacked.id ? { ...s, ...unpacked, quantity: Number(unpacked.quantity) } : s))
            );
          }

          setActiveEnlargedItem((prev) => {
            if (prev && prev.id === unpacked.id) {
              return { ...prev, ...unpacked, quantity: Number(unpacked.quantity) };
            }
            return prev;
          });
        } else if (payload.eventType === 'INSERT' && payload.new) {
          const unpacked = unpackSupplyItem(payload.new);
          if (unpacked.image_url) {
            setSupplyPhotos((prev) => ({ ...prev, [unpacked.id]: unpacked.image_url }));
          }
          if (setSupplies) {
            setSupplies((prev) => {
              if (prev.some((s) => s.id === unpacked.id)) return prev;
              return [...prev, unpacked];
            });
          }
        } else if (payload.eventType === 'DELETE' && payload.old) {
          if (setSupplies) {
            setSupplies((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setSupplies]);

  const getStaffAvatar = (staffId, staffName = '') => {
    const cleanId = String(staffId || '').toLowerCase();
    const strippedId = cleanId.replace(/^0+/, '');
    const cleanName = String(staffName || '').toLowerCase();

    return (
      staffAvatarsMap[cleanId] ||
      staffAvatarsMap[strippedId] ||
      staffAvatarsMap[cleanName] ||
      localStorage.getItem(`sjc_avatar_${staffId}`) ||
      ''
    );
  };

  const compressImage = (file, maxDim = 180) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.76));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractCleanImageUrl = (raw) => {
    if (!raw) return '';
    try {
      if (raw.includes('google.') && raw.includes('imgurl=')) {
        const urlObj = new URL(raw);
        const directImg = urlObj.searchParams.get('imgurl');
        if (directImg) return decodeURIComponent(directImg);
      }
    } catch (_) {}
    return raw;
  };

  const compressFromUrlOrDataUri = (rawUrl, maxDim = 180) => {
    return new Promise((resolve) => {
      const url = extractCleanImageUrl(rawUrl);
      if (!url) return resolve('');

      if (url.startsWith('data:image')) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.76));
        };
        img.onerror = () => resolve(url);
        img.src = url;
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.76));
        } catch (_) {
          resolve(url);
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  };

  const syncMetadataToCloud = async (targetSupplyId, nextPhotosMap, nextStacksMap, updatedQuantity = null) => {
    const targetItem = supplies.find((s) => s.id === targetSupplyId);
    const cleanUnit = targetItem ? String(targetItem.unit || 'pcs').split(META_DELIMITER)[0] : 'pcs';
    const itemImg = nextPhotosMap[targetSupplyId] || targetItem?.image_url || '';
    const itemStack = nextStacksMap[targetSupplyId] || [];

    const packedUnitString = packSupplyUnit(cleanUnit, itemImg, itemStack);
    const updatePayload = { unit: packedUnitString };
    if (updatedQuantity !== null) {
      updatePayload.quantity = Number(updatedQuantity);
    }

    const { error: supplyErr } = await supabase
      .from('supplies')
      .update(updatePayload)
      .eq('id', targetSupplyId);

    if (supplyErr && updatedQuantity !== null) {
      await supabase
        .from('supplies')
        .update({ quantity: Number(updatedQuantity) })
        .eq('id', targetSupplyId);
    }

    try {
      const masterPayload = JSON.stringify({
        photos: nextPhotosMap,
        stacks: nextStacksMap
      });
      await supabase.from('logs').delete().eq('id', 'keep_table_structure');
      await supabase.from('logs').insert([{
        id: 'keep_table_structure',
        time: 'SYNC',
        author: '__SJC_SUPPLY_META__',
        text: masterPayload
      }]);
    } catch (mirrorErr) {
      console.warn('Secondary mirror sync notice:', mirrorErr);
    }
  };

  const saveSupplyPhoto = async (targetId, photoString) => {
    if (!targetId || !photoString) return;
    setIsUploadingPhoto(true);

    try {
      const nextPhotosMap = {
        ...supplyPhotos,
        [targetId]: photoString
      };
      setSupplyPhotos(nextPhotosMap);
      try {
        localStorage.setItem('sjc_supply_photos', JSON.stringify(nextPhotosMap));
      } catch (_) {}

      if (setSupplies) {
        setSupplies((prev) =>
          prev.map((s) => (s.id === targetId ? { ...s, image_url: photoString } : s))
        );
      }
      if (activeEnlargedItem?.id === targetId) {
        setActiveEnlargedItem((prev) => ({ ...prev, image_url: photoString }));
      }

      await syncMetadataToCloud(targetId, nextPhotosMap, usageHistory, null);
      showToast('Item photo saved and synced to all devices!', 'success');
    } catch (err) {
      console.error('Photo save error:', err);
      showToast('Failed to save image.', 'error');
    } finally {
      setIsUploadingPhoto(false);
      uploadTargetIdRef.current = null;
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetIdRef.current;
    if (!file || !targetId) return;

    try {
      const compressedBase64 = await compressImage(file, 180);
      await saveSupplyPhoto(targetId, compressedBase64);
    } catch (err) {
      console.error('Upload processing error:', err);
      showToast('Failed to process image.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDropOnItem = async (e, supplyId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetId(null);
    setIsModalDragOver(false);

    if (!isAdmin) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type && file.type.startsWith('image/')) {
        try {
          const compressed = await compressImage(file, 180);
          await saveSupplyPhoto(supplyId, compressed);
        } catch {
          showToast('Could not process dropped image file.', 'error');
        }
        return;
      }
    }

    let droppedUrl = '';
    const htmlData = e.dataTransfer.getData('text/html');
    if (htmlData) {
      const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) {
        droppedUrl = match[1];
      }
    }

    if (!droppedUrl) {
      const uri = e.dataTransfer.getData('text/uri-list');
      const plain = e.dataTransfer.getData('text/plain');
      droppedUrl = uri || plain || '';
    }

    if (droppedUrl) {
      try {
        const processedPhoto = await compressFromUrlOrDataUri(droppedUrl.trim(), 180);
        if (processedPhoto) {
          await saveSupplyPhoto(supplyId, processedPhoto);
        } else {
          showToast('Invalid or inaccessible image URL.', 'error');
        }
      } catch {
        showToast('Failed to load image from drop source.', 'error');
      }
    }
  };

  const handleNewItemPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 180);
      setNewItemPhoto(compressed);
    } catch (_) {
      showToast('Could not process selected photo.', 'error');
    }
  };

  // 1. Audit Log on Item Creation (Tracks Date, Exact Time, and Epoch Timestamp)
  const handleAddSupplyItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setIsAddingSupply(true);
    const cleanUnit = newItemUnit.trim() || 'pcs';
    const initialQty = parseInt(newItemQty, 10) || 0;

    const currentUserName = user?.name || (isAdmin ? 'Facilities Supervisor' : 'Staff Member');
    const currentUserId = user?.id || '001';
    const userAvatar = getStaffAvatar(currentUserId, currentUserName);
    const timestampNow = Date.now();
    const formattedDate = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const initialAuditRecord = {
      userId: currentUserId,
      userName: currentUserName,
      avatar: userAvatar,
      timestamp: timestampNow,
      date: formattedDate,
      time: formattedTime,
      amount: initialQty,
      action: 'added'
    };

    const packedUnit = packSupplyUnit(cleanUnit, newItemPhoto, [initialAuditRecord]);

    const newSupplyObj = {
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: initialQty,
      unit: packedUnit,
      threshold: parseInt(newItemThreshold, 10) || 1
    };

    try {
      const { data, error } = await supabase
        .from('supplies')
        .insert([newSupplyObj])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        const createdUnpacked = unpackSupplyItem(data[0]);
        createdUnpacked.cloud_stack = [initialAuditRecord];

        const nextStacks = {
          ...usageHistory,
          [createdUnpacked.id]: [initialAuditRecord]
        };
        setUsageHistory(nextStacks);
        try {
          localStorage.setItem('sjc_supplies_usage_history', JSON.stringify(nextStacks));
        } catch (_) {}

        let nextPhotos = supplyPhotos;
        if (newItemPhoto) {
          createdUnpacked.image_url = newItemPhoto;
          nextPhotos = { ...supplyPhotos, [createdUnpacked.id]: newItemPhoto };
          setSupplyPhotos(nextPhotos);
          try {
            localStorage.setItem('sjc_supply_photos', JSON.stringify(nextPhotos));
          } catch (_) {}
        }

        await syncMetadataToCloud(createdUnpacked.id, nextPhotos, nextStacks, initialQty);

        if (setSupplies) {
          setSupplies((prev) => [...prev, createdUnpacked]);
        }

        supabase.from('logs').insert([{
          id: `log-${timestampNow}`,
          time: formattedTime,
          author: currentUserName,
          text: `Added new supply "${newSupplyObj.name}" (${initialQty} ${cleanUnit}) to inventory.`
        }]).catch(() => {});
      }

      setNewItemName('');
      setNewItemQty('');
      setNewItemUnit('bottles');
      setNewItemThreshold('5');
      setNewItemPhoto('');
      setShowAddModal(false);
      showToast(`Added "${newSupplyObj.name}" by ${currentUserName}!`, 'success');
    } catch (err) {
      console.error('Failed to add supply item:', err);
      showToast('Could not save supply item to database.', 'error');
    } finally {
      setIsAddingSupply(false);
    }
  };

  const handleSaveSupplyName = async (e) => {
    if (e) e.preventDefault();
    if (!activeEnlargedItem || !editNameInput.trim()) return;

    const trimmed = editNameInput.trim();
    if (trimmed === activeEnlargedItem.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('supplies')
        .update({ name: trimmed })
        .eq('id', activeEnlargedItem.id);

      if (error) throw error;

      if (setSupplies) {
        setSupplies((prev) =>
          prev.map((s) => (s.id === activeEnlargedItem.id ? { ...s, name: trimmed } : s))
        );
      }

      setActiveEnlargedItem((prev) => ({ ...prev, name: trimmed }));
      setIsEditingName(false);
      showToast(`Renamed to "${trimmed}"!`, 'success');
    } catch (err) {
      console.error('Failed to update supply name:', err);
      showToast('Could not update name in database.', 'error');
    } finally {
      setIsSavingName(false);
    }
  };

  const triggerUpload = (e, supplyId) => {
    e.stopPropagation();
    if (!isAdmin) return;
    uploadTargetIdRef.current = supplyId;
    fileInputRef.current?.click();
  };

  const handleMouseEnterItem = (itemId) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredFullNameId(itemId);
    }, 2000);
  };

  const handleMouseLeaveItem = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredFullNameId(null);
  };

  const handleOpenDeductModal = (item, e) => {
    if (e) e.stopPropagation();
    if (item.quantity <= 0) {
      showToast(`"${item.name}" is completely out of stock.`, 'error');
      return;
    }
    setDeductModalItem(item);
    setDeductQuantityInput('1');
    setDeductError('');
  };

  // 2. Audit Log on Deductions (Tracks Date, Exact Time, and Epoch Timestamp)
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

    const timestampNow = Date.now();
    const formattedDate = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentUserName = user?.name || (isAdmin ? 'Facilities Supervisor' : 'Staff Member');
    const currentUserId = user?.id || '001';
    const userAvatar = getStaffAvatar(currentUserId, currentUserName);

    const newRecord = {
      userId: currentUserId,
      userName: currentUserName,
      avatar: userAvatar,
      timestamp: timestampNow,
      date: formattedDate,
      time: formattedTime,
      amount: count,
      action: 'checkout'
    };

    const existingRecords = usageHistory[supplyId] || deductModalItem.cloud_stack || [];
    const updatedItemHistory = [newRecord, ...existingRecords.slice(0, 9)];
    const nextFullHistory = {
      ...usageHistory,
      [supplyId]: updatedItemHistory
    };

    setUsageHistory(nextFullHistory);
    try {
      localStorage.setItem('sjc_supplies_usage_history', JSON.stringify(nextFullHistory));
    } catch (_) {}

    if (setSupplies) {
      setSupplies((prev) =>
        prev.map((s) =>
          s.id === supplyId
            ? { ...s, quantity: updatedQty, cloud_stack: updatedItemHistory }
            : s
        )
      );
    }

    if (activeEnlargedItem?.id === supplyId) {
      setActiveEnlargedItem((prev) => ({
        ...prev,
        quantity: updatedQty,
        cloud_stack: updatedItemHistory
      }));
    }

    const supplyLog = {
      id: `log-${timestampNow}`,
      created_at: new Date().toISOString(),
      time: formattedTime,
      author: currentUserName,
      text: `Checked out ${count} ${deductModalItem.unit} of ${deductModalItem.name}. Remaining: ${updatedQty} ${deductModalItem.unit}.`,
      role: user?.role || (isAdmin ? 'admin' : 'staff')
    };

    window.dispatchEvent(new CustomEvent('sjc_log_created', { detail: supplyLog }));

    try {
      await syncMetadataToCloud(supplyId, supplyPhotos, nextFullHistory, updatedQty);

      supabase.from('logs').insert([{
        id: `log-${timestampNow}`,
        time: formattedTime,
        author: currentUserName,
        text: supplyLog.text
      }]).catch(() => {});

      showToast(`Checked out ${count} ${deductModalItem.unit} of ${deductModalItem.name}!`, 'success');
    } catch (err) {
      console.warn('Primary sync notice, applying fallback update:', err);
      await supabase.from('supplies').update({ quantity: updatedQty }).eq('id', supplyId);
      showToast(`Stock updated to ${updatedQty} ${deductModalItem.unit}.`, 'success');
    } finally {
      setIsDeducting(false);
      setDeductModalItem(null);
    }
  };

  // 3. Audit Log on Replenishments / Adjustments (Tracks Date, Exact Time, and Epoch Timestamp)
  const handleAdminAddStock = async (supplyId, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;

    const target = supplies.find((s) => s.id === supplyId);
    if (!target) return;

    const updatedQty = target.quantity + 1;
    const timestampNow = Date.now();
    const formattedDate = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentUserName = user?.name || (isAdmin ? 'Facilities Supervisor' : 'Staff Member');
    const currentUserId = user?.id || '001';
    const userAvatar = getStaffAvatar(currentUserId, currentUserName);

    const replenishRecord = {
      userId: currentUserId,
      userName: currentUserName,
      avatar: userAvatar,
      timestamp: timestampNow,
      date: formattedDate,
      time: formattedTime,
      amount: 1,
      action: 'restocked'
    };

    const existingRecords = usageHistory[supplyId] || target.cloud_stack || [];
    const updatedItemHistory = [replenishRecord, ...existingRecords.slice(0, 9)];
    const nextFullHistory = {
      ...usageHistory,
      [supplyId]: updatedItemHistory
    };

    setUsageHistory(nextFullHistory);
    try {
      localStorage.setItem('sjc_supplies_usage_history', JSON.stringify(nextFullHistory));
    } catch (_) {}

    if (setSupplies) {
      setSupplies((prev) =>
        prev.map((s) => (s.id === supplyId ? { ...s, quantity: updatedQty, cloud_stack: updatedItemHistory } : s))
      );
    }

    if (activeEnlargedItem?.id === supplyId) {
      setActiveEnlargedItem((prev) => ({ ...prev, quantity: updatedQty, cloud_stack: updatedItemHistory }));
    }

    try {
      await syncMetadataToCloud(supplyId, supplyPhotos, nextFullHistory, updatedQty);
    } catch {
      await supabase.from('supplies').update({ quantity: updatedQty }).eq('id', supplyId);
    }
  };

  const promptDeleteSupply = (supplyId, name, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    setItemToDelete({ id: supplyId, name });
  };

  const handleConfirmDeleteSupply = async () => {
    if (!itemToDelete) return;
    const { id: supplyId, name } = itemToDelete;

    setIsDeletingSupply(true);

    if (activeEnlargedItem?.id === supplyId) {
      setActiveEnlargedItem(null);
    }

    if (setSupplies) {
      setSupplies((prev) => prev.filter((s) => s.id !== supplyId));
    }

    try {
      await api.deleteSupply(supplyId);
      showToast(`Removed "${name}" from stock.`, 'success');
    } catch {
      await supabase.from('supplies').delete().eq('id', supplyId);
      showToast(`Removed "${name}" from stock.`, 'success');
    } finally {
      setIsDeletingSupply(false);
      setItemToDelete(null);
    }
  };

  // 📊 EXECUTIVE STYLED EXCEL EXPORT (EXACT EMOJIS + COLUMN H LAST ACTION AUDIT)
  const handleExportExcel = () => {
    try {
      const unpacked = supplies.map(unpackSupplyItem);

      const sectionOrder = [
        'Chemicals',
        'PPE',
        'Hygiene',
        'Equipment',
        'Paper & Printing',
        'Disposables'
      ];

      const PALETTE = {
        campusGreen: '176E57',
        titleSubBg: '0F4C3A',
        titleSubText: 'A7F3D0',
        white: 'FFFFFF',
        slateDark: '1E293B',
        slateLight: 'F8FAFC',
        borderSoft: 'E2E8F0',
        
        // Status Colors
        stockedFill: 'D1FAE5',
        stockedText: '065F46',
        lowFill: 'FEF3C7',
        lowText: '92400E',
        outFill: 'FEE2E2',
        outText: '991B1B',
        
        // Category Shelf Banners
        chemFill: 'FEF3C7',
        chemText: '78350F',
        ppeFill: 'F3E8FF',
        ppeText: '581C87',
        hygieneFill: 'CCFBF1',
        hygieneText: '115E59',
        equipFill: 'D1FAE5',
        equipText: '065F46',
        paperFill: 'E0F2FE',
        paperText: '075985',
        dispFill: 'F1F5F9',
        dispText: '334155'
      };

      const thinBorder = {
        top: { style: 'thin', color: { rgb: PALETTE.borderSoft } },
        bottom: { style: 'thin', color: { rgb: PALETTE.borderSoft } },
        left: { style: 'thin', color: { rgb: PALETTE.borderSoft } },
        right: { style: 'thin', color: { rgb: PALETTE.borderSoft } }
      };

      const grouped = {};
      sectionOrder.forEach((cat) => { grouped[cat] = []; });
      unpacked.forEach((item) => {
        const cat = item.category || 'Disposables';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
      });

      const rows = [];
      const cellStyles = {};
      const merges = [];

      const setCellStyle = (r, c, style) => {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        cellStyles[cellRef] = style;
      };

      // --- ROW 0: REPORT TITLE (Green Banner) ---
      rows.push(['PHINMA SAINT JUDE COLLEGE — CAMPUS STORAGE INVENTORY AUDIT', '', '', '', '', '', '', '']);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
      for (let c = 0; c <= 7; c++) {
        setCellStyle(0, c, {
          fill: { fgColor: { rgb: PALETTE.campusGreen } },
          font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: PALETTE.white } },
          alignment: { vertical: 'center', horizontal: 'left', indent: 1 }
        });
      }

      // --- ROW 1: AUDIT METADATA ---
      const now = new Date();
      const dateFormatted = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push([`Audit Date: ${dateFormatted} at ${timeFormatted} | Campus: Dimasalang, Silang, Phinma | Auditor: Facilities Administration`, '', '', '', '', '', '', '']);
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });
      for (let c = 0; c <= 7; c++) {
        setCellStyle(1, c, {
          fill: { fgColor: { rgb: PALETTE.titleSubBg } },
          font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: PALETTE.titleSubText } },
          alignment: { vertical: 'center', horizontal: 'left', indent: 1 }
        });
      }

      // --- ROW 2: BLANK SPACER ---
      rows.push(['', '', '', '', '', '', '', '']);

      // --- ROW 3: COLUMN HEADERS ---
      rows.push([
        'CATEGORY',
        'ITEM NAME',
        'CURRENT STOCK',
        'UNIT',
        'MIN THRESHOLD',
        'INVENTORY STATUS',
        'SAFETY CLASSIFICATION',
        'LAST ACTION / PERSONNEL'
      ]);
      for (let c = 0; c <= 7; c++) {
        setCellStyle(3, c, {
          fill: { fgColor: { rgb: PALETTE.slateDark } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: PALETTE.white } },
          alignment: { vertical: 'center', horizontal: (c === 1 || c === 7) ? 'left' : 'center' },
          border: thinBorder
        });
      }

      let currentRow = 4;

      // --- SECTIONS WITH EMOJIS, COLOR BANNERS & AUDIT TRAIL ---
      sectionOrder.forEach((cat) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return;

        let bannerBg = PALETTE.dispFill;
        let bannerTxt = PALETTE.dispText;
        let catLabel = `📦 ${cat.toUpperCase()}`;

        // Exact match for the icons shown in your Excel view
        if (cat === 'Chemicals') {
          bannerBg = PALETTE.chemFill;
          bannerTxt = PALETTE.chemText;
          catLabel = '🏷️ CHEMICALS & DISINFECTANTS (Hazard / Regulated)';
        } else if (cat === 'PPE') {
          bannerBg = PALETTE.ppeFill;
          bannerTxt = PALETTE.ppeText;
          catLabel = '🦺 PPE & PERSONAL PROTECTIVE EQUIPMENT (Safety Protocol)';
        } else if (cat === 'Hygiene') {
          bannerBg = PALETTE.hygieneFill;
          bannerTxt = PALETTE.hygieneText;
          catLabel = '✨ HYGIENE & RESTROOM SANITATION';
        } else if (cat === 'Equipment') {
          bannerBg = PALETTE.equipFill;
          bannerTxt = PALETTE.equipText;
          catLabel = '🔧 CUSTODIAL & CAMPUS MAINTENANCE EQUIPMENT';
        } else if (cat === 'Paper & Printing') {
          bannerBg = PALETTE.paperFill;
          bannerTxt = PALETTE.paperText;
          catLabel = '📄 PAPER & ACADEMIC PRINTING STOCKS';
        } else if (cat === 'Disposables') {
          bannerBg = PALETTE.dispFill;
          bannerTxt = PALETTE.dispText;
          catLabel = '📦 DISPOSABLES';
        }

        // Section Banner Row
        rows.push([catLabel, '', '', '', '', '', '', `${items.length} items registered`]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 6 } });

        for (let c = 0; c <= 6; c++) {
          setCellStyle(currentRow, c, {
            fill: { fgColor: { rgb: bannerBg } },
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: bannerTxt } },
            alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
            border: thinBorder
          });
        }
        setCellStyle(currentRow, 7, {
          fill: { fgColor: { rgb: bannerBg } },
          font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: bannerTxt } },
          alignment: { vertical: 'center', horizontal: 'center' },
          border: thinBorder
        });
        currentRow++;

        // Data Rows
        items.forEach((item, itemIdx) => {
          const qty = Number(item.quantity) || 0;
          const threshold = Number(item.threshold) || 1;
          const isCritical = qty <= 0;
          const isLow = !isCritical && qty <= threshold;

          let statusText = 'STOCKED';
          let statusBg = PALETTE.stockedFill;
          let statusFg = PALETTE.stockedText;

          if (isCritical) {
            statusText = 'OUT OF STOCK';
            statusBg = PALETTE.outFill;
            statusFg = PALETTE.outText;
          } else if (isLow) {
            statusText = 'LOW STOCK';
            statusBg = PALETTE.lowFill;
            statusFg = PALETTE.lowText;
          }

          const safetyTag = (cat === 'Chemicals' || cat === 'PPE') ? 'RESTRICTED / SAFETY' : 'GENERAL CAMPUS';
          const zebraBg = itemIdx % 2 === 1 ? PALETTE.slateLight : PALETTE.white;

          // Resolve who touched it last and when
          const history = getItemUserStack(item);
          const latestAction = history[0];
          let lastActionString = 'No recorded draws';
          if (latestAction) {
            const verb = latestAction.action === 'added' ? 'Added by' : latestAction.action === 'restocked' ? 'Restocked by' : 'Drawn by';
            const sign = latestAction.action === 'checkout' ? '-' : '+';
            lastActionString = `${verb} ${latestAction.userName} (${sign}${latestAction.amount} ${item.unit || 'pcs'}) • ${latestAction.relativeTime}`;
          }

          rows.push([
            cat,
            item.name,
            qty,
            item.unit || 'pcs',
            threshold,
            statusText,
            safetyTag,
            lastActionString
          ]);

          // Category
          setCellStyle(currentRow, 0, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 10, color: { rgb: '475569' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Item Name
          setCellStyle(currentRow, 1, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
            alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
            border: thinBorder
          });

          // Current Stock
          setCellStyle(currentRow, 2, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Unit
          setCellStyle(currentRow, 3, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 9, color: { rgb: '64748B' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Threshold
          setCellStyle(currentRow, 4, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 9, color: { rgb: '64748B' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Stock Status Pill
          setCellStyle(currentRow, 5, {
            fill: { fgColor: { rgb: statusBg } },
            font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: statusFg } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Safety Classification
          setCellStyle(currentRow, 6, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { 
              name: 'Calibri', 
              sz: 9, 
              bold: cat === 'Chemicals' || cat === 'PPE', 
              color: { rgb: cat === 'Chemicals' ? 'B45309' : cat === 'PPE' ? '7E22CE' : '64748B' } 
            },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: thinBorder
          });

          // Last Action / Personnel Details
          setCellStyle(currentRow, 7, {
            fill: { fgColor: { rgb: zebraBg } },
            font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '475569' } },
            alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
            border: thinBorder
          });

          currentRow++;
        });

        // Blank spacer between shelves
        rows.push(['', '', '', '', '', '', '', '']);
        currentRow++;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);

      ws['!merges'] = merges;
      ws['!cols'] = [
        { wch: 18 }, // Category
        { wch: 34 }, // Item Name
        { wch: 15 }, // Current Stock
        { wch: 12 }, // Unit
        { wch: 15 }, // Min Threshold
        { wch: 18 }, // Stock Status
        { wch: 24 }, // Safety Classification
        { wch: 44 }  // Last Action / Personnel
      ];

      ws['!rows'] = [
        { hpt: 28 }, // Title
        { hpt: 18 }, // Meta
        { hpt: 8  }, // Spacer
        { hpt: 24 }  // Header
      ];

      Object.keys(cellStyles).forEach((cellKey) => {
        if (ws[cellKey]) {
          ws[cellKey].s = cellStyles[cellKey];
        }
      });

      XLSX.utils.book_append_sheet(wb, ws, 'Campus Supplies Audit');

      const fileDate = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `SJC_Campus_Supplies_Report_${fileDate}.xlsx`);
      showToast('Exported styled audit spreadsheet!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      alert('Could not export styled spreadsheet.');
    }
  };

  const filteredSupplies = useMemo(() => {
    return supplies.map(unpackSupplyItem).filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || (item.category && item.category.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [supplies, selectedCategory, searchQuery]);

  const lowStockItems = supplies.filter((s) => s.quantity <= s.threshold);

  const getItemUserStack = (item) => {
    const supplyId = item?.id;
    const recorded = usageHistory[supplyId] || item?.cloud_stack;
    if (recorded && recorded.length > 0) {
      return recorded.map((st) => ({
        ...st,
        avatar: getStaffAvatar(st.userId, st.userName) || st.avatar || '',
        relativeTime: formatRelativeTime(st.timestamp, st.time)
      }));
    }
    return [];
  };

  return (
    <div className={`p-4 pt-3 space-y-3.5 pb-28 text-slate-800 ${isPcMode ? 'max-w-5xl mx-auto' : 'max-w-md mx-auto'}`}>
      
      {/* Hidden File Input for Card Image Uploads */}
      <input 
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* Hidden File Input for New Item Modal Photo Upload */}
      <input 
        type="file"
        ref={newItemFileInputRef}
        accept="image/*"
        onChange={handleNewItemPhotoSelect}
        className="hidden"
      />

      {/* Dynamic Status-Aware Hover Aura Styles */}
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

        .supply-aura-card {
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.22s ease,
                      background-color 0.22s ease;
        }
        .supply-aura-card:hover,
        .supply-aura-card:active {
          transform: scale(1.018);
        }

        /* 🟢 HEALTHY / OPTIMAL AURA */
        .supply-aura-card.aura-healthy:hover,
        .supply-aura-card.aura-healthy:active {
          box-shadow: 0 0 24px rgba(23, 110, 87, 0.22), 0 4px 14px rgba(0, 0, 0, 0.04);
          border-color: rgba(52, 211, 153, 0.9) !important;
        }

        /* 🟡 MILD WARNING / RUNNING LOW AURA */
        .supply-aura-card.aura-warning:hover,
        .supply-aura-card.aura-warning:active {
          box-shadow: 0 0 24px rgba(245, 158, 11, 0.26), 0 4px 14px rgba(0, 0, 0, 0.04);
          border-color: rgba(251, 191, 36, 0.95) !important;
        }

        /* 🔴 CRITICAL / LOW STOCK AURA */
        .supply-aura-card.aura-critical:hover,
        .supply-aura-card.aura-critical:active {
          box-shadow: 0 0 24px rgba(244, 63, 94, 0.26), 0 4px 14px rgba(0, 0, 0, 0.04);
          border-color: rgba(251, 113, 133, 0.95) !important;
        }
      `}</style>

      {/* Toast Alert */}
      {toastMessage && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-20 inset-x-0 z-[250] max-w-sm mx-auto px-4 pointer-events-none animate-toast select-none">
          <div className={`pointer-events-auto p-3.5 backdrop-blur-sm border text-xs font-semibold rounded-3xl flex items-center gap-2.5 shadow-xl ${
            toastType === 'error'
              ? 'bg-rose-50/95 border-rose-300 text-rose-800'
              : 'bg-emerald-50/95 border-emerald-300 text-emerald-800'
          }`}>
            {toastType === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            )}
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
            {supplies.length} items recorded &bull; {isPcMode ? 'Landscape View (Drag & Drop Active)' : 'Campus Inventory'}
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

      {/* Search Input Bar + Add Item Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white rounded-2xl text-xs font-bold transition shadow-xs flex-shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Item</span>
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

      {/* Supplies Grid */}
      <div 
        key={`${selectedCategory}_${isPcMode ? 'pc' : 'mobile'}_${searchQuery}`}
        className={
          isPcMode 
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4 pt-1' 
            : 'space-y-3 pt-1'
        }
      >
        {filteredSupplies.map((item, index) => {
          const qty = Number(item.quantity) || 0;
          const threshold = Number(item.threshold) || 1;

          const isCritical = qty <= threshold;
          const isWarning = !isCritical && qty <= Math.ceil(threshold * 1.5);
          
          const auraClass = isCritical 
            ? 'aura-critical' 
            : isWarning 
            ? 'aura-warning' 
            : 'aura-healthy';

          const borderBaseClass = isCritical 
            ? 'border-rose-200 ring-1 ring-rose-200/70 bg-rose-50/15' 
            : isWarning 
            ? 'border-amber-200 ring-1 ring-amber-200/60 bg-amber-50/10' 
            : 'border-slate-100 bg-white';

          const itemImg = supplyPhotos[item.id] || item.image_url || item.image;
          const stackUsers = getItemUserStack(item);
          const isDraggingOverThis = dragOverTargetId === item.id;
          const latestLog = stackUsers[0];

          return (
            <div
              key={item.id}
              onClick={() => {
                setActiveEnlargedItem(item);
                setEditNameInput(item.name);
                setIsEditingName(false);
              }}
              onDragOver={(e) => {
                if (isPcMode && isAdmin) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverTargetId !== item.id) setDragOverTargetId(item.id);
                }
              }}
              onDragLeave={(e) => {
                if (isPcMode && isAdmin) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setDragOverTargetId(null);
                  }
                }
              }}
              onDrop={(e) => handleDropOnItem(e, item.id)}
              style={{
                animationDelay: !animationsDisabled ? `${Math.min(index * 35, 350)}ms` : '0ms'
              }}
              className={`rounded-3xl p-4 border shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex items-center justify-between gap-3.5 cursor-pointer select-none supply-aura-card relative overflow-hidden ${auraClass} ${borderBaseClass} ${
                !animationsDisabled ? 'anim-ios-notification' : ''
              } ${isDraggingOverThis ? 'ring-2 ring-[#176e57] border-[#176e57] scale-[1.02]' : ''}`}
            >
              {isDraggingOverThis && (
                <div className="absolute inset-0 z-40 bg-emerald-950/20 backdrop-blur-[2px] border-2 border-dashed border-[#176e57] rounded-3xl flex flex-col items-center justify-center p-3 animate-pop pointer-events-none">
                  <div className="bg-white/95 px-3 py-1.5 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-300">
                    <UploadCloud className="w-4 h-4 text-[#176e57] animate-bounce" />
                    <span className="text-xs font-bold text-[#176e57]">
                      Drop image to update picture
                    </span>
                  </div>
                </div>
              )}

              {/* Left Section */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div 
                      className="relative inline-block"
                      onMouseEnter={() => handleMouseEnterItem(item.id)}
                      onMouseLeave={handleMouseLeaveItem}
                    >
                      <h3 className="font-extrabold text-slate-900 text-sm truncate max-w-[180px] sm:max-w-[240px] block" title={item.name}>
                        {item.name}
                      </h3>

                      {hoveredFullNameId === item.id && (
                        <div className="absolute left-0 bottom-full mb-2 z-50 bg-slate-900/95 backdrop-blur-xs text-white text-xs font-bold py-1.5 px-3 rounded-2xl shadow-2xl border border-slate-700 whitespace-nowrap animate-pop pointer-events-none">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{item.name}</span>
                          </div>
                          <div className="absolute left-5 top-full w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
                        </div>
                      )}
                    </div>

                    {item.category && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-lg flex-shrink-0">
                        {item.category}
                      </span>
                    )}

                    {isCritical && (
                      <span className="text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse flex-shrink-0">
                        {qty === 0 ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    )}

                    {isWarning && (
                      <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                        Running Low
                      </span>
                    )}
                  </div>

                  {/* Stock Count & Live Action Badge */}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <p className="text-xs font-extrabold text-slate-700 font-sans">
                      {item.quantity} <span className="font-normal text-slate-400">{item.unit}</span>
                    </p>

                    <div className="flex items-center gap-1.5">
                      {stackUsers.length > 0 && (
                        <div className="flex items-center -space-x-1.5">
                          {stackUsers.slice(0, 3).map((st, sIdx) => {
                            const pfp = st.avatar || getStaffAvatar(st.userId, st.userName);
                            const actionLabel = st.action === 'added' ? 'added to storage' : st.action === 'restocked' ? 'replenished' : 'checked out';
                            return (
                              <div
                                key={sIdx}
                                title={`${st.userName} ${actionLabel} &bull; ${st.relativeTime}`}
                                className={`w-6 h-6 rounded-full ring-2 ring-white text-white flex items-center justify-center font-bold text-[9px] overflow-hidden flex-shrink-0 ${
                                  st.action === 'added' ? 'bg-sky-600' : st.action === 'restocked' ? 'bg-emerald-600' : 'bg-[#176e57]'
                                }`}
                              >
                                {pfp ? (
                                  <img src={pfp} alt={st.userName} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{st.userName?.[0] || 'S'}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <span className="text-[10px] text-slate-400 font-medium">
                        {latestLog ? (
                          latestLog.action === 'added' 
                            ? `Added by ${latestLog.userName} • ${latestLog.relativeTime}`
                            : latestLog.action === 'restocked'
                            ? `Restocked by ${latestLog.userName} • ${latestLog.relativeTime}`
                            : `Taken by ${latestLog.userName} • ${latestLog.relativeTime}`
                        ) : 'No recorded draws'}
                      </span>
                    </div>
                  </div>

                  {/* Stepper Controls Row */}
                  <div className="flex items-center gap-2 mt-2.5">
                    <div className="flex items-center gap-1.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={(e) => handleOpenDeductModal(item, e)}
                        title="Check out units"
                        className="w-7 h-7 rounded-xl bg-white hover:bg-slate-100 active:scale-90 text-slate-700 border border-slate-200/60 shadow-2xs flex items-center justify-center transition"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.2]" />
                      </button>

                      <span className="font-mono font-bold text-xs px-1.5 min-w-[24px] text-center text-slate-800">
                        {item.quantity}
                      </span>

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
                        onClick={(e) => promptDeleteSupply(item.id, item.name, e)}
                        className="text-slate-400 hover:text-rose-600 active:scale-90 transition p-1.5 hover:bg-rose-50 rounded-xl"
                        title="Delete supply"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Slot */}
              <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0">
                <div 
                  onClick={(e) => triggerUpload(e, item.id)}
                  title={isAdmin ? "Tap or drop image from Google / desktop" : "Item photo"}
                  className={`w-16 h-16 rounded-2xl border flex items-center justify-center overflow-hidden transition-all duration-200 relative group/square flex-shrink-0 ${
                    itemImg 
                      ? 'border-slate-200/80 bg-white shadow-2xs ring-1 ring-black/[0.02]' 
                      : 'border-dashed border-slate-300/80 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-100/70'
                  } ${isAdmin ? 'active:scale-95 cursor-pointer' : 'cursor-default'}`}
                >
                  {itemImg ? (
                    <img 
                      src={itemImg} 
                      alt={item.name} 
                      className="w-full h-full object-cover p-0.5 rounded-2xl" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 group-hover/square:text-[#176e57] transition">
                      <Camera className="w-4 h-4" />
                      <span className="text-[8px] font-bold uppercase mt-0.5">
                        {isAdmin ? 'Photo' : 'Item'}
                      </span>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/square:opacity-100 flex items-center justify-center transition rounded-2xl">
                      {isUploadingPhoto && uploadTargetIdRef.current === item.id ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4 text-white" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSupplies.length === 0 && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center space-y-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-600">No supplies found</p>
          <p className="text-[10px] text-slate-400">Try searching with another item name or category</p>
        </div>
      )}

      {/* Add New Item Modal */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[220] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-sheet-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-[#176e57] rounded-xl">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Add New Supply Item
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Will be registered under {user?.name || 'Administrator'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplyItem} className="space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Item Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Mop Heads, Disinfectant"
                    className="w-full p-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1 text-center">
                    Photo:
                  </label>
                  <div
                    onClick={() => newItemFileInputRef.current?.click()}
                    title="Upload item photo"
                    className="w-11 h-11 rounded-2xl border border-dashed border-slate-300 hover:border-[#176e57] bg-white flex items-center justify-center cursor-pointer overflow-hidden transition active:scale-95"
                  >
                    {newItemPhoto ? (
                      <img src={newItemPhoto} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Category:
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-2xl bg-slate-50 font-semibold focus:outline-none focus:border-[#176e57]"
                  >
                    <option value="Paper & Printing">Paper & Printing</option>
                    <option value="Chemicals">Chemicals</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Disposables">Disposables</option>
                    <option value="Hygiene">Hygiene</option>
                    <option value="PPE">PPE</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Unit Type:
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="pcs, bottles, rolls"
                    className="w-full p-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Initial Quantity:
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder="10"
                    className="w-full p-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Low Stock Alert:
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItemThreshold}
                    onChange={(e) => setNewItemThreshold(e.target.value)}
                    placeholder="5"
                    className="w-full p-2.5 border border-slate-200 rounded-2xl bg-slate-50 focus:outline-none focus:border-[#176e57]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-2xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingSupply || !newItemName.trim()}
                  className="flex-1 py-2.5 bg-[#176e57] hover:bg-[#135c49] active:scale-95 text-white font-bold rounded-2xl transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingSupply ? 'Saving...' : 'Add to Storage'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Enlarged Item Modal (Timeline with Explicit Events) */}
      {activeEnlargedItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => {
            setActiveEnlargedItem(null);
            setIsEditingName(false);
          }}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-pop overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5 gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                    {activeEnlargedItem.category || 'General'}
                  </span>

                  {activeEnlargedItem.quantity <= 0 ? (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rose-600" /> Out of Stock
                    </span>
                  ) : activeEnlargedItem.quantity <= activeEnlargedItem.threshold ? (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-rose-600" /> Restock Alert
                    </span>
                  ) : activeEnlargedItem.quantity <= Math.ceil(activeEnlargedItem.threshold * 1.5) ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" /> Running Low
                    </span>
                  ) : null}
                </div>

                {isEditingName ? (
                  <form onSubmit={handleSaveSupplyName} className="flex items-center gap-1.5 mt-2">
                    <input
                      type="text"
                      autoFocus
                      required
                      value={editNameInput}
                      onChange={(e) => setEditNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                      className="text-sm font-extrabold text-slate-900 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#176e57] flex-1"
                    />
                    <button
                      type="submit"
                      disabled={isSavingName || !editNameInput.trim()}
                      title="Save name"
                      className="p-1.5 bg-[#176e57] hover:bg-[#135c49] text-white rounded-xl active:scale-95 transition"
                    >
                      {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingName}
                      onClick={() => setIsEditingName(false)}
                      title="Cancel"
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl active:scale-95 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 mt-1.5 group/title">
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug break-words">
                      {activeEnlargedItem.name}
                    </h3>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditNameInput(activeEnlargedItem.name);
                          setIsEditingName(true);
                        }}
                        title="Edit supply name"
                        className="p-1 text-slate-400 hover:text-[#176e57] hover:bg-emerald-50 rounded-lg transition active:scale-90"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div 
                  onClick={(e) => triggerUpload(e, activeEnlargedItem.id)}
                  onDragOver={(e) => {
                    if (isPcMode && isAdmin) {
                      e.preventDefault();
                      setIsModalDragOver(true);
                    }
                  }}
                  onDragLeave={() => setIsModalDragOver(false)}
                  onDrop={(e) => handleDropOnItem(e, activeEnlargedItem.id)}
                  title={isAdmin ? "Tap or drag image from Google here" : "Item picture"}
                  className={`w-16 h-16 rounded-2xl border flex items-center justify-center overflow-hidden transition-all duration-200 relative group/modal-square ${
                    isModalDragOver
                      ? 'border-[#176e57] ring-4 ring-emerald-400/30 bg-emerald-50 scale-105'
                      : supplyPhotos[activeEnlargedItem.id] || activeEnlargedItem.image_url || activeEnlargedItem.image
                      ? 'border-slate-200/90 bg-white shadow-sm ring-1 ring-black/[0.03]'
                      : 'border-dashed border-slate-300 bg-slate-50 hover:border-slate-400'
                  } ${isAdmin ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  {supplyPhotos[activeEnlargedItem.id] || activeEnlargedItem.image_url || activeEnlargedItem.image ? (
                    <img 
                      src={supplyPhotos[activeEnlargedItem.id] || activeEnlargedItem.image_url || activeEnlargedItem.image} 
                      alt={activeEnlargedItem.name} 
                      className="w-full h-full object-cover p-0.5 rounded-2xl" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Camera className="w-5 h-5" />
                      <span className="text-[8px] font-bold uppercase mt-0.5">Photo</span>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/modal-square:opacity-100 flex items-center justify-center transition rounded-2xl">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveEnlargedItem(null);
                    setIsEditingName(false);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition self-start"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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

              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    activeEnlargedItem.quantity <= activeEnlargedItem.threshold 
                      ? 'bg-rose-500' 
                      : activeEnlargedItem.quantity <= Math.ceil(activeEnlargedItem.threshold * 1.5)
                      ? 'bg-amber-500'
                      : 'bg-[#176e57]'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(8, (activeEnlargedItem.quantity / Math.max(activeEnlargedItem.threshold * 3, 10)) * 100))}%`
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5 font-medium">
                <span>Critical Threshold: <strong>{activeEnlargedItem.threshold} {activeEnlargedItem.unit}</strong></span>
                <span className={
                  activeEnlargedItem.quantity <= activeEnlargedItem.threshold 
                    ? 'text-rose-600 font-bold' 
                    : activeEnlargedItem.quantity <= Math.ceil(activeEnlargedItem.threshold * 1.5)
                    ? 'Running Low'
                    : 'Optimal Capacity'}
                  >
                  {activeEnlargedItem.quantity <= activeEnlargedItem.threshold 
                    ? 'Critical Deficit' 
                    : activeEnlargedItem.quantity <= Math.ceil(activeEnlargedItem.threshold * 1.5)
                    ? 'Running Low'
                    : 'Optimal Capacity'}
                </span>
              </div>
            </div>

            {/* Requisition Timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#176e57]" />
                  Requisition & Adjustment History
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">
                  Audited Log
                </span>
              </div>

              <div className="p-3 bg-white border border-slate-200/80 rounded-2xl space-y-2 shadow-2xs">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {getItemUserStack(activeEnlargedItem).length > 0 ? (
                    getItemUserStack(activeEnlargedItem).map((log, lIdx) => {
                      const pfp = log.avatar || getStaffAvatar(log.userId, log.userName);
                      const isAdded = log.action === 'added';
                      const isRestocked = log.action === 'restocked';

                      return (
                        <div key={lIdx} className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-[9px] overflow-hidden flex-shrink-0 ${
                              isAdded ? 'bg-sky-600' : isRestocked ? 'bg-emerald-600' : 'bg-[#176e57]'
                            }`}>
                              {pfp ? (
                                <img src={pfp} alt={log.userName} className="w-full h-full object-cover" />
                              ) : (
                                <span>{log.userName?.[0] || 'S'}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 block truncate leading-tight">
                                {log.userName}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{log.relativeTime}</span>
                              </span>
                            </div>
                          </div>

                          {isAdded ? (
                            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 flex-shrink-0">
                              Registered (+{log.amount} {activeEnlargedItem.unit})
                            </span>
                          ) : isRestocked ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex-shrink-0">
                              Restocked (+{log.amount} {activeEnlargedItem.unit})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex-shrink-0">
                              Drawn (-{log.amount} {activeEnlargedItem.unit})
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-slate-400 space-y-1">
                      <p className="text-xs font-semibold">No activity recorded yet</p>
                      <p className="text-[10px]">When units are added, taken, or replenished, they will appear here.</p>
                    </div>
                  )}
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

      {/* Staff Requisition Deduction Modal */}
      {deductModalItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop select-none"
          onClick={() => setDeductModalItem(null)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-sheet-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
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

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/70 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Accountable Personnel:</span>
                <strong className="text-slate-800 font-semibold">
                  {user?.name || 'Staff Member'}
                </strong>
              </div>

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

      {/* In-App Delete Confirmation Modal */}
      {itemToDelete && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[300] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-backdrop text-slate-800 select-none"
          onClick={() => !isDeletingSupply && setItemToDelete(null)}
        >
          <div 
            className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3.5 animate-pop text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center animate-pop">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                Delete "{itemToDelete.name}"?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove this supply item from campus inventory?
              </p>
            </div>

            <p className="text-[10px] text-slate-400">
              This action cannot be undone and will permanently remove its recorded records.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingSupply}
                onClick={() => setItemToDelete(null)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingSupply}
                onClick={handleConfirmDeleteSupply}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingSupply ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}