import React, { useState, useEffect, useMemo } from 'react';
import { fileToBase64 } from '../../utils/imageUtils';

// ─── Fast Preset Items for Other / Custom Services ─────────────────────────
const PRESET_SERVICES = [
  { name: 'Airport Pick-up / Transfer (Siem Reap Angkor SAI)', rate: 25.0, qty: 1, unit: 'ជើង', category: 'Transport' },
  { name: 'Angkor Wat Sunrise Tour / Tuk-Tuk Service', rate: 20.0, qty: 1, unit: 'ថ្ងៃ', category: 'Tour' },
  { name: 'Grand Circuit Temple Tour (Private Car)', rate: 35.0, qty: 1, unit: 'ថ្ងៃ', category: 'Tour' },
  { name: 'Kulen Mountain & Waterfall Private Day Trip', rate: 50.0, qty: 1, unit: 'ថ្ងៃ', category: 'Tour' },
  { name: 'Room Accommodation / Night Stay', rate: 25.0, qty: 1, unit: 'យប់', category: 'Room' },
  { name: 'Monthly Accommodation / Long Stay', rate: 180.0, qty: 1, unit: 'ខែ', category: 'Room' },
  { name: 'Motorbike Daily Rental Service', rate: 8.0, qty: 1, unit: 'ថ្ងៃ', category: 'Vehicle' },
  { name: 'Motorbike Monthly Rental Package', rate: 70.0, qty: 1, unit: 'ខែ', category: 'Vehicle' },
  { name: 'Laundry Service (Express Wash & Fold)', rate: 2.0, qty: 3, unit: 'គីឡូ', category: 'Service' },
  { name: 'Refundable Security & Damage Deposit', rate: 50.0, qty: 1, unit: 'កញ្ចប់', category: 'Deposit' },
];

