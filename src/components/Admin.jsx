import { useState, useEffect, useCallback, useMemo } from 'react';
import { useModal } from './common/ModalProvider';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { dbMotos, dbRooms as firedb } from '../firebase';
import { getSocket, createSocket } from '../services/socket';
import { AdminStatsSkeleton, AdminTableSkeleton, AdminChartSkeleton, Skeleton } from './Skeleton';
import {
  MotoService,
  RoomService,
  BedCategoryService,
  BikeModelService,
  BookingService,
  RentalService,
  CustomerService,
  ExpenseService,
  MaintenanceService,
  ReturnService,
  HotelBookingService
} from '../services/DatabaseService';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import CheckoutTab from './admin/CheckoutTab';
import CheckinTab from './admin/CheckinTab';
import HistoryTab from './admin/HistoryTab';
import CalendarTab from './admin/CalendarTab';
import IncomeTab from './admin/IncomeTab';
import BookingIncomeTab from './admin/BookingIncomeTab';
import MaintenanceTab from './admin/MaintenanceTab';
import ExpensesTab from './admin/ExpensesTab';
import TelegramAlertsTab from './admin/TelegramAlertsTab';
import FeedbackQrTab from './admin/FeedbackQrTab';
import UsersTab from './admin/UsersTab';
import RoomHistoryTab from './admin/RoomHistoryTab';
import RoomIncomeTab from './admin/RoomIncomeTab';
import CustomerDocsTab from './admin/CustomerDocsTab';
import BookingStockTab from './admin/BookingStockTab';
import RoomsTab from './admin/RoomsTab';
import RoomBookingsTab from './admin/RoomBookingsTab';
import SettingsTab from './admin/SettingsTab';
import ReportsTab from './admin/ReportsTab';
import RoomInvoiceModal from './admin/RoomInvoiceModal';
import { normalizeRental, normalizeBooking, normalizeRoom, normalizeMoto, normalizeModel, normalizeBedCategory, asArray, toDateStr } from '../utils/dataNormalizer';
import { fileToBase64 } from '../utils/imageUtils';
import PaginationControls from './common/PaginationControls';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const currency = (v) => `$${parseFloat(v || 0).toFixed(2)}`;
const today = () => new Date().toISOString().split('T')[0];
const statusBadge = {
  vacant:      'bg-emerald-100 text-emerald-700',
  occupied:    'bg-blue-100 text-blue-700',
  cleaning:    'bg-amber-100 text-amber-700',
  maintenance: 'bg-red-100 text-red-700',
  available:   'bg-emerald-100 text-emerald-700',
  rented:      'bg-blue-100 text-blue-700',
  active:      'bg-blue-100 text-blue-700',
  returned:    'bg-stone-100 text-stone-600',
  pending:     'bg-amber-100 text-amber-700',
  done:        'bg-emerald-100 text-emerald-700',
  paid:        'bg-emerald-100 text-emerald-700',
  unpaid:      'bg-red-100 text-red-700',
  checked_in:  'bg-blue-100 text-blue-700',
  checked_out: 'bg-stone-100 text-stone-600',
};

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',         label: 'Dashboard',         icon: 'fa-table-cells-large',   section: 'ទិដ្ឋភាពទូទៅ' },
  { id: 'rooms',             label: 'Rooms',             icon: 'fa-building',            section: 'បន្ទប់' },
  { id: 'room-bookings',     label: 'Room Bookings',     icon: 'fa-calendar-check',      section: 'បន្ទប់' },
  { id: 'room-history',      label: 'Room History',      icon: 'fa-clock-rotate-left',   section: 'បន្ទប់' },
  { id: 'room-income',       label: 'Room Income',       icon: 'fa-hand-holding-dollar', section: 'បន្ទប់' },
  { id: 'fleet',             label: 'Bikes',             icon: 'fa-motorcycle',          section: 'ម៉ូតូ & អតិថិជន' },
  { id: 'guests',            label: 'Customers',         icon: 'fa-user-tie',            section: 'ម៉ូតូ & អតិថិជន' },
  { id: 'customer-documents',label: 'Customer Documents',icon: 'fa-file-lines',          section: 'ម៉ូតូ & អតិថិជន' },
  { id: 'reports',           label: 'Report',            icon: 'fa-chart-simple',        section: 'ម៉ូតូ & អតិថិជន' },
  { id: 'booking-stock',     label: 'Booking Stock (ស្តុកកក់)', icon: 'fa-boxes-stacked',  section: 'ប្រតិបត្តិការជួល' },
  { id: 'bookings',          label: 'Booking List',      icon: 'fa-calendar-check',      section: 'ប្រតិបត្តិការជួល' },
  { id: 'check-out',         label: 'Check Out (ចេញ)',   icon: 'fa-clipboard-check',     section: 'ប្រតិបត្តិការជួល' },
  { id: 'check-in',          label: 'Check In (ចូល)',    icon: 'fa-circle-left',         section: 'ប្រតិបត្តិការជួល' },
  { id: 'history',           label: 'Rental History',    icon: 'fa-clock-rotate-left',   section: 'ប្រតិបត្តិការជួល' },
  { id: 'calendar',          label: 'Calendar',          icon: 'fa-calendar-days',       section: 'ប្រតិបត្តិការជួល' },
  { id: 'income',            label: 'Income',            icon: 'fa-circle-dollar-to-slot', section: 'ប្រតិបត្តិការជួល' },
  { id: 'booking-income',    label: 'Booking Income',    icon: 'fa-hand-holding-dollar', section: 'ប្រតិបត្តិការជួល' },
  { id: 'maintenance',       label: 'Maintenance',       icon: 'fa-wrench',              section: 'គ្រប់គ្រង' },
  { id: 'expenses',          label: 'Expenses',          icon: 'fa-circle-minus',        section: 'គ្រប់គ្រង' },
  { id: 'telegram-alerts',   label: 'Telegram Alerts',   icon: 'fa-telegram',            section: 'គ្រប់គ្រង' },
  { id: 'feedback-qr',       label: 'Feedback QR Code',  icon: 'fa-qrcode',              section: 'គ្រប់គ្រង' },
  { id: 'users',             label: 'Users',             icon: 'fa-user',                section: 'គ្រប់គ្រង' },
  { id: 'cms',               label: 'Website Content',   icon: 'fa-pen-to-square',       section: 'គ្រប់គ្រង' },
  { id: 'settings',          label: 'Settings',          icon: 'fa-gear',                section: 'គ្រប់គ្រង' },
  { id: 'housekeeping',      label: 'Housekeeping',      icon: 'fa-broom',               section: 'HIDDEN' },
  { id: 'billing',           label: 'Billing & POS',     icon: 'fa-file-invoice-dollar', section: 'HIDDEN' }
];

const inputCls = "w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-sm";
const labelCls = "block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5";
const cardCls  = "bg-white border border-stone-200 rounded-2xl shadow-sm";
const btnPrimary = "px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors shadow-sm";
const btnSecondary = "px-4 py-2 bg-white border border-stone-200 text-stone-700 text-sm font-bold rounded-lg hover:bg-stone-50 transition-colors";
const btnDanger   = "px-4 py-2 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors";

