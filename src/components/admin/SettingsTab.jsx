import { useState, useEffect, useRef } from 'react';
import { useModal } from '../common/ModalProvider';
import { doc, setDoc } from 'firebase/firestore';
import { dbMotos } from '../../firebase';
import { fileToBase64 } from '../../utils/imageUtils';
import { asArray } from '../../utils/dataNormalizer';

// Preset color options for Dashboard Customizer
const COLOR_PRESETS = [
  { name: 'Angkor Terracotta', hex: '#c0622b', label: 'Terracotta (Original)' },
  { name: 'Classic Blue',      hex: '#2563eb', label: 'Blue (សមុទ្រ)' },
  { name: 'Vibrant Cyan',      hex: '#06b6d4', label: 'Cyan (ផ្ទៃមេឃ)' },
  { name: 'Emerald Green',     hex: '#10b981', label: 'Green (បៃតង)' },
  { name: 'Sunset Orange',     hex: '#f97316', label: 'Orange (ទឹកក្រូច)' },
  { name: 'Rose Pink',         hex: '#ec4899', label: 'Pink (ផ្កាឈូក)' },
  { name: 'Royal Purple',      hex: '#8b5cf6', label: 'Purple (ស្វាយ)' },
  { name: 'Ruby Red',          hex: '#ef4444', label: 'Red (ក្រហម)' },
  { name: 'Electric Indigo',   hex: '#6366f1', label: 'Indigo (ទឹកប៊ិច)' },
  { name: 'Slate Dark',        hex: '#334155', label: 'Slate (ប្រផេះចាស់)' },
];