export default function CustomInvoiceTab({
  settings = {},
  setSettings,
  auth = {},
  currency: rawCurrency = (v) => `$${Number(v || 0).toFixed(2)}`
}) {
  const currency = typeof rawCurrency === 'function' ? rawCurrency : (v) => `$${Number(v || 0).toFixed(2)}`;
  const pMethods = settings.payment_methods || {};
  const bProfile = settings.business_profile || {};
  const shopSet = settings.shop_settings || {};
  const savedCustomProfile = settings.custom_invoice_profile || {};

  // ─── Sub-Tab State: 'create' | 'history' | 'settings' ────────────────────────
  const [activeSubTab, setActiveSubTab] = useState('create');

  // ─── Custom Branding / Profile (Separate from Room & Moto) ───────────────────
  const [profile, setProfile] = useState({
    businessName: savedCustomProfile.businessName || shopSet.shopName || bProfile.hotelName || 'Siem Reap Angkor Services & Hospitality',
    invoiceTitle: savedCustomProfile.invoiceTitle || 'OFFICIAL RECEIPT / INVOICE',
    subtitle: savedCustomProfile.subtitle || 'Tours, Transportation, Guest Services & Custom Folio',
    logo: savedCustomProfile.logo || shopSet.logo || bProfile.logo || '/assets/logo.png',
    address: savedCustomProfile.address || shopSet.address || bProfile.address || 'Near Angkor Wat Main Gate, Siem Reap, Cambodia',
    phone: savedCustomProfile.phone || bProfile.phone || '+855 016 308 199',
    email: savedCustomProfile.email || bProfile.email || 'info@siemreapangkor.com',
    taxNumber: savedCustomProfile.taxNumber || 'K002-901829381',
    receivingAccountNo: savedCustomProfile.receivingAccountNo || pMethods.abaAccountNumber || '000 314 574',
    receivingAccountName: savedCustomProfile.receivingAccountName || pMethods.abaAccountName || 'SOM SUMNANG',
    exchangeRate: Number(savedCustomProfile.exchangeRate || 4000),
    footerNote: savedCustomProfile.footerNote || 'Thank you for choosing our services! Safe travels around Siem Reap & Angkor temples.',
    terms: savedCustomProfile.terms || 'Please retain this official receipt for your records. All tours and services subject to local safety guidelines.',
    paperSize: savedCustomProfile.paperSize || 'a4',
    showLogo: savedCustomProfile.showLogo !== false,
    showKhr: savedCustomProfile.showKhr !== false,
    showSignatures: savedCustomProfile.showSignatures !== false,
    showTaxId: savedCustomProfile.showTaxId !== false,
    showReceivingAccount: savedCustomProfile.showReceivingAccount !== false,
  });

  // Sync when parent settings update
  useEffect(() => {
    if (settings.custom_invoice_profile) {
      setProfile(prev => ({
        ...prev,
        ...settings.custom_invoice_profile,
        receivingAccountNo: settings.custom_invoice_profile.receivingAccountNo || pMethods.abaAccountNumber || '000 314 574',
        receivingAccountName: settings.custom_invoice_profile.receivingAccountName || pMethods.abaAccountName || 'SOM SUMNANG'
      }));
    }
  }, [settings.custom_invoice_profile, pMethods.abaAccountNumber, pMethods.abaAccountName]);

  // ─── Invoices History ───────────────────────────────────────────────────────
  const [invoicesHistory, setInvoicesHistory] = useState(() => {
    // 1. Check parent settings (from DB)
    if (settings?.custom_invoices_history !== undefined && settings?.custom_invoices_history !== null) {
      try {
        const val = settings.custom_invoices_history;
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }

    // 2. Check localStorage
    try {
      const stored = localStorage.getItem('custom_other_invoices_history');
      if (stored !== null && stored !== undefined) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // 3. Fallback to empty array - NEVER hardcode mock items that resurrect after user deletes them!
    return [];
  });

  // Keep local state in sync when parent settings load or change from server
  useEffect(() => {
    if (settings?.custom_invoices_history !== undefined && settings?.custom_invoices_history !== null) {
      try {
        const val = settings.custom_invoices_history;
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (Array.isArray(parsed)) {
          setInvoicesHistory(parsed);
          try {
            localStorage.setItem('custom_other_invoices_history', JSON.stringify(parsed));
          } catch (e) {}
        }
      } catch (e) {}
    }
  }, [settings?.custom_invoices_history]);

  const saveInvoicesHistory = (newInvoices) => {
    const list = Array.isArray(newInvoices) ? newInvoices : [];
    setInvoicesHistory(list);
    try {
      localStorage.setItem('custom_other_invoices_history', JSON.stringify(list));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    if (typeof setSettings === 'function') {
      setSettings(prev => ({
        ...prev,
        custom_invoices_history: list
      }));
    }

    // Sync to backend SQLite database (persists across devices, refreshes, tabs)
    try {
      const token = localStorage.getItem('token') || auth?.token;
      fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ custom_invoices_history: list })
      }).catch(err => console.warn('Server sync error for custom_invoices_history:', err));
    } catch (e) {
      console.warn('Network sync error:', e);
    }
  };

  // ─── Edit Mode State ────────────────────────────────────────────────────────
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

  // ─── History Search, Sort & Filter State ─────────────────────────────────────
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState('newest'); // 'newest' | 'oldest' | 'amount-high' | 'amount-low' | 'customer'
  const [historyFilterPayment, setHistoryFilterPayment] = useState('ALL');

  const filteredInvoicesHistory = useMemo(() => {
    let list = [...invoicesHistory];

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter(inv =>
        (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (inv.customerName || '').toLowerCase().includes(q) ||
        (inv.customerPhone || '').toLowerCase().includes(q) ||
        (inv.items || []).some(it => (it.description || '').toLowerCase().includes(q))
      );
    }

    if (historyFilterPayment !== 'ALL') {
      list = list.filter(inv => (inv.paymentMethod || '').toUpperCase() === historyFilterPayment);
    }

    list.sort((a, b) => {
      if (historySort === 'newest') {
        const da = new Date(a.createdAt || a.date).getTime() || 0;
        const db = new Date(b.createdAt || b.date).getTime() || 0;
        return db - da;
      }
      if (historySort === 'oldest') {
        const da = new Date(a.createdAt || a.date).getTime() || 0;
        const db = new Date(b.createdAt || b.date).getTime() || 0;
        return da - db;
      }
      if (historySort === 'amount-high') {
        return (Number(b.grandTotal) || 0) - (Number(a.grandTotal) || 0);
      }
      if (historySort === 'amount-low') {
        return (Number(a.grandTotal) || 0) - (Number(b.grandTotal) || 0);
      }
      if (historySort === 'customer') {
        return (a.customerName || '').localeCompare(b.customerName || '');
      }
      return 0;
    });

    return list;
  }, [invoicesHistory, historySearch, historySort, historyFilterPayment]);

  const historyMetrics = useMemo(() => {
    const totalCount = invoicesHistory.length;
    const totalRevenue = invoicesHistory.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = invoicesHistory.filter(inv => inv.date === todayStr).length;
    const todayRevenue = invoicesHistory.filter(inv => inv.date === todayStr).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    return { totalCount, totalRevenue, todayCount, todayRevenue };
  }, [invoicesHistory]);

  const handleEditInvoice = (inv) => {
    setEditingInvoiceId(inv.id);
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceDate(inv.date || new Date().toISOString().slice(0, 10));
    setInvoiceTitle(inv.invoiceTitle || profile.invoiceTitle);
    setCustomerName(inv.customerName || '');
    setCustomerPhone(inv.customerPhone || '');
    setCustomerPassport(inv.customerPassport || '');
    setCustomerCompany(inv.customerCompany || '');
    setCustomerAddress(inv.customerAddress || '');
    setPaymentMethod(inv.paymentMethod || 'CASH');
    setReceivingAccount(inv.receivingAccount || profile.receivingAccountNo);
    setReceivingAccountName(inv.receivingAccountName || profile.receivingAccountName);
    setDiscountAmount(inv.discount || 0);
    setTaxPercent(inv.taxPercent || (inv.tax && inv.subtotal ? Math.round((inv.tax / inv.subtotal) * 100) : 0));
    setCustomNote(inv.customNote || '');
    setItems(
      (inv.items || []).map((it, idx) => ({
        id: it.id || Date.now() + idx,
        description: it.description || '',
        qty: it.qty || 1,
        unit: it.unit || 'ថ្ងៃ',
        rate: it.rate || 0,
        total: it.total || (it.qty || 1) * (it.rate || 0)
      }))
    );
    setActiveSubTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingInvoiceId(null);
    handleResetForm();
  };

  const handleDeleteInvoice = (id, invNo) => {
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបវិក្កយបត្រ #${invNo || id} នេះមែនទេ? (Are you sure you want to delete this invoice?)`)) {
      return;
    }
    const targetId = id !== undefined && id !== null ? String(id).trim() : '';
    const targetNo = invNo !== undefined && invNo !== null ? String(invNo).trim() : '';

    const updated = invoicesHistory.filter(inv => {
      const invId = inv.id !== undefined && inv.id !== null ? String(inv.id).trim() : '';
      const invNum = inv.invoiceNumber !== undefined && inv.invoiceNumber !== null ? String(inv.invoiceNumber).trim() : '';
      if (targetId && (invId === targetId || invNum === targetId)) return false;
      if (targetNo && (invId === targetNo || invNum === targetNo)) return false;
      return true;
    });

    saveInvoicesHistory(updated);
    if (
      (editingInvoiceId && targetId && String(editingInvoiceId).trim() === targetId) ||
      (editingInvoiceId && targetNo && String(editingInvoiceId).trim() === targetNo)
    ) {
      handleCancelEdit();
    }
  };

  const handleClearAllHistory = () => {
    if (!invoicesHistory || invoicesHistory.length === 0) return;
    if (!window.confirm('តើអ្នកពិតជាចង់លុបប្រវត្តិវិក្កយបត្រទាំងអស់មែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។ (Are you sure you want to delete ALL custom invoices history? This action cannot be undone.)')) {
      return;
    }
    saveInvoicesHistory([]);
    handleCancelEdit();
  };

  const handleReprintInvoice = (inv) => {
    setActivePrintInvoice(inv);
    setPaperFormat(profile.paperSize || 'a4');
  };

  // ─── Active Form State ─────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-CUS-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceTitle, setInvoiceTitle] = useState(profile.invoiceTitle);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPassport, setCustomerPassport] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [receivingAccount, setReceivingAccount] = useState(profile.receivingAccountNo);
  const [receivingAccountName, setReceivingAccountName] = useState(profile.receivingAccountName);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [customNote, setCustomNote] = useState('');

  // Items in active receipt
  const [items, setItems] = useState([
    { id: 1, description: 'Angkor Wat Sunrise Private Tour (Tuk-Tuk)', qty: 1, unit: 'ថ្ងៃ', rate: 25.0, total: 25.0 }
  ]);

  // Sync defaults when profile updates
  useEffect(() => {
    setReceivingAccount(profile.receivingAccountNo);
    setReceivingAccountName(profile.receivingAccountName);
    setInvoiceTitle(profile.invoiceTitle);
  }, [profile.receivingAccountNo, profile.receivingAccountName, profile.invoiceTitle]);

  // ─── Item Calculations ─────────────────────────────────────────────────────
  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      const it = { ...copy[index], [field]: value };
      const q = Number(field === 'qty' ? value : it.qty) || 0;
      const r = Number(field === 'rate' ? value : it.rate) || 0;
      it.total = q * r;
      copy[index] = it;
      return copy;
    });
  };

  const handleAddItem = (preset = null) => {
    if (preset) {
      setItems(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          description: preset.name,
          qty: preset.qty || 1,
          unit: preset.unit || 'ថ្ងៃ',
          rate: preset.rate || 0,
          total: (preset.qty || 1) * (preset.rate || 0)
        }
      ]);
    } else {
      setItems(prev => [
        ...prev,
        { id: Date.now(), description: '', qty: 1, unit: 'ថ្ងៃ', rate: 0, total: 0 }
      ]);
    }
  };

  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.total) || 0), 0);
  }, [items]);

  const discountVal = Number(discountAmount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountVal);
  const taxVal = (taxableAmount * (Number(taxPercent) || 0)) / 100;
  const grandTotal = Math.max(0, taxableAmount + taxVal);
  const grandTotalKhr = grandTotal * (profile.exchangeRate || 4000);

  // ─── Print Modal State ─────────────────────────────────────────────────────
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);
  const [paperFormat, setPaperFormat] = useState(profile.paperSize || 'a4');

  // ─── Save & Open Print (Create or Update) ───────────────────────────────────
  const handleGenerateInvoice = () => {
    if (!customerName.trim() && items.length === 0) {
      alert('សូមបញ្ចូលឈ្មោះអតិថិជន និងមុខទំនិញ/សេវាកម្ម! (Please enter customer name and at least one item)');
      return;
    }

    const currentInvId = editingInvoiceId || invoiceNumber;
    const existingInv = editingInvoiceId ? invoicesHistory.find(i => i.id === editingInvoiceId) : null;

    const newInv = {
      id: currentInvId,
      invoiceNumber,
      invoiceTitle,
      date: invoiceDate,
      time: existingInv?.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      customerName: customerName.trim() || 'Valued Customer',
      customerPhone,
      customerPassport,
      customerCompany,
      customerAddress,
      items: items.filter(it => it.description.trim()),
      subtotal,
      discount: discountVal,
      tax: taxVal,
      taxPercent: Number(taxPercent) || 0,
      grandTotal,
      grandTotalKhr,
      paymentMethod,
      receivingAccount,
      receivingAccountName,
      customNote,
      profile: { ...profile },
      createdAt: existingInv?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let updated;
    if (editingInvoiceId) {
      updated = invoicesHistory.map(i => i.id === editingInvoiceId ? newInv : i);
      setEditingInvoiceId(null);
    } else {
      updated = [newInv, ...invoicesHistory];
    }

    saveInvoicesHistory(updated);
    setActivePrintInvoice(newInv);
    setPaperFormat(profile.paperSize || 'a4');
  };

  // ─── Direct Iframe Printing (Guarantees 100% clean receipt, no blank page) ───
  const handleTriggerPrint = () => {
    const printableEl = document.getElementById('custom-invoice-printable-area');
    if (!printableEl) {
      window.print();
      return;
    }

    let iframe = document.getElementById('hidden-custom-invoice-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'hidden-custom-invoice-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    let stylesHtml = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
      stylesHtml += el.outerHTML + '\n';
    });

    const isPosFormat = paperFormat === 'pos80' || paperFormat === 'pos58';
    const pageSize = paperFormat === 'pos58' ? '58mm auto' : paperFormat === 'pos80' ? '80mm auto' : 'A4 portrait';
    const pageMargin = isPosFormat ? '0mm' : '8mm';
    const containerWidth = paperFormat === 'pos58' ? '54mm' : paperFormat === 'pos80' ? '76mm' : '100%';

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${activePrintInvoice?.invoiceNumber || 'Invoice_Receipt'}</title>
          ${stylesHtml}
          <style>
            @page {
              size: ${pageSize} !important;
              margin: ${pageMargin} !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #111827 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: ${isPosFormat ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'} !important;
              padding: ${isPosFormat ? '1mm 2mm' : '0'} !important;
            }
            .custom-invoice-print-wrapper {
              width: 100% !important;
              max-width: ${containerWidth} !important;
              margin: 0 auto !important;
              background: #ffffff !important;
            }
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            thead {
              display: table-header-group !important;
            }
            tr {
              page-break-inside: avoid !important;
            }
            img {
              max-width: 100% !important;
            }
          </style>
        </head>
        <body>
          <div class="custom-invoice-print-wrapper">
            ${printableEl.innerHTML}
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('Iframe print error, falling back to window.print():', e);
        window.print();
      }
    }, 280);
  };

  useEffect(() => {
    if (!activePrintInvoice) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleTriggerPrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePrintInvoice, paperFormat]);

  const handleResetForm = () => {
    setEditingInvoiceId(null);
    setInvoiceNumber(`INV-CUS-${Date.now().toString().slice(-6)}`);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setInvoiceTitle(profile.invoiceTitle);
    setCustomerPhone('');
    setCustomerPassport('');
    setCustomerCompany('');
    setCustomerAddress('');
    setPaymentMethod('CASH');
    setDiscountAmount(0);
    setTaxPercent(0);
    setCustomNote('');
    setItems([{ id: Date.now(), description: '', qty: 1, unit: 'ថ្ងៃ', rate: 0, total: 0 }]);
  };

  // ─── Save Profile Settings ─────────────────────────────────────────────────
  const [savingSettings, setSavingSettings] = useState(false);
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const updated = {
        ...settings,
        custom_invoice_profile: profile
      };
      if (typeof setSettings === 'function') {
        setSettings(updated);
      }
      const token = localStorage.getItem('token') || auth?.token;
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ custom_invoice_profile: profile })
      }).catch(err => console.warn('Server settings save error:', err));

      alert('បានរក្សាទុកការកំណត់ Custom Invoice & Other Receipts ដោយជោគជ័យ!');
    } catch (err) {
      alert(`Error saving profile: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <>
      <div className={`space-y-6 pb-20 ${activePrintInvoice ? 'print:hidden' : ''}`}>
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* Header Banner                                                        */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-teal-950 text-white rounded-3xl p-6 shadow-xl border border-stone-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 text-2xl shadow-inner">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Custom Receipt / Invoice Generator
                </span>
                <span className="text-xs text-stone-400">Other Services & General Billing</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white mt-1">
                វិក្កយបត្រទូទៅ & សេវាកម្មផ្សេងៗ (Custom Invoices & Other Receipts)
              </h1>
              <p className="text-xs text-stone-300 mt-0.5">
                Generate, customize, and print receipts for tours, laundry, airport taxi, food, deposits, and any other services.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-4 py-2 bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-stone-700"
            >
              <i className="fa-solid fa-rotate-right"></i>
              <span>New Receipt (បង្កើតថ្មី)</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-stone-800/80">
          {[
            { id: 'create', label: '✍️ Create Custom Receipt (បង្កើតវិក្កយបត្រ)', icon: 'fa-pen-to-square' },
            { id: 'history', label: '🧾 Receipt History (ប្រវត្តិវិក្កយបត្រ)', icon: 'fa-receipt', count: invoicesHistory.length },
            { id: 'settings', label: '⚙️ Custom Branding & Printer Profile (កំណត់ឈ្មោះ Logo អាសយដ្ឋាន)', icon: 'fa-sliders' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-teal-500 text-stone-950 shadow-lg shadow-teal-500/20 font-black scale-102'
                  : 'bg-stone-800/90 text-stone-300 hover:text-white hover:bg-stone-700'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-stone-900/60 text-[10px] font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 1: CREATE CUSTOM INVOICE                                         */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Metadata, Items, Customer (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Editing Invoice Active Banner */}
            {editingInvoiceId && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                    <i className="fa-solid fa-pen-to-square"></i>
                  </span>
                  <div>
                    <h4 className="font-black text-sm text-stone-900">
                      កំពុងកែសម្រួលវិក្កយបត្រ (Editing Invoice): <span className="font-mono text-amber-700 font-bold">#{invoiceNumber}</span>
                    </h4>
                    <p className="text-xs text-stone-500">
                      កែប្រែទិន្នន័យអតិថិជន ទំនិញ តម្លៃ ឬឯកតា (ថ្ងៃ យប់ ខែ) រួចចុច &ldquo;Update &amp; Print&rdquo; នៅខាងស្ដាំ
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-stone-400"></i>
                  <span>Cancel Edit (បោះបង់)</span>
                </button>
              </div>
            )}

            {/* 1. Header & Customer Box */}
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-user-tag"></i>
                  </span>
                  ព័ត៌មានអតិថិជន & វិក្កយបត្រ (Invoice & Customer Information)
                </h3>
                <span className="text-xs font-mono font-bold text-stone-400">#{invoiceNumber}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Invoice Title / Header (ចំណងជើងវិក្កយបត្រ)
                  </label>
                  <input
                    type="text"
                    value={invoiceTitle}
                    onChange={e => setInvoiceTitle(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold focus:ring-1 focus:ring-teal-500"
                    placeholder="OFFICIAL RECEIPT / INVOICE"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Invoice Number (លេខវិក្កយបត្រ)
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono font-bold focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Date (កាលបរិច្ឆេទ)
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-medium focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Customer Name (ឈ្មោះអតិថិជន) *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="e.g. John Doe / លោក សុខា"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Phone Number (លេខទូរស័ព្ទ)
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="+855 ... / 012 ..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Passport / National ID (លេខអត្តសញ្ញាណប័ណ្ណ)
                  </label>
                  <input
                    type="text"
                    value={customerPassport}
                    onChange={e => setCustomerPassport(e.target.value)}
                    placeholder="Optional passport / ID..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                    Customer Address / Company / Bill-To (អាសយដ្ឋាន ឬក្រុមហ៊ុន)
                  </label>
                  <input
                    type="text"
                    value={customerAddress || customerCompany}
                    onChange={e => {
                      setCustomerAddress(e.target.value);
                      setCustomerCompany(e.target.value);
                    }}
                    placeholder="e.g. Room 102 Guest / Angkor Travels Co. / Phnom Penh, Cambodia"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Items & Services Table */}
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-list-check"></i>
                  </span>
                  មុខទំនិញ ឬសេវាកម្ម (Items & Services Description)
                </h3>
                {/* Fast Preset Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-stone-400 shrink-0">Fast Presets:</span>
                  <select
                    onChange={e => {
                      const found = PRESET_SERVICES.find(p => p.name === e.target.value);
                      if (found) handleAddItem(found);
                      e.target.value = '';
                    }}
                    className="bg-teal-50 text-teal-900 font-bold border border-teal-200 rounded-xl px-2.5 py-1 text-xs cursor-pointer focus:outline-hidden"
                  >
                    <option value="">+ Add Popular Service...</option>
                    {PRESET_SERVICES.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.name} (${p.rate.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <datalist id="unit-options-list">
                  <option value="ថ្ងៃ">ថ្ងៃ (Day)</option>
                  <option value="យប់">យប់ (Night)</option>
                  <option value="ខែ">ខែ (Month)</option>
                  <option value="ម៉ោង">ម៉ោង (Hour)</option>
                  <option value="កញ្ចប់">កញ្ចប់ (Package)</option>
                  <option value="ដង">ដង (Times)</option>
                  <option value="ជើង">ជើង (Trip)</option>
                  <option value="នាក់">នាក់ (Pax)</option>
                  <option value="គីឡូ">គីឡូ (Kg)</option>
                </datalist>

                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-stone-200 text-stone-500 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-2 w-8">#</th>
                      <th className="py-2.5 px-2 min-w-[180px]">Description / Service Details</th>
                      <th className="py-2.5 px-2 w-16 text-center">Qty</th>
                      <th className="py-2.5 px-2 w-36 text-center">Unit / Period (ថ្ងៃ យប់ ខែ)</th>
                      <th className="py-2.5 px-2 w-24 text-right">Rate ($)</th>
                      <th className="py-2.5 px-2 w-24 text-right">Total ($)</th>
                      <th className="py-2.5 px-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-2.5 px-2 font-mono text-stone-400">{idx + 1}</td>
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={it.description}
                            onChange={e => handleItemChange(idx, 'description', e.target.value)}
                            placeholder="e.g. Airport Transfer / Laundry Service / Tour Guide..."
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 font-semibold focus:ring-1 focus:ring-teal-500"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center align-middle">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={it.qty}
                            onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                            className="w-14 bg-stone-50 border border-stone-200 rounded-lg px-1.5 py-1.5 text-xs text-center font-mono font-bold text-stone-900 focus:ring-1 focus:ring-teal-500"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center align-middle">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="text"
                              list="unit-options-list"
                              value={it.unit || ''}
                              onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                              placeholder="ថ្ងៃ / យប់ / ខែ"
                              className="w-28 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-center font-bold text-teal-900 placeholder-stone-400 focus:ring-1 focus:ring-teal-500 focus:bg-white"
                            />
                            {/* Fast 1-click pills for ថ្ងៃ, យប់, ខែ */}
                            <div className="flex items-center justify-center gap-1">
                              {['ថ្ងៃ', 'យប់', 'ខែ'].map(u => (
                                <button
                                  key={u}
                                  type="button"
                                  onClick={() => handleItemChange(idx, 'unit', u)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                    it.unit === u
                                      ? 'bg-teal-600 text-white shadow-xs'
                                      : 'bg-stone-100 hover:bg-teal-50 text-stone-600 hover:text-teal-700'
                                  }`}
                                  title={`ជ្រើសរើស ${u}`}
                                >
                                  {u}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right align-middle">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.rate}
                            onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                            className="w-20 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold text-stone-900 focus:ring-1 focus:ring-teal-500"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-black text-stone-900 text-xs align-middle">
                          {currency(it.total)}
                        </td>
                        <td className="py-2.5 px-2 text-center align-middle">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-stone-300 hover:text-rose-600 transition cursor-pointer p-1"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Custom Row Button */}
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-plus text-stone-500"></i>
                <span>Add Row (បន្ថែមជួរថ្មី)</span>
              </button>
            </div>
          </div>

          {/* Right Summary & Payment Panel (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-stone-200 shadow-lg p-5 space-y-4 sticky top-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-receipt"></i>
                </span>
                <div>
                  <h2 className="font-black text-sm text-stone-900">Total & Payment</h2>
                  <p className="text-[10px] text-stone-400 font-mono">Invoice Summary</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px]">
                {items.length} Items
              </span>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal (សរុប):</span>
                <span className="font-mono font-bold text-stone-900">{currency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount (បញ្ចុះតម្លៃ $):</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={discountAmount || ''}
                  onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-20 text-right bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Tax / Service (ពន្ធ %):</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={taxPercent || ''}
                  onChange={e => setTaxPercent(Number(e.target.value) || 0)}
                  placeholder="0%"
                  className="w-16 text-right bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-mono"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline font-bold text-stone-900">
                <span className="text-sm">Grand Total (USD):</span>
                <span className="font-black text-lg text-teal-700 font-mono">{currency(grandTotal)}</span>
              </div>
              {profile.showKhr && (
                <div className="flex justify-between items-center text-[11px] text-stone-500 bg-teal-50/60 p-2.5 rounded-xl border border-teal-200/60">
                  <span>Total in KHR ({profile.exchangeRate.toLocaleString()}៛):</span>
                  <span className="font-mono font-bold text-teal-900">{grandTotalKhr.toLocaleString()} ៛</span>
                </div>
              )}
            </div>

            {/* Payment Method Selector (By Form) */}
            <div className="pt-3 border-t border-stone-200 space-y-2">
              <label className="block text-[10px] font-bold text-stone-700 uppercase">
                Payment Method (វិធីសាស្រ្តទូទាត់):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['CASH', 'ABA', 'KHQR', 'BANK TRANSFER', 'CARD'].map(pm => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPaymentMethod(pm)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      paymentMethod.toUpperCase() === pm
                        ? 'bg-teal-600 text-white shadow-2xs font-black'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value.toUpperCase())}
                placeholder="Or custom method..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-stone-900"
              />
            </div>

            {/* ដាក់លេខគណនីទទួល & ឈ្មោះគណនីទទួល (Editable by Form) */}
            {profile.showReceivingAccount && (
              <div className="pt-2 border-t border-stone-200 space-y-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-building-columns text-blue-600"></i>
                    <span>ដាក់លេខគណនីទទួល:</span>
                  </label>
                  <input
                    type="text"
                    value={receivingAccount}
                    onChange={e => setReceivingAccount(e.target.value)}
                    placeholder="000 314 574"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                    <i className="fa-regular fa-user text-stone-500"></i>
                    <span>ឈ្មោះគណនីទទួល:</span>
                  </label>
                  <input
                    type="text"
                    value={receivingAccountName}
                    onChange={e => setReceivingAccountName(e.target.value)}
                    placeholder="SOM SUMNANG"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-900"
                  />
                </div>
              </div>
            )}

            {/* Notes / Special Instructions */}
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                Custom Invoice Note (កំណត់សម្គាល់)
              </label>
              <textarea
                rows={2}
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                placeholder="Optional notes printed on invoice..."
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-800 resize-none focus:outline-hidden"
              />
            </div>

            {/* Print & Generate Action */}
            <button
              type="button"
              onClick={handleGenerateInvoice}
              className={`w-full py-3.5 text-white font-black text-sm rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                editingInvoiceId
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-600/25'
                  : 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 shadow-teal-600/25'
              }`}
            >
              <i className={editingInvoiceId ? "fa-solid fa-floppy-disk" : "fa-solid fa-print"}></i>
              <span>
                {editingInvoiceId
                  ? `Update & Print Receipt (${currency(grandTotal)})`
                  : `Generate & Print Receipt (${currency(grandTotal)})`}
              </span>
            </button>
          </div>

          {/* Quick / Short Recent History Bar (Below create form) */}
          {invoicesHistory.length > 0 && (
            <div className="lg:col-span-12 bg-white rounded-3xl border border-stone-200 p-5 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-clock-rotate-left"></i>
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-stone-900">
                      Recent Invoices (វិក្កយបត្រថ្មីៗ - Quick Actions)
                    </h4>
                    <p className="text-[10px] text-stone-400">Quick edit, delete, or reprint without leaving this tab</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('history')}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>See Full History ({invoicesHistory.length})</span>
                  <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {invoicesHistory.slice(0, 4).map(inv => (
                  <div key={inv.id} className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 hover:border-teal-300 transition space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-stone-900">#{inv.invoiceNumber}</span>
                      <span className="font-mono font-black text-xs text-teal-700">{currency(inv.grandTotal)}</span>
                    </div>
                    <div className="text-[11px] text-stone-700 truncate font-semibold">
                      {inv.customerName}
                    </div>
                    <div className="text-[10px] text-stone-400 truncate">
                      {inv.items?.map(it => `${it.qty} ${it.unit || ''} ${it.description}`).join(', ')}
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-stone-200">
                      <button
                        type="button"
                        onClick={() => handleReprintInvoice(inv)}
                        className="flex-1 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Print Again"
                      >
                        <i className="fa-solid fa-print"></i>
                        <span>Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditInvoice(inv)}
                        className="p-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Edit Invoice"
                      >
                        <i className="fa-solid fa-pen text-[10px]"></i>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                        className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                        title="Delete Invoice"
                      >
                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 2: RECEIPT HISTORY                                              */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-6 space-y-6">
          {/* Header & Metrics Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div>
              <h2 className="font-black text-base text-stone-900">Custom & Other Invoices History (ប្រវត្តិវិក្កយបត្រ)</h2>
              <p className="text-xs text-stone-500">Track, sort, search, edit, delete, and reprint past non-room and non-moto receipts</p>
            </div>
            <span className="text-xs text-stone-400 font-mono">Total Receipts: {invoicesHistory.length}</span>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200">
              <span className="text-[10px] font-bold text-stone-400 uppercase block">Total Receipts</span>
              <span className="text-lg font-black text-stone-900 font-mono">{historyMetrics.totalCount}</span>
            </div>
            <div className="bg-teal-50/50 rounded-2xl p-3.5 border border-teal-200/60">
              <span className="text-[10px] font-bold text-teal-600 uppercase block">Total Revenue (USD)</span>
              <span className="text-lg font-black text-teal-800 font-mono">{currency(historyMetrics.totalRevenue)}</span>
            </div>
            <div className="bg-blue-50/50 rounded-2xl p-3.5 border border-blue-200/60">
              <span className="text-[10px] font-bold text-blue-600 uppercase block">Today Receipts</span>
              <span className="text-lg font-black text-blue-800 font-mono">{historyMetrics.todayCount}</span>
            </div>
            <div className="bg-emerald-50/50 rounded-2xl p-3.5 border border-emerald-200/60">
              <span className="text-[10px] font-bold text-emerald-600 uppercase block">Today Revenue (USD)</span>
              <span className="text-lg font-black text-emerald-800 font-mono">{currency(historyMetrics.todayRevenue)}</span>
            </div>
          </div>

          {/* Search, Sort, and Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200">
            {/* Search Input */}
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none"></i>
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="ស្វែងរកតាមលេខវិក្កយបត្រ, ឈ្មោះភ្ញៀវ, លេខទូរស័ព្ទ, មុខទំនិញ... (Search by invoice #, customer, phone, item)"
                className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-7 py-2 text-xs text-stone-800 placeholder-stone-400 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs w-4 h-4 flex items-center justify-center cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Sort & Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-white border border-stone-200 px-2.5 py-1.5 rounded-xl text-xs">
                <i className="fa-solid fa-arrow-down-wide-short text-stone-400 text-[11px]"></i>
                <span className="text-[10px] font-bold text-stone-400 uppercase">Sort:</span>
                <select
                  value={historySort}
                  onChange={e => setHistorySort(e.target.value)}
                  className="bg-transparent font-bold text-stone-800 outline-none cursor-pointer text-xs"
                >
                  <option value="newest">📅 Newest First (ថ្មីបំផុត)</option>
                  <option value="oldest">📅 Oldest First (ចាស់បំផុត)</option>
                  <option value="amount-high">💰 Highest Total (តម្លៃខ្ពស់បំផុត)</option>
                  <option value="amount-low">💰 Lowest Total (តម្លៃទាបបំផុត)</option>
                  <option value="customer">👤 Customer A-Z (ឈ្មោះអតិថិជន)</option>
                </select>
              </div>

              {/* Payment Filter Selector */}
              <div className="flex items-center gap-1">
                {['ALL', 'CASH', 'ABA', 'KHQR', 'CARD'].map(pm => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setHistoryFilterPayment(pm)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      historyFilterPayment === pm
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>

              {invoicesHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllHistory}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Clear All History (លុបប្រវត្តិទាំងអស់)"
                >
                  <i className="fa-solid fa-trash-can text-[10px]"></i>
                  <span>លុបទាំងអស់ (Clear All)</span>
                </button>
              )}
            </div>
          </div>

          {filteredInvoicesHistory.length === 0 ? (
            <div className="py-16 text-center text-stone-400 space-y-2">
              <i className="fa-solid fa-receipt text-4xl text-stone-300"></i>
              <p className="text-sm font-bold text-stone-700">No Custom Receipts Found</p>
              <p className="text-xs">
                {historySearch || historyFilterPayment !== 'ALL'
                  ? 'No receipts match your search or filter criteria.'
                  : 'Create your first custom receipt from the create tab above.'}
              </p>
              {(historySearch || historyFilterPayment !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryFilterPayment('ALL');
                  }}
                  className="mt-2 px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Clear Filters (សម្អាតការស្វែងរក)
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-stone-200 text-stone-500 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Receipt #</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Customer Details</th>
                    <th className="py-3 px-3">Services / Items</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3 text-right">Total USD</th>
                    <th className="py-3 px-3 text-center w-52">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredInvoicesHistory.map(inv => (
                    <tr key={inv.id} className="hover:bg-stone-50/70 transition">
                      <td className="py-3 px-3 font-mono font-bold text-stone-900">
                        <span className="bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200/80">
                          #{inv.invoiceNumber}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-500 whitespace-nowrap">
                        <div className="font-semibold text-stone-800">{inv.date}</div>
                        <div className="font-mono text-[10px] text-stone-400">{inv.time}</div>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-stone-900">{inv.customerName}</p>
                        {inv.customerPhone && <p className="text-[10px] text-stone-500 font-mono">{inv.customerPhone}</p>}
                        {inv.customerPassport && <p className="text-[10px] text-stone-400 font-mono">ID: {inv.customerPassport}</p>}
                      </td>
                      <td className="py-3 px-3 text-stone-600 max-w-xs">
                        <div className="space-y-0.5">
                          {inv.items?.map((it, i) => (
                            <div key={i} className="truncate">
                              <span className="font-bold text-stone-800">{it.qty} {it.unit || ''}</span> × {it.description}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-100 text-stone-700 border border-stone-200">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-mono font-black text-teal-700 text-xs">
                          {currency(inv.grandTotal)}
                        </div>
                        {inv.grandTotalKhr > 0 && (
                          <div className="font-mono text-[10px] text-stone-400">
                            {inv.grandTotalKhr.toLocaleString()} ៛
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1. Print Again Button */}
                          <button
                            type="button"
                            onClick={() => handleReprintInvoice(inv)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                            title="Print Again (បោះពុម្ពឡើងវិញ)"
                          >
                            <i className="fa-solid fa-print"></i>
                            <span>Print</span>
                          </button>

                          {/* 2. Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleEditInvoice(inv)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                            title="Edit Invoice (កែសម្រួលវិក្កយបត្រ)"
                          >
                            <i className="fa-solid fa-pen"></i>
                            <span>Edit</span>
                          </button>

                          {/* 3. Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                            title="Delete Invoice (លុបវិក្កយបត្រ)"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 3: BRANDING & PROFILE SETTINGS                                   */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div>
              <h2 className="font-black text-base text-stone-900">
                Custom Invoice Profile & Printer Branding
              </h2>
              <p className="text-xs text-stone-500">
                Set custom Company Name, Logo, Address, Receiving Account, and Terms for this invoice section
              </p>
            </div>
            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              <span>{savingSettings ? 'Saving...' : 'Save Profile (រក្សាទុក)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                Company / Business Name (ឈ្មោះក្រុមហ៊ុន/ហាង)
              </label>
              <input
                type="text"
                value={profile.businessName}
                onChange={e => setProfile({ ...profile, businessName: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                Default Invoice Header / Title (ចំណងជើងវិក្កយបត្រ)
              </label>
              <input
                type="text"
                value={profile.invoiceTitle}
                onChange={e => setProfile({ ...profile, invoiceTitle: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                Subtitle / Slogan Line (ពាក្យស្លោក)
              </label>
              <input
                type="text"
                value={profile.subtitle}
                onChange={e => setProfile({ ...profile, subtitle: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                Phone Number (លេខទូរស័ព្ទ)
              </label>
              <input
                type="text"
                value={profile.phone}
                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                Business Address (អាសយដ្ឋាន)
              </label>
              <input
                type="text"
                value={profile.address}
                onChange={e => setProfile({ ...profile, address: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                Tax / VAT Identification ID (លេខសារពើពន្ធ)
              </label>
              <input
                type="text"
                value={profile.taxNumber}
                onChange={e => setProfile({ ...profile, taxNumber: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                KHR Exchange Rate (អត្រាប្តូរប្រាក់រៀល)
              </label>
              <input
                type="number"
                value={profile.exchangeRate}
                onChange={e => setProfile({ ...profile, exchangeRate: Number(e.target.value) || 4000 })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* ដាក់លេខគណនីទទួល & ឈ្មោះគណនីទទួល */}
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1 flex items-center gap-1.5">
                <i className="fa-solid fa-building-columns text-blue-600"></i>
                <span>ដាក់លេខគណនីទទួល (Receiver Account No)</span>
              </label>
              <input
                type="text"
                value={profile.receivingAccountNo}
                onChange={e => setProfile({ ...profile, receivingAccountNo: e.target.value })}
                placeholder="000 314 574"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono font-bold focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1 flex items-center gap-1.5">
                <i className="fa-regular fa-user text-stone-500"></i>
                <span>ឈ្មោះគណនីទទួល (Receiver Account Name)</span>
              </label>
              <input
                type="text"
                value={profile.receivingAccountName}
                onChange={e => setProfile({ ...profile, receivingAccountName: e.target.value })}
                placeholder="SOM SUMNANG"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Logo Upload */}
            <div className="md:col-span-2 p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <label className="block text-[11px] font-bold text-stone-700 uppercase">
                Invoice Logo (ឡូហ្គោវិក្កយបត្រ)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white border border-stone-300 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {profile.logo ? (
                    <img src={profile.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <i className="fa-solid fa-image text-2xl text-stone-300"></i>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const b64 = await fileToBase64(file, 600, 600, 0.85);
                        setProfile({ ...profile, logo: b64 });
                      }
                    }}
                    className="block w-full text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={profile.logo}
                    onChange={e => setProfile({ ...profile, logo: e.target.value })}
                    placeholder="Or paste image URL: https://..."
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-700 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Footer Terms */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                Footer Thank You Note & Terms (កំណត់ត្រាថ្លែងអំណរគុណ ឬលក្ខខណ្ឌ)
              </label>
              <textarea
                rows={2}
                value={profile.footerNote}
                onChange={e => setProfile({ ...profile, footerNote: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:ring-1 focus:ring-teal-500 resize-none"
              />
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: 'showLogo', title: 'Show Logo on Invoices', kh: 'បង្ហាញ Logo លើវិក្កយបត្រ' },
              { key: 'showKhr', title: 'Show Dual KHR ៛ Amount', kh: 'បង្ហាញតម្លៃជាប្រាក់រៀល' },
              { key: 'showReceivingAccount', title: 'Show ដាក់លេខគណនីទទួល & ឈ្មោះគណនីទទួល', kh: 'បង្ហាញព័ត៌មានគណនីទទួលប្រាក់' },
              { key: 'showTaxId', title: 'Show VAT / Tax Registration ID', kh: 'បង្ហាញលេខសារពើពន្ធ' },
              { key: 'showSignatures', title: 'Show Signature Blocks (A4 Format)', kh: 'បង្ហាញកន្លែងចុះហត្ថលេខា' }
            ].map(tog => (
              <label key={tog.key} className="flex items-center justify-between p-3 rounded-2xl border border-stone-200 bg-stone-50/60 cursor-pointer hover:bg-stone-50">
                <div className="pr-2">
                  <span className="block font-bold text-xs text-stone-800">{tog.title}</span>
                  <span className="block text-[10px] text-stone-500">{tog.kh}</span>
                </div>
                <input
                  type="checkbox"
                  checked={profile[tog.key] !== false}
                  onChange={e => setProfile({ ...profile, [tog.key]: e.target.checked })}
                  className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
                />
              </label>
            ))}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-teal-600/25 transition cursor-pointer"
            >
              {savingSettings ? 'Saving...' : 'Save Profile Settings (រក្សាទុក)'}
            </button>
          </div>
        </form>
      )}

      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* PRINT MODAL: A4 FOLIO, POS 80MM, POS 58MM                           */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activePrintInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75 backdrop-blur-xs overflow-y-auto invoice-modal-overlay print:p-0 print:m-0 print:bg-white print:static print:overflow-visible print:block"
          onClick={() => setActivePrintInvoice(null)}
        >
          <style>{`
            @media print {
              @page {
                size: ${paperFormat === 'pos58' ? '58mm auto' : paperFormat === 'pos80' ? '80mm auto' : 'A4 portrait'};
                margin: ${paperFormat !== 'a4' ? '0' : '8mm'};
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                width: 100% !important;
              }
              .invoice-modal-overlay {
                display: block !important;
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                overflow: visible !important;
              }
              .custom-printable-container {
                width: ${paperFormat === 'pos58' ? '54mm' : paperFormat === 'pos80' ? '76mm' : '100%'} !important;
                max-width: ${paperFormat === 'pos58' ? '54mm' : paperFormat === 'pos80' ? '76mm' : '100%'} !important;
                margin: 0 auto !important;
                padding: ${paperFormat !== 'a4' ? '2mm' : '0'} !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                max-height: none !important;
                overflow: visible !important;
              }
            }
          `}</style>

          <div
            onClick={e => e.stopPropagation()}
            className={`bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col custom-printable-container print:shadow-none print:border-none print:rounded-none ${
              paperFormat === 'pos58' ? 'max-w-[290px]' : paperFormat === 'pos80' ? 'max-w-[360px]' : 'w-full max-w-3xl'
            }`}
          >
            {/* Top Bar (Hidden in Print) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-stone-900 text-white print:hidden border-b border-stone-800">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-sm">
                  <i className="fa-solid fa-file-invoice"></i>
                </span>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm">Print Invoice & Receipt</h3>
                  <p className="text-[10px] text-stone-400 font-mono">{activePrintInvoice.invoiceNumber}</p>
                </div>
              </div>

              {/* Paper Format Switcher */}
              <div className="flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700">
                <button
                  type="button"
                  onClick={() => setPaperFormat('a4')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    paperFormat === 'a4' ? 'bg-teal-500 text-stone-950 shadow-xs' : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-file-lines text-[11px]"></i>
                  <span>A4 Folio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaperFormat('pos80')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    paperFormat === 'pos80' ? 'bg-teal-500 text-stone-950 shadow-xs' : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-receipt text-[11px]"></i>
                  <span>POS 80mm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaperFormat('pos58')}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    paperFormat === 'pos58' ? 'bg-teal-500 text-stone-950 shadow-xs' : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <i className="fa-solid fa-receipt text-[11px]"></i>
                  <span>58mm</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Print ({paperFormat.toUpperCase()})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePrintInvoice(null)}
                  className="w-7 h-7 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center text-xs transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Body */}
            <div id="custom-invoice-printable-area" className="overflow-y-auto p-6 sm:p-8 flex-1 print:p-0 print:overflow-visible">
              {/* ───────────────────────────────────────────────────────────── */}
              {/* A4 FORMAT                                                     */}
              {/* ───────────────────────────────────────────────────────────── */}
              {paperFormat === 'a4' && (
                <div className="max-w-2xl mx-auto space-y-6 text-stone-800 font-sans text-xs">
                  {/* Header */}
                  <div className="flex items-start justify-between pb-6 border-b-2 border-stone-800">
                    <div className="flex items-center gap-4">
                      {profile.showLogo && profile.logo && (
                        <img
                          src={profile.logo}
                          alt="Logo"
                          className="w-16 h-16 object-contain rounded-xl border border-stone-200 p-1 bg-stone-50"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-stone-950 font-display">
                          {profile.businessName}
                        </h1>
                        <p className="text-xs text-teal-800 font-semibold">{profile.subtitle}</p>
                        <p className="text-[11px] text-stone-500 mt-1">{profile.address}</p>
                        <p className="text-[11px] text-stone-500">Tel: {profile.phone}</p>
                        {profile.showTaxId && profile.taxNumber && (
                          <p className="text-[10px] text-stone-400 font-mono">VAT/Tax ID: {profile.taxNumber}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="inline-block px-3 py-1 bg-stone-900 text-white rounded-lg text-xs font-black uppercase tracking-wider font-mono">
                        {activePrintInvoice.invoiceTitle || 'OFFICIAL RECEIPT'}
                      </span>
                      <p className="text-xs font-mono font-bold text-stone-900 pt-1">
                        #{activePrintInvoice.invoiceNumber}
                      </p>
                      <p className="text-[11px] text-stone-500">{activePrintInvoice.date}</p>
                      <p className="text-[11px] text-stone-400 font-mono">{activePrintInvoice.time}</p>
                    </div>
                  </div>

                  {/* Customer Information Box */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">Billed To (អតិថិជន)</span>
                      <span className="font-black text-sm text-stone-900">{activePrintInvoice.customerName}</span>
                      {activePrintInvoice.customerPhone && (
                        <p className="text-stone-500 font-mono text-[11px] mt-0.5">Tel: {activePrintInvoice.customerPhone}</p>
                      )}
                      {activePrintInvoice.customerPassport && (
                        <p className="text-stone-500 font-mono text-[11px]">ID/Passport: {activePrintInvoice.customerPassport}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-bold block">Company / Address</span>
                      <span className="font-semibold text-stone-800">
                        {activePrintInvoice.customerAddress || activePrintInvoice.customerCompany || 'N/A'}
                      </span>
                      <p className="text-[11px] text-stone-400 mt-1">Status: Paid in Full</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-stone-200 text-stone-500 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-2">#</th>
                          <th className="py-2.5 px-2">Description / Services Details</th>
                          <th className="py-2.5 px-2 text-center">Qty / Period (ចំនួន / ឯកតា)</th>
                          <th className="py-2.5 px-2 text-right">Unit Rate</th>
                          <th className="py-2.5 px-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {activePrintInvoice.items?.map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-2 font-mono text-stone-400">{idx + 1}</td>
                            <td className="py-2.5 px-2 font-bold text-stone-900">{it.description}</td>
                            <td className="py-2.5 px-2 text-center font-mono">
                              <span className="font-bold text-stone-900">{it.qty}</span>
                              {it.unit ? (
                                <span className="font-sans font-bold text-stone-700 ml-1.5 px-1.5 py-0.5 bg-stone-100 rounded text-[11px]">
                                  {it.unit}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">{currency(it.rate)}</td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-stone-900">
                              {currency(it.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Terms & Totals */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-t-2 border-stone-200 pt-4">
                    <div className="max-w-xs text-[11px] text-stone-500 space-y-1">
                      <p className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">Terms & Conditions</p>
                      <p>{profile.footerNote}</p>
                      {activePrintInvoice.customNote && (
                        <p className="text-stone-700 italic pt-0.5">Note: {activePrintInvoice.customNote}</p>
                      )}
                      <p className="font-mono text-[10px] text-stone-500 pt-1">
                        Payment Method: <span className="font-bold text-stone-800">{activePrintInvoice.paymentMethod}</span>
                      </p>
                      {profile.showReceivingAccount && (
                        <div className="pt-1 font-mono text-[10px] text-stone-700 space-y-0.5">
                          <p>
                            ដាក់លេខគណនីទទួល <span className="font-bold text-stone-900">{activePrintInvoice.receivingAccount}</span>
                          </p>
                          <p>
                            ឈ្មោះគណនីទទួល <span className="font-bold text-stone-900">{activePrintInvoice.receivingAccountName}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-60 space-y-1.5 text-xs">
                      <div className="flex justify-between text-stone-600">
                        <span>Charges Subtotal:</span>
                        <span className="font-mono font-semibold">{currency(activePrintInvoice.subtotal)}</span>
                      </div>
                      {activePrintInvoice.discount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Discount:</span>
                          <span className="font-mono font-semibold">-{currency(activePrintInvoice.discount)}</span>
                        </div>
                      )}
                      <div className="border-t border-stone-200 pt-2 flex justify-between items-baseline font-bold text-stone-900">
                        <span className="text-sm">Grand Total (USD):</span>
                        <span className="text-base font-mono font-black text-teal-700">
                          {currency(activePrintInvoice.grandTotal)}
                        </span>
                      </div>
                      {profile.showKhr && (
                        <div className="flex justify-between items-center text-[11px] text-stone-500 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200">
                          <span>Total in KHR ({profile.exchangeRate.toLocaleString()}៛):</span>
                          <span className="font-mono font-bold text-stone-700">
                            {activePrintInvoice.grandTotalKhr.toLocaleString()} ៛
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Signatures */}
                  {profile.showSignatures && (
                    <div className="grid grid-cols-2 gap-8 pt-8 border-t border-stone-200 text-center text-xs text-stone-500">
                      <div>
                        <div className="h-12 border-b border-dashed border-stone-300 mb-2"></div>
                        <p className="font-bold text-stone-800">Customer Signature</p>
                        <p className="text-[10px] text-stone-400">ហត្ថលេខាអតិថិជន</p>
                      </div>
                      <div>
                        <div className="h-12 border-b border-dashed border-stone-300 mb-2"></div>
                        <p className="font-bold text-stone-800">Authorized Signature / Stamp</p>
                        <p className="text-[10px] text-stone-400">ហត្ថលេខា និងត្រាអ្នកទទួលប្រាក់</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* POS THERMAL FORMAT (80mm & 58mm)                              */}
              {/* ───────────────────────────────────────────────────────────── */}
              {paperFormat !== 'a4' && (
                <div className="text-stone-950 font-mono text-[11px] leading-tight select-all space-y-2">
                  <div className="text-center space-y-1">
                    {profile.showLogo && profile.logo && (
                      <img
                        src={profile.logo}
                        alt="Logo"
                        className="w-10 h-10 object-contain mx-auto mb-1 filter grayscale"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <h2 className="font-black text-sm uppercase tracking-wider">{profile.businessName}</h2>
                    {profile.subtitle && <p className="text-[10px] text-stone-600">{profile.subtitle}</p>}
                    <p className="text-[10px] text-stone-600">{profile.address}</p>
                    <p className="text-[10px] text-stone-600">Tel: {profile.phone}</p>
                    {profile.showTaxId && profile.taxNumber && (
                      <p className="text-[9px] text-stone-500">VAT: {profile.taxNumber}</p>
                    )}
                  </div>

                  <div className="border-b border-dashed border-stone-400 my-2"></div>

                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>RCVD: #{activePrintInvoice.invoiceNumber}</span>
                      <span>{activePrintInvoice.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TIME: {activePrintInvoice.time}</span>
                      <span>PAY: {activePrintInvoice.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>CLIENT: {activePrintInvoice.customerName}</span>
                    </div>
                    {activePrintInvoice.customerPhone && (
                      <div>TEL: {activePrintInvoice.customerPhone}</div>
                    )}
                  </div>

                  <div className="border-b border-dashed border-stone-400 my-2"></div>

                  <div className="space-y-1.5 text-[11px]">
                    {activePrintInvoice.items?.map((it, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between font-bold">
                          <span className="truncate pr-2">{it.description}</span>
                          <span className="font-mono">{currency(it.total)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                          <span>{it.qty} {it.unit ? `${it.unit} ` : ''}x {currency(it.rate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-b border-dashed border-stone-400 my-2"></div>

                  <div className="space-y-1 text-right text-[11px]">
                    <div className="flex justify-between">
                      <span>SUBTOTAL:</span>
                      <span>{currency(activePrintInvoice.subtotal)}</span>
                    </div>
                    {activePrintInvoice.discount > 0 && (
                      <div className="flex justify-between text-rose-700">
                        <span>DISCOUNT:</span>
                        <span>-{currency(activePrintInvoice.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-black pt-1 border-t border-stone-300">
                      <span>TOTAL USD:</span>
                      <span>{currency(activePrintInvoice.grandTotal)}</span>
                    </div>
                    {profile.showKhr && (
                      <div className="flex justify-between text-[10px] font-bold text-stone-700">
                        <span>TOTAL KHR:</span>
                        <span>{activePrintInvoice.grandTotalKhr.toLocaleString()} ៛</span>
                      </div>
                    )}
                  </div>

                  {profile.showReceivingAccount && (
                    <div className="pt-2 mt-2 border-t border-dashed border-stone-300 text-center text-[9px] text-stone-700 space-y-0.5">
                      <div>ដាក់លេខគណនីទទួល {activePrintInvoice.receivingAccount}</div>
                      <div>ឈ្មោះគណនីទទួល {activePrintInvoice.receivingAccountName}</div>
                    </div>
                  )}

                  <div className="border-b-2 border-dashed border-stone-400 my-3"></div>

                  <div className="text-center space-y-1 pt-1">
                    <p className="font-bold text-[10px] uppercase">{profile.footerNote}</p>
                    <p className="text-[9px] text-stone-500">សូមអរគុណចំពោះការប្រើប្រាស់សេវាកម្ម!</p>
                    <p className="text-[8px] text-stone-400 font-sans mt-1">
                      Siem Reap Angkor • General Receipt Folio
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