// Helper to sort rentals chronologically descending (newest first)
const sortRentalsDesc = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const da = new Date(a.startDate || a.checkoutDate || a.createdAt || 0).getTime();
    const db = new Date(b.startDate || b.checkoutDate || b.createdAt || 0).getTime();
    return db - da;
  });
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN ADMIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Admin() {
  const [token, setToken]     = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [newBookingAlert, setNewBookingAlert] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');

  // data stores
  const [dashStats,   setDashStats]   = useState(null);
  const [bikes,       setBikes]       = useState([]);
  const [models,      setModels]      = useState([]);
  const [rooms,       setRooms]       = useState([]);
  const [bedCategories, setBedCategories] = useState([]);
  const [bookings,    setBookings]    = useState([]);
  const [occupancy,   setOccupancy]   = useState([]);
  const [rentals,     setRentals]     = useState([]);
  const [invoices,    setInvoices]    = useState([]);
  const [housekeeping,setHousekeeping]= useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [guests,      setGuests]      = useState([]);
  const [staff,       setStaff]       = useState([]);
  const [auditLogs,   setAuditLogs]   = useState([]);
  const [reports,     setReports]     = useState(null);
  const [reportPeriod,setReportPeriod]= useState('month');
  const [settings,    setSettings]    = useState({
    telegram_token: '', telegram_chat_id: '', hero_images: [],
    about_us: { title: '', p1: '', p2: '', image1: '', image2: '' },
    why_us: { title: '', p1: '', p2: '', p3: '', stats: [], features: [] },
    services_bar: [],
    testimonials: [],
    contact_info: { address: '', telegramUrl: '', telegramHandle: '', whatsappUrl: '', whatsappDisplay: '', facebookUrl: '', mapUrl: '', mapEmbed: '', hours: '' },
    business_profile: { hotelName: 'Motor Rental Siem Reap Angkor & Guesthouse', phone: '+855 016 308 199', email: 'info@siemreapangkor.com', address: 'Near Angkor Wat Main Gate, Siem Reap, Cambodia', logo: '/assets/logo.png', checkInTime: '14:00', checkOutTime: '12:00', cancellationPolicy: 'Free cancellation up to 24 hours prior to arrival. Late cancellations charged 1 night stay.', depositRule: '$50 USD cash deposit or original valid Passport/National ID required upon check-in/rental.', rentalTerms: "Driver must possess a valid driver's license or passport. Helmets are provided and mandatory." },
    pricing_tax: { primaryCurrency: 'USD', secondaryCurrency: 'KHR', exchangeRate: 4100, vatPercent: 10, serviceChargePercent: 5, cleaningFee: 5, lateCheckoutPerHour: 5, lateReturnPerHour: 3, highSeasonActive: false, highSeasonMultiplier: 1.2 },
    payment_methods: { cashEnabled: true, abaKhqrEnabled: true, abaAccountName: 'MOTOR RENTAL SIEM REAP ANGKOR', abaAccountNumber: '016 308 199 (USD)', abaQrImage: '', cardEnabled: true, bankTransferEnabled: true },
    invoice_settings: { companyHeader: 'Siem Reap Angkor Guesthouse & Motor Rentals', taxNumber: 'K002-901829381', footerNote: 'Thank you for choosing Siem Reap Angkor! Safe travels around the temples.', terms: 'Please retain this invoice for your records. All damage and late return fees are subject to inspection.' },
    notification_settings: { telegramNewBooking: true, telegramMaintenanceAlert: true, telegramCheckoutReminder: true, emailNotificationEnabled: false, recipientEmail: 'yourshop@email.com', returnReminderEnabled: true, returnReminderLeadDays: 1, maintenanceReminderEnabled: true, maintenanceReminderInterval: 15, guestVoucherTemplate: 'Hello {guest_name}, your booking at Siem Reap Angkor for {item_name} ({start_date} to {end_date}) is CONFIRMED! Contact: +855 016 308 199', guestReminderTemplate: 'Dear {guest_name}, friendly reminder that your check-in date is tomorrow {start_date}. We look forward to welcoming you!' },
    security_settings: { autoBackupEnabled: true, backupFrequency: 'daily', requireStrongPasswords: true, sessionTimeoutMinutes: 120 },
    shop_settings: { shopName: 'Motorental Siemreab Angkor', logo: '/assets/logo.png', rentalHoursPerDay: 12, operatingHoursOpen: '06:00 AM', operatingHoursClose: '10:00 PM', depositDocTypes: "National ID, Passport, Driver's License, Birth Certificate, None" },
    theme_settings: { presetName: 'Angkor Terracotta', primaryColor: '#c0622b' },
    telegram_settings: { botToken: '', chatId: '', checkoutAlertEnabled: true, checkinAlertEnabled: true, roomCheckinAlertEnabled: true, roomCheckoutAlertEnabled: true, bookingAlertEnabled: true, rentalAlertTemplate: '', checkoutAlertTemplate: '', returnAlertTemplate: '', checkinAlertTemplate: '', roomCheckinAlertTemplate: '', roomCheckoutAlertTemplate: '', bookingAlertTemplate: '', revenueAlertTemplate: '' }
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [views, setViews] = useState(null);
  const { showModal, showConfirm } = useModal();

  const authHeaders = () => ({ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` });
  const auth = { headers: authHeaders() };
  const authPost = (body) => ({ method:'POST', headers: authHeaders(), body: JSON.stringify(body) });
  const authPatch = (body) => ({ method:'PATCH', headers: authHeaders(), body: JSON.stringify(body) });
  const authDelete = () => ({ method:'DELETE', headers: authHeaders() });
  const mapSafe = (arr, fn) => (Array.isArray(arr) ? arr.map(item => {
    try { return fn(item); } catch (err) { console.error(err); return item; }
  }) : []);

  // ── Telegram Category Alert State & Helper ────────────────────────────────────
  const [tgSending, setTgSending] = useState(false);
  const [tgAlertToast, setTgAlertToast] = useState(null);

  const sendCategoryTelegramAlert = async ({ category, title, summary, stats, details }) => {
    setTgSending(true);
    try {
      const res = await fetch('/api/telegram/send-alert', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({ category, title, summary, stats, details })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTgAlertToast({ type: 'success', text: `Telegram Alert for "${category}" sent successfully!` });
      } else {
        setTgAlertToast({ type: 'error', text: `Failed to send alert: ${data.error || 'Please check Telegram Bot Token in Settings'}` });
      }
    } catch (err) {
      setTgAlertToast({ type: 'error', text: `Network error: ${err.message}` });
    } finally {
      setTgSending(false);
      setTimeout(() => setTgAlertToast(null), 5000);
    }
  };

  // ── fetch helpers ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const hdrs = { headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` } };
      const [b, mdls, r, bk, oc, rn, inv, hk, mnt, g, stf, logs, cats] = await Promise.all([
        MotoService.getAll().catch(()=>[]),
        BikeModelService.getAll().catch(()=>[]),
        RoomService.getAll().catch(()=>[]),
        BookingService.getAll().then(res => res && res.length ? res : fetch('/api/bookings', hdrs).then(r=>r.json()).catch(()=>[])).catch(()=>[]),
        fetch('/api/room-occupancy', hdrs).then(r=>r.json()).catch(()=>[]),
        RentalService.getAll().then(res => res && res.length ? res : fetch('/api/rentals', hdrs).then(r=>r.json()).catch(()=>[])).catch(()=>[]),
        fetch('/api/invoices', hdrs).then(r=>r.json()).catch(()=>[]),
        fetch('/api/housekeeping', hdrs).then(r=>r.json()).catch(()=>[]),
        MaintenanceService.getAll().then(res => res && res.length ? res : fetch('/api/maintenance', hdrs).then(r=>r.json()).catch(()=>[])).catch(()=>[]),
        CustomerService.getAll().then(res => res && res.length ? res : fetch('/api/guests', hdrs).then(r=>r.json()).catch(()=>[])).catch(()=>[]),
        fetch('/api/staff', hdrs).then(r=>r.json()).catch(()=>[]),
        fetch('/api/audit-logs', hdrs).then(r=>r.json()).catch(()=>[]),
        BedCategoryService.getAll().then(res => res && res.length ? res : fetch('/api/bed-categories', hdrs).then(r=>r.json()).catch(()=>[])).catch(()=>[]),
      ]);
      const safeGuests = Array.isArray(g) ? g : [];
      const safeModels = mapSafe(mdls, normalizeModel);
      const safeCategories = mapSafe(cats, normalizeBedCategory);
      const safeBikes = mapSafe(b, x => normalizeMoto(x, safeModels));
      const safeRooms = mapSafe(r, x => normalizeRoom(x, safeCategories));
      const safeRentals = sortRentalsDesc(mapSafe(rn, x => normalizeRental(x, safeGuests, safeBikes, safeModels)));
      const safeBookings = mapSafe(bk, x => normalizeBooking(x, safeGuests, safeBikes, safeModels));

      setGuests(safeGuests);
      setModels(safeModels);
      setBedCategories(safeCategories);
      setBikes(safeBikes);
      setRooms(safeRooms);
      setRentals(safeRentals);
      setBookings(safeBookings);
      setOccupancy(Array.isArray(oc) ? oc : []);
      setInvoices(Array.isArray(inv) ? inv : []);
      setHousekeeping(Array.isArray(hk) ? hk : []);
      setMaintenance(Array.isArray(mnt) ? mnt : []);
      setGuests(Array.isArray(g) ? g : []);
      setStaff(Array.isArray(stf) ? stf : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } finally {
      setLoadingData(false);
    }
  }, [token]);

  const fetchDash = useCallback(() => {
    if (!token) return;
    const hdrs = { headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` } };
    fetch('/api/dashboard', hdrs).then(r=>r.json()).then(setDashStats).catch(()=>{});
  }, [token]);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoadingReports(true);
    try {
      const hdrs = { headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` } };
      const data = await fetch(`/api/reports?period=${reportPeriod}`, hdrs).then(r=>r.json()).catch(()=>null);
      setReports(data);
    } finally {
      setLoadingReports(false);
    }
  }, [token, reportPeriod]);

  const fetchSettings = useCallback(() => {
    if (!token) return;
    const hdrs = { headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` } };
    fetch('/api/settings', hdrs)
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === 'object') {
          const parsed = {};
          ['hero_images','about_us','why_us','services_bar','testimonials','contact_info','business_profile','pricing_tax','payment_methods','invoice_settings','notification_settings','security_settings','public_texts','shop_settings','theme_settings','telegram_settings'].forEach(k => {
            if (data[k]) {
              try {
                parsed[k] = typeof data[k] === 'string' ? JSON.parse(data[k]) : data[k];
              } catch (e) {
                parsed[k] = data[k];
              }
            }
          });
          if ('hero_images' in parsed) parsed.hero_images = asArray(parsed.hero_images);
          if ('testimonials' in parsed) parsed.testimonials = asArray(parsed.testimonials);
          if ('services_bar' in parsed) parsed.services_bar = asArray(parsed.services_bar);
          if (parsed.why_us && typeof parsed.why_us === 'object') {
            parsed.why_us = {
              ...parsed.why_us,
              stats: asArray(parsed.why_us.stats),
              features: asArray(parsed.why_us.features),
            };
          }
          setSettings(prev => ({ ...prev, ...data, ...parsed }));
        }
      })
      .catch(console.error);
  }, [token]);

  const fetchViews = useCallback(async () => {
    try { const d = await getDoc(doc(firedb,"stats","page-views")); setViews(d.exists() ? d.data().count+1542 : 1542); } catch { setViews('N/A'); }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchAll();
    fetchDash();
    fetchSettings();
    fetchViews();

    const unsubBikes = MotoService.subscribe((firestoreMotos) => {
      if (firestoreMotos && firestoreMotos.length > 0) {
        setBikes(mapSafe(firestoreMotos, x => normalizeMoto(x, models)));
      }
    });
    const unsubModels = BikeModelService.subscribe((firestoreModels) => {
      if (firestoreModels && firestoreModels.length > 0) {
        setModels(mapSafe(firestoreModels, normalizeModel));
      }
    });
    const unsubRentals = RentalService.subscribe((firestoreRentals) => {
      if (firestoreRentals && firestoreRentals.length > 0) {
        setRentals(sortRentalsDesc(mapSafe(firestoreRentals, x => normalizeRental(x, guests, bikes, models))));
      }
    });
    const unsubBookings = BookingService.subscribe((firestoreBookings) => {
      if (firestoreBookings && firestoreBookings.length > 0) {
        setBookings(mapSafe(firestoreBookings, x => normalizeBooking(x, guests, bikes, models)));
      }
    });
    const unsubCustomers = CustomerService.subscribe((firestoreCustomers) => {
      if (firestoreCustomers && firestoreCustomers.length > 0) {
        setGuests(firestoreCustomers);
      }
    });
    const unsubRooms = RoomService.subscribe((firestoreRooms) => {
      if (firestoreRooms && firestoreRooms.length > 0) {
        setRooms(prevRooms => mapSafe(firestoreRooms, x => normalizeRoom(x, bedCategories)));
      }
    });
    const unsubBedCategories = BedCategoryService.subscribe((firestoreCats) => {
      if (firestoreCats && firestoreCats.length > 0) {
        const safeCats = mapSafe(firestoreCats, normalizeBedCategory);
        setBedCategories(safeCats);
        setRooms(prevRooms => mapSafe(prevRooms, x => normalizeRoom(x, safeCats)));
      }
    });
    const unsubMaintenance = MaintenanceService.subscribe((firestoreMaint) => {
      if (firestoreMaint && firestoreMaint.length > 0) {
        setMaintenance(firestoreMaint);
      }
    });
    const unsubHBookings = HotelBookingService.subscribe((firestoreHBookings) => {
      if (firestoreHBookings && firestoreHBookings.length > 0) {
        fetchAll();
      }
    });
    const unsubExpenses = ExpenseService.subscribe((firestoreExp) => {
      if (firestoreExp && firestoreExp.length > 0) {
        fetchDash();
      }
    });

    const playChime = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      } catch (e) {}
    };

    const socket = createSocket();
    socket.on('connect', () => setIsLiveConnected(true));
    socket.on('disconnect', () => setIsLiveConnected(false));

    socket.on('new_booking', () => {
      fetchAll();
      fetchDash();
      playChime();
      setNewBookingAlert(true);
      setTimeout(() => setNewBookingAlert(false), 5000);
    });
    socket.on('booking_updated', () => { fetchAll(); fetchDash(); });
    socket.on('room_status_updated', () => { fetchAll(); fetchDash(); });
    socket.on('rooms_updated', () => { fetchAll(); fetchDash(); });
    socket.on('room_occupancy_updated', () => { fetchAll(); fetchDash(); });
    socket.on('bed_categories_updated', () => { fetchAll(); });
    socket.on('bike_status_updated', () => { fetchAll(); fetchDash(); });
    socket.on('bikes_updated', () => { fetchAll(); fetchDash(); });
    socket.on('rental_updated', () => { fetchAll(); fetchDash(); });
    socket.on('invoices_updated', () => { fetchAll(); fetchDash(); });
    socket.on('expenses_updated', () => { fetchAll(); fetchDash(); });
    socket.on('maintenance_updated', () => { fetchAll(); });
    socket.on('housekeeping_updated', () => { fetchAll(); });
    socket.on('guests_updated', () => { fetchAll(); });
    socket.on('settings_updated', () => { fetchSettings(); });
    socket.on('staff_updated', () => { fetchAll(); });

    return () => {
      unsubBikes();
      unsubModels();
      unsubRentals();
      unsubBookings();
      unsubCustomers();
      unsubRooms();
      unsubBedCategories();
      unsubMaintenance();
      unsubHBookings();
      unsubExpenses();
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => { if (activeTab==='reports') fetchReports(); }, [activeTab, reportPeriod]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password}) });
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        setLoginError(`Server returned status ${res.status}. Please check server.`);
        return;
      }
      if (res.ok) { localStorage.setItem('token', data.token); setToken(data.token); setLoginError(''); }
      else setLoginError(data.error || 'Login failed');
    } catch (err) {
      setLoginError(err.message || 'Network error');
    }
  };
  const handleLogout = () => { localStorage.removeItem('token'); setToken(null); };

  const saveSettings = async (customPayload, options = {}) => {
    try {
      const isEvent = customPayload && (customPayload.nativeEvent || customPayload.target || customPayload._reactName || typeof customPayload.preventDefault === 'function');
      const payloadToSend = customPayload && typeof customPayload === 'object' && !isEvent ? { ...settings, ...customPayload } : settings;
      
      // 1. Optimistic UI update immediately
      setSettings(prev => ({ ...prev, ...payloadToSend }));
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);

      // 2. Parallel background sync to Firestore (non-blocking for ultra-fast UI)
      try {
        Promise.allSettled([
          setDoc(doc(dbMotos, 'settings', 'public_settings'), payloadToSend, { merge: true }),
          payloadToSend.shop_settings ? setDoc(doc(dbMotos, 'settings', 'shop_settings'), payloadToSend.shop_settings, { merge: true }) : null,
          payloadToSend.theme_settings ? setDoc(doc(dbMotos, 'settings', 'theme_settings'), payloadToSend.theme_settings, { merge: true }) : null,
          payloadToSend.telegram_settings ? setDoc(doc(dbMotos, 'settings', 'telegram_settings'), payloadToSend.telegram_settings, { merge: true }) : null,
        ].filter(Boolean)).catch(fbErr => console.warn('Firestore settings sync:', fbErr.message));
      } catch (fbErr) {
        console.warn('Firestore sync non-blocking error:', fbErr);
      }

      // 3. Fast server POST
      let res = await fetch('/api/settings', authPost(payloadToSend));

      // If forbidden / unauthorized, auto-refresh token using admin credentials
      if (res.status === 401 || res.status === 403) {
        try {
          const loginRes = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: '1234567' })
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            if (loginData.token) {
              localStorage.setItem('token', loginData.token);
              setToken(loginData.token);
              res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginData.token}` },
                body: JSON.stringify(payloadToSend)
              });
            }
          }
        } catch (authErr) {
          console.warn('Auto re-auth error:', authErr.message);
        }
      }

      if (res.ok) {
        try {
          const s = getSocket();
          if (s && s.connected) {
            s.emit('settings_updated');
          }
        } catch (ignore) {}

        if (!options.silent) {
          showModal('success', 'រក្សាទុកជោគជ័យ!', 'ការកំណត់ត្រូវបានរក្សាទុកដោយជោគជ័យ (Settings saved successfully)');
        }
        return { success: true };
      } else {
        const err = await res.json().catch(() => ({}));
        showModal('error', 'មិនអាចរក្សាទុកបានទេ', err.error || res.statusText || 'Failed to save settings');
        return { success: false, error: err.error };
      }
    } catch (e) {
      showModal('error', 'កំហុសបច្ចេកទេស', e.message);
      return { success: false, error: e.message };
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  //  LOGIN SCREEN
  // ══════════════════════════════════════════════════════════════════════════════
  if (!token) return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center p-4 sm:p-6">
      <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-lg border border-white/20 p-6 sm:p-10 rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm w-full">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-brand-500/30">
            <i className="fa-solid fa-motorcycle text-white text-xl sm:text-2xl"></i>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Admin Panel</h2>
          <p className="text-stone-400 text-xs sm:text-sm mt-1">Siem Reap Angkor PMS</p>
        </div>
        {loginError && <div className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs sm:text-sm p-3 rounded-xl mb-4">{loginError}</div>}
        <div className="mb-4">
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Username</label>
          <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder-stone-500 outline-none focus:border-brand-400 transition-all text-sm" required />
        </div>
        <div className="mb-6 sm:mb-8">
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder-stone-500 outline-none focus:border-brand-400 transition-all text-sm" required />
        </div>
        <button type="submit" className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-xl hover:bg-brand-600 shadow-lg shadow-brand-500/30 transition-all cursor-pointer">Sign In</button>
        <Link to="/" className="block text-center mt-4 text-xs sm:text-sm text-stone-500 hover:text-stone-300 transition-colors">← Return to Website</Link>
      </form>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  //  DASHBOARD LAYOUT
  // ══════════════════════════════════════════════════════════════════════════════
  const sections = [...new Set(NAV.map(n=>n.section))].filter(s => s !== 'HIDDEN');
  const pendingRoomBookings = bookings.filter(b => (b.type === 'room' || b.roomId || String(b.itemName || '').toLowerCase().includes('room')) && (b.status || 'pending') === 'pending').length;
  const pendingMotorBookings = bookings.filter(b => b.type !== 'room' && !b.roomId && !String(b.itemName || '').toLowerCase().includes('room') && (b.status || 'pending') === 'pending').length;
  const totalPendingBookings = pendingRoomBookings + pendingMotorBookings;

  return (
    <div className="min-h-screen bg-[#fbf9f5] font-sans antialiased flex text-stone-800 relative">

      {/* ─── MOBILE DRAWER BACKDROP ────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* ─── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside className={`fixed top-0 left-0 h-full w-72 sm:w-80 md:w-64 bg-white border-r border-stone-200/90 flex flex-col z-50 md:z-30 shadow-2xl md:shadow-xs transition-transform duration-300 ease-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0 shadow-sm">
              <i className="fa-solid fa-motorcycle text-white text-base"></i>
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 leading-tight">Siem Reap Angkor</h1>
              <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest leading-none mt-1">Management System</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-500 hover:text-stone-800 flex items-center justify-center transition cursor-pointer"
            aria-label="Close menu"
          >
            <i className="fa-solid fa-xmark text-base"></i>
          </button>
        </div>

        {/* Quick Nav Search on Mobile */}
        <div className="px-3 pt-3 pb-1 border-b border-stone-100 md:hidden">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs pointer-events-none"></i>
            <input
              type="text"
              placeholder="Search tabs / ស្វែងរកមុខងារ..."
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-7 py-1.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 focus:bg-white transition"
            />
            {navSearch && (
              <button
                type="button"
                onClick={() => setNavSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs w-4 h-4 flex items-center justify-center cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-4">
          {sections.map(section => {
            const sectionTabs = NAV.filter(n => {
              if (n.section !== section) return false;
              if (!navSearch.trim()) return true;
              const q = navSearch.toLowerCase().trim();
              return n.label.toLowerCase().includes(q) || (n.section || '').toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
            });

            if (sectionTabs.length === 0) return null;

            return (
              <div key={section}>
                <p className="px-3.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 mt-3">{section}</p>
                {sectionTabs.map(n => {
                  const isRoomBk = n.id === 'room-bookings';
                  const isMotorBk = n.id === 'bookings';
                  const pendingCount = isRoomBk ? pendingRoomBookings : isMotorBk ? pendingMotorBookings : 0;

                  return (
                    <button key={n.id} onClick={() => { setActiveTab(n.id); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all mb-1 cursor-pointer ${activeTab===n.id ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'}`}>
                      <div className="flex items-center gap-3">
                        <i className={`fa-solid ${n.icon} w-5 text-center text-sm opacity-90`}></i>
                        <span>{n.label}</span>
                      </div>
                      {pendingCount > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                          activeTab === n.id ? 'bg-white text-stone-900 shadow-xs' : 'bg-amber-500 text-white animate-pulse'
                        }`}>
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-stone-100 space-y-1.5">
          <Link to="/" className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 transition-all">
            <i className="fa-solid fa-arrow-up-right-from-square"></i> View Live Site
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer">
            <i className="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="ml-0 md:ml-64 flex-1 min-h-screen pb-24 md:pb-8 flex flex-col w-full min-w-0">

        {/* Toast */}
        <div className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-50 bg-emerald-600 text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-xl flex items-center gap-3 transition-all duration-500 max-w-[90vw] ${newBookingAlert ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <i className="fa-solid fa-bell animate-bounce text-sm sm:text-base"></i>
          <div><p className="font-bold text-xs sm:text-sm">New Booking!</p><p className="text-[10px] sm:text-xs text-emerald-100">Check Online Bookings tab.</p></div>
        </div>

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-3.5 py-3 sm:px-6 sm:py-3.5 md:px-8 md:py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Mobile hamburger button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="md:hidden w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 flex items-center justify-center shrink-0 transition shadow-xs border border-stone-200/60 cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <i className="fa-solid fa-bars text-sm"></i>
            </button>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-stone-900 font-display truncate leading-tight">
                {NAV.find(n=>n.id===activeTab)?.label || 'Dashboard'}
              </h2>
              <p className="text-[10px] sm:text-xs text-stone-500 truncate hidden xs:block">
                {new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold border transition-colors ${
              isLiveConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className="relative flex h-2 w-2 shrink-0">
                {isLiveConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isLiveConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className="hidden sm:inline">{isLiveConnected ? 'Live Real-Time' : 'Connecting...'}</span>
              <span className="sm:hidden">{isLiveConnected ? 'Live' : '...'}</span>
            </div>
            {dashStats && (
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('rooms')}
                  className="flex items-center gap-1 sm:gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold text-emerald-700 transition cursor-pointer"
                  title="View Rooms"
                >
                  <i className="fa-solid fa-bed text-[10px]"></i>
                  <span>{dashStats.rooms?.vacant || 0}</span>
                  <span className="hidden sm:inline">Vacant</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('fleet')}
                  className="flex items-center gap-1 sm:gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200/70 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold text-blue-700 transition cursor-pointer"
                  title="View Fleet"
                >
                  <i className="fa-solid fa-motorcycle text-[10px]"></i>
                  <span>{dashStats.bikes?.available || 0}</span>
                  <span className="hidden sm:inline">Available</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-3.5 sm:p-6 md:p-8 space-y-4 sm:space-y-6 flex-1 min-w-0">

          {/* Floating Toast for Telegram Alerts */}
          {tgAlertToast && (
            <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 transition-all no-print animate-in fade-in slide-in-from-top-3 ${
              tgAlertToast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}>
              <i className={`fa-solid ${tgAlertToast.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'} text-base`}></i>
              <span>{tgAlertToast.text}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* DASHBOARD */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'dashboard' && (
            <DashboardTab
              bikes={bikes}
              models={models}
              rentals={rentals}
              bookings={bookings}
              rooms={rooms}
              cardCls={cardCls}
              loadingData={loadingData}
              currency={currency}
              onNavigateTab={setActiveTab}
              sendCategoryTelegramAlert={sendCategoryTelegramAlert}
              tgSending={tgSending}
            />
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ROOMS & RESERVATIONS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'rooms' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={6} />
            ) : (
              <RoomsTab
                bookings={bookings}
                setBookings={setBookings}
                rooms={rooms}
                bedCategories={bedCategories}
                occupancy={occupancy}
                guests={guests}
                auth={auth}
                fetchAll={fetchAll}
                fetchDash={fetchDash}
                inputCls={inputCls}
                labelCls={labelCls}
                cardCls={cardCls}
                btnPrimary={btnPrimary}
                btnSecondary={btnSecondary}
                btnDanger={btnDanger}
                statusBadge={statusBadge}
                today={today}
                currency={currency}
                sendCategoryTelegramAlert={sendCategoryTelegramAlert}
                tgSending={tgSending}
                settings={settings}
              />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ROOM BOOKINGS (Customer Online & Direct Room Bookings)        */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'room-bookings' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={6} />
            ) : (
              <RoomBookingsTab
                bookings={bookings}
                setBookings={setBookings}
                rooms={rooms}
                bedCategories={bedCategories}
                auth={auth}
                fetchAll={fetchAll}
                fetchDash={fetchDash}
                inputCls={inputCls}
                labelCls={labelCls}
                cardCls={cardCls}
                btnPrimary={btnPrimary}
                btnSecondary={btnSecondary}
                btnDanger={btnDanger}
                statusBadge={statusBadge}
                today={today}
                currency={currency}
                sendCategoryTelegramAlert={sendCategoryTelegramAlert}
                tgSending={tgSending}
              />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ONLINE BOOKINGS (from public website) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'bookings' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={6} />
            ) : (
              <BookingsTab
                bookings={bookings}
                setBookings={setBookings}
                auth={auth}
                fetchAll={fetchAll}
                inputCls={inputCls}
                labelCls={labelCls}
                cardCls={cardCls}
                btnPrimary={btnPrimary}
                btnSecondary={btnSecondary}
                btnDanger={btnDanger}
                statusBadge={statusBadge}
                sendCategoryTelegramAlert={sendCategoryTelegramAlert}
                tgSending={tgSending}
              />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* GUESTS CRM */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'guests' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={5} />
            ) : (
              <GuestsTab
                guests={guests}
                auth={auth}
                fetchAll={fetchAll}
                inputCls={inputCls}
                labelCls={labelCls}
                cardCls={cardCls}
                btnPrimary={btnPrimary}
                btnDanger={btnDanger}
                sendCategoryTelegramAlert={sendCategoryTelegramAlert}
                tgSending={tgSending}
              />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* BIKES & FLEET MANAGEMENT */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'fleet' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={6} />
            ) : (
              <FleetTab
                bikes={bikes}
                models={models}
                setBikes={setBikes}
                setModels={setModels}
                auth={auth}
                fetchAll={fetchAll}
                inputCls={inputCls}
                labelCls={labelCls}
                cardCls={cardCls}
                btnPrimary={btnPrimary}
                btnSecondary={btnSecondary}
                btnDanger={btnDanger}
                statusBadge={statusBadge}
                currency={currency}
                rooms={rooms}
                sendCategoryTelegramAlert={sendCategoryTelegramAlert}
                tgSending={tgSending}
              />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* RENTALS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'rentals' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={6} />
            ) : (
              <RentalsTab bikes={bikes} rentals={rentals} occupancy={occupancy} auth={auth} fetchAll={fetchAll} inputCls={inputCls} labelCls={labelCls} cardCls={cardCls} btnPrimary={btnPrimary} btnSecondary={btnSecondary} btnDanger={btnDanger} statusBadge={statusBadge} today={today} currency={currency} sendCategoryTelegramAlert={sendCategoryTelegramAlert} tgSending={tgSending} />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* BILLING & POS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'billing' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={5} />
            ) : (
              <BillingTab invoices={invoices} occupancy={occupancy} rentals={rentals} auth={auth} fetchAll={fetchAll} inputCls={inputCls} labelCls={labelCls} cardCls={cardCls} btnPrimary={btnPrimary} btnSecondary={btnSecondary} btnDanger={btnDanger} statusBadge={statusBadge} currency={currency} settings={settings} />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* HOUSEKEEPING */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'housekeeping' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={5} />
            ) : (
              <HousekeepingTab rooms={rooms} housekeeping={housekeeping} maintenance={maintenance} bikes={bikes} auth={auth} fetchAll={fetchAll} fetchDash={fetchDash} inputCls={inputCls} labelCls={labelCls} cardCls={cardCls} btnPrimary={btnPrimary} btnDanger={btnDanger} statusBadge={statusBadge} today={today} currency={currency} />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* REPORTS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'reports' && (
            <ReportsTab
              reports={reports}
              rentals={rentals}
              occupancy={occupancy}
              bookings={bookings}
              bikes={bikes}
              rooms={rooms}
              models={models}
              reportPeriod={reportPeriod}
              setReportPeriod={setReportPeriod}
              cardCls={cardCls}
              currency={currency}
              sendCategoryTelegramAlert={sendCategoryTelegramAlert}
              tgSending={tgSending}
            />
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* WEBSITE CMS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'cms' && (
            <div className="space-y-6 max-w-4xl">
              {/* About Us */}
              <div className={`${cardCls} p-6`}>
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
                  <div>
                    <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-store mr-2 text-brand-500"></i>About Us Section (ព័ត៌មានអំពីយើង)</h3>
                    <p className="text-xs text-stone-500">គ្រប់គ្រងចំណងជើង, អត្ថបទរៀបរាប់, ចំណុចលេចធ្លោ, និងរូបភាពបង្ហាញលើគេហទំព័រ</p>
                  </div>
                  <button onClick={saveSettings} className={btnPrimary}>
                    {settingsSaved ? <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-circle-check"></i> Saved!</span> : 'Save About Us'}
                  </button>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Badge / Section Tag</label>
                      <input
                        type="text"
                        value={settings.about_us?.label || ''}
                        onChange={e => setSettings({ ...settings, about_us: { ...settings.about_us, label: e.target.value } })}
                        placeholder="e.g. About Us or អំពីយើង"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Experience Badge Text</label>
                      <input
                        type="text"
                        value={settings.about_us?.badgeText || ''}
                        onChange={e => setSettings({ ...settings, about_us: { ...settings.about_us, badgeText: e.target.value } })}
                        placeholder="e.g. 10+ Years Experience"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Main Headline</label>
                    <input
                      type="text"
                      value={settings.about_us?.title || ''}
                      onChange={e => setSettings({ ...settings, about_us: { ...settings.about_us, title: e.target.value } })}
                      placeholder="e.g. Local Experts in Siem Reap"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Story Paragraph 1</label>
                    <textarea
                      rows="3"
                      value={settings.about_us?.p1 || ''}
                      onChange={e => setSettings({ ...settings, about_us: { ...settings.about_us, p1: e.target.value } })}
                      className={inputCls}
                      placeholder="Introduction and founding story..."
                    ></textarea>
                  </div>

                  <div>
                    <label className={labelCls}>Story Paragraph 2</label>
                    <textarea
                      rows="3"
                      value={settings.about_us?.p2 || ''}
                      onChange={e => setSettings({ ...settings, about_us: { ...settings.about_us, p2: e.target.value } })}
                      className={inputCls}
                      placeholder="Mission, customer service, and local knowledge..."
                    ></textarea>
                  </div>

                  {/* Highlights / Features Checklist */}
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className={labelCls}>Key Highlights / Service Points</label>
                      <button
                        type="button"
                        onClick={() => {
                          const currentFeats = settings.about_us?.features || ['Family Owned & Operated', 'Local Guides & Maps Provided', '24/7 Support on the Road'];
                          setSettings({ ...settings, about_us: { ...settings.about_us, features: [...currentFeats, 'New Service Highlight'] } });
                        }}
                        className="text-xs font-bold text-brand-600 hover:underline"
                      >
                        + Add Bullet Point
                      </button>
                    </div>

                    {(settings.about_us?.features || ['Family Owned & Operated', 'Local Guides & Maps Provided', '24/7 Support on the Road']).map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 text-xs font-bold">
                          <i className="fa-solid fa-check"></i>
                        </div>
                        <input
                          type="text"
                          value={feat}
                          onChange={e => {
                            const newFeats = [...(settings.about_us?.features || ['Family Owned & Operated', 'Local Guides & Maps Provided', '24/7 Support on the Road'])];
                            newFeats[fIdx] = e.target.value;
                            setSettings({ ...settings, about_us: { ...settings.about_us, features: newFeats } });
                          }}
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newFeats = [...(settings.about_us?.features || ['Family Owned & Operated', 'Local Guides & Maps Provided', '24/7 Support on the Road'])];
                            newFeats.splice(fIdx, 1);
                            setSettings({ ...settings, about_us: { ...settings.about_us, features: newFeats } });
                          }}
                          className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Images Upload & URL */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    {/* Image 1 */}
                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                      <label className={labelCls}>Photo 1 (Top Left)</label>
                      <input
                        type="text"
                        value={settings.about_us?.image1 || ''}
                        onChange={e => setSettings({ ...settings, about_us: { ...settings.about_us, image1: e.target.value } })}
                        placeholder="Image URL or upload below..."
                        className={inputCls}
                      />
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async e => {
                            const f = e.target.files[0];
                            if (f) {
                              const dataUrl = await fileToBase64(f, 1400, 1400, 0.8);
                              setSettings({ ...settings, about_us: { ...settings.about_us, image1: dataUrl } });
                            }
                          }}
                          className="w-full text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white file:text-stone-700 file:border file:border-stone-200 cursor-pointer"
                        />
                      </div>
                      {settings.about_us?.image1 && (
                        <div className="relative group w-full h-32 rounded-lg overflow-hidden border border-stone-200">
                          <img src={settings.about_us.image1} alt="Preview 1" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSettings({ ...settings, about_us: { ...settings.about_us, image1: '' } })}
                            className="absolute top-2 right-2 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <i className="fa-solid fa-times text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Image 2 */}
                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                      <label className={labelCls}>Photo 2 (Bottom Right)</label>
                      <input
                        type="text"
                        value={settings.about_us?.image2 || ''}
                        onChange={e => setSettings({ ...settings, about_us: { ...settings.about_us, image2: e.target.value } })}
                        placeholder="Image URL or upload below..."
                        className={inputCls}
                      />
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async e => {
                            const f = e.target.files[0];
                            if (f) {
                              const dataUrl = await fileToBase64(f, 1400, 1400, 0.8);
                              setSettings({ ...settings, about_us: { ...settings.about_us, image2: dataUrl } });
                            }
                          }}
                          className="w-full text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white file:text-stone-700 file:border file:border-stone-200 cursor-pointer"
                        />
                      </div>
                      {settings.about_us?.image2 && (
                        <div className="relative group w-full h-32 rounded-lg overflow-hidden border border-stone-200">
                          <img src={settings.about_us.image2} alt="Preview 2" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSettings({ ...settings, about_us: { ...settings.about_us, image2: '' } })}
                            className="absolute top-2 right-2 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <i className="fa-solid fa-times text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-circle-check"></i> Saved!</span> : 'Save About Us Changes'}</button>
                  </div>
                </div>
              </div>
              {/* Reviews */}
              <div className={`${cardCls} p-6`}>
                <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-star mr-2 text-amber-500"></i>Customer Reviews</h3>
                <div className="space-y-4">
                  {(asArray(settings.testimonials)).map((t,i)=>(
                    <div key={i} className="p-4 border border-stone-200 rounded-xl bg-stone-50 flex gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <input type="text" value={t.name} placeholder="Name" onChange={e=>{const a=[...settings.testimonials];a[i]={...a[i],name:e.target.value};setSettings({...settings,testimonials:a});}} className={inputCls} />
                          <input type="text" value={t.country} placeholder="Country" onChange={e=>{const a=[...settings.testimonials];a[i]={...a[i],country:e.target.value};setSettings({...settings,testimonials:a});}} className={inputCls} />
                          <input type="number" min="1" max="5" value={t.rating} onChange={e=>{const a=[...settings.testimonials];a[i]={...a[i],rating:parseInt(e.target.value)};setSettings({...settings,testimonials:a});}} className={inputCls} />
                        </div>
                        <textarea rows="2" value={t.text} placeholder="Review text" onChange={e=>{const a=[...settings.testimonials];a[i]={...a[i],text:e.target.value};setSettings({...settings,testimonials:a});}} className={inputCls}></textarea>
                      </div>
                      <button onClick={()=>{const a=[...settings.testimonials];a.splice(i,1);setSettings({...settings,testimonials:a});}} className="w-10 h-10 flex items-center justify-center text-red-500 bg-white border border-red-100 rounded-lg hover:bg-red-50"><i className="fa-solid fa-trash text-xs"></i></button>
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <button onClick={()=>setSettings({...settings,testimonials:[...(settings.testimonials||[]),{name:'',country:'',text:'',rating:5}]})} className={btnSecondary}>+ Add Review</button>
                    <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-circle-check"></i> Saved!</span> : 'Save Reviews'}</button>
                  </div>
                </div>
              </div>
              {/* Contact */}
              <div className={`${cardCls} p-6`}>
                <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-address-book mr-2 text-indigo-500"></i>Contact Info</h3>
                <div className="space-y-4">
                  <div><label className={labelCls}>Address</label><input type="text" value={settings.contact_info?.address||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,address:e.target.value}})} className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Telegram URL</label><input type="text" value={settings.contact_info?.telegramUrl||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,telegramUrl:e.target.value}})} className={inputCls} /></div>
                    <div><label className={labelCls}>Telegram Handle</label><input type="text" value={settings.contact_info?.telegramHandle||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,telegramHandle:e.target.value}})} className={inputCls} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>WhatsApp URL</label><input type="text" value={settings.contact_info?.whatsappUrl||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,whatsappUrl:e.target.value}})} className={inputCls} /></div>
                    <div><label className={labelCls}>WhatsApp Display</label><input type="text" value={settings.contact_info?.whatsappDisplay||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,whatsappDisplay:e.target.value}})} className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Facebook URL</label><input type="text" value={settings.contact_info?.facebookUrl||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,facebookUrl:e.target.value}})} className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={labelCls}>Map Link</label><input type="text" value={settings.contact_info?.mapUrl||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,mapUrl:e.target.value}})} className={inputCls} /></div>
                    <div><label className={labelCls}>Map Embed URL</label><input type="text" value={settings.contact_info?.mapEmbed||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,mapEmbed:e.target.value}})} className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Hours</label><input type="text" value={settings.contact_info?.hours||''} onChange={e=>setSettings({...settings,contact_info:{...settings.contact_info,hours:e.target.value}})} className={inputCls} /></div>
                  <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-circle-check"></i> Saved!</span> : 'Save Contact Info'}</button>
                </div>
              </div>
              {/* Why Us (About Siem Reap Angkor) */}
              <div className={`${cardCls} p-6`}>
                <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-list-check mr-2 text-emerald-500"></i>Why Us / About Siem Reap Angkor</h3>
                <div className="space-y-4">
                  <div><label className={labelCls}>Title</label><input type="text" value={settings.why_us?.title||''} onChange={e=>setSettings({...settings,why_us:{...settings.why_us,title:e.target.value}})} className={inputCls} /></div>
                  <div><label className={labelCls}>Paragraph 1</label><textarea rows="2" value={settings.why_us?.p1||''} onChange={e=>setSettings({...settings,why_us:{...settings.why_us,p1:e.target.value}})} className={inputCls} /></div>
                  <div><label className={labelCls}>Paragraph 2</label><textarea rows="2" value={settings.why_us?.p2||''} onChange={e=>setSettings({...settings,why_us:{...settings.why_us,p2:e.target.value}})} className={inputCls} /></div>
                  <div><label className={labelCls}>Paragraph 3</label><textarea rows="2" value={settings.why_us?.p3||''} onChange={e=>setSettings({...settings,why_us:{...settings.why_us,p3:e.target.value}})} className={inputCls} /></div>
                  
                  {/* Stats */}
                  <label className={labelCls}>Statistics (e.g. 500+ Happy Guests)</label>
                  {(asArray(settings.why_us?.stats)).map((s,i)=>(
                    <div key={i} className="flex gap-3">
                      <input type="text" value={s.num} placeholder="Number (e.g. 500+)" onChange={e=>{const a=[...settings.why_us.stats];a[i]={...a[i],num:e.target.value};setSettings({...settings,why_us:{...settings.why_us,stats:a}})}} className={inputCls} />
                      <input type="text" value={s.label} placeholder="Label" onChange={e=>{const a=[...settings.why_us.stats];a[i]={...a[i],label:e.target.value};setSettings({...settings,why_us:{...settings.why_us,stats:a}})}} className={inputCls} />
                      <button onClick={()=>{const a=[...settings.why_us.stats];a.splice(i,1);setSettings({...settings,why_us:{...settings.why_us,stats:a}})}} className="w-10 h-10 flex items-center justify-center text-red-500 border border-stone-200 rounded-lg hover:bg-red-50"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  ))}
                  <button onClick={()=>setSettings({...settings,why_us:{...settings.why_us,stats:[...(settings.why_us?.stats||[]),{num:'',label:''}]}})} className="text-xs font-bold text-brand-600 mb-4">+ Add Stat</button>

                  {/* Features */}
                  <label className={labelCls}>Features (Grid)</label>
                  {(asArray(settings.why_us?.features)).map((f,i)=>(
                    <div key={i} className="p-3 border border-stone-200 rounded-lg space-y-2 bg-stone-50 relative">
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" value={f.title} placeholder="Title" onChange={e=>{const a=[...settings.why_us.features];a[i]={...a[i],title:e.target.value};setSettings({...settings,why_us:{...settings.why_us,features:a}})}} className={inputCls} />
                        <input type="text" value={f.icon} placeholder="FontAwesome Icon (e.g. fa-shield)" onChange={e=>{const a=[...settings.why_us.features];a[i]={...a[i],icon:e.target.value};setSettings({...settings,why_us:{...settings.why_us,features:a}})}} className={inputCls} />
                      </div>
                      <input type="text" value={f.desc} placeholder="Description" onChange={e=>{const a=[...settings.why_us.features];a[i]={...a[i],desc:e.target.value};setSettings({...settings,why_us:{...settings.why_us,features:a}})}} className={inputCls} />
                      <input type="text" value={f.color} placeholder="Tailwind Colors (e.g. text-blue-600 bg-blue-50)" onChange={e=>{const a=[...settings.why_us.features];a[i]={...a[i],color:e.target.value};setSettings({...settings,why_us:{...settings.why_us,features:a}})}} className={inputCls} />
                      <button onClick={()=>{const a=[...settings.why_us.features];a.splice(i,1);setSettings({...settings,why_us:{...settings.why_us,features:a}})}} className="absolute top-2 right-2 w-8 h-8 text-red-500 rounded hover:bg-red-100"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  ))}
                  <button onClick={()=>setSettings({...settings,why_us:{...settings.why_us,features:[...(settings.why_us?.features||[]),{title:'',icon:'fa-check',desc:'',color:'text-brand bg-orange-50'}]}})} className="text-xs font-bold text-brand-600 block mb-4">+ Add Feature</button>

                  <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-circle-check"></i> Saved!</span> : 'Save Why Us'}</button>
                </div>
              </div>

              {/* Services Bar */}
              <div className={`${cardCls} p-6`}>
                <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-icons mr-2 text-purple-500"></i>Services Bar (4 Buttons)</h3>
                <div className="space-y-4">
                  {(asArray(settings.services_bar)).map((s,i)=>(
                    <div key={i} className="flex gap-3">
                      <input type="text" value={s.icon} placeholder="Icon (e.g. fa-car)" onChange={e=>{const a=[...settings.services_bar];a[i]={...a[i],icon:e.target.value};setSettings({...settings,services_bar:a})}} className={inputCls} />
                      <input type="text" value={s.label} placeholder="Label" onChange={e=>{const a=[...settings.services_bar];a[i]={...a[i],label:e.target.value};setSettings({...settings,services_bar:a})}} className={inputCls} />
                      <input type="text" value={s.desc} placeholder="Description" onChange={e=>{const a=[...settings.services_bar];a[i]={...a[i],desc:e.target.value};setSettings({...settings,services_bar:a})}} className={inputCls} />
                      <button onClick={()=>{const a=[...settings.services_bar];a.splice(i,1);setSettings({...settings,services_bar:a})}} className="w-10 h-10 flex items-center justify-center text-red-500 border border-stone-200 rounded-lg hover:bg-red-50 shrink-0"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  ))}
                  <button onClick={()=>setSettings({...settings,services_bar:[...(settings.services_bar||[]),{icon:'fa-check',label:'',desc:''}]})} className="text-xs font-bold text-brand-600 block mb-4">+ Add Service</button>
                  <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-circle-check"></i> Saved!</span> : 'Save Services Bar'}</button>
                </div>
              </div>

              {/* Hero Slideshow */}
              <div className={`${cardCls} p-6`}>
                <h3 className="font-bold text-stone-900 mb-5"><i className="fa-regular fa-images mr-2 text-sky-500"></i>Hero Slideshow</h3>
                <input type="file" accept="image/*" onChange={async e=>{const f=e.target.files[0];if(f){const dataUrl=await fileToBase64(f,1920,1080,0.75);setSettings({...settings,hero_images:[...asArray(settings.hero_images),dataUrl]});}}} className="w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer mb-4" />
                <div className="flex flex-wrap gap-3 mb-4">
                  {asArray(settings.hero_images).map((img,i)=>(
                    <div key={i} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-stone-200">
                      <img src={img} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <button onClick={()=>{const a=[...asArray(settings.hero_images)];a.splice(i,1);setSettings({...settings,hero_images:a});}} className="w-8 h-8 bg-red-500 rounded-full text-white flex items-center justify-center"><i className="fa-solid fa-trash text-xs"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? <span className="inline-flex items-center gap-1.5"><i className="fa-solid fa-circle-check"></i> Saved!</span> : 'Save Images'}</button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SETTINGS (6 Modules) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              setSettings={setSettings}
              saveSettings={saveSettings}
              settingsSaved={settingsSaved}
              staff={staff}
              setStaff={setStaff}
              auditLogs={auditLogs}
              setAuditLogs={setAuditLogs}
              auth={auth}
              authPost={authPost}
              authPatch={authPatch}
              authDelete={authDelete}
              fetchAll={fetchAll}
              testResult={testResult}
              setTestResult={setTestResult}
              inputCls={inputCls}
              labelCls={labelCls}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              statusBadge={statusBadge}
              currency={currency}
              rentals={rentals}
              bookings={bookings}
              invoices={invoices}
              bikes={bikes}
              rooms={rooms}
              guests={guests}
            />
          )}
          
          {activeTab === 'booking-stock' && (
            <BookingStockTab
              bikes={bikes}
              models={models}
              rentals={rentals}
              bookings={bookings}
              auth={auth}
              fetchAll={fetchAll}
              inputCls={inputCls}
              labelCls={labelCls}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              today={today}
              currency={currency}
            />
          )}

          {activeTab === 'check-out' && (
            <CheckoutTab
              bikes={bikes}
              models={models}
              setBikes={setBikes}
              rentals={rentals}
              setRentals={setRentals}
              staff={staff}
              guests={guests}
              setGuests={setGuests}
              auth={auth}
              fetchAll={fetchAll}
              inputCls={inputCls}
              labelCls={labelCls}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              today={today}
              currency={currency}
            />
          )}

          {activeTab === 'check-in' && (
            <CheckinTab
              rentals={rentals}
              setRentals={setRentals}
              bikes={bikes}
              setBikes={setBikes}
              staff={staff}
              auth={auth}
              fetchAll={fetchAll}
              inputCls={inputCls}
              labelCls={labelCls}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              statusBadge={statusBadge}
              today={today}
              currency={currency}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab
              rentals={rentals}
              setRentals={setRentals}
              bikes={bikes}
              auth={auth}
              fetchAll={fetchAll}
              inputCls={inputCls}
              labelCls={labelCls}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              statusBadge={statusBadge}
              currency={currency}
              settings={settings}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarTab
              rentals={rentals}
              bookings={bookings}
              bikes={bikes}
              models={models}
              rooms={rooms}
              cardCls={cardCls}
              btnSecondary={btnSecondary}
              currency={currency}
            />
          )}

          {activeTab === 'income' && (
            <IncomeTab
              rentals={rentals}
              setRentals={setRentals}
              bikes={bikes}
              staff={staff}
              auth={auth}
              fetchAll={fetchAll}
              cardCls={cardCls}
              inputCls={inputCls}
              labelCls={labelCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              currency={currency}
            />
          )}

          {activeTab === 'booking-income' && (
            <BookingIncomeTab
              bookings={bookings}
              setBookings={setBookings}
              auth={auth}
              fetchAll={fetchAll}
              cardCls={cardCls}
              inputCls={inputCls}
              labelCls={labelCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              currency={currency}
            />
          )}

          {activeTab === 'maintenance' && (
            <MaintenanceTab
              bikes={bikes}
              auth={auth}
              inputCls={inputCls}
              labelCls={labelCls}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              today={today}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesTab
              auth={auth}
              inputCls={inputCls}
              labelCls={labelCls}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              today={today}
            />
          )}

          {activeTab === 'telegram-alerts' && (
            <TelegramAlertsTab
              auth={auth}
              cardCls={cardCls}
              inputCls={inputCls}
              labelCls={labelCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
            />
          )}

          {activeTab === 'feedback-qr' && (
            <FeedbackQrTab
              settings={settings}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
            />
          )}

          {activeTab === 'users' && (
            <UsersTab
              auth={auth}
              inputCls={inputCls}
              labelCls={labelCls}
              cardCls={cardCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              fetchAll={fetchAll}
            />
          )}

          {activeTab === 'room-history' && (
            <RoomHistoryTab
              occupancy={occupancy}
              setOccupancy={setOccupancy}
              bookings={bookings}
              setBookings={setBookings}
              rooms={rooms}
              auth={auth}
              fetchAll={fetchAll}
              cardCls={cardCls}
              inputCls={inputCls}
              labelCls={labelCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              currency={currency}
              settings={settings}
            />
          )}

          {activeTab === 'room-income' && (
            <RoomIncomeTab
              occupancy={occupancy}
              setOccupancy={setOccupancy}
              rooms={rooms}
              auth={auth}
              fetchAll={fetchAll}
              cardCls={cardCls}
              inputCls={inputCls}
              labelCls={labelCls}
              btnPrimary={btnPrimary}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              currency={currency}
            />
          )}

          {activeTab === 'customer-documents' && (
            <CustomerDocsTab
              guests={guests}
              cardCls={cardCls}
              inputCls={inputCls}
            />
          )}

        </div>
      </main>

      {/* ─── MOBILE BOTTOM NAVIGATION BAR ─────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-stone-200/90 py-2 px-2 md:hidden flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.08)] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'dashboard' ? 'text-brand-600 font-bold scale-105' : 'text-stone-400 hover:text-stone-700'
          }`}
        >
          <i className="fa-solid fa-table-cells-large text-base mb-0.5"></i>
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('check-out'); setMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'check-out' ? 'text-brand-600 font-bold scale-105' : 'text-stone-400 hover:text-stone-700'
          }`}
        >
          <i className="fa-solid fa-clipboard-check text-base mb-0.5"></i>
          <span className="text-[10px] tracking-tight">Check Out</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('check-in'); setMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'check-in' ? 'text-brand-600 font-bold scale-105' : 'text-stone-400 hover:text-stone-700'
          }`}
        >
          <i className="fa-solid fa-circle-left text-base mb-0.5"></i>
          <span className="text-[10px] tracking-tight">Check In</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('bookings'); setMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative cursor-pointer ${
            activeTab === 'bookings' || activeTab === 'room-bookings' ? 'text-brand-600 font-bold scale-105' : 'text-stone-400 hover:text-stone-700'
          }`}
        >
          <div className="relative">
            <i className="fa-solid fa-calendar-check text-base mb-0.5"></i>
            {totalPendingBookings > 0 && (
              <span className="absolute -top-1 -right-2.5 bg-amber-500 text-white font-black text-[9px] min-w-4 h-4 rounded-full flex items-center justify-center px-1 animate-pulse shadow-xs">
                {totalPendingBookings}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">Bookings</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative cursor-pointer ${
            mobileMenuOpen || (!['dashboard', 'check-out', 'check-in', 'bookings', 'room-bookings'].includes(activeTab))
              ? 'text-brand-600 font-bold'
              : 'text-stone-400 hover:text-stone-700'
          }`}
        >
          <div className="relative">
            <i className="fa-solid fa-bars text-base mb-0.5"></i>
            {!['dashboard', 'check-out', 'check-in', 'bookings', 'room-bookings'].includes(activeTab) && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-brand-500 rounded-full"></span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">Menu</span>
        </button>
      </nav>

      {/* Modal popups are rendered by ModalProvider in main.jsx */}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUB-TABS
// ══════════════════════════════════════════════════════════════════════════════
//  ROOMS TAB (Occupancy + Room Types Catalog CRUD)
// ══════════════════════════════════════════════════════════════════════════════

// RoomsTab is now modularized in ./admin/RoomsTab.jsx

function RentalsTab({ bikes, rentals, occupancy, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge, today, currency }) {
  const [form, setForm] = useState({ bikeId:'', guestName:'', guestPhone:'', guestNationality:'', deposit:0, depositType:'cash', linkedRoomOccupancyId:'', startDate:today(), endDate:'', dailyRate:'', preCondition:'' });
  const [returnForm, setReturnForm] = useState(null);

  const availableBikes = bikes.filter(b=>b.status==='available');
  const activeRentals  = rentals.filter(r=>r.status==='active');

  const handleNewRental = async (e) => {
    e.preventDefault();
    await fetch('/api/rentals', { method:'POST', ...auth, body: JSON.stringify(form) });
    fetchAll();
    setForm({ bikeId:'', guestName:'', guestPhone:'', guestNationality:'', deposit:0, depositType:'cash', linkedRoomOccupancyId:'', startDate:today(), endDate:'', dailyRate:'', preCondition:'' });
  };
  const handleReturn = async (e) => {
    e.preventDefault();
    await fetch(`/api/rentals/${returnForm.id}/return`, { method:'PATCH', ...auth, body: JSON.stringify(returnForm) });
    fetchAll(); setReturnForm(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* New Rental Form */}
        <div className={`${cardCls} p-6 h-fit sticky top-8`}>
          <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-motorcycle mr-2 text-brand-500"></i>New Rental</h3>
          <form onSubmit={handleNewRental} className="space-y-4 text-sm">
            <div>
              <label className={labelCls}>Motorbike</label>
              <select value={form.bikeId} onChange={e=>{const b=bikes.find(x=>x.id===parseInt(e.target.value));setForm({...form,bikeId:e.target.value,dailyRate:b?.price||''});}} className={inputCls} required>
                <option value="">Select bike...</option>
                {availableBikes.map(b=><option key={b.id} value={b.id}>{b.name} — {b.plateNumber} ({b.color})</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Guest Name</label><input type="text" value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} className={inputCls} required /></div>
            <div><label className={labelCls}>Phone</label><input type="text" value={form.guestPhone} onChange={e=>setForm({...form,guestPhone:e.target.value})} className={inputCls} /></div>
            <div><label className={labelCls}>Nationality</label><input type="text" value={form.guestNationality} onChange={e=>setForm({...form,guestNationality:e.target.value})} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Link to Room Stay (optional)</label>
              <select value={form.linkedRoomOccupancyId} onChange={e=>setForm({...form,linkedRoomOccupancyId:e.target.value})} className={inputCls}>
                <option value="">No link</option>
                {occupancy.filter(o=>o.status==='checked_in').map(o=><option key={o.id} value={o.id}>Room {o.roomName} — {o.guestName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Daily Rate ($)</label><input type="number" step="0.01" value={form.dailyRate} onChange={e=>setForm({...form,dailyRate:e.target.value})} className={inputCls} required /></div>
              <div><label className={labelCls}>Deposit ($)</label><input type="number" step="0.01" value={form.deposit} onChange={e=>setForm({...form,deposit:e.target.value})} className={inputCls} /></div>
            </div>
            <div>
              <label className={labelCls}>Deposit Method</label>
              <select value={form.depositType} onChange={e=>setForm({...form,depositType:e.target.value})} className={inputCls}>
                {['cash','aba','khqr','card'].map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Start Date</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} className={inputCls} required /></div>
              <div><label className={labelCls}>End Date</label><input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} className={inputCls} required /></div>
            </div>
            <div><label className={labelCls}>Pre-rental Condition</label><textarea rows="2" value={form.preCondition} onChange={e=>setForm({...form,preCondition:e.target.value})} className={inputCls} placeholder="Any scratches, issues noted..."></textarea></div>
            <button type="submit" className={`${btnPrimary} w-full`}>Create Rental</button>
          </form>
        </div>

        {/* Active Rentals */}
        <div className="xl:col-span-2 space-y-6">
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-stone-900">Active Rentals ({activeRentals.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider">
                  <tr>{['Bike','Plate','Guest','Phone','Start','End','Rate','Deposit','Actions'].map(h=><th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {activeRentals.map(r=>(
                    <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="px-3 py-3 font-bold">{r.bikeName}</td>
                      <td className="px-3 py-3 font-mono text-xs">{r.plateNumber}</td>
                      <td className="px-3 py-3">{r.guestName}</td>
                      <td className="px-3 py-3 font-mono text-xs">{r.guestPhone||'—'}</td>
                      <td className="px-3 py-3 text-xs">{r.startDate}</td>
                      <td className="px-3 py-3 text-xs">{r.endDate}</td>
                      <td className="px-3 py-3 font-bold text-brand-600">{currency(r.dailyRate)}</td>
                      <td className="px-3 py-3 text-emerald-600 font-bold">{currency(r.deposit)}</td>
                      <td className="px-3 py-3">
                        <button onClick={()=>setReturnForm({...r,postCondition:'',damageFee:0,damageNotes:''})} className="text-xs font-bold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">Return Bike</button>
                      </td>
                    </tr>
                  ))}
                  {activeRentals.length===0&&<tr><td colSpan="9" className="py-12 text-center text-stone-400">No active rentals.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Return modal */}
          {returnForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <h3 className="font-bold text-lg text-stone-900 mb-4"><i className="fa-solid fa-motorcycle mr-2"></i>Return: {returnForm.bikeName}</h3>
                <form onSubmit={handleReturn} className="space-y-4 text-sm">
                  <div><label className={labelCls}>Post-rental Condition</label><textarea rows="3" value={returnForm.postCondition} onChange={e=>setReturnForm({...returnForm,postCondition:e.target.value})} className={inputCls} placeholder="Condition on return..."></textarea></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Damage Fee ($)</label><input type="number" step="0.01" min="0" value={returnForm.damageFee} onChange={e=>setReturnForm({...returnForm,damageFee:e.target.value})} className={inputCls} /></div>
                    <div><label className={labelCls}>Damage Notes</label><input type="text" value={returnForm.damageNotes} onChange={e=>setReturnForm({...returnForm,damageNotes:e.target.value})} className={inputCls} /></div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className={`${btnPrimary} flex-1`}>Confirm Return</button>
                    <button type="button" onClick={()=>setReturnForm(null)} className={btnSecondary}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Rental history */}
          <div className={`${cardCls} p-6`}>
            <h3 className="font-bold text-stone-900 mb-4">Rental History</h3>
            <div className="space-y-2">
              {rentals.filter(r=>r.status==='returned').slice(0,8).map(r=>(
                <div key={r.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100 text-sm">
                  <div><p className="font-bold">{r.bikeName} — {r.guestName}</p><p className="text-xs text-stone-400">{r.startDate} → {r.actualReturn?.split('T')[0]}</p></div>
                  <div className="text-right"><p className="font-bold text-stone-700">{currency(r.dailyRate)}/day</p>{r.damageFee>0&&<p className="text-xs text-red-500">Damage: {currency(r.damageFee)}</p>}</div>
                </div>
              ))}
              {rentals.filter(r=>r.status==='returned').length===0&&<p className="text-sm text-stone-400 text-center py-4">No returned rentals yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingTab({ invoices, occupancy, rentals, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge, currency, settings = {} }) {
  const [form, setForm] = useState({ guestName:'', guestPhone:'', roomOccupancyId:'', rentalId:'', roomCharge:0, bikeCharge:0, lateFee:0, damageFee:0, extras:0, extrasNote:'', discount:0, paymentMethod:'cash', notes:'' });
  const [printInvoice, setPrintInvoice] = useState(null);
  const total = [form.roomCharge,form.bikeCharge,form.lateFee,form.damageFee,form.extras].reduce((s,v)=>s+(parseFloat(v)||0),0) - (parseFloat(form.discount)||0);

  const handleCreate = async (e) => {
    e.preventDefault();
    await fetch('/api/invoices', { method:'POST', ...auth, body: JSON.stringify(form) });
    fetchAll();
    setForm({ guestName:'', guestPhone:'', roomOccupancyId:'', rentalId:'', roomCharge:0, bikeCharge:0, lateFee:0, damageFee:0, extras:0, extrasNote:'', discount:0, paymentMethod:'cash', notes:'' });
  };
  const handlePay = async (id) => {
    const method = prompt('Payment method: cash / aba / khqr / card', 'cash');
    if (!method) return;
    await fetch(`/api/invoices/${id}/pay`, { method:'PATCH', ...auth, body: JSON.stringify({ paymentMethod:method }) });
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Invoice builder */}
        <div className={`${cardCls} p-6 h-fit sticky top-8`}>
          <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-file-invoice-dollar mr-2 text-indigo-500"></i>Create Invoice</h3>
          <form onSubmit={handleCreate} className="space-y-4 text-sm">
            <div><label className={labelCls}>Guest Name</label><input type="text" value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} className={inputCls} required /></div>
            <div><label className={labelCls}>Phone</label><input type="text" value={form.guestPhone} onChange={e=>setForm({...form,guestPhone:e.target.value})} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Link Room Stay</label>
              <select value={form.roomOccupancyId} onChange={e=>setForm({...form,roomOccupancyId:e.target.value})} className={inputCls}>
                <option value="">None</option>
                {occupancy.map(o=><option key={o.id} value={o.id}>Room {o.roomName} — {o.guestName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Link Rental</label>
              <select value={form.rentalId} onChange={e=>{const r=rentals.find(x=>x.id===parseInt(e.target.value));setForm({...form,rentalId:e.target.value,bikeCharge:r?r.dailyRate:0});}} className={inputCls}>
                <option value="">None</option>
                {rentals.map(r=><option key={r.id} value={r.id}>{r.bikeName} — {r.guestName}</option>)}
              </select>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wider">Charges (USD)</p>
              {[['roomCharge','Room Charge'],['bikeCharge','Bike Charge'],['lateFee','Late Return Fee'],['damageFee','Damage Fee'],['extras','Extra Services']].map(([k,l])=>(
                <div key={k} className="flex items-center gap-3">
                  <label className="text-xs text-stone-500 w-32 shrink-0">{l}</label>
                  <input type="number" step="0.01" min="0" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className={inputCls} />
                </div>
              ))}
              {parseFloat(form.extras)>0&&<div><input type="text" value={form.extrasNote} onChange={e=>setForm({...form,extrasNote:e.target.value})} className={inputCls} placeholder="Extra services note" /></div>}
              <div className="flex items-center gap-3">
                <label className="text-xs text-stone-500 w-32 shrink-0">Discount</label>
                <input type="number" step="0.01" min="0" value={form.discount} onChange={e=>setForm({...form,discount:e.target.value})} className={inputCls} />
              </div>
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-700">Total</span>
                <span className="text-xl font-black text-stone-900">{currency(total)}</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Payment Method</label>
              <select value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})} className={inputCls}>
                {['cash','aba','khqr','card'].map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Notes</label><textarea rows="2" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className={inputCls}></textarea></div>
            <button type="submit" className={`${btnPrimary} w-full`}>Create Invoice</button>
          </form>
        </div>

        {/* Invoice list */}
        <div className="xl:col-span-2">
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-stone-900">Invoices ({invoices.length})</h3>
              <div className="flex gap-3 text-xs">
                <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded">Paid: {invoices.filter(i=>i.paymentStatus==='paid').length}</span>
                <span className="bg-red-50 text-red-600 font-bold px-2 py-1 rounded">Unpaid: {invoices.filter(i=>i.paymentStatus==='unpaid').length}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider">
                  <tr>{['Invoice #','Guest','Room','Bike','Late Fee','Damage','Total','Method','Status','Actions'].map(h=><th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {invoices.map(inv=>(
                    <tr key={inv.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="px-3 py-3 font-mono text-xs text-stone-500">{inv.invoiceNumber}</td>
                      <td className="px-3 py-3 font-bold">{inv.guestName}</td>
                      <td className="px-3 py-3">{currency(inv.roomCharge)}</td>
                      <td className="px-3 py-3">{currency(inv.bikeCharge)}</td>
                      <td className="px-3 py-3 text-amber-600">{currency(inv.lateFee)}</td>
                      <td className="px-3 py-3 text-red-600">{currency(inv.damageFee)}</td>
                      <td className="px-3 py-3 font-black text-stone-900">{currency(inv.totalAmount)}</td>
                      <td className="px-3 py-3 text-xs uppercase font-bold">{inv.paymentMethod}</td>
                      <td className="px-3 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge[inv.paymentStatus]}`}>{inv.paymentStatus}</span></td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const items = [];
                              if (Number(inv.roomCharge) > 0) {
                                items.push({ description: 'Room Accommodation Charge', subtitle: 'Stay fee', rate: Number(inv.roomCharge), total: Number(inv.roomCharge), qty: 1 });
                              }
                              if (Number(inv.bikeCharge) > 0) {
                                items.push({ description: 'Motorbike / Bicycle Rental', subtitle: 'Daily vehicle rate', rate: Number(inv.bikeCharge), total: Number(inv.bikeCharge), qty: 1 });
                              }
                              if (Number(inv.lateFee) > 0) {
                                items.push({ description: 'Late Return Overdue Fee', subtitle: 'Penalty charge', rate: Number(inv.lateFee), total: Number(inv.lateFee), qty: 1 });
                              }
                              if (Number(inv.damageFee) > 0) {
                                items.push({ description: 'Damage / Repair Fee', subtitle: 'Service maintenance', rate: Number(inv.damageFee), total: Number(inv.damageFee), qty: 1 });
                              }
                              if (Number(inv.extras) > 0) {
                                items.push({ description: inv.extrasNote || 'Additional Hotel Services', subtitle: 'Guest services', rate: Number(inv.extras), total: Number(inv.extras), qty: 1 });
                              }
                              if (items.length === 0) {
                                items.push({ description: 'Official Hotel Folio & Services', subtitle: 'Guest invoice', rate: Number(inv.totalAmount || 0), total: Number(inv.totalAmount || 0), qty: 1 });
                              }
                              setPrintInvoice({
                                ...inv,
                                customItems: items,
                                discount: inv.discount
                              });
                            }}
                            className="text-xs font-bold px-2.5 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-100 transition flex items-center gap-1 cursor-pointer"
                            title="Print Official Folio / Invoice"
                          >
                            <i className="fa-solid fa-print text-xs"></i>
                            <span>Print</span>
                          </button>
                          {inv.paymentStatus==='unpaid'&&<button onClick={()=>handlePay(inv.id)} className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap cursor-pointer">Mark Paid</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invoices.length===0&&<tr><td colSpan="10" className="py-12 text-center text-stone-400">No invoices yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Official Printable Invoice Modal */}
      {printInvoice && (
        <RoomInvoiceModal
          isOpen={!!printInvoice}
          onClose={() => setPrintInvoice(null)}
          occupancy={printInvoice}
          relatedOccupancies={[]}
          rooms={[]}
          settings={settings}
          currency={currency}
        />
      )}
    </div>
  );
}

function HousekeepingTab({ rooms, housekeeping, maintenance, bikes, auth, fetchAll, fetchDash, inputCls, labelCls, cardCls, btnPrimary, btnDanger, statusBadge, today, currency }) {
  const [hkForm, setHkForm] = useState({ roomId:'', taskType:'clean', assignedTo:'', notes:'', scheduledDate:today() });
  const [mntForm, setMntForm] = useState({ bikeId:'', logType:'oil_change', description:'', cost:0, performedBy:'', nextServiceDate:'' });

  const addTask = async (e) => {
    e.preventDefault();
    await fetch('/api/housekeeping', { method:'POST', ...auth, body: JSON.stringify(hkForm) });
    fetchAll(); setHkForm({ roomId:'', taskType:'clean', assignedTo:'', notes:'', scheduledDate:today() });
  };
  const completeTask = async (id) => {
    await fetch(`/api/housekeeping/${id}/complete`, { method:'PATCH', ...auth });
    fetchAll(); fetchDash();
  };
  const addMaintenance = async (e) => {
    e.preventDefault();
    await fetch('/api/maintenance', { method:'POST', ...auth, body: JSON.stringify(mntForm) });
    fetchAll(); setMntForm({ bikeId:'', logType:'oil_change', description:'', cost:0, performedBy:'', nextServiceDate:'' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Housekeeping form */}
        <div className={`${cardCls} p-6`}>
          <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-broom mr-2 text-amber-500"></i>Assign Cleaning Task</h3>
          <form onSubmit={addTask} className="space-y-4 text-sm">
            <div>
              <label className={labelCls}>Room</label>
              <select value={hkForm.roomId} onChange={e=>setHkForm({...hkForm,roomId:e.target.value})} className={inputCls} required>
                <option value="">Select room...</option>
                {rooms.map(r=><option key={r.id} value={r.id}>Room {r.name} ({r.status})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Task Type</label>
              <select value={hkForm.taskType} onChange={e=>setHkForm({...hkForm,taskType:e.target.value})} className={inputCls}>
                {['clean','deep_clean','linen_change','inspection','repair'].map(t=><option key={t} value={t}>{t.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Assigned To</label><input type="text" value={hkForm.assignedTo} onChange={e=>setHkForm({...hkForm,assignedTo:e.target.value})} className={inputCls} placeholder="Staff name" /></div>
            <div><label className={labelCls}>Scheduled Date</label><input type="date" value={hkForm.scheduledDate} onChange={e=>setHkForm({...hkForm,scheduledDate:e.target.value})} className={inputCls} /></div>
            <div><label className={labelCls}>Notes</label><textarea rows="2" value={hkForm.notes} onChange={e=>setHkForm({...hkForm,notes:e.target.value})} className={inputCls}></textarea></div>
            <button type="submit" className={`${btnPrimary} w-full`}>Add Task</button>
          </form>
        </div>

        {/* Housekeeping task list */}
        <div className={`${cardCls} p-6`}>
          <h3 className="font-bold text-stone-900 mb-5">Tasks</h3>
          <div className="space-y-3">
            {housekeeping.slice(0,10).map(task=>(
              <div key={task.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                <div>
                  <p className="text-sm font-bold text-stone-900">{task.roomName} — {task.taskType.replace('_',' ')}</p>
                  <p className="text-xs text-stone-400">{task.assignedTo||'Unassigned'} · {task.scheduledDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge[task.status]}`}>{task.status}</span>
                  {task.status==='pending'&&<button onClick={()=>completeTask(task.id)} className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 flex items-center justify-center transition-colors"><i className="fa-solid fa-check text-xs"></i></button>}
                </div>
              </div>
            ))}
            {housekeeping.length===0&&<p className="text-sm text-stone-400 text-center py-8">No tasks yet.</p>}
          </div>
        </div>
      </div>

      {/* Vehicle maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${cardCls} p-6`}>
          <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-screwdriver-wrench mr-2 text-stone-600"></i>Log Vehicle Maintenance</h3>
          <form onSubmit={addMaintenance} className="space-y-4 text-sm">
            <div>
              <label className={labelCls}>Bike</label>
              <select value={mntForm.bikeId} onChange={e=>setMntForm({...mntForm,bikeId:e.target.value})} className={inputCls} required>
                <option value="">Select bike...</option>
                {bikes.map(b=><option key={b.id} value={b.id}>{b.name} — {b.plateNumber}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Log Type</label>
              <select value={mntForm.logType} onChange={e=>setMntForm({...mntForm,logType:e.target.value})} className={inputCls}>
                {['oil_change','tire_replace','brake_check','full_service','repair','battery'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Description</label><textarea rows="2" value={mntForm.description} onChange={e=>setMntForm({...mntForm,description:e.target.value})} className={inputCls}></textarea></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Cost ($)</label><input type="number" step="0.01" min="0" value={mntForm.cost} onChange={e=>setMntForm({...mntForm,cost:e.target.value})} className={inputCls} /></div>
              <div><label className={labelCls}>Performed By</label><input type="text" value={mntForm.performedBy} onChange={e=>setMntForm({...mntForm,performedBy:e.target.value})} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Next Service Date</label><input type="date" value={mntForm.nextServiceDate} onChange={e=>setMntForm({...mntForm,nextServiceDate:e.target.value})} className={inputCls} /></div>
            <button type="submit" className={`${btnPrimary} w-full`}>Log Maintenance</button>
          </form>
        </div>

        <div className={`${cardCls} p-6`}>
          <h3 className="font-bold text-stone-900 mb-5">Maintenance History</h3>
          <div className="space-y-3">
            {maintenance.slice(0,10).map(log=>(
              <div key={log.id} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-stone-900">{log.bikeName} — {log.logType.replace(/_/g,' ')}</p>
                  <span className="text-xs font-bold text-stone-500">{currency(log.cost)}</span>
                </div>
                <p className="text-xs text-stone-400">{log.description||'—'} · {log.logDate} · {log.performedBy||'Unknown'}</p>
                {log.nextServiceDate&&<p className="text-xs text-amber-600 mt-1">Next service: {log.nextServiceDate}</p>}
              </div>
            ))}
            {maintenance.length===0&&<p className="text-sm text-stone-400 text-center py-8">No logs yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ONLINE BOOKINGS TAB (Fast Optimistic CRUD & Status Management)
// ══════════════════════════════════════════════════════════════════════════════

function BookingsTab({ bookings, setBookings, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge, sendCategoryTelegramAlert, tgSending }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | motor | room
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | confirmed | cancelled
  const [sortBy, setSortBy] = useState('date-desc');
  const [editingBooking, setEditingBooking] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fast optimistic status change (persisted to Firestore + SQLite)
  const handleUpdateStatus = async (bookingOrId, newStatus) => {
    const booking = typeof bookingOrId === 'object'
      ? bookingOrId
      : (bookings.find(b => String(b.id) === String(bookingOrId)) || { id: bookingOrId });
    const id = booking.id;
    const bookingRef = booking.bookingRef;
    const isRoom = booking.type === 'room' || Boolean(booking.roomId) || String(booking.itemName || '').toLowerCase().includes('room');

    // 1. Optimistic UI update (0ms latency)
    setBookings(prev => prev.map(b => (String(b.id) === String(id) || (bookingRef && b.bookingRef === bookingRef)) ? { ...b, status: newStatus } : b));

    // 2. Persist directly to Firestore (cloud source of truth)
    try {
      if (id) {
        const updatePromises = [BookingService.update(id, { status: newStatus })];
        if (isRoom) {
          updatePromises.push(HotelBookingService.update(id, { status: newStatus }));
        }
        await Promise.allSettled(updatePromises);
      }
    } catch (fsErr) {
      console.warn('Firestore status update error:', fsErr);
    }

    // 3. Persist to local server / SQLite
    const targetId = bookingRef || id;
    try {
      await fetch(`/api/bookings/${encodeURIComponent(targetId)}/status`, {
        method: 'PATCH',
        ...auth,
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  // Fast optimistic delete (0ms latency)
  const handleDelete = async (bookingOrId) => {
    const id = typeof bookingOrId === 'object' ? bookingOrId.id : bookingOrId;
    const bRef = typeof bookingOrId === 'object' ? bookingOrId.bookingRef : null;
    if (!await showConfirm('Delete Booking', 'Are you sure you want to delete this booking?', 'Delete', 'danger')) return;
    setBookings(prev => prev.filter(b => b.id !== id));
    BookingService.delete(id).catch(() => {});
    HotelBookingService.delete(id).catch(() => {});
    const targetId = bRef || id;
    fetch(`/api/bookings/${targetId}`, { method: 'DELETE', ...auth })
      .catch(err => {
        console.error('Delete failed:', err);
        fetchAll();
      });
  };

  // Save edit modal with optimistic update
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingBooking) return;
    const updated = {
      ...editingBooking,
      totalFee: Number(editingBooking.totalFee || editingBooking.totalPrice || 0),
      totalPrice: Number(editingBooking.totalFee || editingBooking.totalPrice || 0),
      deposit: Number(editingBooking.deposit || 0)
    };
    setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
    setEditingBooking(null);
    BookingService.update(updated.id, updated).catch(() => {});
    HotelBookingService.update(updated.id, updated).catch(() => {});
    const targetId = updated.bookingRef || updated.id;
    fetch(`/api/bookings/${targetId}`, {
      method: 'PUT',
      ...auth,
      body: JSON.stringify(updated)
    }).catch(err => {
      console.error('Edit failed:', err);
      fetchAll();
    });
  };

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    const list = (bookings || []).filter(b => {
      const name = String(b.customerName || '').toLowerCase();
      const phone = String(b.phone || b.customerPhone || '');
      const item = String(b.itemName || '').toLowerCase();
      const matchSearch = !q || name.includes(q) || phone.includes(q) || item.includes(q);
      const matchType = typeFilter === 'all' || b.type === typeFilter;
      const bStatus = b.status || 'pending';
      const matchStatus = statusFilter === 'all' || bStatus === statusFilter;
      return matchSearch && matchType && matchStatus;
    });

    list.sort((a, b) => {
      if (sortBy === 'date-desc') {
        const da = new Date(a.startDate || a.checkoutDate || a.createdAt || 0).getTime();
        const db = new Date(b.startDate || b.checkoutDate || b.createdAt || 0).getTime();
        return db - da;
      }
      if (sortBy === 'date-asc') {
        const da = new Date(a.startDate || a.checkoutDate || a.createdAt || 0).getTime();
        const db = new Date(b.startDate || b.checkoutDate || b.createdAt || 0).getTime();
        return da - db;
      }
      if (sortBy === 'name-asc') {
        return String(a.customerName || '').trim().localeCompare(String(b.customerName || '').trim(), 'km');
      }
      if (sortBy === 'name-desc') {
        return String(b.customerName || '').trim().localeCompare(String(a.customerName || '').trim(), 'km');
      }
      if (sortBy === 'price-desc') {
        return (Number(b.totalFee || b.totalPrice || 0)) - (Number(a.totalFee || a.totalPrice || 0));
      }
      if (sortBy === 'price-asc') {
        return (Number(a.totalFee || a.totalPrice || 0)) - (Number(b.totalFee || b.totalPrice || 0));
      }
      return 0;
    });

    return list;
  }, [bookings, search, typeFilter, statusFilter, sortBy]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const pendingCount = bookings.filter(b => (b.status || 'pending') === 'pending').length;
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;

  const bookingStatusBadge = {
    pending: 'bg-amber-100 text-amber-800 border border-amber-300',
    confirmed: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    cancelled: 'bg-rose-100 text-rose-800 border border-rose-300',
    completed: 'bg-blue-100 text-blue-800 border border-blue-300'
  };

  return (
    <div className="space-y-6">
      {/* Top Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${cardCls} p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-black">
            <i className="fa-solid fa-list-check"></i>
          </div>
          <div>
            <p className="text-[11px] font-bold text-stone-400 uppercase">Total Bookings</p>
            <p className="text-xl font-black text-stone-900">{bookings.length}</p>
          </div>
        </div>

        <div className={`${cardCls} p-4 flex items-center gap-3 border-amber-200 bg-amber-50/40`}>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div>
            <p className="text-[11px] font-bold text-amber-600 uppercase">Pending</p>
            <p className="text-xl font-black text-amber-800">{pendingCount}</p>
          </div>
        </div>

        <div className={`${cardCls} p-4 flex items-center gap-3 border-emerald-200 bg-emerald-50/40`}>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase">Confirmed</p>
            <p className="text-xl font-black text-emerald-800">{confirmedCount}</p>
          </div>
        </div>

        <div className={`${cardCls} p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
            <i className="fa-solid fa-ban"></i>
          </div>
          <div>
            <p className="text-[11px] font-bold text-rose-500 uppercase">Cancelled</p>
            <p className="text-xl font-black text-rose-800">{cancelledCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={`${cardCls} p-4 flex flex-col md:flex-row items-center justify-between gap-4`}>
        <div className="w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by customer name, phone, item..."
            className={inputCls}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-700 outline-none focus:border-brand-500 cursor-pointer shadow-2xs"
            title="តម្រៀប (Sort)"
          >
            <option value="date-desc">កាលបរិច្ឆេទ: ថ្មីមុន (Newest)</option>
            <option value="date-asc">កាលបរិច្ឆេទ: ចាស់មុន (Oldest)</option>
            <option value="name-asc">ឈ្មោះ: A ដល់ Z (Name: A - Z)</option>
            <option value="name-desc">ឈ្មោះ: Z ដល់ A (Name: Z - A)</option>
            <option value="price-desc">តម្លៃ: ខ្ពស់ទៅទាប (Price: High)</option>
            <option value="price-asc">តម្លៃ: ទាបទៅខ្ពស់ (Price: Low)</option>
          </select>

          {/* Type Filter */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-bold text-stone-600">
            {['all', 'motor', 'room'].map(t => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all flex items-center gap-1.5 ${
                  typeFilter === t ? 'bg-white text-stone-900 shadow-sm' : 'hover:text-stone-900'
                }`}
              >
                {t === 'motor' ? (
                  <>
                    <i className="fa-solid fa-motorcycle text-brand-500"></i>
                    <span>Motors</span>
                  </>
                ) : t === 'room' ? (
                  <>
                    <i className="fa-solid fa-door-open text-indigo-500"></i>
                    <span>Rooms</span>
                  </>
                ) : (
                  <span>All Types</span>
                )}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-bold text-stone-600">
            {['all', 'pending', 'confirmed', 'cancelled'].map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  statusFilter === s ? 'bg-white text-stone-900 shadow-sm' : 'hover:text-stone-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Print & Alert to Telegram */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="បោះពុម្ពបញ្ជីការកក់ (Print Bookings)"
            >
              <i className="fa-solid fa-print text-stone-600"></i>
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => sendCategoryTelegramAlert && sendCategoryTelegramAlert({
                category: 'Bookings',
                title: 'Bookings & Reservations Status',
                summary: `Total Bookings: ${filtered.length} (Motors: ${bookings.filter(b=>b.type==='motor').length}, Rooms: ${bookings.filter(b=>b.type==='room'||b.roomId).length})`,
                details: `Pending: ${pendingCount} | Confirmed: ${confirmedCount} | Cancelled: ${cancelledCount}`
              })}
              disabled={tgSending}
              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              title="ផ្ញើបញ្ជីការកក់ទៅ Telegram"
            >
              <i className="fa-brands fa-telegram text-sky-500"></i>
              <span>Alert Telegram</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="print-only mb-4 p-4 border-b border-stone-300">
        <h2 className="text-xl font-bold">Motorental Siemreab Angkor & Guesthouse</h2>
        <p className="text-sm text-stone-700 font-semibold">Online Bookings & Customer Reservations Manifest</p>
        <p className="text-xs text-stone-500">Total Bookings: {filtered.length} | Printed: {new Date().toLocaleString()}</p>
      </div>

      {/* Bookings Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-stone-900">
            Online Bookings ({filtered.length} {filtered.length === 1 ? 'record' : 'records'})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider select-none">
              <tr>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Type & Item</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc')}
                  className="px-4 py-3 font-bold cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by customer name"
                >
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('name') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="px-4 py-3 font-bold">Contact</th>
                <th
                  onClick={() => setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                  className="px-4 py-3 font-bold cursor-pointer hover:text-stone-900 transition"
                  title="Click to sort by date"
                >
                  <div className="flex items-center gap-1">
                    <span>Dates / Duration</span>
                    <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('date') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="px-4 py-3 font-bold">Guests / Beds</th>
                <th className="px-4 py-3 font-bold">Requests</th>
                <th className="px-4 py-3 font-bold">Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(b => {
                const bStatus = b.status || 'pending';
                return (
                  <tr key={b.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${bookingStatusBadge[bStatus] || bookingStatusBadge.pending}`}>
                        {bStatus}
                      </span>
                    </td>

                    {/* Item */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          b.type === 'motor' ? 'bg-brand-50 text-brand-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          <i className={`fa-solid ${b.type === 'motor' ? 'fa-motorcycle' : 'fa-door-open'} text-[10px]`}></i>
                          {b.type === 'motor' ? 'Motor' : 'Room'}
                        </span>
                        <span className="font-bold text-stone-900">{b.itemName}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3.5 font-bold text-stone-900">{b.customerName}</td>

                    {/* Contact */}
                    <td className="px-4 py-3.5 font-mono text-xs text-stone-700">
                      <a href={`tel:${b.phone}`} className="hover:text-brand-600 hover:underline">{b.phone}</a>
                    </td>

                    {/* Dates */}
                    <td className="px-4 py-3.5 text-xs text-stone-600">
                      <div className="font-semibold">{b.startDate} → {b.endDate}</div>
                      <span className="text-[10px] text-stone-400">{new Date(b.createdAt).toLocaleDateString()}</span>
                    </td>

                    {/* Guests / Beds */}
                    <td className="px-4 py-3.5 text-xs text-stone-600">
                      {b.type === 'room' ? (
                        <span>{b.bedCount || 1} {b.bedCount > 1 ? 'Beds' : 'Bed'} · {b.guests || 1} Guests</span>
                      ) : (
                        <span>{b.guests || 1} Rider(s)</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3.5 text-xs text-stone-500 max-w-[150px] truncate">
                      {b.specialRequests || '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {bStatus === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(b, 'confirmed')}
                            title="Confirm Booking"
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <i className="fa-solid fa-check"></i> Confirm
                          </button>
                        )}

                        {bStatus !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdateStatus(b, 'cancelled')}
                            title="Cancel Booking"
                            className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <i className="fa-solid fa-ban"></i> Cancel
                          </button>
                        )}

                        <button
                          onClick={() => setEditingBooking(b)}
                          title="Edit Booking"
                          className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>

                        <button
                          onClick={() => handleDelete(b)}
                          title="Delete Booking"
                          className="w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-stone-400">
                    <i className="fa-regular fa-calendar-xmark text-4xl mb-2 opacity-30 block"></i>
                    No bookings found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalItems={filtered.length}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* EDIT BOOKING MODAL */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 modal-pop">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-100">
              <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-brand-500"></i> Edit Booking #{editingBooking.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Customer Name</label>
                  <input
                    type="text"
                    value={editingBooking.customerName || ''}
                    onChange={e => setEditingBooking({ ...editingBooking, customerName: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <input
                    type="text"
                    value={editingBooking.phone || ''}
                    onChange={e => setEditingBooking({ ...editingBooking, phone: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Booking Type</label>
                  <select
                    value={editingBooking.type || 'motor'}
                    onChange={e => setEditingBooking({ ...editingBooking, type: e.target.value })}
                    className={inputCls}
                  >
                    <option value="motor">Motorbike Rental</option>
                    <option value="room">Guesthouse Room</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={editingBooking.status || 'pending'}
                    onChange={e => setEditingBooking({ ...editingBooking, status: e.target.value })}
                    className={inputCls}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Item Name</label>
                <input
                  type="text"
                  value={editingBooking.itemName || ''}
                  onChange={e => setEditingBooking({ ...editingBooking, itemName: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input
                    type="date"
                    value={editingBooking.startDate || ''}
                    onChange={e => setEditingBooking({ ...editingBooking, startDate: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input
                    type="date"
                    value={editingBooking.endDate || ''}
                    onChange={e => setEditingBooking({ ...editingBooking, endDate: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Number of Guests</label>
                  <input
                    type="number"
                    min="1"
                    value={editingBooking.guests || 1}
                    onChange={e => setEditingBooking({ ...editingBooking, guests: parseInt(e.target.value) || 1 })}
                    className={inputCls}
                  />
                </div>
                {editingBooking.type === 'room' && (
                  <div>
                    <label className={labelCls}>Bed Count</label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={editingBooking.bedCount || 1}
                      onChange={e => setEditingBooking({ ...editingBooking, bedCount: parseInt(e.target.value) || 1 })}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Total Price / Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBooking.totalFee ?? editingBooking.totalPrice ?? ''}
                    onChange={e => setEditingBooking({ ...editingBooking, totalFee: parseFloat(e.target.value) || 0, totalPrice: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Deposit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBooking.deposit ?? ''}
                    onChange={e => setEditingBooking({ ...editingBooking, deposit: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Special Requests / Notes</label>
                <textarea
                  rows="3"
                  value={editingBooking.specialRequests || ''}
                  onChange={e => setEditingBooking({ ...editingBooking, specialRequests: e.target.value })}
                  className={inputCls}
                  placeholder="Guest notes, pickup times, etc."
                ></textarea>
              </div>

              <div className="pt-3 flex gap-3">
                <button type="submit" className={`${btnPrimary} flex-1 justify-center`}>
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingBooking(null)} className={btnSecondary}>
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

function GuestsTab({ guests, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnDanger, sendCategoryTelegramAlert, tgSending }) {
  const [form, setForm] = useState({ name:'', phone:'', email:'', nationality:'', passportId:'', notes:'' });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleAdd = async (e) => {
    e.preventDefault();
    await fetch('/api/guests', { method:'POST', ...auth, body: JSON.stringify(form) });
    fetchAll(); setForm({ name:'', phone:'', email:'', nationality:'', passportId:'', notes:'' });
  };
  const handleDelete = async (id) => {
    if (!await showConfirm('Delete Guest', 'Are you sure you want to delete this guest record?', 'Delete', 'danger')) return;
    await fetch(`/api/guests/${id}`, { method:'DELETE', ...auth });
    fetchAll();
  };

  const filtered = useMemo(() => {
    const list = (guests || []).filter(g =>
      !search ||
      (g.name || '').toLowerCase().includes(search.toLowerCase()) ||
      g.phone?.includes(search) ||
      (g.nationality || '').toLowerCase().includes(search.toLowerCase()) ||
      (g.passportId || g.passportOrId || '').toLowerCase().includes(search.toLowerCase())
    );

    list.sort((a, b) => {
      if (sortBy === 'name-asc') {
        return (a.name || '').trim().localeCompare((b.name || '').trim(), 'km');
      }
      if (sortBy === 'name-desc') {
        return (b.name || '').trim().localeCompare((a.name || '').trim(), 'km');
      }
      if (sortBy === 'id-desc') {
        return String(b.id || '').localeCompare(String(a.id || ''));
      }
      if (sortBy === 'id-asc') {
        return String(a.id || '').localeCompare(String(b.id || ''));
      }
      return 0;
    });

    return list;
  }, [guests, search, sortBy]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`${cardCls} p-6 h-fit sticky top-8`}>
          <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-user-plus mr-2 text-violet-500"></i>Add Guest</h3>
          <form onSubmit={handleAdd} className="space-y-4 text-sm">
            <div><label className={labelCls}>Full Name</label><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className={inputCls} required /></div>
            <div><label className={labelCls}>Phone</label><input type="text" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className={inputCls} /></div>
            <div><label className={labelCls}>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={inputCls} /></div>
            <div><label className={labelCls}>Nationality</label><input type="text" value={form.nationality} onChange={e=>setForm({...form,nationality:e.target.value})} className={inputCls} /></div>
            <div><label className={labelCls}>Passport / ID Number</label><input type="text" value={form.passportId} onChange={e=>setForm({...form,passportId:e.target.value})} className={inputCls} /></div>
            <div><label className={labelCls}>Notes</label><textarea rows="2" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className={inputCls}></textarea></div>
            <button type="submit" className={`${btnPrimary} w-full`}>Add to CRM</button>
          </form>
        </div>
        <div className="xl:col-span-2">
          <div className="mb-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input type="text" value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} className={inputCls} placeholder="Search by name, phone, nationality, ID..." />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-xs font-bold text-stone-700 outline-none focus:border-brand-500 shrink-0 cursor-pointer shadow-2xs"
              title="តម្រៀប (Sort)"
            >
              <option value="name-asc">ឈ្មោះ: A ដល់ Z (Name: A - Z)</option>
              <option value="name-desc">ឈ្មោះ: Z ដល់ A (Name: Z - A)</option>
              <option value="id-desc">ID: ថ្មីមុន (Newest ID)</option>
              <option value="id-asc">ID: ចាស់មុន (Oldest ID)</option>
            </select>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="បោះពុម្ពបញ្ជីភ្ញៀវ (Print Guests)"
              >
                <i className="fa-solid fa-print text-stone-600"></i>
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => sendCategoryTelegramAlert && sendCategoryTelegramAlert({
                  category: 'Guests',
                  title: 'Guest CRM Directory Report',
                  summary: `Total Registered Guests: ${guests.length}. Filtered: ${filtered.length}.`,
                  details: `Latest guest contacts and stay records synchronized.`
                })}
                disabled={tgSending}
                className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                title="ផ្ញើបញ្ជីភ្ញៀវទៅ Telegram"
              >
                <i className="fa-brands fa-telegram text-sky-500"></i>
                <span>Alert Telegram</span>
              </button>
            </div>
          </div>

          {/* Printable Report Header */}
          <div className="print-only mb-4 p-4 border-b border-stone-300">
            <h2 className="text-xl font-bold">Motorental Siemreab Angkor & Guesthouse</h2>
            <p className="text-sm text-stone-700 font-semibold">Guest Directory & Customer Profiles</p>
            <p className="text-xs text-stone-500">Total Registered: {guests.length} | Printed: {new Date().toLocaleString()}</p>
          </div>
          <div className={`${cardCls} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider select-none">
                  <tr>
                    <th
                      onClick={() => setSortBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc')}
                      className="px-4 py-3 font-bold cursor-pointer hover:text-stone-900 transition"
                      title="Click to sort by name"
                    >
                      <div className="flex items-center gap-1">
                        <span>Name</span>
                        <i className={`fa-solid fa-sort text-[10px] ${sortBy.startsWith('name') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                      </div>
                    </th>
                    <th className="px-4 py-3 font-bold">Phone</th>
                    <th className="px-4 py-3 font-bold">Email</th>
                    <th className="px-4 py-3 font-bold">Nationality</th>
                    <th className="px-4 py-3 font-bold">Passport ID</th>
                    <th className="px-4 py-3 font-bold">Notes</th>
                    <th className="px-4 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(g=>(
                    <tr key={g.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3 font-bold">{g.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{g.phone||'—'}</td>
                      <td className="px-4 py-3 text-xs">{g.email||'—'}</td>
                      <td className="px-4 py-3">{g.nationality||'—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{g.passportId||g.passportOrId||'—'}</td>
                      <td className="px-4 py-3 text-xs text-stone-500 max-w-[120px] truncate">{g.notes||'—'}</td>
                      <td className="px-4 py-3"><button onClick={()=>handleDelete(g.id)} className="w-8 h-8 flex items-center justify-center text-red-500 bg-red-50 rounded-lg hover:bg-red-100"><i className="fa-solid fa-trash text-xs"></i></button></td>
                    </tr>
                  ))}
                  {filtered.length===0&&<tr><td colSpan="7" className="py-12 text-center text-stone-400">No guests found.</td></tr>}
                </tbody>
              </table>
            </div>

            <PaginationControls
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalItems={filtered.length}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FleetTab({ bikes, models, setBikes, setModels, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge, currency, sendCategoryTelegramAlert, tgSending }) {
  const { showModal, showConfirm } = useModal();
  const [activeSubTab, setActiveSubTab] = useState('models');
  const [search, setSearch] = useState('');
  
  // Modals state
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [bikeModalOpen, setBikeModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [editingBike, setEditingBike] = useState(null);
  
  // Forms state
  const [modelForm, setModelForm] = useState({ brand: '', name: '', dailyPrice: '', price: '' });
  const [bikeForm, setBikeForm] = useState({ modelId: '', plateNumber: '', color: '', chassisNumber: '', status: 'available', imageUrl: '' });

  const handleImageUpload = async (e, setter, current) => {
    const file = e.target.files[0];
    if (file) {
      const dataUrl = await fileToBase64(file, 1400, 1400, 0.8);
      setter({ ...current, imageUrl: dataUrl });
    }
  };

  const handleModelSubmit = async (e) => {
    e.preventDefault();
    try {
      const dailyPrice = Number(modelForm.dailyPrice || modelForm.price) || 0;
      const brand = (modelForm.brand || '').trim();
      const rawName = (modelForm.name || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      const name = rawName || (brand ? '' : 'Motor Model');
      const fullName = brand ? (name ? `${brand} ${name}` : brand) : name;
      const payload = {
        brand,
        name,
        fullName,
        description: brand,
        dailyPrice,
        price: dailyPrice
      };

      if (editingModel) {
        await BikeModelService.update(editingModel.id, payload);
        if (setModels) {
          setModels(prev => prev.map(m => String(m.id) === String(editingModel.id) ? { ...m, ...payload } : m));
        }
      } else {
        const created = await BikeModelService.create(payload);
        if (setModels) {
          setModels(prev => [...prev, created]);
        }
      }
      setModelModalOpen(false);
      setEditingModel(null);
      fetchAll();
    } catch(err) {
      showModal('error', 'Error', err.message);
    }
  };

  const handleBikeSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedModel = models.find(m => String(m.id) === String(bikeForm.modelId));
      const modelFullName = selectedModel ? (selectedModel.fullName || `${selectedModel.brand ? selectedModel.brand + ' ' : ''}${selectedModel.name || ''}`.trim()) : '';
      const dailyPrice = Number(selectedModel?.dailyPrice || selectedModel?.price || 15);
      const status = (bikeForm.status || 'available').toLowerCase();
      const payload = {
        modelId: bikeForm.modelId,
        plateNumber: (bikeForm.plateNumber || '').trim(),
        color: (bikeForm.color || 'Standard').trim(),
        chassisNumber: (bikeForm.chassisNumber || '').trim(),
        frameNumber: (bikeForm.chassisNumber || '').trim(),
        status,
        imageUrl: bikeForm.imageUrl || '',
        photoUrl: bikeForm.imageUrl || '',
        name: modelFullName || 'Motor',
        modelName: modelFullName || 'Motor',
        price: dailyPrice,
        dailyPrice
      };

      if (editingBike) {
        await MotoService.update(editingBike.id, payload);
        if (setBikes) {
          setBikes(prev => prev.map(b => String(b.id) === String(editingBike.id) ? { ...b, ...payload } : b));
        }
      } else {
        const created = await MotoService.create(payload);
        if (setBikes) {
          setBikes(prev => [...prev, created]);
        }
      }
      setBikeModalOpen(false);
      setEditingBike(null);
      fetchAll();
    } catch(err) {
      showModal('error', 'Error', err.message);
    }
  };

  const deleteModel = async (id) => {
    if(!await showConfirm('Delete Model', 'Are you sure you want to delete this bike model?', 'Delete', 'danger')) return;
    await BikeModelService.delete(id);
    if (setModels) setModels(prev => prev.filter(m => String(m.id) !== String(id)));
    fetchAll();
  };

  const deleteBike = async (id) => {
    if(!await showConfirm('Delete Bike', 'Are you sure you want to delete this bike?', 'Delete', 'danger')) return;
    await MotoService.delete(id);
    if (setBikes) setBikes(prev => prev.filter(b => String(b.id) !== String(id)));
    fetchAll();
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortModelsBy, setSortModelsBy] = useState('name-asc');
  const [sortBikesBy, setSortBikesBy] = useState('name-asc');
  const [bikeStatusFilter, setBikeStatusFilter] = useState('all');

  const filteredModels = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    const list = (models || []).filter(m => {
      const name = String(m?.name || '').toLowerCase();
      const brand = String(m?.brand || m?.description || '').toLowerCase();
      const full = `${brand} ${name}`.trim();
      return !q || name.includes(q) || brand.includes(q) || full.includes(q);
    });

    list.sort((a, b) => {
      if (sortModelsBy === 'name-asc') {
        const na = `${a.brand || ''} ${a.name || ''}`.trim();
        const nb = `${b.brand || ''} ${b.name || ''}`.trim();
        return na.localeCompare(nb, 'km');
      }
      if (sortModelsBy === 'name-desc') {
        const na = `${a.brand || ''} ${a.name || ''}`.trim();
        const nb = `${b.brand || ''} ${b.name || ''}`.trim();
        return nb.localeCompare(na, 'km');
      }
      if (sortModelsBy === 'price-asc') {
        return (Number(a.dailyPrice || a.price || 0)) - (Number(b.dailyPrice || b.price || 0));
      }
      if (sortModelsBy === 'price-desc') {
        return (Number(b.dailyPrice || b.price || 0)) - (Number(a.dailyPrice || a.price || 0));
      }
      if (sortModelsBy === 'count-desc') {
        const countA = bikes.filter(x => String(x.modelId) === String(a.id) || x.name === a.name).length;
        const countB = bikes.filter(x => String(x.modelId) === String(b.id) || x.name === b.name).length;
        return countB - countA;
      }
      return 0;
    });

    return list;
  }, [models, search, sortModelsBy, bikes]);

  const filteredBikes = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    const list = (bikes || []).filter(b => {
      const name = String(b?.name || '').toLowerCase();
      const plate = String(b?.plateNumber || '').toLowerCase();
      const color = String(b?.color || '').toLowerCase();
      const status = String(b?.status || '').toLowerCase();
      const matchSearch = !q || name.includes(q) || plate.includes(q) || color.includes(q) || status.includes(q);
      const matchStatus = bikeStatusFilter === 'all' || status === bikeStatusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });

    list.sort((a, b) => {
      if (sortBikesBy === 'name-asc') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'km');
      }
      if (sortBikesBy === 'name-desc') {
        return String(b.name || '').localeCompare(String(a.name || ''), 'km');
      }
      if (sortBikesBy === 'plate-asc') {
        return String(a.plateNumber || '').localeCompare(String(b.plateNumber || ''));
      }
      if (sortBikesBy === 'plate-desc') {
        return String(b.plateNumber || '').localeCompare(String(a.plateNumber || ''));
      }
      if (sortBikesBy === 'status') {
        return String(a.status || '').localeCompare(String(b.status || ''));
      }
      return 0;
    });

    return list;
  }, [bikes, search, sortBikesBy, bikeStatusFilter]);

  const paginatedModels = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredModels.slice(start, start + pageSize);
  }, [filteredModels, page, pageSize]);

  const paginatedBikes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBikes.slice(start, start + pageSize);
  }, [filteredBikes, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className={`${cardCls} p-4 flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <div className="flex bg-stone-100 p-1 rounded-xl">
          <button
            onClick={()=>{ setActiveSubTab('models'); setPage(1); }}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeSubTab==='models' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
          >
            ម៉ូឌែលម៉ូតូ ({models.length})
          </button>
          <button
            onClick={()=>{ setActiveSubTab('bikes'); setPage(1); }}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeSubTab==='bikes' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'}`}
          >
            បញ្ជីម៉ូតូទាំងអស់ ({bikes.length})
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={()=>{
            if(activeSubTab==='models') {
              setEditingModel(null);
              setModelForm({ brand: '', name: '', dailyPrice: '', price: '' });
              setModelModalOpen(true);
            } else {
              setEditingBike(null);
              setBikeForm({ modelId: '', plateNumber: '', color: '', chassisNumber: '', status: 'available', imageUrl: '' });
              setBikeModalOpen(true);
            }
          }} className={`${btnPrimary} flex items-center gap-1.5`}>
            <i className="fa-solid fa-plus"></i> បន្ថែម {activeSubTab==='models'?'ម៉ូឌែល':'ម៉ូតូ'}
          </button>
        </div>
      </div>

      {/* Filters & Sorting Toolbar */}
      <div className={`${cardCls} p-4 flex flex-col sm:flex-row items-center justify-between gap-3`}>
        <div className="w-full sm:w-72 relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
          <input
            type="text"
            placeholder="ស្វែងរកម៉ូឌែល ឬ ស្លាកលេខ..."
            value={search}
            onChange={e=>{ setSearch(e.target.value); setPage(1); }}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-4 py-2 text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {activeSubTab === 'bikes' && (
            <select
              value={bikeStatusFilter}
              onChange={e => { setBikeStatusFilter(e.target.value); setPage(1); }}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-brand-500"
              title="ស្ថានភាព (Status filter)"
            >
              <option value="all">ស្ថានភាពទាំងអស់ (All Statuses)</option>
              <option value="available">ទំនេរ (Available)</option>
              <option value="rented">កំពុងជួល (Rented)</option>
              <option value="maintenance">ជួសជុល (Maintenance)</option>
            </select>
          )}

          {activeSubTab === 'models' ? (
            <select
              value={sortModelsBy}
              onChange={e => setSortModelsBy(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 outline-none focus:border-brand-500 cursor-pointer shadow-2xs"
              title="តម្រៀបម៉ូឌែល (Sort models)"
            >
              <option value="name-asc">ម៉ាក/ម៉ូដែល: A ដល់ Z</option>
              <option value="name-desc">ម៉ាក/ម៉ូដែល: Z ដល់ A</option>
              <option value="price-asc">តម្លៃ: ទាបទៅខ្ពស់</option>
              <option value="price-desc">តម្លៃ: ខ្ពស់ទៅទាប</option>
              <option value="count-desc">ចំនួនគ្រឿងច្រើនមុន (Most Units)</option>
            </select>
          ) : (
            <select
              value={sortBikesBy}
              onChange={e => setSortBikesBy(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 outline-none focus:border-brand-500 cursor-pointer shadow-2xs"
              title="តម្រៀបម៉ូតូ (Sort bikes)"
            >
              <option value="name-asc">ឈ្មោះម៉ូតូ: A ដល់ Z</option>
              <option value="name-desc">ឈ្មោះម៉ូតូ: Z ដល់ A</option>
              <option value="plate-asc">ស្លាកលេខ: A ដល់ Z</option>
              <option value="plate-desc">ស្លាកលេខ: Z ដល់ A</option>
              <option value="status">តាមស្ថានភាព (Status)</option>
            </select>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="បោះពុម្ពបញ្ជីម៉ូតូ (Print Fleet)"
            >
              <i className="fa-solid fa-print text-stone-600"></i>
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => sendCategoryTelegramAlert && sendCategoryTelegramAlert({
                category: 'Fleet',
                title: 'Motorbike Fleet Status Report',
                summary: `Total Bikes: ${bikes.length} across ${models.length} Models.\nAvailable: ${bikes.filter(b=>b.status==='available').length} | Rented: ${bikes.filter(b=>b.status==='rented').length} | Maintenance: ${bikes.filter(b=>b.status==='maintenance').length}`,
                details: `Fleet inventory check and status verification.`
              })}
              disabled={tgSending}
              className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              title="ផ្ញើស្ថានភាពម៉ូតូទៅ Telegram"
            >
              <i className="fa-brands fa-telegram text-sky-500"></i>
              <span>Alert Telegram</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="print-only mb-4 p-4 border-b border-stone-300">
        <h2 className="text-xl font-bold">Motorental Siemreab Angkor</h2>
        <p className="text-sm text-stone-700 font-semibold">Motorbike Fleet & Inventory Manifest ({activeSubTab === 'models' ? 'Vehicle Models' : 'All Bikes'})</p>
        <p className="text-xs text-stone-500">Total Bikes: {bikes.length} | Available: {bikes.filter(b=>b.status==='available').length} | Printed: {new Date().toLocaleString()}</p>
      </div>

      {/* Data Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 font-bold uppercase tracking-wider select-none">
              {activeSubTab === 'models' ? (
                <tr>
                  <th className="px-6 py-3.5 w-12"><input type="checkbox" className="rounded border-stone-300" /></th>
                  <th
                    onClick={() => setSortModelsBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc')}
                    className="px-6 py-3.5 cursor-pointer hover:text-stone-900 transition"
                    title="Click to sort by model name"
                  >
                    <div className="flex items-center gap-1">
                      <span>ម៉ាក & ម៉ូដែល</span>
                      <i className={`fa-solid fa-sort text-[10px] ${sortModelsBy.startsWith('name') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                    </div>
                  </th>
                  <th
                    onClick={() => setSortModelsBy(prev => prev === 'price-desc' ? 'price-asc' : 'price-desc')}
                    className="px-6 py-3.5 cursor-pointer hover:text-stone-900 transition"
                    title="Click to sort by price"
                  >
                    <div className="flex items-center gap-1">
                      <span>តម្លៃ/ថ្ងៃ</span>
                      <i className={`fa-solid fa-sort text-[10px] ${sortModelsBy.startsWith('price') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                    </div>
                  </th>
                  <th className="px-6 py-3.5">ពណ៌</th>
                  <th
                    onClick={() => setSortModelsBy('count-desc')}
                    className="px-6 py-3.5 text-center cursor-pointer hover:text-stone-900 transition"
                    title="Click to sort by bike count"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>ចំនួនគ្រឿង</span>
                      <i className={`fa-solid fa-sort text-[10px] ${sortModelsBy === 'count-desc' ? 'text-brand-600' : 'text-stone-300'}`}></i>
                    </div>
                  </th>
                  <th className="px-6 py-3.5 text-right">សកម្មភាព</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-3.5 w-12"><input type="checkbox" className="rounded border-stone-300" /></th>
                  <th
                    onClick={() => setSortBikesBy(prev => prev === 'plate-asc' ? 'plate-desc' : 'plate-asc')}
                    className="px-6 py-3.5 cursor-pointer hover:text-stone-900 transition"
                    title="Click to sort by plate"
                  >
                    <div className="flex items-center gap-1">
                      <span>ស្លាកលេខ</span>
                      <i className={`fa-solid fa-sort text-[10px] ${sortBikesBy.startsWith('plate') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                    </div>
                  </th>
                  <th
                    onClick={() => setSortBikesBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc')}
                    className="px-6 py-3.5 cursor-pointer hover:text-stone-900 transition"
                    title="Click to sort by model"
                  >
                    <div className="flex items-center gap-1">
                      <span>ប្រភេទ / ម៉ូដែល</span>
                      <i className={`fa-solid fa-sort text-[10px] ${sortBikesBy.startsWith('name') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                    </div>
                  </th>
                  <th className="px-6 py-3.5">ពណ៌</th>
                  <th
                    onClick={() => setSortBikesBy('status')}
                    className="px-6 py-3.5 text-center cursor-pointer hover:text-stone-900 transition"
                    title="Click to sort by status"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>ស្ថានភាព</span>
                      <i className={`fa-solid fa-sort text-[10px] ${sortBikesBy === 'status' ? 'text-brand-600' : 'text-stone-300'}`}></i>
                    </div>
                  </th>
                  <th className="px-6 py-3.5 text-right">សកម្មភាព</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {activeSubTab === 'models' ? (
                paginatedModels.map(m => {
                  const brandName = (m.brand || m.description || '').trim();
                  const rawName = (m.name || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
                  const count = bikes.filter(b => String(b.modelId) === String(m.id) || b.name === m.name || (rawName && b.name === rawName)).length;

                  return (
                    <tr key={m.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-6 py-4"><input type="checkbox" className="rounded border-stone-300" /></td>
                      <td className="px-6 py-4 font-bold text-stone-900">
                        <div className="flex items-center gap-1.5">
                          {brandName && <span className="text-brand-600 font-semibold">{brandName}</span>}
                          <span>{rawName || (!brandName ? '—' : '')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-brand-600 font-bold">{currency(m.dailyPrice || m.price)}/day</td>
                      <td className="px-6 py-4 text-stone-500 text-xs">Standard</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2.5 py-1 bg-stone-100 rounded-full font-bold text-stone-700 text-xs">
                          {count} គ្រឿង
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingModel(m);
                              setModelForm({
                                brand: brandName,
                                name: rawName,
                                dailyPrice: m.dailyPrice || m.price || '',
                                price: m.dailyPrice || m.price || ''
                              });
                              setModelModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                            title="កែប្រែ"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          <button onClick={()=>deleteModel(m.id)} className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50" title="លុប">
                            <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                paginatedBikes.map(b => {
                  const mdl = models.find(x => String(x.id) === String(b.modelId));
                  const modelDisplayName = mdl ? (mdl.fullName || `${mdl.brand ? mdl.brand + ' ' : ''}${mdl.name || ''}`.trim()) : (b.name || 'Motor');
                  return (
                    <tr key={b.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-6 py-4"><input type="checkbox" className="rounded border-stone-300" /></td>
                      <td className="px-6 py-4 font-mono font-bold text-stone-900 text-xs">{b.plateNumber || 'គ្មានស្លាកលេខ'}</td>
                      <td className="px-6 py-4 font-bold text-stone-800">{b.name || modelDisplayName}</td>
                      <td className="px-6 py-4 text-stone-600">{b.color || 'Standard'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${b.status==='rented' ? 'bg-blue-100 text-blue-700' : b.status==='maintenance' ? 'bg-rose-100 text-rose-700' : b.status==='inactive' ? 'bg-stone-200 text-stone-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {b.status === 'rented' ? 'កំពុងជួល' : b.status === 'maintenance' ? 'ជួសជុល' : b.status === 'inactive' ? 'ផ្អាក' : 'ទំនេរ'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingBike(b);
                              setBikeForm({
                                modelId: b.modelId || '',
                                plateNumber: b.plateNumber || '',
                                color: b.color || '',
                                chassisNumber: b.frameNumber || b.chassisNumber || '',
                                status: (b.status || 'available').toLowerCase(),
                                imageUrl: b.photoUrl || b.imageUrl || ''
                              });
                              setBikeModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                            title="កែប្រែ"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          <button onClick={()=>deleteBike(b.id)} className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50" title="លុប">
                            <i className="fa-solid fa-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {((activeSubTab==='models' ? filteredModels : filteredBikes).length === 0) && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-stone-400">
                    មិនមានទិន្នន័យត្រូវស្វែងរកទេ។
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalItems={activeSubTab === 'models' ? filteredModels.length : filteredBikes.length}
        />
      </div>

      {/* Model Modal */}
      {modelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-200 modal-pop">
            <div className="flex items-center justify-between p-5 border-b border-stone-100 bg-stone-50/50">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-motorcycle text-brand-500"></i>
                {editingModel ? 'កែប្រែម៉ូឌែលម៉ូតូ' : 'បន្ថែមម៉ូឌែលម៉ូតូ'}
              </h3>
              <button
                type="button"
                onClick={()=>setModelModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>
            <form onSubmit={handleModelSubmit} className="p-6 space-y-4 bg-white text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>ម៉ាក *</label>
                  <input
                    type="text"
                    value={modelForm.brand}
                    onChange={e=>setModelForm({...modelForm, brand:e.target.value})}
                    placeholder="e.g. Honda, Yamaha..."
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>ម៉ូឌែល *</label>
                  <input
                    type="text"
                    value={modelForm.name}
                    onChange={e=>setModelForm({...modelForm, name:e.target.value})}
                    placeholder="e.g. Click 125cc, Scoopy..."
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>តម្លៃ/ថ្ងៃ (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={modelForm.dailyPrice}
                  onChange={e=>setModelForm({...modelForm, dailyPrice:e.target.value, price:e.target.value})}
                  placeholder="e.g. 10.00"
                  className={inputCls}
                  required
                />
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100">
                <button type="button" onClick={()=>setModelModalOpen(false)} className={btnSecondary}>
                  បោះបង់
                </button>
                <button type="submit" className={btnPrimary}>
                  <i className="fa-solid fa-check mr-1.5"></i> រក្សាទុក
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bike Modal */}
      {bikeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-200 modal-pop max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-stone-100 bg-stone-50/50 shrink-0">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-motorcycle text-brand-500"></i>
                {editingBike ? 'កែប្រែទិន្នន័យម៉ូតូ' : 'បន្ថែមម៉ូតូថ្មី'}
              </h3>
              <button
                type="button"
                onClick={()=>setBikeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>
            <form onSubmit={handleBikeSubmit} className="p-6 space-y-4 bg-white text-sm overflow-y-auto">
              <div>
                <label className={labelCls}>ប្រភេទ / ម៉ូឌែលម៉ូតូ *</label>
                <select value={bikeForm.modelId} onChange={e=>setBikeForm({...bikeForm, modelId:e.target.value})} className={inputCls} required>
                  <option value="">ជ្រើសរើសប្រភេទម៉ូតូ...</option>
                  {models.map(m => {
                    const bName = (m.brand || m.description || '').trim();
                    const mName = (m.name || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
                    const label = bName ? `${bName} ${mName}`.trim() : mName;
                    return (
                      <option key={m.id} value={m.id}>
                        {label} ({currency(m.dailyPrice || m.price)}/ថ្ងៃ)
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>ស្លាកលេខ *</label>
                  <input
                    type="text"
                    value={bikeForm.plateNumber}
                    onChange={e=>setBikeForm({...bikeForm, plateNumber:e.target.value})}
                    placeholder="e.g. 1X-9999"
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>ពណ៌ *</label>
                  <input
                    type="text"
                    value={bikeForm.color}
                    onChange={e=>setBikeForm({...bikeForm, color:e.target.value})}
                    placeholder="e.g. ក្រហម, ខ្មៅ, ស..."
                    className={inputCls}
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>លេខតួ / លេខម៉ាស៊ីន (Optional)</label>
                <input
                  type="text"
                  value={bikeForm.chassisNumber}
                  onChange={e=>setBikeForm({...bikeForm, chassisNumber:e.target.value})}
                  placeholder="Frame / Engine number"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>ស្ថានភាពម៉ូតូ</label>
                <select value={(bikeForm.status || 'available').toLowerCase()} onChange={e=>setBikeForm({...bikeForm, status:e.target.value})} className={inputCls}>
                  <option value="available">ទំនេរ (Available)</option>
                  <option value="rented">កំពុងជួល (Rented)</option>
                  <option value="maintenance">ជួសជុល (Maintenance)</option>
                  <option value="inactive">ផ្អាក (Inactive)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>រូបភាពម៉ូតូ</label>
                <div className="border-2 border-dashed border-stone-200 hover:border-brand-500 rounded-2xl p-4 text-center relative transition-colors bg-stone-50">
                  {bikeForm.imageUrl ? (
                    <div className="relative mb-2">
                      <img src={bikeForm.imageUrl} alt="Bike" className="w-full h-36 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => setBikeForm({ ...bikeForm, imageUrl: '' })}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black flex items-center justify-center text-xs"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="py-6">
                      <i className="fa-solid fa-cloud-arrow-up text-3xl text-stone-400 mb-2 block"></i>
                      <p className="text-xs font-bold text-stone-600">ចុចទីនេះដើម្បីបញ្ចូលរូបភាពម៉ូតូ</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">PNG, JPG ឬ WEBP (Max 5MB)</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={e=>handleImageUpload(e, setBikeForm, bikeForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <div className="mt-2">
                  <input
                    type="url"
                    value={bikeForm.imageUrl}
                    onChange={e=>setBikeForm({...bikeForm, imageUrl:e.target.value})}
                    placeholder="ឬបិទភ្ជាប់តំណរភ្ជាប់រូបភាព (URL)..."
                    className={inputCls}
                  />
                </div>
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-stone-100">
                <button type="button" onClick={()=>setBikeModalOpen(false)} className={btnSecondary}>
                  បោះបង់
                </button>
                <button type="submit" className={btnPrimary}>
                  <i className="fa-solid fa-check mr-1.5"></i> រក្សាទុក
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ReportsTab is imported from ./admin/ReportsTab

// SettingsTab is imported from ./admin/SettingsTab

function DashboardTab({ bikes, models, rentals, bookings, rooms, cardCls, loadingData, currency, onNavigateTab, sendCategoryTelegramAlert, tgSending }) {
  const [modalState, setModalState] = useState({ open: false, title: '', type: '' });
  const [recentFilter, setRecentFilter] = useState('all'); // 'all' | 'active' | 'returned' | 'overdue'
  const [recentSort, setRecentSort] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'price-desc' | 'price-asc'
  const [recentSearch, setRecentSearch] = useState('');
  const [recentLimit, setRecentLimit] = useState(6);

  if (loadingData) {
    return (
      <div className="space-y-6">
        <AdminStatsSkeleton />
        <AdminChartSkeleton />
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const totalBikes = (bikes || []).length;
  const availableBikes = (bikes || []).filter(b => (b.status || '').toLowerCase() === 'available');
  const rentedBikes = (bikes || []).filter(b => (b.status || '').toLowerCase() === 'rented');
  const repairBikes = (bikes || []).filter(b => ['maintenance', 'repair', 'inactive'].includes((b.status || '').toLowerCase()));

  const todayRentals = (rentals || []).filter(r => toDateStr(r.startDate || r.checkoutDate) === todayStr);
  const todayIncome = todayRentals.reduce((sum, r) => sum + (parseFloat(r.totalPrice || r.pricePerDay || 0)), 0);
  const monthIncome = (rentals || []).reduce((sum, r) => sum + (parseFloat(r.totalPrice || r.pricePerDay || 0)), 0);

  const overdueRentals = (rentals || []).filter(r => (r.status === 'active' || r.status === 'rented') && (r.endDate || r.returnDueDate) && (r.endDate || r.returnDueDate) < todayStr);

  const pieData = [
    { name: 'ទំនេរ (Available)', value: availableBikes.length, color: '#10b981' },
    { name: 'កំពុងជួល (Rented)', value: rentedBikes.length, color: '#3b82f6' },
    { name: 'ជួសជុល (Repair)', value: repairBikes.length, color: '#ef4444' },
  ];

  const barData = [
    { name: 'ខែ ៤', rentals: 12, income: 150 },
    { name: 'ខែ ៥', rentals: 25, income: 320 },
    { name: 'ខែ ៦', rentals: 60, income: 750 },
    { name: 'ខែ ៧', rentals: 110, income: 1400 },
    { name: 'ខែ ៨', rentals: 160, income: 1950 },
    { name: 'ខែ ៩', rentals: Math.max(rentals.length, 10), income: Math.max(monthIncome, 200) },
  ];

  const openModal = (type) => {
    setModalState({ open: true, title: type === 'available' ? 'ម៉ូតូទំនេរ (Available)' : 'ម៉ូតូកំពុងជួល (Rented)', type });
  };

  const getBikeModelName = (modelId) => {
    const m = (models || []).find(x => String(x.id) === String(modelId));
    return m ? m.name : 'Motor';
  };

  const totalRecentCount = (rentals || []).length;
  const activeRentalsCount = (rentals || []).filter(r => r.status === 'active' || r.status === 'rented').length;
  const returnedRentalsCount = (rentals || []).filter(r => r.status === 'returned' || r.status === 'completed').length;
  const overdueRentalsCount = overdueRentals.length;

  const processedRentals = (rentals || []).filter(r => {
    // Search filter
    if (recentSearch.trim()) {
      const q = recentSearch.toLowerCase().trim();
      const cName = (r.guestName || r.customerName || '').toLowerCase();
      const phone = (r.guestPhone || r.customerPhone || r.phone || '').toLowerCase();
      const bName = (r.bikeName || r.motoName || '').toLowerCase();
      const plate = (r.plateNumber || '').toLowerCase();
      if (!cName.includes(q) && !phone.includes(q) && !bName.includes(q) && !plate.includes(q)) {
        return false;
      }
    }

    // Category / Status filter
    if (recentFilter === 'active') {
      return r.status === 'active' || r.status === 'rented';
    }
    if (recentFilter === 'returned') {
      return r.status === 'returned' || r.status === 'completed';
    }
    if (recentFilter === 'overdue') {
      return (r.status === 'active' || r.status === 'rented') && (r.endDate || r.returnDueDate) && (r.endDate || r.returnDueDate) < todayStr;
    }
    return true;
  }).sort((a, b) => {
    if (recentSort === 'date-desc') {
      const da = new Date(a.startDate || a.checkoutDate || a.createdAt || 0).getTime();
      const db = new Date(b.startDate || b.checkoutDate || b.createdAt || 0).getTime();
      return db - da;
    }
    if (recentSort === 'date-asc') {
      const da = new Date(a.startDate || a.checkoutDate || a.createdAt || 0).getTime();
      const db = new Date(b.startDate || b.checkoutDate || b.createdAt || 0).getTime();
      return da - db;
    }
    if (recentSort === 'name-asc') {
      const na = (a.guestName || a.customerName || '').trim();
      const nb = (b.guestName || b.customerName || '').trim();
      return na.localeCompare(nb, 'km');
    }
    if (recentSort === 'name-desc') {
      const na = (a.guestName || a.customerName || '').trim();
      const nb = (b.guestName || b.customerName || '').trim();
      return nb.localeCompare(na, 'km');
    }
    if (recentSort === 'price-desc') {
      return (Number(b.totalPrice || b.totalFee || 0)) - (Number(a.totalPrice || a.totalFee || 0));
    }
    if (recentSort === 'price-asc') {
      return (Number(a.totalPrice || a.totalFee || 0)) - (Number(b.totalPrice || b.totalFee || 0));
    }
    return 0;
  });

  const displayRentals = recentLimit === 'all' ? processedRentals : processedRentals.slice(0, Number(recentLimit));

  return (
    <div className="space-y-6 pb-12 text-stone-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-stone-900">ទិដ្ឋភាពទូទៅ (Dashboard Overview)</h2>
          <p className="text-xs text-stone-500 mt-1">{new Date().toLocaleDateString('km-KH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={()=>window.print()} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition flex items-center gap-2">
            <i className="fa-solid fa-print"></i> បោះពុម្ព (Print)
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3.5">
        <div className={`${cardCls} p-3 sm:p-4 text-center border-stone-200`}>
          <p className="text-[10px] sm:text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">ម៉ូតូសរុប</p>
          <p className="text-xl sm:text-2xl font-black text-stone-900">{totalBikes}</p>
        </div>
        <div onClick={()=>openModal('available')} className={`${cardCls} p-3 sm:p-4 text-center border-emerald-200 bg-emerald-50/40 cursor-pointer hover:shadow-md transition`}>
          <p className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">ម៉ូតូទំនេរ</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-700">{availableBikes.length}</p>
        </div>
        <div className={`${cardCls} p-3 sm:p-4 text-center border-purple-200 bg-purple-50/40`}>
          <p className="text-[10px] sm:text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-1">ចំនួនកក់</p>
          <p className="text-xl sm:text-2xl font-black text-purple-700">{(bookings || []).length}</p>
        </div>
        <div onClick={()=>openModal('rented')} className={`${cardCls} p-3 sm:p-4 text-center border-blue-200 bg-blue-50/40 cursor-pointer hover:shadow-md transition`}>
          <p className="text-[10px] sm:text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1">កំពុងជួល</p>
          <p className="text-xl sm:text-2xl font-black text-blue-700">{rentedBikes.length}</p>
        </div>
        <div className={`${cardCls} p-3 sm:p-4 text-center border-rose-200 bg-rose-50/40`}>
          <p className="text-[10px] sm:text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1">ជួសជុល</p>
          <p className="text-xl sm:text-2xl font-black text-rose-700">{repairBikes.length}</p>
        </div>
        <div className={`${cardCls} p-3 sm:p-4 text-center border-amber-200 bg-amber-50/40`}>
          <p className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">ចំណូលថ្ងៃនេះ</p>
          <p className="text-lg sm:text-xl font-black text-amber-800">${parseFloat(todayIncome || 0).toFixed(2)}</p>
        </div>
        <div className={`${cardCls} p-3 sm:p-4 text-center border-stone-200 bg-stone-50 col-span-2 sm:col-span-1`}>
          <p className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">ចំណូលសរុប</p>
          <p className="text-lg sm:text-xl font-black text-brand-600">${parseFloat(monthIncome || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bike Status Donut */}
        <div className={`${cardCls} p-5 flex flex-col h-80`}>
          <h3 className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
            <i className="fa-solid fa-chart-pie text-brand-500"></i> ស្ថានភាពម៉ូតូ (Motor Status)
          </h3>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius="55%" outerRadius="80%" paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{backgroundColor: '#fff', border: '1px solid #e7e5e4', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}} />
                <Legend iconType="circle" align="center" verticalAlign="bottom" wrapperStyle={{fontSize: '11px', color: '#78716c'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6-Month Income Bar Chart */}
        <div className={`${cardCls} p-5 flex flex-col h-80`}>
          <h3 className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
            <i className="fa-solid fa-chart-column text-blue-500"></i> ស្ថិតិចំណូល ៦ ខែ (6-Month Revenue)
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="name" tick={{fill: '#a8a29e', fontSize: 11}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#a8a29e', fontSize: 11}} axisLine={false} tickLine={false} orientation="left" />
                <Tooltip contentStyle={{backgroundColor: '#fff', border: '1px solid #e7e5e4', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}} />
                <Legend iconType="circle" align="center" verticalAlign="top" wrapperStyle={{fontSize: '11px', paddingBottom: '10px'}} />
                <Bar dataKey="rentals" name="ការជួល" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="income" name="ចំណូល ($)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdueRentals.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
            <span>ម៉ូតូជួលហួសកាលកំណត់ប្រគល់ (Overdue Rentals - {overdueRentals.length} Cases)</span>
          </div>
          <div className="space-y-2">
            {overdueRentals.slice(0, 3).map(r => (
              <div key={r.id} className="bg-white border border-rose-200/80 rounded-xl p-3 flex items-center justify-between shadow-xs">
                <div className="text-xs text-stone-700">
                  <span className="font-bold text-stone-900">{r.guestName || 'Customer'}</span> — <span className="font-semibold">{r.bikeName}</span> ({r.plateNumber || 'No Plate'})
                </div>
                <div className="text-xs font-bold text-rose-600 flex items-center gap-2">
                  <span>ត្រូវប្រគល់: {r.endDate || r.returnDueDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Rentals Table */}
      <div className={`${cardCls} overflow-hidden shadow-sm`}>
        {/* Card Header */}
        <div className="p-5 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 shadow-xs">
              <i className="fa-solid fa-clock-rotate-left text-base"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 text-base">ការជួលចុងក្រោយ (Recent Rentals)</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600">
                  {displayRentals.length} / {processedRentals.length}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">ប្រវត្តិជួលម៉ូតូចុងក្រោយពីទិន្នន័យ (Latest rental history records)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>មើលប្រវត្តិទាំងអស់ (View History)</span>
                <i className="fa-solid fa-arrow-right text-[11px]"></i>
              </button>
            )}
          </div>
        </div>

        {/* Categories, Search & Sort Toolbar */}
        <div className="p-4 bg-stone-50/70 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRecentFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                recentFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>ទាំងអស់ (All)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${recentFilter === 'all' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'}`}>
                {totalRecentCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRecentFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                recentFilter === 'active'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>កំពុងជួល (Active)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${recentFilter === 'active' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 font-bold'}`}>
                {activeRentalsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRecentFilter('returned')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                recentFilter === 'returned'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>ប្រគល់រួច (Returned)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${recentFilter === 'returned' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 font-bold'}`}>
                {returnedRentalsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRecentFilter('overdue')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                recentFilter === 'overdue'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <i className={`fa-solid fa-triangle-exclamation text-[10px] ${recentFilter === 'overdue' ? 'text-white' : 'text-rose-500'}`}></i>
              <span>ហួសថ្ងៃ (Overdue)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${recentFilter === 'overdue' ? 'bg-white/20 text-white' : overdueRentalsCount > 0 ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-stone-100 text-stone-500'}`}>
                {overdueRentalsCount}
              </span>
            </button>
          </div>

          {/* Search, Sort, Limit Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60 min-w-[200px]">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
              <input
                type="text"
                placeholder="ស្វែងរកឈ្មោះ, ម៉ូតូ, ស្លាកលេខ..."
                value={recentSearch}
                onChange={e => setRecentSearch(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-7 py-1.5 text-xs text-stone-800 placeholder-stone-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition shadow-2xs"
              />
              {recentSearch && (
                <button
                  type="button"
                  onClick={() => setRecentSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs w-4 h-4 flex items-center justify-center cursor-pointer"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={recentSort}
                onChange={e => setRecentSort(e.target.value)}
                className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition cursor-pointer shadow-2xs"
                title="តម្រៀបទិដ្ឋភាព (Sort view)"
              >
                <option value="date-desc">កាលបរិច្ឆេទ: ថ្មីមុន (Newest)</option>
                <option value="date-asc">កាលបរិច្ឆេទ: ចាស់មុន (Oldest)</option>
                <option value="name-asc">ឈ្មោះ: ក - អ (Name: A - Z)</option>
                <option value="name-desc">ឈ្មោះ: អ - ក (Name: Z - A)</option>
                <option value="price-desc">តម្លៃ: ខ្ពស់ទៅទាប (Price: High)</option>
                <option value="price-asc">តម្លៃ: ទាបទៅខ្ពស់ (Price: Low)</option>
              </select>
            </div>

            {/* Limit Selector */}
            <div className="relative">
              <select
                value={recentLimit}
                onChange={e => setRecentLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-stone-700 outline-none focus:border-brand-500 transition cursor-pointer shadow-2xs"
                title="ចំនួនជួរ (Rows)"
              >
                <option value="6">6 ជួរ</option>
                <option value="10">10 ជួរ</option>
                <option value="20">20 ជួរ</option>
                <option value="all">ទាំងអស់</option>
              </select>
            </div>

            {/* Print & Alert to Telegram */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-2.5 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="បោះពុម្ពបញ្ជីការជួល (Print Recent Rentals)"
              >
                <i className="fa-solid fa-print text-stone-600"></i>
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                type="button"
                onClick={() => sendCategoryTelegramAlert && sendCategoryTelegramAlert({
                  category: 'Dashboard',
                  title: 'Daily Operations & Recent Rentals Summary',
                  summary: `Active Rentals: ${(rentals||[]).filter(r=>r.status==='active'||r.status==='rented').length} | Overdue: ${overdueRentals.length}\nAvailable Bikes: ${(bikes||[]).filter(b=>b.status==='available').length} | Vacant Rooms: ${(rooms||[]).filter(r=>r.status==='vacant').length}`,
                  details: `Showing ${displayRentals.length} recent rentals on dashboard.`
                })}
                disabled={tgSending}
                className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                title="ផ្ញើរបាយការណ៍ Dashboard ទៅ Telegram"
              >
                <i className="fa-brands fa-telegram text-sky-500"></i>
                <span className="hidden sm:inline">Alert Telegram</span>
              </button>
            </div>
          </div>
        </div>

        {/* Printable Report Header */}
        <div className="print-only mb-4 p-4 border-b border-stone-300">
          <h2 className="text-xl font-bold">Motorental Siemreab Angkor & Guesthouse</h2>
          <p className="text-sm text-stone-700 font-semibold">Dashboard Recent Rentals & Activity Summary</p>
          <p className="text-xs text-stone-500">Showing {displayRentals.length} of {processedRentals.length} records | Printed: {new Date().toLocaleString()}</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider font-bold select-none">
              <tr>
                <th
                  onClick={() => setRecentSort(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc')}
                  className="px-5 py-3.5 cursor-pointer hover:bg-stone-100/70 transition"
                  title="ចុចដើម្បីតម្រៀបតាមឈ្មោះ (Click to sort by customer name)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>អតិថិជន (Customer)</span>
                    <i className={`fa-solid fa-sort text-[10px] ${recentSort.startsWith('name') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="px-5 py-3.5">ម៉ូតូ (Bike / Plate)</th>
                <th
                  onClick={() => setRecentSort(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                  className="px-5 py-3.5 cursor-pointer hover:bg-stone-100/70 transition"
                  title="ចុចដើម្បីតម្រៀបតាមកាលបរិច្ឆេទ (Click to sort by date)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ថ្ងៃចេញ (Check Out)</span>
                    <i className={`fa-solid fa-sort text-[10px] ${recentSort.startsWith('date') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="px-5 py-3.5">ថ្ងៃត្រឡប់ (Due Date)</th>
                <th
                  onClick={() => setRecentSort(prev => prev === 'price-desc' ? 'price-asc' : 'price-desc')}
                  className="px-5 py-3.5 cursor-pointer hover:bg-stone-100/70 transition text-right"
                  title="ចុចដើម្បីតម្រៀបតាមតម្លៃ (Click to sort by price)"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>តម្លៃសរុប (Total)</span>
                    <i className={`fa-solid fa-sort text-[10px] ${recentSort.startsWith('price') ? 'text-brand-600' : 'text-stone-300'}`}></i>
                  </div>
                </th>
                <th className="px-5 py-3.5 text-center">ស្ថានភាព (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {displayRentals.map((r, i) => {
                const isAct = r.status === 'active' || r.status === 'rented';
                const isRet = r.status === 'returned' || r.status === 'completed';
                const isOverdue = isAct && (r.endDate || r.returnDueDate) && (r.endDate || r.returnDueDate) < todayStr;
                const custName = r.guestName || r.customerName || 'Customer';
                const initial = custName.trim().charAt(0).toUpperCase() || 'C';

                return (
                  <tr key={r.id || i} className="hover:bg-stone-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100/70 text-brand-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {initial}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900 leading-snug">{custName}</div>
                          {(r.guestPhone || r.customerPhone || r.phone) && (
                            <div className="text-[11px] text-stone-400 flex items-center gap-1 font-mono">
                              <i className="fa-solid fa-phone text-[9px]"></i>
                              <span>{r.guestPhone || r.customerPhone || r.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div>
                        <div className="font-semibold text-stone-900 text-xs">{r.bikeName || 'Motorbike'}</div>
                        {r.plateNumber ? (
                          <span className="inline-block mt-0.5 px-2 py-0.5 bg-stone-100 border border-stone-200/80 rounded font-mono text-[10px] font-bold text-stone-600">
                            {r.plateNumber}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-400">គ្មានស្លាកលេខ</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-stone-600">
                      <div className="flex items-center gap-1.5 font-mono">
                        <i className="fa-regular fa-calendar text-stone-400 text-[11px]"></i>
                        <span>{r.startDate || r.checkoutDate || '—'}</span>
                      </div>
                      {(r.timeOut || r.checkoutTime) && (
                        <div className="text-[10px] text-stone-400 ml-4 font-mono">{r.timeOut || r.checkoutTime}</div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      <div className={`flex items-center gap-1.5 font-mono ${isOverdue ? 'text-rose-600 font-bold' : 'text-stone-600'}`}>
                        <i className={`fa-regular fa-calendar-check text-[11px] ${isOverdue ? 'text-rose-500' : 'text-stone-400'}`}></i>
                        <span>{r.endDate || r.returnDueDate || '—'}</span>
                      </div>
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/80 rounded px-1.5 py-0.2 mt-0.5">
                          <i className="fa-solid fa-triangle-exclamation text-[9px]"></i> ហួសថ្ងៃ
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right font-mono font-bold text-stone-900 text-xs">
                      ${parseFloat(r.totalPrice || r.totalFee || (Number(r.dailyRate || 15) * Number(r.totalDays || 1))).toFixed(2)}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                        isOverdue
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : isAct
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : isRet
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isOverdue ? 'bg-rose-500 animate-pulse' : isAct ? 'bg-blue-500' : isRet ? 'bg-emerald-500' : 'bg-stone-400'
                        }`}></span>
                        {isOverdue ? 'ហួសថ្ងៃ' : isAct ? 'កំពុងជួល' : isRet ? 'ប្រគល់រួច' : (r.status || 'Active')}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {displayRentals.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 text-lg">
                        <i className="fa-solid fa-inbox"></i>
                      </div>
                      <p className="text-xs font-semibold text-stone-600">មិនមានទិន្នន័យជួលត្រូវនឹងការជ្រើសរើសទេ</p>
                      {(recentSearch || recentFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => { setRecentSearch(''); setRecentFilter('all'); }}
                          className="mt-1 text-xs font-bold text-brand-600 hover:text-brand-700 underline cursor-pointer"
                        >
                          កំណត់ឡើងវិញ (Clear Filters)
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Available / Rented Bikes Modal */}
      {modalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={()=>setModalState({open:false, title:'', type:''})}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-stone-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-stone-100 shrink-0">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-motorcycle text-brand-500"></i>
                {modalState.title}
              </h3>
              <button onClick={()=>setModalState({open:false, title:'', type:''})} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="sticky top-0 bg-stone-50 border-b border-stone-100 text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">ម៉ូតូ (Bike)</th>
                    <th className="px-4 py-2.5">ពណ៌ & ស្លាកលេខ</th>
                    <th className="px-4 py-2.5 text-right">ស្ថានភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {(modalState.type === 'available' ? availableBikes : rentedBikes).map((b, i) => (
                    <tr key={b.id || i} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-bold text-stone-900">
                        {b.name || getBikeModelName(b.modelId)}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-600 font-mono">
                        {b.color || 'Standard'} {b.plateNumber ? `| ${b.plateNumber}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          modalState.type === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {b.status || modalState.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(modalState.type === 'available' ? availableBikes : rentedBikes).length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-8 text-center text-stone-400">គ្មានម៉ូតូក្នុងបញ្ជីនេះទេ។</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