export default function SettingsTab({
  settings = {},
  setSettings,
  saveSettings,
  settingsSaved,
  staff = [],
  setStaff,
  auditLogs = [],
  setAuditLogs,
  auth,
  authPost,
  authPatch,
  authDelete,
  fetchAll,
  testResult,
  setTestResult,
  inputCls = 'w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all',
  labelCls = 'block text-xs font-bold text-stone-600 mb-1 uppercase tracking-wider',
  cardCls = 'bg-white rounded-2xl border border-stone-200 shadow-xs',
  btnPrimary = 'bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all',
  btnSecondary = 'bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-4 py-2 rounded-xl text-sm transition-all',
  btnDanger = 'bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all',
  statusBadge = {},
  currency = (v) => `$${parseFloat(v || 0).toFixed(2)}`,
  rentals = [],
  bookings = [],
  invoices = [],
  bikes = [],
  rooms = [],
  guests = []
}) {
  const { showModal, showConfirm } = useModal();
  const [activeSubTab, setActiveSubTab] = useState('shop_system');

  // Staff modal state
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ username: '', password: '', fullName: '', role: 'receptionist', permissions: 'bookings,rooms,rentals,invoices,guests', phone: '', status: 'active' });
  const [staffSearch, setStaffSearch] = useState('');

  // Audit log filter state
  const [auditSearch, setAuditSearch] = useState('');

  // Backup & Restore State
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Template active tab
  const [activeTemplateType, setActiveTemplateType] = useState('rental');
  const [testingTemplate, setTestingTemplate] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState(null);
  const templateTextareaRef = useRef(null);

  // Password visibility for Telegram Token
  const [showTgToken, setShowTgToken] = useState(false);

  // Save in progress indicator
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Extract / Default configuration objects
  const bProfile = settings.business_profile || {};
  const shopSet = settings.shop_settings || {};
  const themeSet = settings.theme_settings || {};
  const tgSet = settings.telegram_settings || {};
  const notifSet = settings.notification_settings || {};
  const pTax = settings.pricing_tax || {};
  const pMethods = settings.payment_methods || {};
  const invSettings = settings.invoice_settings || {};
  const secSettings = settings.security_settings || {};

  // Current values with robust fallbacks
  const currentShopName = shopSet.shopName || bProfile.hotelName || 'Motorental Siemreab Angkor';
  const currentLogo = shopSet.logo || bProfile.logo || '/assets/logo.png';
  const currentRentalHours = shopSet.rentalHoursPerDay ?? 12;
  const currentOpenHours = shopSet.operatingHoursOpen || '06:00 AM';
  const currentCloseHours = shopSet.operatingHoursClose || '10:00 PM';
  const currentDepositDocs = shopSet.depositDocTypes || "National ID, Passport, Driver's License, Birth Certificate, None";

  // Theme color state
  const currentThemeColor = themeSet.primaryColor || '#c0622b';
  const currentPresetName = themeSet.presetName || 'Angkor Terracotta';

  // Telegram settings
  const currentTgToken = tgSet.botToken || settings.telegram_token || '';
  const currentTgChatId = tgSet.chatId || settings.telegram_chat_id || '';
  const currentRentalTemplate = tgSet.rentalAlertTemplate || tgSet.checkoutAlertTemplate || '🛵 <b>[ការចេញដំណើរ / CHECK-OUT ALERT]</b>\n\n👤 អតិថិជន: <b>{customer_name}</b>\n📞 ទូរស័ព្ទ: {phone}\n🏍️ យានយន្ត/បន្ទប់: <b>{bike_model}</b> ({plate_number})\n📅 កាលបរិច្ឆេទ: {start_date} ដល់ {end_date}\n💰 តម្លៃសរុប: ${total_amount} | ប្រាក់កក់: ${deposit}\n💳 បង់ប្រាក់: {payment_method}\n👨‍💼 បុគ្គលិក: {staff_name}\n🕒 ម៉ោង: {time}';
  const currentReturnTemplate = tgSet.returnAlertTemplate || tgSet.checkinAlertTemplate || '🏁 <b>[ការប្រគល់ត្រឡប់ / CHECK-IN & RETURN ALERT]</b>\n\n👤 អតិថិជន: <b>{customer_name}</b>\n🏍️ យានយន្ត/បន្ទប់: <b>{bike_model}</b> ({plate_number})\n📅 ថ្ងៃត្រឡប់: {return_date}\n💵 ថ្លៃយឺត: ${late_fee} | ថ្លៃខូចខាត: ${damage_fee}\n✅ ប្រាក់តម្កល់បានប្រគល់: ${deposit_returned}\n👨‍💼 បុគ្គលិកទទួល: {staff_name}\n🕒 ម៉ោង: {time}';
  const currentBookingTemplate = tgSet.bookingAlertTemplate || '🔔 <b>[ការកក់ថ្មី / NEW BOOKING ALERT]</b>\n\n🔖 លេខកក់: <code>{booking_ref}</code>\n🏷️ ប្រភេទ: <b>{type}</b>\n📌 ព័ត៌មាន: <b>{item_name}</b>\n👤 អតិថិជន: <b>{customer_name}</b>\n📞 ទូរស័ព្ទ: {phone}\n📅 កាលបរិច្ឆេទ: {start_date} ដល់ {end_date}\n💰 តម្លៃប៉ាន់ស្មាន: ${total_amount}\n🕒 ម៉ោង: {time}';
  const currentRevenueTemplate = tgSet.revenueAlertTemplate || '💰 <b>[ចំណូលទទួលបាន / Payment Received]</b>\n\nវិក្កយបត្រ: #{invoice_id}\nអតិថិជន: {customer_name}\nចំនួនទឹកប្រាក់: ${amount}\nវិធីទូទាត់: {payment_method}\n🕒 ម៉ោង: {time}';

  // Apply theme color dynamically to document styles
  const applyThemeColor = (hex, presetName = 'Custom') => {
    try {
      document.documentElement.style.setProperty('--brand-500', hex);
      document.documentElement.style.setProperty('--color-brand-500', hex);
      document.documentElement.style.setProperty('--brand-primary', hex);
      localStorage.setItem('admin_theme_color', hex);

      // Inject or update dynamic style tag for instant UI accents
      let styleTag = document.getElementById('dynamic-admin-theme-css');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-admin-theme-css';
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
        :root { --theme-primary-color: ${hex}; }
        .theme-accent-bg { background-color: ${hex} !important; }
        .theme-accent-text { color: ${hex} !important; }
        .theme-accent-border { border-color: ${hex} !important; }
      `;
    } catch (e) {
      console.warn('Theme apply error:', e);
    }
  };

  // Sync theme on initial render
  useEffect(() => {
    if (themeSet.primaryColor) {
      applyThemeColor(themeSet.primaryColor, themeSet.presetName);
    }
  }, [themeSet.primaryColor]);

  // Handler for color preset selection
  const handleSelectPreset = (preset) => {
    applyThemeColor(preset.hex, preset.name);
    setSettings(prev => ({
      ...prev,
      theme_settings: {
        ...(prev.theme_settings || {}),
        presetName: preset.name,
        primaryColor: preset.hex
      }
    }));
  };

  // Handler for custom color hex input
  const handleCustomHexChange = (hex) => {
    applyThemeColor(hex, 'Custom Hex');
    setSettings(prev => ({
      ...prev,
      theme_settings: {
        ...(prev.theme_settings || {}),
        presetName: 'Custom Hex',
        primaryColor: hex
      }
    }));
  };

  // Insert tag into Telegram template at cursor position
  const handleInsertTag = (tag) => {
    let currentText = '';
    let updateField = '';
    if (activeTemplateType === 'rental' || activeTemplateType === 'checkout') {
      currentText = currentRentalTemplate;
      updateField = 'rentalAlertTemplate';
    } else if (activeTemplateType === 'return' || activeTemplateType === 'checkin') {
      currentText = currentReturnTemplate;
      updateField = 'returnAlertTemplate';
    } else if (activeTemplateType === 'booking') {
      currentText = currentBookingTemplate;
      updateField = 'bookingAlertTemplate';
    } else {
      currentText = currentRevenueTemplate;
      updateField = 'revenueAlertTemplate';
    }

    const textarea = templateTextareaRef.current;
    let newText = '';
    if (textarea) {
      const start = textarea.selectionStart ?? currentText.length;
      const end = textarea.selectionEnd ?? currentText.length;
      newText = currentText.substring(0, start) + tag + currentText.substring(end);
    } else {
      newText = currentText + ' ' + tag;
    }

    setSettings(prev => ({
      ...prev,
      telegram_settings: {
        ...(prev.telegram_settings || {}),
        [updateField]: newText,
        ...(updateField === 'rentalAlertTemplate' ? { checkoutAlertTemplate: newText } : {}),
        ...(updateField === 'returnAlertTemplate' ? { checkinAlertTemplate: newText } : {})
      }
    }));
  };

  // Test current template directly on Telegram
  const handleTestCurrentTemplate = async () => {
    setTestingTemplate(true);
    setTestResultMsg(null);
    try {
      const activeTemplate =
        (activeTemplateType === 'rental' || activeTemplateType === 'checkout')
          ? currentRentalTemplate
          : (activeTemplateType === 'return' || activeTemplateType === 'checkin')
          ? currentReturnTemplate
          : activeTemplateType === 'booking'
          ? currentBookingTemplate
          : currentRevenueTemplate;

      const res = await fetch('/api/telegram/test-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
        body: JSON.stringify({
          type: activeTemplateType,
          template: activeTemplate
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestResultMsg({ type: 'success', text: 'Telegram alert preview successfully delivered to your channel/group!' });
      } else {
        setTestResultMsg({ type: 'error', text: data.error || 'Failed to send alert. Check Bot Token & Chat ID.' });
      }
    } catch (e) {
      setTestResultMsg({ type: 'error', text: e.message });
    } finally {
      setTestingTemplate(false);
      setTimeout(() => setTestResultMsg(null), 6000);
    }
  };

  // Comprehensive Save All Handler
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
      const payloadToSend = {
        ...settings,
        // Guarantee synchronization of shop settings
        shop_settings: {
          shopName: currentShopName,
          logo: currentLogo,
          rentalHoursPerDay: Number(currentRentalHours),
          operatingHoursOpen: currentOpenHours,
          operatingHoursClose: currentCloseHours,
          depositDocTypes: currentDepositDocs
        },
        business_profile: {
          ...(settings.business_profile || {}),
          hotelName: currentShopName,
          logo: currentLogo
        },
        invoice_settings: {
          ...(settings.invoice_settings || {}),
          companyHeader: currentShopName
        },
        theme_settings: {
          presetName: currentPresetName,
          primaryColor: currentThemeColor
        },
        telegram_token: currentTgToken,
        telegram_chat_id: currentTgChatId,
        telegram_settings: {
          botToken: currentTgToken,
          chatId: currentTgChatId,
          checkoutAlertEnabled: tgSet.checkoutAlertEnabled !== false,
          checkinAlertEnabled: tgSet.checkinAlertEnabled !== false,
          bookingAlertEnabled: tgSet.bookingAlertEnabled !== false,
          rentalAlertTemplate: currentRentalTemplate,
          checkoutAlertTemplate: currentRentalTemplate,
          returnAlertTemplate: currentReturnTemplate,
          checkinAlertTemplate: currentReturnTemplate,
          bookingAlertTemplate: currentBookingTemplate,
          revenueAlertTemplate: currentRevenueTemplate
        },
        notification_settings: {
          ...(settings.notification_settings || {}),
          emailNotificationEnabled: notifSet.emailNotificationEnabled ?? false,
          recipientEmail: notifSet.recipientEmail || 'yourshop@email.com',
          returnReminderEnabled: notifSet.returnReminderEnabled ?? true,
          returnReminderLeadDays: Number(notifSet.returnReminderLeadDays ?? 1),
          maintenanceReminderEnabled: notifSet.maintenanceReminderEnabled ?? true,
          maintenanceReminderInterval: Number(notifSet.maintenanceReminderInterval ?? 15)
        }
      };

      // Ultra-fast save
      await saveSettings(payloadToSend);
    } catch (err) {
      showModal('error', 'បរាជ័យ (Error)', err.message || 'Failed to save settings');
    } finally {
      setIsSavingAll(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════
  // BACKUP & RESTORE HANDLERS
  // ═════════════════════════════════════════════════════════════════════

  // Download JSON Backup
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      let dumpData = null;
      // Try server endpoint first
      try {
        const res = await fetch('/api/backup', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        if (res.ok) {
          dumpData = await res.json();
        }
      } catch (ignore) {}

      // If server returned dump, download it; otherwise compile client-state dump
      if (!dumpData) {
        dumpData = {
          exportedAt: new Date().toISOString(),
          system: "Siem Reap Angkor PMS & Motorental",
          version: "2.5",
          data: {
            bikes,
            rooms,
            bookings,
            rentals,
            invoices,
            guests,
            settings,
            staff,
            auditLogs
          }
        };
      }

      const blob = new Blob([JSON.stringify(dumpData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `motorental-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showModal('error', 'Backup Failed', err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  // Export CSV: Rental History
  const handleExportHistoryCSV = () => {
    try {
      const records = rentals.length > 0 ? rentals : [];
      const headers = [
        'Rental ID',
        'Customer Name',
        'Phone Number',
        'Motorbike Model',
        'Plate Number',
        'Start Date',
        'End Date',
        'Daily Rate ($)',
        'Total Fee ($)',
        'Deposit Doc / Cash',
        'Status',
        'Created At',
        'Notes'
      ];

      const csvRows = [headers.join(',')];

      records.forEach(r => {
        const row = [
          `"${(r.id || '').replace(/"/g, '""')}"`,
          `"${(r.customerName || r.guestName || '').replace(/"/g, '""')}"`,
          `"${(r.phone || r.customerPhone || '').replace(/"/g, '""')}"`,
          `"${(r.bikeModel || r.model || '').replace(/"/g, '""')}"`,
          `"${(r.plateNumber || r.plate || '').replace(/"/g, '""')}"`,
          `"${(r.startDate || '').replace(/"/g, '""')}"`,
          `"${(r.endDate || '').replace(/"/g, '""')}"`,
          `"${(r.dailyRate || 0)}"`,
          `"${(r.totalPrice || r.totalFee || r.total || 0)}"`,
          `"${(r.deposit || r.depositDoc || '').replace(/"/g, '""')}"`,
          `"${(r.status || '').replace(/"/g, '""')}"`,
          `"${(r.createdAt || '').replace(/"/g, '""')}"`,
          `"${(r.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel UTF-8
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rental_history_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showModal('error', 'Export CSV Failed', err.message);
    }
  };

  // Export CSV: Income & Revenue
  const handleExportIncomeCSV = () => {
    try {
      const records = invoices.length > 0 ? invoices : rentals.filter(r => (r.totalPrice || r.totalFee || 0) > 0);
      const headers = [
        'Invoice/Receipt ID',
        'Date',
        'Category/Source',
        'Customer Name',
        'Item/Room/Vehicle',
        'Payment Method',
        'Amount ($)',
        'Status',
        'Notes'
      ];

      const csvRows = [headers.join(',')];

      records.forEach(inv => {
        const row = [
          `"${(inv.id || inv.invoiceNumber || '').replace(/"/g, '""')}"`,
          `"${(inv.date || inv.startDate || inv.createdAt || '').replace(/"/g, '""')}"`,
          `"${(inv.category || (inv.roomName ? 'Room Rental' : 'Motor Rental')).replace(/"/g, '""')}"`,
          `"${(inv.customerName || inv.guestName || '').replace(/"/g, '""')}"`,
          `"${(inv.bikeModel || inv.roomName || inv.item || '').replace(/"/g, '""')}"`,
          `"${(inv.paymentMethod || 'Cash / ABA').replace(/"/g, '""')}"`,
          `"${(inv.amount || inv.totalPrice || inv.totalFee || 0)}"`,
          `"${(inv.status || 'Paid').replace(/"/g, '""')}"`,
          `"${(inv.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `income_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showModal('error', 'Export Income CSV Failed', err.message);
    }
  };

  // Restore database from JSON backup file
  const handleRestoreBackup = async () => {
    if (!selectedBackupFile) {
      showModal('warning', 'សូមជ្រើសរើសឯកសារ', 'សូមជ្រើសរើសឯកសារ .json backup ជាមុនសិន (Please select a .json backup file).');
      return;
    }

    const confirmed = await showConfirm(
      'Restore from Backup (បញ្ចូលទិន្នន័យឡើងវិញ)',
      'តើអ្នកពិតជាចង់បញ្ចូលទិន្នន័យពីឯកសារ Backup នេះមែនទេ? ទិន្នន័យនឹងត្រូវ Merge ចូលទៅក្នុង Cloud Firestore និងមូលដ្ឋានទិន្នន័យប្រព័ន្ធ។ (Are you sure you want to merge and restore from this backup file?)',
      'យល់ព្រមបញ្ចូល (Restore Now)',
      'danger'
    );

    if (!confirmed) return;

    setIsRestoring(true);
    setRestoreMessage('កំពុងដំណើរការបញ្ចូលទិន្នន័យ (Restoring data in progress)...');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const dataPayload = json.data || json;

        // 1. Restore local SQLite if endpoint available
        try {
          await fetch('/api/restore', authPost({ data: dataPayload }));
        } catch (apiErr) {
          console.warn('SQLite restore warning:', apiErr);
        }

        // 2. Merge into Cloud Firestore directly for active collections
        const collectionsToMerge = ['rentals', 'bikes', 'rooms', 'bookings', 'guests', 'invoices'];
        for (const coll of collectionsToMerge) {
          if (Array.isArray(dataPayload[coll])) {
            for (const item of dataPayload[coll]) {
              if (item.id) {
                try {
                  await setDoc(doc(dbMotos, coll, String(item.id)), item, { merge: true });
                } catch (ignore) {}
              }
            }
          }
        }

        // Merge settings if present
        if (dataPayload.settings) {
          try {
            await setDoc(doc(dbMotos, 'settings', 'public_settings'), dataPayload.settings, { merge: true });
          } catch (ignore) {}
        }

        setRestoreMessage('បញ្ចូលទិន្នន័យជោគជ័យ! ទិន្នន័យទាំងអស់ត្រូវបាន Merge ចូលប្រព័ន្ធដោយជោគជ័យ។ (Database restored and merged successfully!)');
        showModal('success', 'ជោគជ័យ!', 'ទិន្នន័យត្រូវបាន Restore ចូលប្រព័ន្ធដោយជោគជ័យ។');
        fetchAll();
        setSelectedBackupFile(null);
      } catch (err) {
        setRestoreMessage(`Invalid JSON or Restore Error: ${err.message}`);
        showModal('error', 'Restore Failed', err.message);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(selectedBackupFile);
  };

  // Staff handlers
  const handleOpenStaffModal = (st = null) => {
    if (st) {
      setEditingStaff(st);
      setStaffForm({ username: st.username, password: '', fullName: st.fullName, role: st.role, permissions: st.permissions || '', phone: st.phone || '', status: st.status || 'active' });
    } else {
      setEditingStaff(null);
      setStaffForm({ username: '', password: '', fullName: '', role: 'receptionist', permissions: 'bookings,rooms,rentals,invoices,guests', phone: '', status: 'active' });
    }
    setStaffModalOpen(true);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (editingStaff) {
      await fetch(`/api/staff/${editingStaff.id}`, authPatch(staffForm));
    } else {
      await fetch('/api/staff', authPost(staffForm));
    }
    setStaffModalOpen(false);
    fetchAll();
  };

  const handleDeleteStaff = async (id) => {
    if (!await showConfirm('Delete Staff', 'Are you sure you want to delete this staff account?', 'Delete', 'danger')) return;
    await fetch(`/api/staff/${id}`, authDelete());
    fetchAll();
  };

  // Navigation Sub-tabs
  const SETTING_MODULES = [
    { id: 'shop_system',   label: 'Shop & System',       khmer: 'ការកំណត់ហាង & ប្រព័ន្ធ', icon: 'fa-store', badge: 'Main' },
    { id: 'ui_theme',      label: 'UI Theme / Colors',   khmer: 'ពណ៌ UI / Theme',          icon: 'fa-palette', badge: 'Branding' },
    { id: 'telegram_bot',  label: 'Telegram Alerts',     khmer: 'Telegram Bot & Template', icon: 'fa-paper-plane', badge: 'Alerts' },
    { id: 'notifications', label: 'Reminders & Emails',  khmer: 'ការជូនដំណឹង & រំលឹក',     icon: 'fa-bell', badge: 'Auto' },
    { id: 'backup_restore',label: 'Backup & Restore',    khmer: 'ទាញយក & បញ្ចូលទិន្នន័យ',   icon: 'fa-database', badge: 'Export/Import' },
    { id: 'payments',      label: 'Payments & KHQR',     khmer: 'ការទូទាត់ & ABA QR',       icon: 'fa-credit-card' },
    { id: 'pricing',       label: 'Pricing & Taxes',     khmer: 'តម្លៃ & អត្រាប្តូរប្រាក់',   icon: 'fa-coins' },
    { id: 'staff_users',   label: 'Users & Roles',       khmer: 'គណនីបុគ្គលិក',            icon: 'fa-users-gear' },
    { id: 'website_texts', label: 'Website Texts',       khmer: 'អត្ថបទគេហទំព័រ',          icon: 'fa-language' },
    { id: 'audit_logs',    label: 'Audit Trail',         khmer: 'ប្រវត្តិសកម្មភាព',         icon: 'fa-list-check' },
  ];

  return (
    <div className="space-y-6 max-w-6xl pb-24 relative">
      {/* ── Top Header Banner ── */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100">
              <i className="fa-solid fa-sliders"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 font-display">
                ការកំណត់ប្រព័ន្ធ & ហាង (System & Store Settings)
              </h2>
              <p className="text-xs text-stone-500">
                កំណត់ព័ត៌មានហាង, ពណ៌ Theme, ប្រព័ន្ធ Telegram Alert, ការជូនដំណឹង និង Backup/Restore ទិន្នន័យ
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Save */}
        <div className="flex items-center gap-3">
          {settingsSaved && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check"></i> រក្សាទុកជោគជ័យ
            </span>
          )}
          <button
            id="btn-save-settings-top"
            onClick={handleSaveAll}
            disabled={isSavingAll}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <i className={`fa-solid ${isSavingAll ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
            <span>{isSavingAll ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការកំណត់ទាំងអស់'}</span>
          </button>
        </div>
      </div>

      {/* ── Sub-navigation Pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-stone-200/60 rounded-2xl scrollbar-none">
        {SETTING_MODULES.map(tab => (
          <button
            key={tab.id}
            id={`tab-setting-${tab.id}`}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/40'
            }`}
          >
            <i className={`fa-solid ${tab.icon} ${activeSubTab === tab.id ? 'text-blue-600' : 'text-stone-400'}`}></i>
            <div className="text-left">
              <span className="block leading-tight">{tab.khmer}</span>
              <span className="block text-[10px] opacity-70 font-normal">{tab.label}</span>
            </div>
            {tab.badge && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                activeSubTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-stone-200 text-stone-600'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 1. ការកំណត់ហាង & ប្រព័ន្ធ (Shop & System Settings) */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'shop_system' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-lg border border-orange-100">
                  <i className="fa-solid fa-store"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    ១. ការកំណត់ហាង & ប្រព័ន្ធ (Shop & System Settings)
                  </h3>
                  <p className="text-xs text-stone-500">
                    ព័ត៌មានទូទៅរបស់អាជីវកម្ម, ឈ្មោះហាងលើវិក្កយបត្រ, ឡូហ្គោ, ម៉ោងជួលប្រចាំថ្ងៃ និងឯកសារតម្កល់
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                Core Identity
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              {/* Shop Name */}
              <div className="md:col-span-2">
                <label className={labelCls}>
                  <i className="fa-solid fa-building mr-1.5 text-stone-400"></i>
                  Shop Name (ឈ្មោះហាង)
                </label>
                <input
                  id="input-shop-name"
                  type="text"
                  value={currentShopName}
                  onChange={e => {
                    const val = e.target.value;
                    setSettings(prev => ({
                      ...prev,
                      shop_settings: { ...(prev.shop_settings || {}), shopName: val },
                      business_profile: { ...(prev.business_profile || {}), hotelName: val },
                      invoice_settings: { ...(prev.invoice_settings || {}), companyHeader: val }
                    }));
                  }}
                  className={`${inputCls} font-semibold text-stone-900`}
                  placeholder="Motorental Siemreab Angkor"
                />
                <p className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1">
                  <i className="fa-solid fa-circle-info text-blue-500"></i>
                  Sets the business name shown on invoices, rental agreements, headers, and public pages.
                </p>
              </div>

              {/* Shop Logo with File Upload Support */}
              <div className="md:col-span-2 bg-stone-50/70 p-4 rounded-2xl border border-stone-200">
                <label className={labelCls}>
                  <i className="fa-solid fa-image mr-1.5 text-stone-400"></i>
                  Shop Logo (ឡូហ្គោហាង)
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mt-2">
                  <div className="relative group w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-stone-300 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                    {currentLogo ? (
                      <img src={currentLogo} alt="Shop Logo" className="w-full h-full object-contain rounded-xl" />
                    ) : (
                      <i className="fa-solid fa-motorcycle text-3xl text-stone-300"></i>
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer flex items-center gap-2 shadow-xs transition-colors">
                        <i className="fa-solid fa-arrow-up-from-bracket text-blue-600"></i>
                        ជ្រើសរើសឯកសារ (Choose Logo File)
                        <input
                          id="input-logo-file"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files[0];
                            if (f) {
                              const base64 = await fileToBase64(f, 600, 600, 0.88);
                              setSettings(prev => ({
                                ...prev,
                                shop_settings: { ...(prev.shop_settings || {}), logo: base64 },
                                business_profile: { ...(prev.business_profile || {}), logo: base64 }
                              }));
                            }
                          }}
                        />
                      </label>

                      {currentLogo && (
                        <button
                          type="button"
                          onClick={() => {
                            setSettings(prev => ({
                              ...prev,
                              shop_settings: { ...(prev.shop_settings || {}), logo: '' },
                              business_profile: { ...(prev.business_profile || {}), logo: '' }
                            }));
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-bold px-3 py-2 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                        >
                          <i className="fa-solid fa-trash-can mr-1"></i> លុប Logo (Remove)
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={typeof currentLogo === 'string' && currentLogo.startsWith('data:') ? '(Uploaded image file)' : currentLogo}
                      onChange={e => {
                        const val = e.target.value;
                        setSettings(prev => ({
                          ...prev,
                          shop_settings: { ...(prev.shop_settings || {}), logo: val },
                          business_profile: { ...(prev.business_profile || {}), logo: val }
                        }));
                      }}
                      placeholder="Or enter logo image URL (e.g. /assets/logo.png)"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Rental Hours per Day */}
              <div>
                <label className={labelCls}>
                  <i className="fa-solid fa-hourglass-half mr-1.5 text-stone-400"></i>
                  Rental Hours per Day (ម៉ោង/ថ្ងៃជួល)
                </label>
                <div className="relative">
                  <input
                    id="input-rental-hours"
                    type="number"
                    min="1"
                    max="24"
                    value={currentRentalHours}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 12;
                      setSettings(prev => ({
                        ...prev,
                        shop_settings: { ...(prev.shop_settings || {}), rentalHoursPerDay: val }
                      }));
                    }}
                    className={`${inputCls} pr-14`}
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-stone-400">ម៉ោង/ថ្ងៃ</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5">
                  Configures default daily rental calculation limits (default: 12 hours).
                </p>
              </div>

              {/* Operating Hours (Open - Close) */}
              <div>
                <label className={labelCls}>
                  <i className="fa-solid fa-clock mr-1.5 text-stone-400"></i>
                  Operating Hours (ម៉ោងបើក - បិទ)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      id="input-operating-open"
                      type="text"
                      value={currentOpenHours}
                      onChange={e => {
                        const val = e.target.value;
                        setSettings(prev => ({
                          ...prev,
                          shop_settings: { ...(prev.shop_settings || {}), operatingHoursOpen: val }
                        }));
                      }}
                      placeholder="06:00 AM"
                      className={inputCls}
                    />
                    <span className="absolute right-2.5 top-2.5 text-[10px] text-stone-400 uppercase font-bold">បើក</span>
                  </div>
                  <div className="relative">
                    <input
                      id="input-operating-close"
                      type="text"
                      value={currentCloseHours}
                      onChange={e => {
                        const val = e.target.value;
                        setSettings(prev => ({
                          ...prev,
                          shop_settings: { ...(prev.shop_settings || {}), operatingHoursClose: val }
                        }));
                      }}
                      placeholder="10:00 PM"
                      className={inputCls}
                    />
                    <span className="absolute right-2.5 top-2.5 text-[10px] text-stone-400 uppercase font-bold">បិទ</span>
                  </div>
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5">
                  Sets opening and closing times (06:00 AM – 10:00 PM) for vehicle pickup and return scheduling.
                </p>
              </div>

              {/* Deposit Document Types */}
              <div className="md:col-span-2">
                <label className={labelCls}>
                  <i className="fa-solid fa-id-card-clip mr-1.5 text-stone-400"></i>
                  Deposit Document Types (ប្រភេទឯកសារតម្កល់)
                </label>
                <input
                  id="input-deposit-docs"
                  type="text"
                  value={currentDepositDocs}
                  onChange={e => {
                    const val = e.target.value;
                    setSettings(prev => ({
                      ...prev,
                      shop_settings: { ...(prev.shop_settings || {}), depositDocTypes: val }
                    }));
                  }}
                  className={inputCls}
                  placeholder="National ID, Passport, Driver's License, Birth Certificate, None"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">Quick Add:</span>
                  {['National ID', 'Passport', "Driver's License", 'Birth Certificate', 'Cash Deposit', 'None'].map(docType => (
                    <button
                      key={docType}
                      type="button"
                      onClick={() => {
                        const currentArr = currentDepositDocs.split(',').map(s => s.trim()).filter(Boolean);
                        if (!currentArr.includes(docType)) {
                          currentArr.push(docType);
                          const newVal = currentArr.join(', ');
                          setSettings(prev => ({
                            ...prev,
                            shop_settings: { ...(prev.shop_settings || {}), depositDocTypes: newVal }
                          }));
                        }
                      }}
                      className="text-[11px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded-lg transition-colors border border-stone-200"
                    >
                      + {docType}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5">
                  Configures comma-separated acceptable customer deposits (National ID, Passport, Driver&apos;s License, Birth Certificate, None).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 2. ពណ៌ UI / Theme (Dashboard Customizer) */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'ui_theme' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg border border-purple-100">
                  <i className="fa-solid fa-palette"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    ២. ពណ៌ UI / Theme (Dashboard Customizer)
                  </h3>
                  <p className="text-xs text-stone-500">
                    ជ្រើសរើសក្ដារពណ៌ស្វ័យប្រវត្តិ (Color Presets) ឬកំណត់កូដពណ៌ផ្ទាល់ខ្លួន (Custom Hex Color)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border border-stone-300" style={{ backgroundColor: currentThemeColor }}></span>
                <span className="text-xs font-mono font-bold text-stone-700">{currentThemeColor}</span>
              </div>
            </div>

            {/* Color Presets */}
            <div className="mb-8">
              <label className={labelCls}>
                <i className="fa-solid fa-swatchbook mr-1.5 text-stone-400"></i>
                Color Presets (ជ្រើសរើសក្ដារពណ៌ដែលពេញនិយម)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 mt-3">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected = currentThemeColor.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`flex flex-col p-3 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                        isSelected
                          ? 'border-stone-900 shadow-md ring-2 ring-stone-900/10 bg-stone-50'
                          : 'border-stone-200 hover:border-stone-400 bg-white hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div
                          className="w-7 h-7 rounded-xl shadow-xs flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: preset.hex }}
                        >
                          {isSelected && <i className="fa-solid fa-check"></i>}
                        </div>
                        <span className="text-[10px] font-mono text-stone-400">{preset.hex}</span>
                      </div>
                      <span className="text-xs font-bold text-stone-900">{preset.name}</span>
                      <span className="text-[10px] text-stone-500 mt-0.5 truncate">{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Hex Color & Native Color Picker */}
            <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200">
              <label className={labelCls}>
                <i className="fa-solid fa-eye-dropper mr-1.5 text-stone-400"></i>
                Custom Hex Color (កំណត់កូដពណ៌ផ្ទាល់ខ្លួន)
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4 mt-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative">
                    <input
                      id="input-theme-native-color"
                      type="color"
                      value={currentThemeColor}
                      onChange={e => handleCustomHexChange(e.target.value)}
                      className="w-14 h-12 rounded-xl border border-stone-300 cursor-pointer p-1 bg-white shadow-xs"
                    />
                  </div>

                  <div className="relative flex-1 sm:w-48">
                    <span className="absolute left-3 top-2.5 font-mono text-stone-400 font-bold">#</span>
                    <input
                      id="input-theme-hex"
                      type="text"
                      value={currentThemeColor.replace('#', '')}
                      onChange={e => handleCustomHexChange(`#${e.target.value.replace('#', '')}`)}
                      className={`${inputCls} pl-7 font-mono font-bold uppercase`}
                      placeholder="c0622b"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="text-xs text-stone-500">
                  <p className="font-semibold text-stone-800">Live Branding Accent Applied</p>
                  <p>Changes take effect instantly on buttons, badges, navigation, and accents.</p>
                </div>
              </div>

              {/* Live Preview Samples */}
              <div className="mt-6 pt-5 border-t border-stone-200/80">
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Live Component Preview:</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    style={{ backgroundColor: currentThemeColor }}
                    className="text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-2"
                  >
                    <i className="fa-solid fa-plus"></i> Button Preview
                  </button>

                  <span
                    style={{ backgroundColor: `${currentThemeColor}18`, color: currentThemeColor, borderColor: `${currentThemeColor}35` }}
                    className="text-xs font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-star text-[10px]"></i> Badge Preview
                  </span>

                  <div
                    style={{ borderLeftColor: currentThemeColor }}
                    className="border-l-4 bg-white px-3 py-1.5 rounded-r-xl border border-stone-200 text-xs font-bold text-stone-800"
                  >
                    Active Card Accent
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 3. Telegram Bot Alert Settings */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'telegram_bot' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-lg border border-sky-100">
                  <i className="fa-brands fa-telegram"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    ៣. Telegram Bot Alert Settings (ប្រព័ន្ធជូនដំណឹងតាម Telegram)
                  </h3>
                  <p className="text-xs text-stone-500">
                    ភ្ជាប់ Telegram Bot Token និង Chat ID សម្រាប់ទទួលដំណឹងការជួល, ការប្រគល់ម៉ូតូ និងចំណូល
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setTestResult('testing');
                  try {
                    const r = await fetch('/api/settings/test', authPost({}));
                    const d = await r.json();
                    setTestResult(d.success ? 'success' : `Failed: ${d.error}`);
                  } catch (e) {
                    setTestResult(`Error: ${e.message}`);
                  }
                }}
                className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <i className={`fa-solid ${testResult === 'testing' ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                {testResult === 'testing' ? 'កំពុងផ្ញើ...' : 'ផ្ញើសារសាកល្បង (Test Alert)'}
              </button>
            </div>

            {/* Test result message */}
            {testResult && testResult !== 'testing' && (
              <div className={`p-4 rounded-xl text-sm font-medium mb-5 flex items-center gap-2 ${
                testResult === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <i className={`fa-solid ${testResult === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-red-600'}`}></i>
                <span>{testResult === 'success' ? 'សារសាកល្បងត្រូវបានផ្ញើទៅកាន់ Telegram ដោយជោគជ័យ!' : testResult}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 text-sm">
              {/* Telegram Bot Token */}
              <div>
                <label className={labelCls}>
                  <i className="fa-solid fa-key mr-1.5 text-stone-400"></i>
                  Telegram Bot Token
                </label>
                <div className="relative">
                  <input
                    id="input-telegram-token"
                    type={showTgToken ? 'text' : 'password'}
                    value={currentTgToken}
                    onChange={e => {
                      const val = e.target.value;
                      setSettings(prev => ({
                        ...prev,
                        telegram_token: val,
                        telegram_settings: { ...(prev.telegram_settings || {}), botToken: val }
                      }));
                    }}
                    placeholder="7123456789:AAHq..."
                    className={`${inputCls} font-mono pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTgToken(!showTgToken)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700"
                  >
                    <i className={`fa-solid ${showTgToken ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Connects the system to the Telegram Bot API via token.</p>
              </div>

              {/* Group / Chat ID */}
              <div>
                <label className={labelCls}>
                  <i className="fa-solid fa-comments mr-1.5 text-stone-400"></i>
                  Group / Chat ID
                </label>
                <input
                  id="input-telegram-chat-id"
                  type="text"
                  value={currentTgChatId}
                  onChange={e => {
                    const val = e.target.value;
                    setSettings(prev => ({
                      ...prev,
                      telegram_chat_id: val,
                      telegram_settings: { ...(prev.telegram_settings || {}), chatId: val }
                    }));
                  }}
                  placeholder="-1001234567890 or @your_channel"
                  className={`${inputCls} font-mono`}
                />
                <p className="text-[11px] text-stone-400 mt-1">Directs real-time operational notifications to a specific Telegram group or channel.</p>
              </div>
            </div>

            {/* Automated Alert Toggles */}
            <div className="mt-8 pt-6 border-t border-stone-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-bell text-amber-500"></i>
                    Automated Telegram Alerts (ការជូនដំណឹងស្វ័យប្រវត្តិ)
                  </h4>
                  <p className="text-xs text-stone-500">ជ្រើសរើសប្រភេទប្រតិបត្តិការដែលត្រូវផ្ញើដំណឹងស្វ័យប្រវត្តិតាម Telegram</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <label className="flex items-center gap-2.5 text-xs font-bold text-stone-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tgSet.checkoutAlertEnabled !== false}
                    onChange={e => setSettings(prev => ({
                      ...prev,
                      telegram_settings: { ...(prev.telegram_settings || {}), checkoutAlertEnabled: e.target.checked }
                    }))}
                    className="rounded text-brand-500 focus:ring-brand-500 h-4 w-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-clipboard-check text-blue-500"></i> Check-Out Alert (ចេញ)
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-bold text-stone-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tgSet.checkinAlertEnabled !== false}
                    onChange={e => setSettings(prev => ({
                      ...prev,
                      telegram_settings: { ...(prev.telegram_settings || {}), checkinAlertEnabled: e.target.checked }
                    }))}
                    className="rounded text-brand-500 focus:ring-brand-500 h-4 w-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-rotate-left text-emerald-500"></i> Check-In / Return (ចូល)
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-bold text-stone-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tgSet.bookingAlertEnabled !== false}
                    onChange={e => setSettings(prev => ({
                      ...prev,
                      telegram_settings: { ...(prev.telegram_settings || {}), bookingAlertEnabled: e.target.checked }
                    }))}
                    className="rounded text-brand-500 focus:ring-brand-500 h-4 w-4"
                  />
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-calendar-check text-purple-500"></i> Booking Alert (ការកក់)
                  </span>
                </label>
              </div>

              {/* Custom Alert Templates */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-file-code text-blue-600"></i>
                    Custom Alert Templates (កែសម្រួលទម្រង់សារជូនដំណឹង)
                  </h4>
                  <p className="text-xs text-stone-500">អ្នកអាចកំណត់ពាក្យ ភាសា និង Dynamic Tags តាមតម្រូវការ</p>
                </div>

                {/* Subtabs for Templates */}
                <div className="flex flex-wrap gap-1.5 bg-stone-100 p-1 rounded-xl">
                  {[
                    { id: 'rental', label: 'Check-Out Alert (ចេញ)', icon: 'fa-clipboard-check' },
                    { id: 'return', label: 'Check-In / Return (ចូល)', icon: 'fa-rotate-left' },
                    { id: 'booking', label: 'Booking Alert (ការកក់)', icon: 'fa-calendar-check' },
                    { id: 'revenue', label: 'Payment / Income (ចំណូល)', icon: 'fa-file-invoice-dollar' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTemplateType(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        activeTemplateType === t.id ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <i className={`fa-solid ${t.icon} text-xs`}></i>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag Insertion Buttons */}
              <div className="mb-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                  Available Placeholders for {activeTemplateType.toUpperCase()} (ចុចដើម្បីបញ្ចូល Tag ទៅក្នុងទម្រង់សារ):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    activeTemplateType === 'booking'
                      ? ['{booking_ref}', '{type}', '{item_name}', '{customer_name}', '{phone}', '{start_date}', '{end_date}', '{total_amount}', '{deposit}', '{notes}', '{time}']
                      : (activeTemplateType === 'return' || activeTemplateType === 'checkin')
                      ? ['{customer_name}', '{phone}', '{bike_model}', '{plate_number}', '{item_name}', '{return_date}', '{late_fee}', '{damage_fee}', '{deposit_returned}', '{staff_name}', '{time}']
                      : activeTemplateType === 'revenue'
                      ? ['{invoice_id}', '{customer_name}', '{amount}', '{payment_method}', '{time}']
                      : ['{customer_name}', '{phone}', '{bike_model}', '{plate_number}', '{item_name}', '{start_date}', '{end_date}', '{total_amount}', '{deposit}', '{payment_method}', '{staff_name}', '{time}']
                  ).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag(tag)}
                      className="text-[11px] font-mono font-semibold bg-white hover:bg-brand-50 hover:text-brand-700 text-stone-700 px-2 py-1 rounded-lg border border-stone-200 transition-colors shadow-2xs cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Editor & Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <textarea
                    ref={templateTextareaRef}
                    rows={8}
                    value={
                      activeTemplateType === 'rental' || activeTemplateType === 'checkout'
                        ? currentRentalTemplate
                        : activeTemplateType === 'return' || activeTemplateType === 'checkin'
                        ? currentReturnTemplate
                        : activeTemplateType === 'booking'
                        ? currentBookingTemplate
                        : currentRevenueTemplate
                    }
                    onChange={e => {
                      const val = e.target.value;
                      const field =
                        activeTemplateType === 'rental' || activeTemplateType === 'checkout'
                          ? 'rentalAlertTemplate'
                          : activeTemplateType === 'return' || activeTemplateType === 'checkin'
                          ? 'returnAlertTemplate'
                          : activeTemplateType === 'booking'
                          ? 'bookingAlertTemplate'
                          : 'revenueAlertTemplate';
                      setSettings(prev => ({
                        ...prev,
                        telegram_settings: {
                          ...(prev.telegram_settings || {}),
                          [field]: val,
                          ...(field === 'rentalAlertTemplate' ? { checkoutAlertTemplate: val } : {}),
                          ...(field === 'returnAlertTemplate' ? { checkinAlertTemplate: val } : {})
                        }
                      }));
                    }}
                    className={`${inputCls} font-mono text-xs`}
                    placeholder="Enter message template using HTML (<b>...</b>, <i>...</i>, <code>...</code>) and dynamic tags..."
                  ></textarea>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleTestCurrentTemplate}
                      disabled={testingTemplate}
                      className="px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <i className={`fa-brands fa-telegram ${testingTemplate ? 'animate-bounce' : ''}`}></i>
                      <span>{testingTemplate ? 'Sending Test...' : 'Test This Template on Telegram'}</span>
                    </button>

                    {testResultMsg && (
                      <span className={`text-xs font-bold flex items-center gap-1.5 ${testResultMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        <i className={`fa-solid ${testResultMsg.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                        <span>{testResultMsg.text}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Telegram Message Preview Simulation */}
                <div className="bg-[#182533] text-white p-4 rounded-2xl shadow-inner font-sans text-xs flex flex-col justify-between border border-slate-700">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-700 text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <i className="fa-brands fa-telegram text-sky-400"></i>
                        <span>Telegram Alert Live Preview ({activeTemplateType.toUpperCase()})</span>
                      </span>
                      <span className="text-[10px]">Just now</span>
                    </div>

                    <div
                      className="whitespace-pre-wrap leading-relaxed text-slate-100"
                      dangerouslySetInnerHTML={{
                        __html: (
                          activeTemplateType === 'rental' || activeTemplateType === 'checkout'
                            ? currentRentalTemplate
                            : activeTemplateType === 'return' || activeTemplateType === 'checkin'
                            ? currentReturnTemplate
                            : activeTemplateType === 'booking'
                            ? currentBookingTemplate
                            : currentRevenueTemplate
                        )
                          .replace(/{booking_ref}/gi, 'SR-BK-88421')
                          .replace(/{type}/gi, 'Motor Rental (ជួលម៉ូតូ)')
                          .replace(/{item_name}/gi, 'Honda Scoopy 2024')
                          .replace(/{customer_name}/gi, 'John Doe')
                          .replace(/{phone}/gi, '+855 12 345 678')
                          .replace(/{bike_model}/gi, 'Honda Scoopy 2024')
                          .replace(/{plate_number}/gi, '1AB-2345')
                          .replace(/{room_name}/gi, 'Deluxe Room #101')
                          .replace(/{start_date}/gi, '2026-09-13')
                          .replace(/{end_date}/gi, '2026-09-16')
                          .replace(/{total_amount}/gi, '45.00')
                          .replace(/{deposit}/gi, '50.00')
                          .replace(/{return_date}/gi, '2026-09-16')
                          .replace(/{late_fee}/gi, '0.00')
                          .replace(/{damage_fee}/gi, '0.00')
                          .replace(/{deposit_returned}/gi, '50.00')
                          .replace(/{payment_method}/gi, 'ABA KHQR')
                          .replace(/{staff_name}/gi, 'Admin / Reception')
                          .replace(/{notes}/gi, 'Customer requested helmet')
                          .replace(/{invoice_id}/gi, 'INV-9021')
                          .replace(/{amount}/gi, '45.00')
                          .replace(/{time}/gi, '13:00, 13/09/2026')
                      }}
                    />
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-700/50 flex justify-end text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">Delivered via Bot <i className="fa-solid fa-check-double text-sky-400"></i></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 4. Notification Settings */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'notifications' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-100">
                  <i className="fa-solid fa-bell"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    ៤. Notification Settings (ការកំណត់ការជូនដំណឹង)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Email Notifications, រំលឹកថ្ងៃត្រូវត្រឡប់ម៉ូតូ (Return Reminder), និងរំលឹកការថែទាំជួសជុល (Maintenance)
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Automated Alerts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              {/* Email Notification Card */}
              <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                        <i className="fa-solid fa-envelope"></i>
                      </div>
                      <span className="font-bold text-stone-900">Email Notification</span>
                    </div>
                    <input
                      id="checkbox-email-notif"
                      type="checkbox"
                      checked={notifSet.emailNotificationEnabled || false}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSettings(prev => ({
                          ...prev,
                          notification_settings: {
                            ...(prev.notification_settings || {}),
                            emailNotificationEnabled: checked
                          }
                        }));
                      }}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <p className="text-xs text-stone-500 mb-4">
                    Enable Email Notification to receive critical booking and system alerts directly in your inbox.
                  </p>

                  <div>
                    <label className={labelCls}>Recipient Email</label>
                    <input
                      id="input-recipient-email"
                      type="email"
                      value={notifSet.recipientEmail || 'yourshop@email.com'}
                      onChange={e => {
                        const val = e.target.value;
                        setSettings(prev => ({
                          ...prev,
                          notification_settings: {
                            ...(prev.notification_settings || {}),
                            recipientEmail: val
                          }
                        }));
                      }}
                      placeholder="yourshop@email.com"
                      className={inputCls}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-stone-400 mt-4">
                  Default receiving address for all automated system alerts.
                </p>
              </div>

              {/* Return Reminder Card */}
              <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-sm">
                        <i className="fa-solid fa-clock-rotate-left"></i>
                      </div>
                      <div>
                        <span className="font-bold text-stone-900 block leading-tight">Return Reminder</span>
                        <span className="text-[10px] text-stone-400">រំលឹកថ្ងៃត្រូវត្រឡប់</span>
                      </div>
                    </div>
                    <input
                      id="checkbox-return-reminder"
                      type="checkbox"
                      checked={notifSet.returnReminderEnabled !== false}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSettings(prev => ({
                          ...prev,
                          notification_settings: {
                            ...(prev.notification_settings || {}),
                            returnReminderEnabled: checked
                          }
                        }));
                      }}
                      className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                    />
                  </div>

                  <p className="text-xs text-stone-500 mb-4">
                    Enable Return Reminder alerts before customer rental duration ends.
                  </p>

                  <div>
                    <label className={labelCls}>Lead Days (មុនចំនួនថ្ងៃ)</label>
                    <div className="relative">
                      <input
                        id="input-lead-days"
                        type="number"
                        min="1"
                        max="7"
                        value={notifSet.returnReminderLeadDays ?? 1}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          setSettings(prev => ({
                            ...prev,
                            notification_settings: {
                              ...(prev.notification_settings || {}),
                              returnReminderLeadDays: val
                            }
                          }));
                        }}
                        className={`${inputCls} pr-14`}
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-bold text-stone-400">ថ្ងៃមុន</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-stone-400 mt-4">
                  Sets how many days before return date to alert staff/customers (set to 1 day).
                </p>
              </div>

              {/* Maintenance Reminder Card */}
              <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-sm">
                        <i className="fa-solid fa-wrench"></i>
                      </div>
                      <div>
                        <span className="font-bold text-stone-900 block leading-tight">Maintenance Reminder</span>
                        <span className="text-[10px] text-stone-400">រំលឹកការជួសជុល/ថែទាំ</span>
                      </div>
                    </div>
                    <input
                      id="checkbox-maintenance-reminder"
                      type="checkbox"
                      checked={notifSet.maintenanceReminderEnabled !== false}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSettings(prev => ({
                          ...prev,
                          notification_settings: {
                            ...(prev.notification_settings || {}),
                            maintenanceReminderEnabled: checked
                          }
                        }));
                      }}
                      className="w-5 h-5 accent-rose-600 rounded cursor-pointer"
                    />
                  </div>

                  <p className="text-xs text-stone-500 mb-4">
                    Enable Maintenance Reminder for routine vehicle engine & safety checks.
                  </p>

                  <div>
                    <label className={labelCls}>Interval (គម្លាតថ្ងៃថែទាំ)</label>
                    <div className="relative">
                      <input
                        id="input-maintenance-interval"
                        type="number"
                        min="1"
                        max="90"
                        value={notifSet.maintenanceReminderInterval ?? 15}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 15;
                          setSettings(prev => ({
                            ...prev,
                            notification_settings: {
                              ...(prev.notification_settings || {}),
                              maintenanceReminderInterval: val
                            }
                          }));
                        }}
                        className={`${inputCls} pr-14`}
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-bold text-stone-400">ថ្ងៃម្តង</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-stone-400 mt-4">
                  Frequency threshold in days between maintenance checks (set to every 15 days).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 5. Backup & Restore */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'backup_restore' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-lg border border-teal-100">
                  <i className="fa-solid fa-database"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    ៥. Backup & Restore (ទាញយក & បញ្ចូលទិន្នន័យ)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Export JSON Backup, Export CSV History/Income, និង Restore from Backup (Merge Mode)
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                Disaster Recovery
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Export Data Section */}
              <div className="p-6 bg-stone-50/80 rounded-2xl border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-file-export text-teal-600"></i>
                    <h4 className="font-bold text-sm text-stone-900">Export Data (ទាញយកទិន្នន័យ)</h4>
                  </div>
                  <p className="text-xs text-stone-500 mb-5">
                    ទាញយកទិន្នន័យបម្រុងទុកជាឯកសារ JSON ឬឯកសារ Spreadsheet CSV សម្រាប់គណនេយ្យ
                  </p>

                  <div className="space-y-3">
                    {/* JSON Full Backup */}
                    <div className="bg-white p-4 rounded-xl border border-stone-200 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-bold text-xs text-stone-900 block">Download Backup (JSON)</span>
                        <span className="text-[10px] text-stone-500">Full database export in JSON format for offsite backup</span>
                      </div>
                      <button
                        id="btn-download-json-backup"
                        type="button"
                        onClick={handleDownloadBackup}
                        disabled={backupLoading}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                      >
                        <i className={`fa-solid ${backupLoading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                        <span>{backupLoading ? 'Generating...' : 'Download JSON'}</span>
                      </button>
                    </div>

                    {/* CSV History Export */}
                    <div className="bg-white p-4 rounded-xl border border-stone-200 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-bold text-xs text-stone-900 block">Export CSV (History)</span>
                        <span className="text-[10px] text-stone-500">Exports full vehicle and rental transaction history as a spreadsheet</span>
                      </div>
                      <button
                        id="btn-export-csv-history"
                        type="button"
                        onClick={handleExportHistoryCSV}
                        className="bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                      >
                        <i className="fa-solid fa-file-csv text-emerald-400"></i>
                        <span>Export CSV (History)</span>
                      </button>
                    </div>

                    {/* CSV Income Export */}
                    <div className="bg-white p-4 rounded-xl border border-stone-200 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-bold text-xs text-stone-900 block">Export CSV (Income)</span>
                        <span className="text-[10px] text-stone-500">Exports revenue and booking financial reports as CSV</span>
                      </div>
                      <button
                        id="btn-export-csv-income"
                        type="button"
                        onClick={handleExportIncomeCSV}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                      >
                        <i className="fa-solid fa-file-invoice-dollar"></i>
                        <span>Export CSV (Income)</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-200 text-[11px] text-stone-400">
                  <i className="fa-solid fa-shield-halved mr-1 text-teal-600"></i> All exports are securely generated directly from the live database.
                </div>
              </div>

              {/* Import / Restore Section */}
              <div className="p-6 bg-amber-50/50 rounded-2xl border border-amber-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-file-import text-amber-600"></i>
                    <h4 className="font-bold text-sm text-stone-900">Import / Restore (បញ្ចូលទិន្នន័យ)</h4>
                  </div>
                  <p className="text-xs text-stone-500 mb-5">
                    បញ្ចូលទិន្នន័យពីឯកសារ .json backup ឡើងវិញដោយផ្ទាល់ទៅក្នុង Cloud Firestore (Merge mode)
                  </p>

                  <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-2xs space-y-4">
                    <div>
                      <label className={labelCls}>Choose Backup File (.json)</label>
                      <input
                        id="input-backup-file"
                        type="file"
                        accept=".json"
                        onChange={e => setSelectedBackupFile(e.target.files[0] || null)}
                        className="w-full text-xs text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                      />
                    </div>

                    {selectedBackupFile && (
                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <i className="fa-solid fa-file-lines text-amber-600"></i>
                          <span className="font-bold text-stone-800 truncate">{selectedBackupFile.name}</span>
                          <span className="text-[10px] text-stone-400 font-mono">({Math.round(selectedBackupFile.size / 1024)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedBackupFile(null)}
                          className="text-stone-400 hover:text-red-500"
                        >
                          <i className="fa-solid fa-times"></i>
                        </button>
                      </div>
                    )}

                    <button
                      id="btn-restore-backup"
                      type="button"
                      onClick={handleRestoreBackup}
                      disabled={!selectedBackupFile || isRestoring}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                        selectedBackupFile && !isRestoring
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      <i className={`fa-solid ${isRestoring ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                      <span>{isRestoring ? 'កំពុងបញ្ចូលទិន្នន័យ...' : 'Restore from Backup (Merge into Firestore)'}</span>
                    </button>
                  </div>

                  {restoreMessage && (
                    <div className="mt-4 p-3.5 rounded-xl text-xs font-medium bg-stone-900 text-white shadow-lg">
                      {restoreMessage}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-amber-200 text-[11px] text-amber-800/80">
                  <i className="fa-solid fa-triangle-exclamation mr-1 text-amber-600"></i>
                  Merges imported data directly into Cloud Firestore and system tables safely.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 6. Payments & Invoicing */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'payments' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900">
                <i className="fa-solid fa-credit-card mr-2 text-emerald-500"></i>Payment Gateways & KHQR
              </h3>
              <button onClick={handleSaveAll} className={btnPrimary}>Save Payment Config</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {[
                { key: 'cashEnabled', label: 'Cash on Arrival', icon: 'fa-money-bill-wave', color: 'text-emerald-600 bg-emerald-50' },
                { key: 'abaKhqrEnabled', label: 'ABA Bank KHQR / Bakong', icon: 'fa-qrcode', color: 'text-blue-600 bg-blue-50' },
                { key: 'cardEnabled', label: 'Credit / Debit Card POS', icon: 'fa-credit-card', color: 'text-purple-600 bg-purple-50' },
                { key: 'bankTransferEnabled', label: 'Direct Bank Transfer', icon: 'fa-building-columns', color: 'text-amber-600 bg-amber-50' },
              ].map(m => (
                <div key={m.key} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.color}`}>
                      <i className={`fa-solid ${m.icon} text-lg`}></i>
                    </div>
                    <span className="font-bold text-sm text-stone-900">{m.label}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={pMethods[m.key] !== false}
                    onChange={e => setSettings({ ...settings, payment_methods: { ...pMethods, [m.key]: e.target.checked } })}
                    className="w-5 h-5 accent-brand-500 rounded cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* ABA KHQR Details */}
            {pMethods.abaKhqrEnabled !== false && (
              <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-4">
                <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2">
                  <i className="fa-solid fa-qrcode text-blue-600"></i> ABA KHQR Account Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className={labelCls}>ABA Account Name</label>
                    <input
                      type="text"
                      value={pMethods.abaAccountName || ''}
                      onChange={e => setSettings({ ...settings, payment_methods: { ...pMethods, abaAccountName: e.target.value } })}
                      className={inputCls}
                      placeholder="e.g. MOTOR RENTAL SIEM REAP ANGKOR"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>ABA Account Number / ID</label>
                    <input
                      type="text"
                      value={pMethods.abaAccountNumber || ''}
                      onChange={e => setSettings({ ...settings, payment_methods: { ...pMethods, abaAccountNumber: e.target.value } })}
                      className={inputCls}
                      placeholder="e.g. 016 308 199"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Upload KHQR Image for Customer Payment Screen</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const f = e.target.files[0];
                        if (f) {
                          const dataUrl = await fileToBase64(f, 800, 800, 0.85);
                          setSettings({ ...settings, payment_methods: { ...pMethods, abaQrImage: dataUrl } });
                        }
                      }}
                      className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white file:text-blue-700 file:border file:border-blue-200 cursor-pointer"
                    />
                    {pMethods.abaQrImage && (
                      <div className="mt-3 flex items-center gap-4">
                        <img src={pMethods.abaQrImage} alt="KHQR Preview" className="w-24 h-24 object-contain rounded-xl border border-blue-200 bg-white p-2 shadow-sm" />
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, payment_methods: { ...pMethods, abaQrImage: '' } })}
                          className="text-xs font-bold text-red-600 hover:underline"
                        >
                          Remove QR
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 7. Pricing, Taxes & Currency */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'pricing' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900">
                <i className="fa-solid fa-coins mr-2 text-amber-500"></i>Currency & Exchange Rates
              </h3>
              <button onClick={handleSaveAll} className={btnPrimary}>Save Pricing</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
              <div>
                <label className={labelCls}>Primary System Currency</label>
                <select
                  value={pTax.primaryCurrency || 'USD'}
                  onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, primaryCurrency: e.target.value } })}
                  className={inputCls}
                >
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="KHR">KHR (៛ - Khmer Riel)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Exchange Rate (1 USD to KHR)</label>
                <input
                  type="number"
                  value={pTax.exchangeRate || 4100}
                  onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, exchangeRate: parseFloat(e.target.value) } })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Late Bike Return Fee ($/hour)</label>
                <input
                  type="number"
                  value={pTax.lateReturnPerHour || 3}
                  onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, lateReturnPerHour: parseFloat(e.target.value) } })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 8. Staff Users & Roles */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'staff_users' && (
        <div className="space-y-6">
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-6 border-b border-stone-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-stone-900">
                  <i className="fa-solid fa-users-gear mr-2 text-violet-500"></i>Staff Accounts & Role Permissions
                </h3>
                <p className="text-xs text-stone-500">បង្កើត Account ឱ្យបុគ្គលិក និងកំណត់សិទ្ធិមើល/កែប្រែទិន្នន័យ</p>
              </div>
              <button onClick={() => handleOpenStaffModal()} className={btnPrimary}>
                <i className="fa-solid fa-user-plus mr-1.5"></i> Add New Staff
              </button>
            </div>

            <div className="p-4 border-b border-stone-100 bg-stone-50">
              <input
                type="text"
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                placeholder="Search staff by name, role, username..."
                className={inputCls}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 border-b border-stone-200 text-xs text-stone-500 uppercase tracking-widest">
                  <tr>
                    {['Staff Member', 'Username', 'Role', 'Permissions', 'Phone', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff
                    .filter(s => !staffSearch || s.fullName?.toLowerCase().includes(staffSearch.toLowerCase()) || s.username?.toLowerCase().includes(staffSearch.toLowerCase()))
                    .map(st => (
                      <tr key={st.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-stone-900">{st.fullName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-stone-600">{st.username}</td>
                        <td className="px-4 py-3 capitalize">{st.role}</td>
                        <td className="px-4 py-3 text-xs text-stone-500">{st.permissions || 'All'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{st.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {st.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleOpenStaffModal(st)} className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">
                              <i className="fa-solid fa-pen text-xs"></i>
                            </button>
                            {st.role !== 'admin' && (
                              <button onClick={() => handleDeleteStaff(st.id)} className="w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">
                                <i className="fa-solid fa-trash text-xs"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {staff.length === 0 && (
                    <tr><td colSpan="7" className="py-8 text-center text-stone-400">No staff members found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 9. Website Public Texts */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'website_texts' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900">
                <i className="fa-solid fa-language mr-2 text-brand-500"></i>Public Page Texts
              </h3>
              <button onClick={handleSaveAll} className={btnPrimary}>Save Texts</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <div>
                <label className={labelCls}>Hero Title</label>
                <input
                  type="text"
                  className={inputCls}
                  value={settings.public_texts?.hero_title || ''}
                  onChange={e => setSettings({ ...settings, public_texts: { ...(settings.public_texts || {}), hero_title: e.target.value } })}
                />
              </div>
              <div>
                <label className={labelCls}>Hero Button</label>
                <input
                  type="text"
                  className={inputCls}
                  value={settings.public_texts?.hero_btn || ''}
                  onChange={e => setSettings({ ...settings, public_texts: { ...(settings.public_texts || {}), hero_btn: e.target.value } })}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Hero Subtitle</label>
                <textarea
                  rows="2"
                  className={inputCls}
                  value={settings.public_texts?.hero_subtitle || ''}
                  onChange={e => setSettings({ ...settings, public_texts: { ...(settings.public_texts || {}), hero_subtitle: e.target.value } })}
                ></textarea>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 10. Audit Trail */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'audit_logs' && (
        <div className="space-y-6">
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-stone-900">
                <i className="fa-solid fa-list-check mr-2 text-stone-700"></i>Activity Audit Trail
              </h3>
              <span className="text-xs font-bold bg-stone-100 text-stone-600 px-3 py-1 rounded-full">
                {auditLogs.length} events logged
              </span>
            </div>

            <div className="p-4 border-b border-stone-100 bg-stone-50">
              <input
                type="text"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Search audit trail..."
                className={inputCls}
              />
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 border-b border-stone-200 text-xs text-stone-500 uppercase tracking-widest sticky top-0">
                  <tr>
                    {['Timestamp', 'User', 'Action', 'Details'].map(h => (
                      <th key={h} className="px-4 py-3 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs
                    .filter(log => !auditSearch || log.action?.toLowerCase().includes(auditSearch.toLowerCase()) || log.performedBy?.toLowerCase().includes(auditSearch.toLowerCase()))
                    .map(log => (
                      <tr key={log.id} className="border-b border-stone-100 hover:bg-stone-50 text-xs">
                        <td className="px-4 py-3 font-mono text-stone-400 whitespace-nowrap">{log.createdAt}</td>
                        <td className="px-4 py-3 font-bold text-stone-900">{log.performedBy}</td>
                        <td className="px-4 py-3 font-semibold">{log.action}</td>
                        <td className="px-4 py-3 text-stone-600 max-w-xs truncate">{log.details || '—'}</td>
                      </tr>
                    ))}
                  {auditLogs.length === 0 && (
                    <tr><td colSpan="4" className="py-8 text-center text-stone-400 text-xs">No audit logs recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* FIXED BOTTOM-RIGHT SAVE ACTION BUTTON */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          id="btn-save-all-settings-floating"
          onClick={handleSaveAll}
          disabled={isSavingAll}
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-6 py-3.5 rounded-2xl shadow-xl shadow-blue-500/30 flex items-center gap-2.5 transition-all text-sm cursor-pointer border border-blue-400/40"
        >
          <i className={`fa-solid ${isSavingAll ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-base`}></i>
          <span>{isSavingAll ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកការកំណត់ទាំងអស់ (Save All Settings)'}</span>
        </button>
      </div>

      {/* Staff Modal */}
      {staffModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
              <h3 className="font-bold text-lg text-stone-900">
                {editingStaff ? 'Edit Staff Account' : 'Register New Staff'}
              </h3>
              <button onClick={() => setStaffModalOpen(false)} className="w-8 h-8 rounded-full bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4 text-sm">
              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  value={staffForm.fullName}
                  onChange={e => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input
                  type="text"
                  value={staffForm.username}
                  onChange={e => setStaffForm({ ...staffForm, username: e.target.value })}
                  className={inputCls}
                  disabled={!!editingStaff}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>{editingStaff ? 'Password (leave blank to keep unchanged)' : 'Password'}</label>
                <input
                  type="password"
                  value={staffForm.password}
                  onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                  className={inputCls}
                  required={!editingStaff}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Role</label>
                  <select
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                    className={inputCls}
                  >
                    <option value="receptionist">Receptionist</option>
                    <option value="housekeeper">Housekeeper</option>
                    <option value="mechanic">Mechanic</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={staffForm.status}
                    onChange={e => setStaffForm({ ...staffForm, status: e.target.value })}
                    className={inputCls}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="submit" className={`${btnPrimary} flex-1`}>
                  {editingStaff ? 'Update Account' : 'Create Account'}
                </button>
                <button type="button" onClick={() => setStaffModalOpen(false)} className={btnSecondary}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
