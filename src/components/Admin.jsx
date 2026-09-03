import { useState, useEffect, useCallback, useMemo } from 'react';
import { useModal } from './common/ModalProvider';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { dbMotos, dbRooms as firedb } from '../firebase';
import { io } from 'socket.io-client';
import { AdminStatsSkeleton, AdminTableSkeleton, AdminChartSkeleton, Skeleton } from './Skeleton';
import {
  MotoService,
  RoomService,
  BikeModelService,
  BookingService,
  RentalService,
  CustomerService,
  ExpenseService,
  MaintenanceService,
  ReturnService
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
import { normalizeRental, normalizeBooking, normalizeRoom, normalizeMoto } from '../utils/dataNormalizer';
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
  const [loadingData, setLoadingData] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);

  // data stores
  const [dashStats,   setDashStats]   = useState(null);
  const [bikes,       setBikes]       = useState([]);
  const [models,      setModels]      = useState([]);
  const [rooms,       setRooms]       = useState([]);
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
    notification_settings: { telegramNewBooking: true, telegramMaintenanceAlert: true, telegramCheckoutReminder: true, guestVoucherTemplate: 'Hello {guest_name}, your booking at Siem Reap Angkor for {item_name} ({start_date} to {end_date}) is CONFIRMED! Contact: +855 016 308 199', guestReminderTemplate: 'Dear {guest_name}, friendly reminder that your check-in date is tomorrow {start_date}. We look forward to welcoming you!' },
    security_settings: { autoBackupEnabled: true, backupFrequency: 'daily', requireStrongPasswords: true, sessionTimeoutMinutes: 120 }
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

  // ── fetch helpers ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const hdrs = { headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` } };
      const [b, mdls, r, bk, oc, rn, inv, hk, mnt, g, stf, logs] = await Promise.all([
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
      ]);
      const safeGuests = Array.isArray(g) ? g : [];
      const safeModels = Array.isArray(mdls) ? mdls : [];
      const safeBikes = Array.isArray(b) ? b.map(x => normalizeMoto(x, safeModels)) : [];
      const safeRooms = Array.isArray(r) ? r.map(normalizeRoom) : [];
      const safeRentals = Array.isArray(rn) ? rn.map(x => normalizeRental(x, safeGuests, safeBikes, safeModels)) : [];
      const safeBookings = Array.isArray(bk) ? bk.map(x => normalizeBooking(x, safeGuests, safeBikes, safeModels)) : [];

      setGuests(safeGuests);
      setModels(safeModels);
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
          ['hero_images','about_us','why_us','services_bar','testimonials','contact_info','business_profile','pricing_tax','payment_methods','invoice_settings','notification_settings','security_settings','public_texts'].forEach(k => {
            if (data[k]) {
              try {
                parsed[k] = typeof data[k] === 'string' ? JSON.parse(data[k]) : data[k];
              } catch (e) {
                parsed[k] = data[k];
              }
            }
          });
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
        setBikes(firestoreMotos.map(x => normalizeMoto(x, models)));
      }
    });
    const unsubModels = BikeModelService.subscribe((firestoreModels) => {
      if (firestoreModels && firestoreModels.length > 0) {
        setModels(firestoreModels);
      }
    });
    const unsubRentals = RentalService.subscribe((firestoreRentals) => {
      if (firestoreRentals && firestoreRentals.length > 0) {
        setRentals(firestoreRentals.map(x => normalizeRental(x, guests, bikes, models)));
      }
    });
    const unsubBookings = BookingService.subscribe((firestoreBookings) => {
      if (firestoreBookings && firestoreBookings.length > 0) {
        setBookings(firestoreBookings.map(x => normalizeBooking(x, guests, bikes, models)));
      }
    });
    const unsubCustomers = CustomerService.subscribe((firestoreCustomers) => {
      if (firestoreCustomers && firestoreCustomers.length > 0) {
        setGuests(firestoreCustomers);
      }
    });
    const unsubRooms = RoomService.subscribe((firestoreRooms) => {
      if (firestoreRooms && firestoreRooms.length > 0) {
        setRooms(firestoreRooms.map(normalizeRoom));
      }
    });
    const unsubMaintenance = MaintenanceService.subscribe((firestoreMaint) => {
      if (firestoreMaint && firestoreMaint.length > 0) {
        setMaintenance(firestoreMaint);
      }
    });

    const socketUrl = window.location.hostname==='localhost' ? 'http://localhost:3000' : '/';
    const socket = io(socketUrl);
    socket.on('new_booking', () => { fetchAll(); fetchDash(); setNewBookingAlert(true); setTimeout(()=>setNewBookingAlert(false),5000); });
    socket.on('room_status_updated', () => { fetchAll(); fetchDash(); });
    socket.on('bike_status_updated', () => { fetchAll(); fetchDash(); });
    socket.on('booking_updated', () => { fetchAll(); });
    socket.on('settings_updated', () => { fetchSettings(); });

    return () => {
      unsubBikes();
      unsubModels();
      unsubRentals();
      unsubBookings();
      unsubCustomers();
      unsubRooms();
      unsubMaintenance();
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => { if (activeTab==='reports') fetchReports(); }, [activeTab, reportPeriod]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password}) });
    const data = await res.json();
    if (res.ok) { localStorage.setItem('token', data.token); setToken(data.token); setLoginError(''); }
    else setLoginError(data.error);
  };
  const handleLogout = () => { localStorage.removeItem('token'); setToken(null); };

  const saveSettings = async (customPayload) => {
    try {
      const payloadToSend = customPayload && typeof customPayload === 'object' && !customPayload.nativeEvent ? { ...settings, ...customPayload } : settings;
      
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

      // Also sync to Firestore public_settings
      try {
        await setDoc(doc(dbMotos, 'settings', 'public_settings'), payloadToSend, { merge: true });
      } catch (fbErr) {
        console.warn('Firestore settings sync:', fbErr.message);
      }

      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
        fetchSettings();
        showModal('success', 'រក្សាទុកជោគជ័យ!', 'ការកំណត់ និង រូបភាពត្រូវបានរក្សាទុកដោយជោគជ័យ (Settings & images saved successfully)');
      } else {
        const err = await res.json().catch(() => ({}));
        showModal('error', 'មិនអាចរក្សាទុកបានទេ', err.error || res.statusText || 'Failed to save settings');
      }
    } catch (e) {
      showModal('error', 'កំហុសបច្ចេកទេស', e.message);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  //  LOGIN SCREEN
  // ══════════════════════════════════════════════════════════════════════════════
  if (!token) return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center p-5">
      <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-lg border border-white/20 p-10 rounded-3xl shadow-2xl max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
            <i className="fa-solid fa-motorcycle text-white text-2xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
          <p className="text-stone-400 text-sm mt-1">Siem Reap Angkor PMS</p>
        </div>
        {loginError && <div className="bg-red-500/20 text-red-300 border border-red-500/30 text-sm p-3 rounded-xl mb-4">{loginError}</div>}
        <div className="mb-4">
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Username</label>
          <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder-stone-500 outline-none focus:border-brand-400 transition-all" required />
        </div>
        <div className="mb-8">
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder-stone-500 outline-none focus:border-brand-400 transition-all" required />
        </div>
        <button type="submit" className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-xl hover:bg-brand-600 shadow-lg shadow-brand-500/30 transition-all">Sign In</button>
        <Link to="/" className="block text-center mt-4 text-sm text-stone-500 hover:text-stone-300 transition-colors">← Return to Website</Link>
      </form>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  //  DASHBOARD LAYOUT
  // ══════════════════════════════════════════════════════════════════════════════
  const sections = [...new Set(NAV.map(n=>n.section))].filter(s => s !== 'HIDDEN');

  return (
    <div className="min-h-screen bg-[#fbf9f5] font-sans antialiased flex text-stone-800">

      {/* ─── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-white border-r border-stone-200/90 flex flex-col z-30 shadow-xs">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0 shadow-sm">
              <i className="fa-solid fa-motorcycle text-white text-base"></i>
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 leading-tight">Siem Reap Angkor</h1>
              <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest leading-none mt-1">Management System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-4">
          {sections.map(section => (
            <div key={section}>
              <p className="px-3.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 mt-3">{section}</p>
              {NAV.filter(n=>n.section===section).map(n => (
                <button key={n.id} onClick={()=>setActiveTab(n.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all mb-1 ${activeTab===n.id ? 'bg-brand-500 text-white shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'}`}>
                  <i className={`fa-solid ${n.icon} w-5 text-center text-sm opacity-90`}></i>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-stone-100 space-y-1.5">
          <Link to="/" className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 transition-all">
            <i className="fa-solid fa-arrow-up-right-from-square"></i> View Live Site
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all">
            <i className="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="ml-64 flex-1 min-h-screen">

        {/* Toast */}
        <div className={`fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 transition-all duration-500 ${newBookingAlert ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <i className="fa-solid fa-bell animate-bounce"></i>
          <div><p className="font-bold text-sm">New Booking!</p><p className="text-xs text-emerald-100">Check Online Bookings tab.</p></div>
        </div>

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-stone-900 font-display">{NAV.find(n=>n.id===activeTab)?.label}</h2>
            <p className="text-xs text-stone-500">{new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
          </div>
          <div className="flex items-center gap-3">
            {dashStats && (
              <>
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/70 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700">
                  <i className="fa-solid fa-bed"></i> {dashStats.rooms?.vacant || 0} Vacant
                </div>
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200/70 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700">
                  <i className="fa-solid fa-motorcycle"></i> {dashStats.bikes?.available || 0} Available
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* DASHBOARD */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'dashboard' && (
            <DashboardTab bikes={bikes} models={models} rentals={rentals} bookings={bookings} cardCls={cardCls} loadingData={loadingData} currency={currency} />
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* ROOMS & RESERVATIONS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'rooms' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={6} />
            ) : (
              <RoomsTab rooms={rooms} occupancy={occupancy} auth={auth} fetchAll={fetchAll} fetchDash={fetchDash} inputCls={inputCls} labelCls={labelCls} cardCls={cardCls} btnPrimary={btnPrimary} btnSecondary={btnSecondary} btnDanger={btnDanger} statusBadge={statusBadge} today={today} currency={currency} />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MOTORBIKE RENTAL */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'rentals' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={6} />
            ) : (
              <RentalsTab bikes={bikes} rentals={rentals} occupancy={occupancy} auth={auth} fetchAll={fetchAll} inputCls={inputCls} labelCls={labelCls} cardCls={cardCls} btnPrimary={btnPrimary} btnSecondary={btnSecondary} btnDanger={btnDanger} statusBadge={statusBadge} today={today} currency={currency} />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* BILLING & POS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'billing' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={5} />
            ) : (
              <BillingTab invoices={invoices} occupancy={occupancy} rentals={rentals} auth={auth} fetchAll={fetchAll} inputCls={inputCls} labelCls={labelCls} cardCls={cardCls} btnPrimary={btnPrimary} btnSecondary={btnSecondary} btnDanger={btnDanger} statusBadge={statusBadge} currency={currency} />
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
              <GuestsTab guests={guests} auth={auth} fetchAll={fetchAll} inputCls={inputCls} labelCls={labelCls} cardCls={cardCls} btnPrimary={btnPrimary} btnDanger={btnDanger} />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* FLEET MANAGER (Bikes CRUD) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'fleet' && (
            loadingData ? (
              <AdminTableSkeleton rows={7} cols={6} />
            ) : (
              <FleetTab bikes={bikes} models={models} auth={auth} fetchAll={fetchAll} inputCls={inputCls} labelCls={labelCls} cardCls={cardCls} btnPrimary={btnPrimary} btnSecondary={btnSecondary} btnDanger={btnDanger} statusBadge={statusBadge} currency={currency} rooms={rooms} />
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* REPORTS */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'reports' && (
            (loadingReports || !reports) ? (
              <AdminChartSkeleton />
            ) : (
              <ReportsTab reports={reports} reportPeriod={reportPeriod} setReportPeriod={setReportPeriod} cardCls={cardCls} currency={currency} />
            )
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
                  <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save About Us'}</button>
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
                          onChange={e => {
                            const f = e.target.files[0];
                            if (f) {
                              const r = new FileReader();
                              r.onloadend = () => setSettings({ ...settings, about_us: { ...settings.about_us, image1: r.result } });
                              r.readAsDataURL(f);
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
                          onChange={e => {
                            const f = e.target.files[0];
                            if (f) {
                              const r = new FileReader();
                              r.onloadend = () => setSettings({ ...settings, about_us: { ...settings.about_us, image2: r.result } });
                              r.readAsDataURL(f);
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
                    <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save About Us Changes'}</button>
                  </div>
                </div>
              </div>
              {/* Reviews */}
              <div className={`${cardCls} p-6`}>
                <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-star mr-2 text-amber-500"></i>Customer Reviews</h3>
                <div className="space-y-4">
                  {(settings.testimonials||[]).map((t,i)=>(
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
                    <button onClick={saveSettings} className={btnPrimary}>{settingsSaved?'✅ Saved!':'Save Reviews'}</button>
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
                  <button onClick={saveSettings} className={btnPrimary}>{settingsSaved?'✅ Saved!':'Save Contact Info'}</button>
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
                  {(settings.why_us?.stats||[]).map((s,i)=>(
                    <div key={i} className="flex gap-3">
                      <input type="text" value={s.num} placeholder="Number (e.g. 500+)" onChange={e=>{const a=[...settings.why_us.stats];a[i]={...a[i],num:e.target.value};setSettings({...settings,why_us:{...settings.why_us,stats:a}})}} className={inputCls} />
                      <input type="text" value={s.label} placeholder="Label" onChange={e=>{const a=[...settings.why_us.stats];a[i]={...a[i],label:e.target.value};setSettings({...settings,why_us:{...settings.why_us,stats:a}})}} className={inputCls} />
                      <button onClick={()=>{const a=[...settings.why_us.stats];a.splice(i,1);setSettings({...settings,why_us:{...settings.why_us,stats:a}})}} className="w-10 h-10 flex items-center justify-center text-red-500 border border-stone-200 rounded-lg hover:bg-red-50"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  ))}
                  <button onClick={()=>setSettings({...settings,why_us:{...settings.why_us,stats:[...(settings.why_us?.stats||[]),{num:'',label:''}]}})} className="text-xs font-bold text-brand-600 mb-4">+ Add Stat</button>

                  {/* Features */}
                  <label className={labelCls}>Features (Grid)</label>
                  {(settings.why_us?.features||[]).map((f,i)=>(
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

                  <button onClick={saveSettings} className={btnPrimary}>{settingsSaved?'✅ Saved!':'Save Why Us'}</button>
                </div>
              </div>

              {/* Services Bar */}
              <div className={`${cardCls} p-6`}>
                <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-icons mr-2 text-purple-500"></i>Services Bar (4 Buttons)</h3>
                <div className="space-y-4">
                  {(settings.services_bar||[]).map((s,i)=>(
                    <div key={i} className="flex gap-3">
                      <input type="text" value={s.icon} placeholder="Icon (e.g. fa-car)" onChange={e=>{const a=[...settings.services_bar];a[i]={...a[i],icon:e.target.value};setSettings({...settings,services_bar:a})}} className={inputCls} />
                      <input type="text" value={s.label} placeholder="Label" onChange={e=>{const a=[...settings.services_bar];a[i]={...a[i],label:e.target.value};setSettings({...settings,services_bar:a})}} className={inputCls} />
                      <input type="text" value={s.desc} placeholder="Description" onChange={e=>{const a=[...settings.services_bar];a[i]={...a[i],desc:e.target.value};setSettings({...settings,services_bar:a})}} className={inputCls} />
                      <button onClick={()=>{const a=[...settings.services_bar];a.splice(i,1);setSettings({...settings,services_bar:a})}} className="w-10 h-10 flex items-center justify-center text-red-500 border border-stone-200 rounded-lg hover:bg-red-50 shrink-0"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  ))}
                  <button onClick={()=>setSettings({...settings,services_bar:[...(settings.services_bar||[]),{icon:'fa-check',label:'',desc:''}]})} className="text-xs font-bold text-brand-600 block mb-4">+ Add Service</button>
                  <button onClick={saveSettings} className={btnPrimary}>{settingsSaved?'✅ Saved!':'Save Services Bar'}</button>
                </div>
              </div>

              {/* Hero Slideshow */}
              <div className={`${cardCls} p-6`}>
                <h3 className="font-bold text-stone-900 mb-5"><i className="fa-regular fa-images mr-2 text-sky-500"></i>Hero Slideshow</h3>
                <input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onloadend=()=>setSettings({...settings,hero_images:[...(settings.hero_images||[]),r.result]});r.readAsDataURL(f);}}} className="w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer mb-4" />
                <div className="flex flex-wrap gap-3 mb-4">
                  {(settings.hero_images||[]).map((img,i)=>(
                    <div key={i} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-stone-200">
                      <img src={img} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <button onClick={()=>{const a=[...settings.hero_images];a.splice(i,1);setSettings({...settings,hero_images:a});}} className="w-8 h-8 bg-red-500 rounded-full text-white flex items-center justify-center"><i className="fa-solid fa-trash text-xs"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={saveSettings} className={btnPrimary}>{settingsSaved?'✅ Saved!':'Save Images'}</button>
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
              rentals={rentals}
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
              today={today}
              currency={currency}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab
              rentals={rentals}
              auth={auth}
              fetchAll={fetchAll}
              inputCls={inputCls}
              cardCls={cardCls}
              btnSecondary={btnSecondary}
              btnDanger={btnDanger}
              statusBadge={statusBadge}
              currency={currency}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarTab
              rentals={rentals}
              bookings={bookings}
              cardCls={cardCls}
              btnSecondary={btnSecondary}
            />
          )}

          {activeTab === 'income' && (
            <IncomeTab
              rentals={rentals}
              bikes={bikes}
              cardCls={cardCls}
              inputCls={inputCls}
              btnSecondary={btnSecondary}
              currency={currency}
            />
          )}

          {activeTab === 'booking-income' && (
            <BookingIncomeTab
              bookings={bookings}
              cardCls={cardCls}
              inputCls={inputCls}
              btnSecondary={btnSecondary}
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
            />
          )}

          {activeTab === 'room-history' && (
            <RoomHistoryTab
              occupancy={occupancy}
              rooms={rooms}
              cardCls={cardCls}
              inputCls={inputCls}
              btnSecondary={btnSecondary}
              currency={currency}
            />
          )}

          {activeTab === 'room-income' && (
            <RoomIncomeTab
              occupancy={occupancy}
              rooms={rooms}
              cardCls={cardCls}
              inputCls={inputCls}
              btnSecondary={btnSecondary}
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

      {/* Modal popups are rendered by ModalProvider in main.jsx */}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUB-TABS
// ══════════════════════════════════════════════════════════════════════════════
//  ROOMS TAB (Occupancy + Room Types Catalog CRUD)
// ══════════════════════════════════════════════════════════════════════════════

function RoomsTab({ rooms, occupancy, auth, fetchAll, fetchDash, inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge, today, currency }) {
  const [subSection, setSubSection] = useState('occupancy'); // 'occupancy' | 'catalog'
  
  // Check-in form state
  const [form, setForm] = useState({ roomId:'', guestName:'', guestPhone:'', guestNationality:'', bedCount:1, checkInDate: today(), checkOutDate:'', notes:'' });
  
  // Room Catalog CRUD state
  const [editingRoom, setEditingRoom] = useState(null);
  const [newRoom, setNewRoom] = useState({
    name: '', description: '', floor: '1',
    beds1Price: 25, beds2Price: 35, beds3Price: 45,
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower'],
    policies: { checkin: '2:00 PM', checkout: '12:00 PM', cancellation: 'Free cancellation up to 24h' },
    images: []
  });

  const ALL_AMENITIES = ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower', 'Flat-screen TV', 'Mini Fridge', 'Daily Housekeeping', 'Balcony / Terrace', 'Safety Deposit Box'];

  const activeOccupancy = occupancy.filter(o => o.status === 'checked_in');

  // Check-in handlers
  const handleCheckIn = async (e) => {
    e.preventDefault();
    await fetch('/api/room-occupancy', { method:'POST', ...auth, body: JSON.stringify(form) });
    fetchAll(); fetchDash();
    setForm({ roomId:'', guestName:'', guestPhone:'', guestNationality:'', bedCount:1, checkInDate:today(), checkOutDate:'', notes:'' });
  };
  const handleCheckOut = async (id) => {
    if (!await showConfirm('Confirm Check-out', 'Are you sure you want to check out this guest?', 'Check Out', 'warning')) return;
    await fetch(`/api/room-occupancy/${id}/checkout`, { method:'PATCH', ...auth });
    fetchAll(); fetchDash();
  };
  const handleStatusChange = async (roomId, status) => {
    await fetch(`/api/rooms/${roomId}/status`, { method:'PATCH', ...auth, body: JSON.stringify({ status }) });
    fetchAll(); fetchDash();
  };

  // Room Catalog Handlers
  const handleRoomImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const r = new FileReader();
      r.onloadend = () => {
        if (editingRoom) {
          setEditingRoom({ ...editingRoom, images: [...(editingRoom.images || []), r.result] });
        } else {
          setNewRoom({ ...newRoom, images: [...(newRoom.images || []), r.result] });
        }
      };
      r.readAsDataURL(file);
    }
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await RoomService.update(editingRoom.id, editingRoom);
        setEditingRoom(null);
      } else {
        await RoomService.create(newRoom);
        setNewRoom({
          name: '', description: '', floor: '1',
          beds1Price: 25, beds2Price: 35, beds3Price: 45,
          amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower'],
          policies: { checkin: '2:00 PM', checkout: '12:00 PM', cancellation: 'Free cancellation up to 24h' },
          images: []
        });
      }
      fetchAll(); fetchDash();
    } catch (err) {
      showModal('error', 'Validation Error', err.message);
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!await showConfirm('Delete Room', 'Are you sure you want to delete this room? This will also remove it from the public website.', 'Delete', 'danger')) return;
    try {
      await RoomService.delete(id);
      fetchAll(); fetchDash();
    } catch (err) {
      showModal('error', 'Error', err.message);
    }
  };

  const currentRoom = editingRoom || newRoom;
  const setRoomState = editingRoom ? setEditingRoom : setNewRoom;

  const statusColors = { vacant:'bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-400', occupied:'bg-blue-100 text-blue-700 border-blue-200', cleaning:'bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-400', maintenance:'bg-red-100 text-red-700 border-red-200 hover:border-red-400' };
  const statusIcons  = { vacant:'fa-check-circle', occupied:'fa-user', cleaning:'fa-broom', maintenance:'fa-wrench' };

  return (
    <div className="space-y-6">
      {/* Sub navigation switch */}
      <div className="flex items-center gap-2 p-1 bg-stone-200/70 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setSubSection('occupancy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            subSection === 'occupancy' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <i className="fa-solid fa-bed text-brand-500"></i> Check-in & Occupancy (ការកក់ និង Check-in)
        </button>
        <button
          type="button"
          onClick={() => setSubSection('catalog')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            subSection === 'catalog' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <i className="fa-solid fa-list-check text-indigo-500"></i> Manage Room Types & Catalog (គ្រប់គ្រងបន្ទប់ និងតម្លៃ)
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 1. OCCUPANCY & CHECK-IN */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subSection === 'occupancy' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Check-in form */}
          <div className={`${cardCls} p-6 h-fit sticky top-8`}>
            <h3 className="font-bold text-stone-900 mb-5"><i className="fa-solid fa-right-to-bracket mr-2 text-emerald-500"></i>New Check-in</h3>
            <form onSubmit={handleCheckIn} className="space-y-4 text-sm">
              <div>
                <label className={labelCls}>Room</label>
                <select value={form.roomId} onChange={e=>setForm({...form,roomId:e.target.value})} className={inputCls} required>
                  <option value="">Select room...</option>
                  {rooms.filter(r=>r.status==='vacant').map(r=><option key={r.id} value={r.id}>Room {r.name} — {r.status}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Guest Name</label><input type="text" value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} className={inputCls} required /></div>
              <div><label className={labelCls}>Phone</label><input type="text" value={form.guestPhone} onChange={e=>setForm({...form,guestPhone:e.target.value})} className={inputCls} /></div>
              <div><label className={labelCls}>Nationality</label><input type="text" value={form.guestNationality} onChange={e=>setForm({...form,guestNationality:e.target.value})} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Beds</label><input type="number" min="1" max="3" value={form.bedCount} onChange={e=>setForm({...form,bedCount:parseInt(e.target.value)})} className={inputCls} /></div>
                <div><label className={labelCls}>Check-in Date</label><input type="date" value={form.checkInDate} onChange={e=>setForm({...form,checkInDate:e.target.value})} className={inputCls} required /></div>
              </div>
              <div><label className={labelCls}>Check-out Date</label><input type="date" value={form.checkOutDate} onChange={e=>setForm({...form,checkOutDate:e.target.value})} className={inputCls} required /></div>
              <div><label className={labelCls}>Notes</label><textarea rows="2" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className={inputCls}></textarea></div>
              <button type="submit" className={`${btnPrimary} w-full justify-center`}>Check In Guest</button>
            </form>
          </div>

          {/* Room grid + active stays */}
          <div className="xl:col-span-2 space-y-6">
            {/* Room status grid */}
            <div className={`${cardCls} p-6`}>
              <h3 className="font-bold text-stone-900 mb-5">Room Status Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {rooms.map(room => {
                  const occ = activeOccupancy.find(o=>o.roomId===room.id);
                  return (
                    <div key={room.id} className={`rounded-2xl border-2 p-4 transition-all ${statusColors[room.status]||statusColors.vacant}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-black">Room {room.name}</span>
                        <i className={`fa-solid ${statusIcons[room.status]||statusIcons.vacant}`}></i>
                      </div>
                      <p className="text-xs font-bold capitalize mb-3">{room.status}</p>
                      {occ && <p className="text-xs font-bold truncate mb-3">{occ.guestName}</p>}
                      {occ && <p className="text-xs opacity-70">Out: {occ.checkOutDate}</p>}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {['vacant','occupied','cleaning','maintenance'].filter(s=>s!==room.status).map(s => (
                          <button key={s} onClick={()=>handleStatusChange(room.id,s)} className="text-[10px] font-bold px-1.5 py-0.5 bg-white/60 hover:bg-white rounded capitalize transition-colors">
                            → {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active stays */}
            <div className={`${cardCls} overflow-hidden`}>
              <div className="p-5 border-b border-stone-100">
                <h3 className="font-bold text-stone-900">Active Stays ({activeOccupancy.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider">
                    <tr>{['Room','Guest','Nationality','Phone','Check-in','Check-out','Actions'].map(h=><th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {activeOccupancy.map(o => (
                      <tr key={o.id} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="px-4 py-3 font-bold text-blue-600">{o.roomName}</td>
                        <td className="px-4 py-3 font-bold">{o.guestName}</td>
                        <td className="px-4 py-3 text-stone-500">{o.guestNationality||'—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{o.guestPhone||'—'}</td>
                        <td className="px-4 py-3 text-xs">{o.checkInDate}</td>
                        <td className="px-4 py-3 text-xs">{o.checkOutDate}</td>
                        <td className="px-4 py-3">
                          <button onClick={()=>handleCheckOut(o.id)} className="text-xs font-bold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap">Check Out</button>
                        </td>
                      </tr>
                    ))}
                    {activeOccupancy.length===0&&<tr><td colSpan="7" className="py-12 text-center text-stone-400">No active check-ins.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 2. ROOM CATALOG & PRICING CRUD */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subSection === 'catalog' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Room Form */}
          <div className={`${cardCls} p-6 h-fit sticky top-8`}>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
              <h3 className="font-bold text-lg text-stone-900">
                <i className="fa-solid fa-hotel mr-2 text-indigo-500"></i>
                {editingRoom ? `Edit Room ${editingRoom.name}` : 'Add New Room'}
              </h3>
              {editingRoom && (
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="text-xs font-bold text-stone-400 hover:text-stone-700"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Room Name / Number</label>
                  <input
                    type="text"
                    value={currentRoom.name}
                    onChange={e => setRoomState({ ...currentRoom, name: e.target.value })}
                    placeholder="e.g. 101 or Deluxe Suite"
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Floor</label>
                  <input
                    type="text"
                    value={currentRoom.floor || '1'}
                    onChange={e => setRoomState({ ...currentRoom, floor: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Room Description</label>
                <textarea
                  rows="2"
                  value={currentRoom.description}
                  onChange={e => setRoomState({ ...currentRoom, description: e.target.value })}
                  placeholder="Cozy room with garden view, private hot shower..."
                  className={inputCls}
                  required
                ></textarea>
              </div>

              {/* Bed Rates */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                <label className={labelCls}>Nightly Rates by Bed Configuration</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 uppercase">1 Bed ($)</span>
                    <input
                      type="number"
                      value={currentRoom.beds1Price}
                      onChange={e => setRoomState({ ...currentRoom, beds1Price: parseFloat(e.target.value) })}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 uppercase">2 Beds ($)</span>
                    <input
                      type="number"
                      value={currentRoom.beds2Price}
                      onChange={e => setRoomState({ ...currentRoom, beds2Price: parseFloat(e.target.value) })}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 uppercase">3 Beds ($)</span>
                    <input
                      type="number"
                      value={currentRoom.beds3Price}
                      onChange={e => setRoomState({ ...currentRoom, beds3Price: parseFloat(e.target.value) })}
                      className={inputCls}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Amenities Checklist */}
              <div>
                <label className={labelCls}>Room Amenities</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                  {ALL_AMENITIES.map(amenity => {
                    const checked = (currentRoom.amenities || []).includes(amenity);
                    return (
                      <label key={amenity} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const cur = currentRoom.amenities || [];
                            const updated = e.target.checked ? [...cur, amenity] : cur.filter(a => a !== amenity);
                            setRoomState({ ...currentRoom, amenities: updated });
                          }}
                          className="w-4 h-4 accent-brand-500 rounded"
                        />
                        <span>{amenity}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Photos Upload */}
              <div>
                <label className={labelCls}>Upload Room Photos</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleRoomImageUpload}
                  className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {(currentRoom.images || []).map((img, i) => (
                    <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-stone-200">
                      <img src={img} alt="Room Photo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const a = [...currentRoom.images];
                          a.splice(i, 1);
                          setRoomState({ ...currentRoom, images: a });
                        }}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs"
                      >
                        <i className="fa-solid fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="submit" className={`${btnPrimary} flex-1 justify-center`}>
                  {editingRoom ? 'Update Room' : 'Add Room to Catalog'}
                </button>
                {editingRoom && (
                  <button type="button" onClick={() => setEditingRoom(null)} className={btnSecondary}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Room Catalog Table */}
          <div className="xl:col-span-2">
            <div className={`${cardCls} overflow-hidden`}>
              <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-stone-900">Room Types Catalog ({rooms.length} rooms)</h3>
                  <p className="text-xs text-stone-500">Rooms displayed to customers on the public booking section</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider">
                    <tr>
                      {['Photo', 'Room Name', 'Floor', 'Bed Rates (1/2/3)', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map(room => {
                      const roomImgs = Array.isArray(room.images) ? room.images : (room.imageUrl ? [room.imageUrl] : []);
                      return (
                        <tr key={room.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3">
                            <img
                              src={roomImgs[0] || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=300&q=80'}
                              alt={room.name}
                              className="w-12 h-12 rounded-xl object-cover bg-stone-100 border border-stone-200"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-stone-900">Room {room.name}</p>
                            <p className="text-xs text-stone-400 max-w-xs truncate">{room.description}</p>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-stone-600">Floor {room.floor || '1'}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-mono">
                              <span className="text-emerald-700 font-bold">${room.beds1Price}</span> /{' '}
                              <span className="text-blue-700 font-bold">${room.beds2Price}</span> /{' '}
                              <span className="text-purple-700 font-bold">${room.beds3Price}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[room.status] || 'bg-stone-100 text-stone-600'}`}>
                              {room.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingRoom({
                                    ...room,
                                    images: Array.isArray(room.images) ? room.images : (room.imageUrl ? [room.imageUrl] : []),
                                    amenities: Array.isArray(room.amenities) ? room.amenities : []
                                  });
                                }}
                                className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                              >
                                <i className="fa-solid fa-pen text-xs"></i>
                              </button>
                              <button
                                onClick={() => handleDeleteRoom(room.id)}
                                className="w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                <i className="fa-solid fa-trash text-xs"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {rooms.length === 0 && (
                      <tr><td colSpan="6" className="py-12 text-center text-stone-400">No rooms configured yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

function BillingTab({ invoices, occupancy, rentals, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge, currency }) {
  const [form, setForm] = useState({ guestName:'', guestPhone:'', roomOccupancyId:'', rentalId:'', roomCharge:0, bikeCharge:0, lateFee:0, damageFee:0, extras:0, extrasNote:'', discount:0, paymentMethod:'cash', notes:'' });
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
                      <td className="px-3 py-3">
                        {inv.paymentStatus==='unpaid'&&<button onClick={()=>handlePay(inv.id)} className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap">Mark Paid</button>}
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

function BookingsTab({ bookings, setBookings, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | motor | room
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | confirmed | cancelled
  const [editingBooking, setEditingBooking] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fast optimistic status change (0ms latency)
  const handleUpdateStatus = (id, newStatus) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    fetch(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      ...auth,
      body: JSON.stringify({ status: newStatus })
    }).catch(err => {
      console.error('Status update failed:', err);
      fetchAll();
    });
  };

  // Fast optimistic delete (0ms latency)
  const handleDelete = async (id) => {
    if (!await showConfirm('Delete Booking', 'Are you sure you want to delete this booking?', 'Delete', 'danger')) return;
    setBookings(prev => prev.filter(b => b.id !== id));
    fetch(`/api/bookings/${id}`, { method: 'DELETE', ...auth })
      .catch(err => {
        console.error('Delete failed:', err);
        fetchAll();
      });
  };

  // Save edit modal with optimistic update
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingBooking) return;
    const updated = { ...editingBooking };
    setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
    setEditingBooking(null);
    fetch(`/api/bookings/${updated.id}`, {
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
    return (bookings || []).filter(b => {
      const name = String(b.customerName || '').toLowerCase();
      const phone = String(b.phone || b.customerPhone || '');
      const item = String(b.itemName || '').toLowerCase();
      const matchSearch = !q || name.includes(q) || phone.includes(q) || item.includes(q);
      const matchType = typeFilter === 'all' || b.type === typeFilter;
      const bStatus = b.status || 'pending';
      const matchStatus = statusFilter === 'all' || bStatus === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [bookings, search, typeFilter, statusFilter]);

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
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by customer name, phone, item..."
            className={inputCls}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          {/* Type Filter */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-bold text-stone-600">
            {['all', 'motor', 'room'].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  typeFilter === t ? 'bg-white text-stone-900 shadow-sm' : 'hover:text-stone-900'
                }`}
              >
                {t === 'motor' ? '🛵 Motors' : t === 'room' ? '🏨 Rooms' : 'All Types'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-bold text-stone-600">
            {['all', 'pending', 'confirmed', 'cancelled'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  statusFilter === s ? 'bg-white text-stone-900 shadow-sm' : 'hover:text-stone-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
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
            <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider">
              <tr>
                {['Status', 'Type & Item', 'Customer', 'Contact', 'Dates / Duration', 'Guests / Beds', 'Requests', 'Quick Actions'].map(h => (
                  <th key={h} className="px-4 py-3 font-bold">{h}</th>
                ))}
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
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          b.type === 'motor' ? 'bg-brand-50 text-brand-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {b.type === 'motor' ? '🛵 Motor' : '🏨 Room'}
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
                            onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                            title="Confirm Booking"
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <i className="fa-solid fa-check"></i> Confirm
                          </button>
                        )}

                        {bStatus !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'cancelled')}
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
                          onClick={() => handleDelete(b.id)}
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 anim-scale-in">
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
                    <option value="motor">Motorbike Rental 🛵</option>
                    <option value="room">Guesthouse Room 🏨</option>
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

function GuestsTab({ guests, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnDanger }) {
  const [form, setForm] = useState({ name:'', phone:'', email:'', nationality:'', passportId:'', notes:'' });
  const [search, setSearch] = useState('');
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

  const filtered = (guests || []).filter(g => !search || (g.name || '').toLowerCase().includes(search.toLowerCase()) || g.phone?.includes(search) || (g.nationality || '').toLowerCase().includes(search.toLowerCase()));

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
          <div className="mb-4">
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} className={inputCls} placeholder="Search by name, phone, nationality..." />
          </div>
          <div className={`${cardCls} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider">
                  <tr>{['Name','Phone','Email','Nationality','Passport ID','Notes','Actions'].map(h=><th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
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

function FleetTab({ bikes, models, auth, fetchAll, inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge, currency }) {
  const [activeSubTab, setActiveSubTab] = useState('models');
  const [search, setSearch] = useState('');
  
  // Modals state
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [bikeModalOpen, setBikeModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [editingBike, setEditingBike] = useState(null);
  
  // Forms state
  const [modelForm, setModelForm] = useState({ name: '', description: '', price: '' });
  const [bikeForm, setBikeForm] = useState({ modelId: '', plateNumber: '', color: '', chassisNumber: '', status: 'Available', imageUrl: '' });

  const handleImageUpload = (e, setter, current) => {
    const file = e.target.files[0];
    if (file) { const r = new FileReader(); r.onloadend = ()=>setter({...current, imageUrl: r.result}); r.readAsDataURL(file); }
  };

  const handleModelSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingModel) {
        await BikeModelService.update(editingModel.id, modelForm);
      } else {
        await BikeModelService.create(modelForm);
      }
      setModelModalOpen(false); setEditingModel(null);
      fetchAll();
    } catch(err) { showModal('error', 'Error', err.message); }
  };

  const handleBikeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBike) {
        await MotoService.update(editingBike.id, bikeForm);
      } else {
        await MotoService.create(bikeForm);
      }
      setBikeModalOpen(false); setEditingBike(null);
      fetchAll();
    } catch(err) { showModal('error', 'Error', err.message); }
  };

  const deleteModel = async (id) => {
    if(!await showConfirm('Delete Model', 'Are you sure you want to delete this bike model?', 'Delete', 'danger')) return;
    await BikeModelService.delete(id); fetchAll();
  };
  const deleteBike = async (id) => {
    if(!await showConfirm('Delete Bike', 'Are you sure you want to delete this bike?', 'Delete', 'danger')) return;
    await MotoService.delete(id); fetchAll();
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredModels = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    return (models || []).filter(m => {
      const name = String(m?.name || '').toLowerCase();
      const brand = String(m?.brand || m?.description || '').toLowerCase();
      return !q || name.includes(q) || brand.includes(q);
    });
  }, [models, search]);

  const filteredBikes = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    return (bikes || []).filter(b => {
      const name = String(b?.name || '').toLowerCase();
      const plate = String(b?.plateNumber || '').toLowerCase();
      const color = String(b?.color || '').toLowerCase();
      const status = String(b?.status || '').toLowerCase();
      return !q || name.includes(q) || plate.includes(q) || color.includes(q) || status.includes(q);
    });
  }, [bikes, search]);

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
            if(activeSubTab==='models') { setEditingModel(null); setModelForm({name:'', description:'', price:''}); setModelModalOpen(true); }
            else { setEditingBike(null); setBikeForm({modelId:'', plateNumber:'', color:'', chassisNumber:'', status:'Available', imageUrl:''}); setBikeModalOpen(true); }
          }} className={`${btnPrimary} flex items-center gap-1.5`}>
            <i className="fa-solid fa-plus"></i> បន្ថែម {activeSubTab==='models'?'ម៉ូឌែល':'ម៉ូតូ'}
          </button>
        </div>
      </div>

      {/* Filters */}
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
      </div>

      {/* Data Table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 font-bold uppercase tracking-wider">
              {activeSubTab === 'models' ? (
                <tr>
                  <th className="px-6 py-3.5 w-12"><input type="checkbox" className="rounded border-stone-300" /></th>
                  <th className="px-6 py-3.5">ម៉ាក & ម៉ូដែល</th>
                  <th className="px-6 py-3.5">តម្លៃ/ថ្ងៃ</th>
                  <th className="px-6 py-3.5">ពណ៌</th>
                  <th className="px-6 py-3.5 text-center">ចំនួនគ្រឿង</th>
                  <th className="px-6 py-3.5 text-right">សកម្មភាព</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-3.5 w-12"><input type="checkbox" className="rounded border-stone-300" /></th>
                  <th className="px-6 py-3.5">ស្លាកលេខ</th>
                  <th className="px-6 py-3.5">ប្រភេទ / ម៉ូដែល</th>
                  <th className="px-6 py-3.5">ពណ៌</th>
                  <th className="px-6 py-3.5 text-center">ស្ថានភាព</th>
                  <th className="px-6 py-3.5 text-right">សកម្មភាព</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {activeSubTab === 'models' ? (
                paginatedModels.map(m => (
                  <tr key={m.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="px-6 py-4"><input type="checkbox" className="rounded border-stone-300" /></td>
                    <td className="px-6 py-4 font-bold text-stone-900">{m.name}</td>
                    <td className="px-6 py-4 text-brand-600 font-bold">{currency(m.price || m.dailyPrice)}/day</td>
                    <td className="px-6 py-4 text-stone-500 text-xs">Standard</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 bg-stone-100 rounded-full font-bold text-stone-700 text-xs">
                        {bikes.filter(b=>String(b.modelId)===String(m.id) || b.name===m.name).length} គ្រឿង
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={()=>{setEditingModel(m); setModelForm({ name: m.name, description: m.description || '', price: m.price || m.dailyPrice || '' }); setModelModalOpen(true);}} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"><i className="fa-solid fa-pen text-xs"></i></button>
                        <button onClick={()=>deleteModel(m.id)} className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"><i className="fa-solid fa-trash text-xs"></i></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                paginatedBikes.map(b => {
                  const mdl = models.find(x=>String(x.id) === String(b.modelId));
                  return (
                    <tr key={b.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-6 py-4"><input type="checkbox" className="rounded border-stone-300" /></td>
                      <td className="px-6 py-4 font-mono font-bold text-stone-900 text-xs">{b.plateNumber || 'គ្មានស្លាកលេខ'}</td>
                      <td className="px-6 py-4 font-bold text-stone-800">{b.name || mdl?.name || 'Motor'}</td>
                      <td className="px-6 py-4 text-stone-600">{b.color || 'Standard'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${b.status==='rented' ? 'bg-blue-100 text-blue-700' : b.status==='maintenance' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {b.status === 'rented' ? 'កំពុងជួល' : b.status === 'maintenance' ? 'ជួសជុល' : 'ទំនេរ'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={()=>{setEditingBike(b); setBikeForm({ modelId: b.modelId||'', plateNumber: b.plateNumber||'', color: b.color||'', chassisNumber: b.frameNumber||'', status: b.status||'available', imageUrl: b.photoUrl||'' }); setBikeModalOpen(true);}} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"><i className="fa-solid fa-pen text-xs"></i></button>
                          <button onClick={()=>deleteBike(b.id)} className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"><i className="fa-solid fa-trash text-xs"></i></button>
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
          <div className={`${darkCard} w-full max-w-lg overflow-hidden shadow-2xl`}>
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#1c1c2b]">
              <h3 className="text-lg font-bold text-white">{editingModel ? 'កែប្រែប្រភេទ' : 'បន្ថែមប្រភេទ'}</h3>
              <button onClick={()=>setModelModalOpen(false)} className="text-stone-500 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <form onSubmit={handleModelSubmit} className="p-6 space-y-5 bg-[#1c1c2b]">
              <div className="grid grid-cols-2 gap-5">
                <div><label className={darkLabel}>ម៉ាក *</label><input type="text" value={modelForm.description} onChange={e=>setModelForm({...modelForm, description:e.target.value})} className={darkInput} required /></div>
                <div><label className={darkLabel}>ម៉ូដែល *</label><input type="text" value={modelForm.name} onChange={e=>setModelForm({...modelForm, name:e.target.value})} className={darkInput} required /></div>
              </div>
              <div><label className={darkLabel}>តម្លៃ/ថ្ងៃ (USD) *</label><input type="number" step="0.01" value={modelForm.price} onChange={e=>setModelForm({...modelForm, price:e.target.value})} className={darkInput} required /></div>
              
              <div className="pt-4 flex items-center justify-end gap-4 border-t border-white/5">
                <button type="button" onClick={()=>setModelModalOpen(false)} className="text-sm font-bold text-stone-400 hover:text-white">បោះបង់</button>
                <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20">រក្សាទុក</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bike Modal */}
      {bikeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${darkCard} w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col`}>
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#1c1c2b] shrink-0">
              <h3 className="text-lg font-bold text-white">{editingBike ? 'កែប្រែម៉ូតូ' : 'បន្ថែមម៉ូតូ'}</h3>
              <button onClick={()=>setBikeModalOpen(false)} className="text-stone-500 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <form onSubmit={handleBikeSubmit} className="p-6 space-y-5 bg-[#1c1c2b] overflow-y-auto">
              <div>
                <label className={darkLabel}>ប្រភេទម៉ូតូ *</label>
                <select value={bikeForm.modelId} onChange={e=>setBikeForm({...bikeForm, modelId:e.target.value})} className={darkInput} required>
                  <option value="">ជ្រើសរើសប្រភេទ...</option>
                  {models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div><label className={darkLabel}>ស្លាកលេខ *</label><input type="text" value={bikeForm.plateNumber} onChange={e=>setBikeForm({...bikeForm, plateNumber:e.target.value})} className={darkInput} required /></div>
                <div><label className={darkLabel}>ពណ៌ *</label><input type="text" value={bikeForm.color} onChange={e=>setBikeForm({...bikeForm, color:e.target.value})} className={darkInput} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div><label className={darkLabel}>លេខតួ/ម៉ាស៊ីន</label><input type="text" value={bikeForm.chassisNumber} onChange={e=>setBikeForm({...bikeForm, chassisNumber:e.target.value})} className={darkInput} /></div>
                <div><label className={darkLabel}>លេខកូដ</label><input type="text" className={darkInput} /></div>
              </div>
              <div>
                <label className={darkLabel}>ស្ថានភាព</label>
                <select value={bikeForm.status} onChange={e=>setBikeForm({...bikeForm, status:e.target.value})} className={darkInput}>
                  <option value="Available">Available</option>
                  <option value="Rented">Rented</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className={darkLabel}>រូបភាពម៉ូតូ</label>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-4 text-center relative hover:border-brand-500/50 transition-colors">
                  {bikeForm.imageUrl ? (
                    <img src={bikeForm.imageUrl} alt="Bike" className="w-full h-32 object-cover rounded-lg mb-4" />
                  ) : (
                    <div className="py-8">
                      <i className="fa-solid fa-cloud-arrow-up text-3xl text-stone-600 mb-2"></i>
                      <p className="text-sm text-stone-500">ចុចទីនេះដើម្បីបញ្ចូលរូបភាព</p>
                    </div>
                  )}
                  <input type="file" onChange={e=>handleImageUpload(e, setBikeForm, bikeForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <input type="url" value={bikeForm.imageUrl} onChange={e=>setBikeForm({...bikeForm, imageUrl:e.target.value})} placeholder="https://..." className={darkInput} />
                </div>
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-4 border-t border-white/5">
                <button type="button" onClick={()=>setBikeModalOpen(false)} className="text-sm font-bold text-stone-400 hover:text-white">បោះបង់</button>
                <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20">រក្សាទុក</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsTab({ reports, reportPeriod, setReportPeriod, cardCls, currency }) {
  const totalRevenue = (reports?.roomRevenue||0) + (reports?.bikeRevenue||0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {[['week','Last 7 Days'],['month','Last 30 Days'],['year','Last Year']].map(([p,l])=>(
          <button key={p} onClick={()=>setReportPeriod(p)} className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${reportPeriod===p?'bg-stone-900 text-white':'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label:'Total Revenue', value: currency(totalRevenue), icon:'fa-dollar-sign', color:'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label:'Room Revenue', value: currency(reports?.roomRevenue||0), icon:'fa-bed', color:'text-blue-600 bg-blue-50 border-blue-100' },
          { label:'Bike Revenue', value: currency(reports?.bikeRevenue||0), icon:'fa-motorcycle', color:'text-brand-600 bg-brand-50 border-brand-100' },
        ].map((s,i)=>(
          <div key={i} className={`${cardCls} p-6 flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${s.color}`}><i className={`fa-solid ${s.icon} text-lg`}></i></div>
            <div><p className="text-xs text-stone-400 font-bold uppercase tracking-wide">{s.label}</p><p className="text-2xl font-black text-stone-900">{s.value}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily revenue bars */}
        <div className={`${cardCls} p-6`}>
          <h3 className="font-bold text-stone-900 mb-5">Daily Revenue</h3>
          {reports?.dailyRevenue?.length > 0 ? (
            <div className="space-y-2">
              {reports.dailyRevenue.slice(-14).map((d,i)=>{
                const maxVal = Math.max(...reports.dailyRevenue.map(x=>x.total));
                const pct = maxVal > 0 ? (d.total/maxVal)*100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-stone-400 shrink-0 text-right">{d.day?.slice(5)}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                      <div className="h-full bg-brand-400 rounded-full transition-all" style={{width:`${pct}%`}}></div>
                    </div>
                    <span className="w-14 font-bold text-stone-700 shrink-0">{currency(d.total)}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-stone-400 text-sm text-center py-12">No revenue data yet.</p>}
        </div>

        {/* Top bikes */}
        <div className={`${cardCls} p-6`}>
          <h3 className="font-bold text-stone-900 mb-5">Most Rented Bikes</h3>
          {reports?.topBikes?.length > 0 ? (
            <div className="space-y-3">
              {reports.topBikes.map((b,i)=>(
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${i===0?'bg-amber-100 text-amber-700':i===1?'bg-stone-200 text-stone-600':'bg-stone-100 text-stone-500'}`}>{i+1}</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-stone-900">{b.name}</p>
                    <div className="w-full bg-stone-100 rounded-full h-2 mt-1.5 overflow-hidden">
                      <div className="h-full bg-brand-400 rounded-full" style={{width:`${(b.rentals/(reports.topBikes[0]?.rentals||1))*100}%`}}></div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-stone-600 shrink-0">{b.rentals}x</span>
                </div>
              ))}
            </div>
          ) : <p className="text-stone-400 text-sm text-center py-12">No rental data yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SETTINGS TAB (6 Modules: Profile, Pricing, Staff, Payments, Notifications, Security)
// ══════════════════════════════════════════════════════════════════════════════

function SettingsTab({
  settings, setSettings, saveSettings, settingsSaved,
  staff, setStaff, auditLogs, setAuditLogs,
  auth, authPost, authPatch, authDelete, fetchAll,
  testResult, setTestResult,
  inputCls, labelCls, cardCls, btnPrimary, btnSecondary, btnDanger, statusBadge, currency
}) {
  const [subTab, setSubTab] = useState('business');
  
  // Staff modal state
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ username: '', password: '', fullName: '', role: 'receptionist', permissions: 'bookings,rooms,rentals,invoices,guests', phone: '', status: 'active' });
  const [staffSearch, setStaffSearch] = useState('');

  // Audit log filter state
  const [auditSearch, setAuditSearch] = useState('');

  // Backup loading state
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');

  const SUB_TABS = [
    { id: 'website_copy',  label: 'Website Copy (Texts)', khmer: 'អត្ថបទគេហទំព័រ', icon: 'fa-language' },
    { id: 'business',      label: 'Hotel Profile & Policies', khmer: 'ព័ត៌មានអចលនទ្រព្យ', icon: 'fa-hotel' },
    { id: 'pricing',       label: 'Pricing, Taxes & Currency', khmer: 'តម្លៃ ពន្ធ និងរូបិយប័ណ្ណ', icon: 'fa-coins' },
    { id: 'staff',         label: 'Users & Permissions', khmer: 'សិទ្ធិបុគ្គលិក', icon: 'fa-user-shield' },
    { id: 'payments',      label: 'Payments & Invoicing', khmer: 'ការទូទាត់ និងវិក្កយបត្រ', icon: 'fa-file-invoice-dollar' },
    { id: 'notifications', label: 'Notifications & Alerts', khmer: 'ការជូនដំណឹង', icon: 'fa-bell' },
    { id: 'security',      label: 'Security & Backup', khmer: 'សន្តិសុខ និង Backup', icon: 'fa-shield-halved' },
  ];

  // Staff Handlers
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

  // Backup Handlers
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/backup', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `siemreap-angkor-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      showModal('error', 'Backup Failed', err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!await showConfirm('⚠️ Restore Database', 'WARNING: Restoring will replace ALL existing data in the database with the backup file. This action cannot be undone.', 'Restore', 'danger')) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const res = await fetch('/api/restore', authPost({ data: json.data || json }));
        const d = await res.json();
        if (res.ok) {
          setRestoreMessage('✅ Database restored successfully! Refreshing data...');
          fetchAll();
          setTimeout(() => setRestoreMessage(''), 5000);
        } else {
          setRestoreMessage(`❌ Restore failed: ${d.error}`);
        }
      } catch (err) {
        setRestoreMessage(`❌ Invalid JSON backup file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const bProfile = settings.business_profile || {};
  const pTax = settings.pricing_tax || {};
  const pMethods = settings.payment_methods || {};
  const invSettings = settings.invoice_settings || {};
  const notifSettings = settings.notification_settings || {};
  const secSettings = settings.security_settings || {};

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Sub-tabs Pills */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-stone-200/70 rounded-2xl">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              subTab === tab.id
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/40'
            }`}
          >
            <i className={`fa-solid ${tab.icon} ${subTab === tab.id ? 'text-brand-500' : 'text-stone-400'}`}></i>
            <div className="text-left">
              <span className="block leading-tight">{tab.label}</span>
              <span className="block text-[10px] opacity-70 font-normal">{tab.khmer}</span>
            </div>
          </button>
        ))}
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 0. WEBSITE COPY (Public Texts) */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subTab === 'website_copy' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-language mr-2 text-brand-500"></i>Public Page Texts</h3>
                <p className="text-xs text-stone-500">អត្ថបទសម្រាប់គេហទំព័រ (Welcome, About, ...)</p>
              </div>
              <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Texts'}</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm mb-6">
              <div className="col-span-full mb-2 border-b border-stone-100 pb-2"><h4 className="font-bold text-stone-700">Hero Section</h4></div>
              <div>
                <label className={labelCls}>Hero Title</label>
                <input type="text" className={inputCls} value={settings.public_texts?.hero_title || ''} onChange={e=>setSettings({...settings, public_texts: {...(settings.public_texts||{}), hero_title: e.target.value}})} />
              </div>
              <div>
                <label className={labelCls}>Hero Button</label>
                <input type="text" className={inputCls} value={settings.public_texts?.hero_btn || ''} onChange={e=>setSettings({...settings, public_texts: {...(settings.public_texts||{}), hero_btn: e.target.value}})} />
              </div>
              <div className="col-span-full">
                <label className={labelCls}>Hero Subtitle</label>
                <textarea className={inputCls} rows="2" value={settings.public_texts?.hero_subtitle || ''} onChange={e=>setSettings({...settings, public_texts: {...(settings.public_texts||{}), hero_subtitle: e.target.value}})}></textarea>
              </div>
              <div className="col-span-full mt-2">
                <label className={labelCls}>Hero Slideshow Images (URLs)</label>
                <div className="space-y-3">
                  {(settings.hero_images || []).map((imgUrl, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="w-12 h-12 shrink-0 bg-stone-100 rounded border border-stone-200 overflow-hidden flex items-center justify-center">
                        {imgUrl ? <img src={imgUrl} alt="Slide" className="w-full h-full object-cover" onError={e=>e.target.style.display='none'}/> : <i className="fa-solid fa-image text-stone-300"></i>}
                      </div>
                      <input 
                        type="url" 
                        placeholder="https://..."
                        className={inputCls} 
                        value={imgUrl} 
                        onChange={e => {
                          const newImgs = [...(settings.hero_images || [])];
                          newImgs[i] = e.target.value;
                          setSettings({...settings, hero_images: newImgs});
                        }} 
                      />
                      <button 
                        onClick={() => {
                          const newImgs = [...(settings.hero_images || [])];
                          newImgs.splice(i, 1);
                          setSettings({...settings, hero_images: newImgs});
                        }}
                        className="w-10 h-10 shrink-0 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setSettings({...settings, hero_images: [...(settings.hero_images || []), '']})}
                    className="text-xs font-bold text-brand-500 hover:text-brand-600 flex items-center gap-2 mt-2 px-2 py-1 rounded hover:bg-brand-50 transition-colors w-max"
                  >
                    <i className="fa-solid fa-plus"></i> Add Image URL
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm mb-6">
              <div className="col-span-full mb-2 border-b border-stone-100 pb-2"><h4 className="font-bold text-stone-700">Motor Rentals Section</h4></div>
              <div>
                <label className={labelCls}>Section Label</label>
                <input type="text" className={inputCls} value={settings.public_texts?.bikes_section || ''} onChange={e=>setSettings({...settings, public_texts: {...(settings.public_texts||{}), bikes_section: e.target.value}})} />
              </div>
              <div>
                <label className={labelCls}>Section Title</label>
                <input type="text" className={inputCls} value={settings.public_texts?.bikes_title || ''} onChange={e=>setSettings({...settings, public_texts: {...(settings.public_texts||{}), bikes_title: e.target.value}})} />
              </div>
              <div className="col-span-full">
                <label className={labelCls}>Section Subtitle</label>
                <textarea className={inputCls} rows="2" value={settings.public_texts?.bikes_subtitle || ''} onChange={e=>setSettings({...settings, public_texts: {...(settings.public_texts||{}), bikes_subtitle: e.target.value}})}></textarea>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <div className="col-span-full mb-2 border-b border-stone-100 pb-2"><h4 className="font-bold text-stone-700">Guesthouses Page</h4></div>
              <div className="col-span-full">
                <label className={labelCls}>Page Title</label>
                <input type="text" className={inputCls} value={settings.public_texts?.guesthouses_title || ''} onChange={e=>setSettings({...settings, public_texts: {...(settings.public_texts||{}), guesthouses_title: e.target.value}})} />
              </div>
              <div className="col-span-full">
                <label className={labelCls}>Page Subtitle</label>
                <textarea className={inputCls} rows="2" value={settings.public_texts?.guesthouses_subtitle || ''} onChange={e=>setSettings({...settings, public_texts: {...(settings.public_texts||{}), guesthouses_subtitle: e.target.value}})}></textarea>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 1. HOTEL / BUSINESS PROFILE */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subTab === 'business' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-hotel mr-2 text-brand-500"></i>General Business Profile</h3>
                <p className="text-xs text-stone-500">ឈ្មោះសណ្ឋាគារ, លេខទូរស័ព្ទ, អ៊ីមែល, អាសយដ្ឋាន, និង Logo</p>
              </div>
              <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Profile'}</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <div>
                <label className={labelCls}>Business / Hotel Name</label>
                <input
                  type="text"
                  value={bProfile.hotelName || ''}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, hotelName: e.target.value } })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Contact Phone</label>
                <input
                  type="text"
                  value={bProfile.phone || ''}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, phone: e.target.value } })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Official Email</label>
                <input
                  type="email"
                  value={bProfile.email || ''}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, email: e.target.value } })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Logo Path / URL</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    value={bProfile.logo || ''}
                    onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, logo: e.target.value } })}
                    className={inputCls}
                  />
                  <img src={bProfile.logo || '/assets/logo.png'} alt="Logo" className="w-10 h-10 object-contain rounded-lg border border-stone-200 bg-stone-50 p-1 shrink-0" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Physical Address</label>
                <input
                  type="text"
                  value={bProfile.address || ''}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, address: e.target.value } })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="font-bold text-lg text-stone-900 mb-6 pb-4 border-b border-stone-100"><i className="fa-solid fa-clock mr-2 text-indigo-500"></i>Stay Policies & Check-in Times</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <div>
                <label className={labelCls}>Standard Check-in Time</label>
                <input
                  type="time"
                  value={bProfile.checkInTime || '14:00'}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, checkInTime: e.target.value } })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Standard Check-out Time</label>
                <input
                  type="time"
                  value={bProfile.checkOutTime || '12:00'}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, checkOutTime: e.target.value } })}
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Cancellation Policy</label>
                <textarea
                  rows="3"
                  value={bProfile.cancellationPolicy || ''}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, cancellationPolicy: e.target.value } })}
                  className={inputCls}
                  placeholder="Rules regarding refunds and cancellation deadlines..."
                ></textarea>
              </div>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="font-bold text-lg text-stone-900 mb-6 pb-4 border-b border-stone-100"><i className="fa-solid fa-file-shield mr-2 text-emerald-500"></i>Security Deposits & Rental Rules</h3>
            <div className="space-y-4 text-sm">
              <div>
                <label className={labelCls}>Deposit Policy (Room & Motorbike)</label>
                <textarea
                  rows="2"
                  value={bProfile.depositRule || ''}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, depositRule: e.target.value } })}
                  className={inputCls}
                  placeholder="e.g. $50 deposit or original passport..."
                ></textarea>
              </div>
              <div>
                <label className={labelCls}>Motorcycle Rental Requirements & Safety Terms</label>
                <textarea
                  rows="2"
                  value={bProfile.rentalTerms || ''}
                  onChange={e => setSettings({ ...settings, business_profile: { ...bProfile, rentalTerms: e.target.value } })}
                  className={inputCls}
                  placeholder="e.g. Driver's license / Passport rules, helmet policies..."
                ></textarea>
              </div>
              <div className="pt-2">
                <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save All Business Settings'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 2. PRICING, TAXES & CURRENCY */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subTab === 'pricing' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-coins mr-2 text-amber-500"></i>Currency & Exchange Rates</h3>
                <p className="text-xs text-stone-500">កំណត់រូបិយប័ណ្ណមេ ($ USD / ៛ KHR) និងអត្រាប្តូរប្រាក់</p>
              </div>
              <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Pricing'}</button>
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
                <label className={labelCls}>Secondary Currency</label>
                <select
                  value={pTax.secondaryCurrency || 'KHR'}
                  onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, secondaryCurrency: e.target.value } })}
                  className={inputCls}
                >
                  <option value="KHR">KHR (៛ - Khmer Riel)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Exchange Rate (1 USD to KHR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-stone-400 font-bold">៛</span>
                  <input
                    type="number"
                    value={pTax.exchangeRate || 4100}
                    onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, exchangeRate: parseFloat(e.target.value) } })}
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="font-bold text-lg text-stone-900 mb-6 pb-4 border-b border-stone-100"><i className="fa-solid fa-receipt mr-2 text-blue-500"></i>Taxes, Fees & Late Penalty Rates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
              <div>
                <label className={labelCls}>VAT / Tax Rate (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={pTax.vatPercent || 0}
                    onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, vatPercent: parseFloat(e.target.value) } })}
                    className={inputCls}
                  />
                  <span className="absolute right-3 top-2 text-stone-400 font-bold">%</span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Service Charge (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={pTax.serviceChargePercent || 0}
                    onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, serviceChargePercent: parseFloat(e.target.value) } })}
                    className={inputCls}
                  />
                  <span className="absolute right-3 top-2 text-stone-400 font-bold">%</span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Room Cleaning Fee ($)</label>
                <input
                  type="number"
                  value={pTax.cleaningFee || 0}
                  onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, cleaningFee: parseFloat(e.target.value) } })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Late Check-out Fee ($/hour)</label>
                <input
                  type="number"
                  value={pTax.lateCheckoutPerHour || 5}
                  onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, lateCheckoutPerHour: parseFloat(e.target.value) } })}
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

          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-calendar-days mr-2 text-purple-500"></i>Seasonal Rates Multiplier (High / Peak Season)</h3>
                <p className="text-xs text-stone-500">កែប្រែតម្លៃបន្ទប់ និងម៉ូតូដោយស្វ័យប្រវត្តិតាមរដូវកាលទេសចរណ៍</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={pTax.highSeasonActive || false}
                  onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, highSeasonActive: e.target.checked } })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            
            {pTax.highSeasonActive && (
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3 mt-4 text-sm">
                <div className="flex items-center gap-4">
                  <label className="text-xs font-bold text-purple-900 w-48">High Season Rate Multiplier</label>
                  <input
                    type="number"
                    step="0.05"
                    value={pTax.highSeasonMultiplier || 1.2}
                    onChange={e => setSettings({ ...settings, pricing_tax: { ...pTax, highSeasonMultiplier: parseFloat(e.target.value) } })}
                    className="w-24 bg-white border border-purple-200 rounded-lg p-2 text-center font-bold text-purple-900"
                  />
                  <span className="text-xs text-purple-700 font-medium">(e.g. 1.2 = +20% increase for all rooms & bike rates)</span>
                </div>
              </div>
            )}

            <div className="pt-5 border-t border-stone-100 mt-5">
              <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Pricing & Taxes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 3. STAFF & PERMISSIONS */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subTab === 'staff' && (
        <div className="space-y-6">
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-6 border-b border-stone-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-users-gear mr-2 text-violet-500"></i>Staff Accounts & Role Permissions</h3>
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
                    .filter(s => !staffSearch || s.fullName.toLowerCase().includes(staffSearch.toLowerCase()) || s.username.toLowerCase().includes(staffSearch.toLowerCase()) || s.role.toLowerCase().includes(staffSearch.toLowerCase()))
                    .map(st => {
                      const roleColors = {
                        admin: 'bg-rose-100 text-rose-800 border-rose-200',
                        receptionist: 'bg-blue-100 text-blue-800 border-blue-200',
                        housekeeper: 'bg-amber-100 text-amber-800 border-amber-200',
                        mechanic: 'bg-stone-200 text-stone-800 border-stone-300'
                      };
                      return (
                        <tr key={st.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-brand-600">
                                {st.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-stone-900">{st.fullName}</p>
                                <p className="text-[10px] text-stone-400">Added: {st.createdAt ? new Date(st.createdAt).toLocaleDateString() : 'N/A'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-600">{st.username}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${roleColors[st.role] || 'bg-stone-100 text-stone-600'}`}>
                              {st.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-500 max-w-[200px] truncate">
                            {st.role === 'admin' ? 'Full System Access (All)' : st.permissions || 'Default Staff'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{st.phone || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                              {st.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleOpenStaffModal(st)} className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                                <i className="fa-solid fa-pen text-xs"></i>
                              </button>
                              {st.role !== 'admin' && (
                                <button onClick={() => handleDeleteStaff(st.id)} className="w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                                  <i className="fa-solid fa-trash text-xs"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {staff.length === 0 && (
                    <tr><td colSpan="7" className="py-12 text-center text-stone-400">No staff members found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staff Modal */}
          {staffModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-5">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-stone-200 anim-scale-in">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
                  <h3 className="font-bold text-lg text-stone-900">
                    <i className="fa-solid fa-user-gear mr-2 text-brand-500"></i>
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
                      <label className={labelCls}>System Role</label>
                      <select
                        value={staffForm.role}
                        onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                        className={inputCls}
                      >
                        <option value="receptionist">Receptionist (Front Desk)</option>
                        <option value="housekeeper">Housekeeper (Cleaning)</option>
                        <option value="mechanic">Mechanic (Fleet Service)</option>
                        <option value="admin">Administrator (Full Access)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Phone Number</label>
                      <input
                        type="text"
                        value={staffForm.phone}
                        onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select
                      value={staffForm.status}
                      onChange={e => setStaffForm({ ...staffForm, status: e.target.value })}
                      className={inputCls}
                    >
                      <option value="active">Active (Can Login)</option>
                      <option value="inactive">Inactive / Suspended</option>
                    </select>
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
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 4. PAYMENT METHODS & INVOICING */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subTab === 'payments' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-credit-card mr-2 text-emerald-500"></i>Payment Gateways & Methods</h3>
                <p className="text-xs text-stone-500">ភ្ជាប់ប្រព័ន្ធទូទាត់ (ABA KHQR, Cash, Credit Card, Bank Transfer)</p>
              </div>
              <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Payment Config'}</button>
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
                      onChange={e => {
                        const f = e.target.files[0];
                        if (f) {
                          const r = new FileReader();
                          r.onloadend = () => setSettings({ ...settings, payment_methods: { ...pMethods, abaQrImage: r.result } });
                          r.readAsDataURL(f);
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

          <div className={`${cardCls} p-6`}>
            <h3 className="font-bold text-lg text-stone-900 mb-6 pb-4 border-b border-stone-100"><i className="fa-solid fa-file-invoice mr-2 text-indigo-500"></i>Invoice Template & Receipt Notes</h3>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Invoice Header Title</label>
                  <input
                    type="text"
                    value={invSettings.companyHeader || ''}
                    onChange={e => setSettings({ ...settings, invoice_settings: { ...invSettings, companyHeader: e.target.value } })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tax / VAT Registration Number</label>
                  <input
                    type="text"
                    value={invSettings.taxNumber || ''}
                    onChange={e => setSettings({ ...settings, invoice_settings: { ...invSettings, taxNumber: e.target.value } })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Thank You / Customer Footer Note</label>
                <input
                  type="text"
                  value={invSettings.footerNote || ''}
                  onChange={e => setSettings({ ...settings, invoice_settings: { ...invSettings, footerNote: e.target.value } })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Terms & Check-out Policies on Invoice</label>
                <textarea
                  rows="2"
                  value={invSettings.terms || ''}
                  onChange={e => setSettings({ ...settings, invoice_settings: { ...invSettings, terms: e.target.value } })}
                  className={inputCls}
                ></textarea>
              </div>
              <div className="pt-2">
                <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Invoice Template'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 5. NOTIFICATIONS & ALERTS */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subTab === 'notifications' && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-brands fa-telegram mr-2 text-sky-500"></i>Staff Telegram Notifications</h3>
                <p className="text-xs text-stone-500">ជូនដំណឹងពេលមានការកក់ថ្មី, ម៉ូតូដល់ពេលត្រូវដូរប្រេង, ឬភ្ញៀវត្រូវ Check-out</p>
              </div>
              <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Notifications'}</button>
            </div>

            <div className="space-y-4 text-sm mb-6">
              <div>
                <label className={labelCls}>Telegram Bot Token</label>
                <input
                  type="text"
                  value={settings.telegram_token || ''}
                  onChange={e => setSettings({ ...settings, telegram_token: e.target.value })}
                  className={inputCls}
                  placeholder="1234567890:ABCdefGHI..."
                />
              </div>
              <div>
                <label className={labelCls}>Telegram Chat / Group ID</label>
                <input
                  type="text"
                  value={settings.telegram_chat_id || ''}
                  onChange={e => setSettings({ ...settings, telegram_chat_id: e.target.value })}
                  className={inputCls}
                  placeholder="-100123456789"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    setTestResult('testing');
                    const r = await fetch('/api/settings/test', authPost({}));
                    const d = await r.json();
                    setTestResult(d.success ? 'success' : `Failed: ${d.error}`);
                  }}
                  className={btnSecondary}
                >
                  {testResult === 'testing' ? '⏳ Sending...' : '🔔 Send Telegram Test Message'}
                </button>
              </div>
              {testResult && testResult !== 'testing' && (
                <div className={`p-3 rounded-xl text-sm font-medium ${testResult === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult === 'success' ? '✅ Success! Test message received on Telegram.' : `❌ ${testResult}`}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-stone-100">
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-2">Automated Alert Triggers</p>
              {[
                { key: 'telegramNewBooking', label: 'Instant alert when online booking is submitted' },
                { key: 'telegramMaintenanceAlert', label: 'Fleet maintenance / oil change due reminder' },
                { key: 'telegramCheckoutReminder', label: 'Daily morning guest check-out summary' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <input
                    type="checkbox"
                    checked={notifSettings[item.key] !== false}
                    onChange={e => setSettings({ ...settings, notification_settings: { ...notifSettings, [item.key]: e.target.checked } })}
                    className="w-4 h-4 accent-brand-500 rounded"
                  />
                  <span className="text-sm font-medium text-stone-800">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="font-bold text-lg text-stone-900 mb-6 pb-4 border-b border-stone-100"><i className="fa-solid fa-envelope-open-text mr-2 text-brand-500"></i>Automated Guest Communication Templates</h3>
            <div className="space-y-5 text-sm">
              <div>
                <label className={labelCls}>Guest Booking Confirmation Voucher (WhatsApp / SMS)</label>
                <textarea
                  rows="3"
                  value={notifSettings.guestVoucherTemplate || ''}
                  onChange={e => setSettings({ ...settings, notification_settings: { ...notifSettings, guestVoucherTemplate: e.target.value } })}
                  className={inputCls}
                ></textarea>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['{guest_name}', '{item_name}', '{start_date}', '{end_date}'].map(tag => (
                    <span key={tag} className="text-[11px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">{tag}</span>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Pre-Arrival Check-in Reminder Template</label>
                <textarea
                  rows="3"
                  value={notifSettings.guestReminderTemplate || ''}
                  onChange={e => setSettings({ ...settings, notification_settings: { ...notifSettings, guestReminderTemplate: e.target.value } })}
                  className={inputCls}
                ></textarea>
              </div>

              <div className="pt-2">
                <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Notification Settings'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 6. SECURITY, AUDIT LOGS & BACKUP */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subTab === 'security' && (
        <div className="space-y-6">
          {/* Data Backup & Restore */}
          <div className={`${cardCls} p-6`}>
            <h3 className="font-bold text-lg text-stone-900 mb-2"><i className="fa-solid fa-database mr-2 text-emerald-600"></i>Database Backup & Disaster Recovery</h3>
            <p className="text-xs text-stone-500 mb-6">ទាញយក Backup ទិន្នន័យទាំងអស់ (JSON) ឬ Restore ឡើងវិញពេលមានបញ្ហា</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-emerald-950 mb-1"><i className="fa-solid fa-download mr-1.5 text-emerald-600"></i> Export & Download Full Backup</h4>
                  <p className="text-xs text-emerald-800/80 mb-4">Downloads a comprehensive JSON archive of all bookings, rooms, bikes, invoices, guests, and settings.</p>
                </div>
                <button onClick={handleDownloadBackup} disabled={backupLoading} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-700 w-fit`}>
                  {backupLoading ? 'Generating Backup...' : 'Download JSON Backup'}
                </button>
              </div>

              <div className="p-5 bg-amber-50/60 rounded-2xl border border-amber-200 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm text-amber-950 mb-1"><i className="fa-solid fa-upload mr-1.5 text-amber-600"></i> Restore Database from Backup</h4>
                  <p className="text-xs text-amber-800/80 mb-4">Upload a previously exported backup file to restore complete system records.</p>
                </div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFile}
                  className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white cursor-pointer"
                />
              </div>
            </div>

            {restoreMessage && (
              <div className="p-4 rounded-xl text-sm font-medium bg-stone-900 text-white shadow-lg mb-4">
                {restoreMessage}
              </div>
            )}
          </div>

          {/* System Security Policies */}
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-shield-halved mr-2 text-purple-600"></i>Security & Session Policies</h3>
                <p className="text-xs text-stone-500">កំណត់សុវត្ថិភាព Password និងរយៈពេល Session Timeout</p>
              </div>
              <button onClick={saveSettings} className={btnPrimary}>{settingsSaved ? '✅ Saved!' : 'Save Security'}</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <label className="flex items-center gap-3 cursor-pointer p-4 bg-stone-50 rounded-xl border border-stone-200">
                <input
                  type="checkbox"
                  checked={secSettings.autoBackupEnabled !== false}
                  onChange={e => setSettings({ ...settings, security_settings: { ...secSettings, autoBackupEnabled: e.target.checked } })}
                  className="w-4 h-4 accent-brand-500 rounded"
                />
                <div>
                  <p className="font-bold text-stone-900 text-sm">Automatic Daily Data Snapshot</p>
                  <p className="text-xs text-stone-500">Keep automated system recovery points</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-4 bg-stone-50 rounded-xl border border-stone-200">
                <input
                  type="checkbox"
                  checked={secSettings.requireStrongPasswords !== false}
                  onChange={e => setSettings({ ...settings, security_settings: { ...secSettings, requireStrongPasswords: e.target.checked } })}
                  className="w-4 h-4 accent-brand-500 rounded"
                />
                <div>
                  <p className="font-bold text-stone-900 text-sm">Require Strong Staff Passwords</p>
                  <p className="text-xs text-stone-500">Enforce minimum 6 characters for all roles</p>
                </div>
              </label>

              <div>
                <label className={labelCls}>Admin Session Timeout (Minutes)</label>
                <input
                  type="number"
                  value={secSettings.sessionTimeoutMinutes || 120}
                  onChange={e => setSettings({ ...settings, security_settings: { ...secSettings, sessionTimeoutMinutes: parseInt(e.target.value) } })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Audit Logs Trail */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-stone-900"><i className="fa-solid fa-list-check mr-2 text-stone-700"></i>Activity Audit Trail</h3>
                <p className="text-xs text-stone-500">ត្រួតពិនិត្យប្រវត្តិកែប្រែទិន្នន័យរបស់បុគ្គលិក (Activity History)</p>
              </div>
              <span className="text-xs font-bold bg-stone-100 text-stone-600 px-3 py-1 rounded-full">
                {auditLogs.length} events logged
              </span>
            </div>

            <div className="p-4 border-b border-stone-100 bg-stone-50">
              <input
                type="text"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Search audit trail by user, action, details..."
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
                    .filter(log => !auditSearch || log.action.toLowerCase().includes(auditSearch.toLowerCase()) || log.performedBy.toLowerCase().includes(auditSearch.toLowerCase()) || log.details?.toLowerCase().includes(auditSearch.toLowerCase()))
                    .map(log => (
                      <tr key={log.id} className="border-b border-stone-100 hover:bg-stone-50 text-xs">
                        <td className="px-4 py-3 font-mono text-stone-400 whitespace-nowrap">{log.createdAt}</td>
                        <td className="px-4 py-3 font-bold text-stone-900">{log.performedBy}</td>
                        <td className="px-4 py-3">
                          <span className="bg-stone-100 text-stone-700 font-bold px-2 py-0.5 rounded">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-600 max-w-xs truncate">{log.details || '—'}</td>
                      </tr>
                    ))}
                  {auditLogs.length === 0 && (
                    <tr><td colSpan="4" className="py-10 text-center text-stone-400 text-xs">No audit logs recorded yet.</td></tr>
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

function DashboardTab({ bikes, models, rentals, bookings, cardCls, loadingData, currency }) {
  const [modalState, setModalState] = useState({ open: false, title: '', type: '' });

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

  const todayRentals = (rentals || []).filter(r => (r.startDate || r.checkoutDate || '').substring(0, 10) === todayStr);
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

  const displayRentals = (rentals || []).slice(0, 6);

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        <div className={`${cardCls} p-4 text-center border-stone-200`}>
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">ម៉ូតូសរុប</p>
          <p className="text-2xl font-black text-stone-900">{totalBikes}</p>
        </div>
        <div onClick={()=>openModal('available')} className={`${cardCls} p-4 text-center border-emerald-200 bg-emerald-50/40 cursor-pointer hover:shadow-md transition`}>
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">ម៉ូតូទំនេរ</p>
          <p className="text-2xl font-black text-emerald-700">{availableBikes.length}</p>
        </div>
        <div className={`${cardCls} p-4 text-center border-purple-200 bg-purple-50/40`}>
          <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-1">ចំនួនកក់</p>
          <p className="text-2xl font-black text-purple-700">{(bookings || []).length}</p>
        </div>
        <div onClick={()=>openModal('rented')} className={`${cardCls} p-4 text-center border-blue-200 bg-blue-50/40 cursor-pointer hover:shadow-md transition`}>
          <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1">កំពុងជួល</p>
          <p className="text-2xl font-black text-blue-700">{rentedBikes.length}</p>
        </div>
        <div className={`${cardCls} p-4 text-center border-rose-200 bg-rose-50/40`}>
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1">ជួសជុល</p>
          <p className="text-2xl font-black text-rose-700">{repairBikes.length}</p>
        </div>
        <div className={`${cardCls} p-4 text-center border-amber-200 bg-amber-50/40`}>
          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">ចំណូលថ្ងៃនេះ</p>
          <p className="text-xl font-black text-amber-800">${parseFloat(todayIncome || 0).toFixed(2)}</p>
        </div>
        <div className={`${cardCls} p-4 text-center border-stone-200 bg-stone-50`}>
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">ចំណូលសរុប</p>
          <p className="text-xl font-black text-brand-600">${parseFloat(monthIncome || 0).toFixed(2)}</p>
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
      <div className={`${cardCls} overflow-hidden`}>
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-brand-500"></i> ការជួលចុងក្រោយ (Recent Rentals)
          </h3>
          <span className="text-xs text-stone-400 font-medium">Showing latest {displayRentals.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-5 py-3">អតិថិជន (Customer)</th>
                <th className="px-5 py-3">ម៉ូតូ (Bike)</th>
                <th className="px-5 py-3">ថ្ងៃចេញ (Check Out)</th>
                <th className="px-5 py-3">ថ្ងៃត្រឡប់ (Due Date)</th>
                <th className="px-5 py-3">ស្ថានភាព (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {displayRentals.map((r, i) => (
                <tr key={r.id || i} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-stone-900">{r.guestName || r.customerName || '—'}</td>
                  <td className="px-5 py-3.5 font-semibold text-stone-800">
                    <div>{r.bikeName || 'Motor'}</div>
                    {r.plateNumber && <div className="text-[11px] font-mono text-stone-400">{r.plateNumber}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-stone-600 font-mono">{r.startDate || r.checkoutDate || '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-stone-600 font-mono">{r.endDate || r.returnDueDate || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'active' || r.status === 'rented' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {r.status || 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
              {displayRentals.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-stone-400">មិនទាន់មានទិន្នន័យជួលនៅឡើយទេ។</td>
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

