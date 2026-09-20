import { useState, useMemo } from 'react';
import { useModal } from '../common/ModalProvider';
import { RoomService, BedCategoryService, OccupancyService } from '../../services/DatabaseService';
import { fileToBase64 } from '../../utils/imageUtils';
import RoomBookingsTab from './RoomBookingsTab';
import RoomInvoiceModal from './RoomInvoiceModal';
import RoomCheckoutModal from './RoomCheckoutModal';

const ALL_AMENITIES = [
  'Air Conditioning',
  'Free Wi-Fi',
  'Private Bathroom',
  'Hot Shower',
  'Flat-screen TV',
  'Mini Fridge',
  'Daily Housekeeping',
  'Balcony / Terrace',
  'Safety Deposit Box',
  'Desk / Work Area',
  'Tea / Coffee Maker',
  'Pool View'
];

const AMENITY_ICONS = {
  'Air Conditioning': 'fa-snowflake',
  'Free Wi-Fi': 'fa-wifi',
  'Private Bathroom': 'fa-shower',
  'Hot Shower': 'fa-temperature-high',
  'Flat-screen TV': 'fa-tv',
  'Mini Fridge': 'fa-kitchen-set',
  'Daily Housekeeping': 'fa-broom',
  'Balcony / Terrace': 'fa-mountain-sun',
  'Safety Deposit Box': 'fa-vault',
  'Desk / Work Area': 'fa-laptop',
  'Tea / Coffee Maker': 'fa-mug-hot',
  'Pool View': 'fa-water-ladder'
};

const DEFAULT_CATEGORIES = [
  {
    name: '1 Bed - Standard Double',
    bedType: '1 Queen Bed (1.6m)',
    bedCount: 1,
    price: 25,
    capacity: 2,
    description: 'Comfortable air-conditioned room with 1 large double bed, private bathroom with hot shower, and high-speed Wi-Fi.',
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower', 'Flat-screen TV', 'Daily Housekeeping'],
    images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80']
  },
  {
    name: '2 Beds - Deluxe Twin',
    bedType: '2 Single Beds (1.2m)',
    bedCount: 2,
    price: 35,
    capacity: 2,
    description: 'Spacious twin room with 2 comfortable single beds, desk, mini fridge, and balcony view towards the garden.',
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower', 'Flat-screen TV', 'Mini Fridge', 'Balcony / Terrace', 'Daily Housekeeping'],
    images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80']
  },
  {
    name: '3 Beds - Family Suite',
    bedType: '1 Double + 2 Single Beds',
    bedCount: 3,
    price: 45,
    capacity: 4,
    description: 'Perfect for families or groups traveling together. Generous space with 3 beds, seating area, and full amenities.',
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower', 'Flat-screen TV', 'Mini Fridge', 'Daily Housekeeping', 'Safety Deposit Box'],
    images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80']
  }
];

export default function RoomsTab({
  rooms = [],
  bedCategories = [],
  occupancy = [],
  bookings = [],
  setBookings,
  guests = [],
  auth,
  fetchAll,
  fetchDash,
  inputCls,
  labelCls,
  cardCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
  statusBadge,
  today,
  currency,
  sendCategoryTelegramAlert,
  tgSending,
  settings = {}
}) {
  const { showModal, showConfirm } = useModal();
  const [localTgSending, setLocalTgSending] = useState(false);

  const handleRoomsTelegramAlert = async () => {
    setLocalTgSending(true);
    try {
      const vacantCount = rooms.filter(r => r.status === 'vacant').length;
      const occupiedCount = rooms.filter(r => r.status === 'occupied').length;
      const cleaningCount = rooms.filter(r => r.status === 'cleaning').length;
      const activeOcc = (occupancy || []).filter(o => o.status === 'checked_in').length;

      if (sendCategoryTelegramAlert) {
        await sendCategoryTelegramAlert({
          category: 'Rooms',
          title: 'Room Inventory & Occupancy Status Report',
          summary: `Total Rooms: ${rooms.length} (${bedCategories.length} Categories)\nVacant: ${vacantCount} | Occupied: ${occupiedCount} | Cleaning: ${cleaningCount}`,
          details: `Active in-house guests: ${activeOcc}`
        });
      } else {
        const res = await fetch('/api/telegram/send-alert', {
          method: 'POST',
          headers: auth?.headers || { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'Rooms',
            title: 'Room Inventory & Occupancy Status Report',
            summary: `Total Rooms: ${rooms.length} (${bedCategories.length} Categories)\nVacant: ${vacantCount} | Occupied: ${occupiedCount} | Cleaning: ${cleaningCount}`,
            details: `Active in-house guests: ${activeOcc}`
          })
        });
        if (res.ok) {
          showModal('success', 'Telegram Alert Sent', 'Room occupancy and inventory status sent to Telegram.');
        } else {
          showModal('error', 'Alert Error', 'Failed to send Telegram alert.');
        }
      }
    } catch (err) {
      showModal('error', 'Network Error', err.message);
    } finally {
      setLocalTgSending(false);
    }
  };

  // Sub-navigation: 'occupancy' | 'categories' | 'rooms'
  const [subSection, setSubSection] = useState('rooms');

  // Filter & Search states for rooms
  const [roomSearch, setRoomSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [roomSortBy, setRoomSortBy] = useState('name-asc');

  // Room Detail Modal / "One by One" view state
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  // Inline editing in room detail modal
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [detailEditForm, setDetailEditForm] = useState({
    name: '', floor: '1', categoryId: '', price: 25, status: 'vacant',
    description: '', amenities: [], images: [], bedType: '', bedCount: 1, capacity: 2
  });

  // Check-in form state (supports single and multi-room check-in)
  const [checkInForm, setCheckInForm] = useState({
    roomId: '',
    roomIds: [],
    guestName: '',
    guestPhone: '',
    guestNationality: '',
    passportOrId: '',
    bedCount: 1,
    checkInDate: today ? today() : new Date().toISOString().split('T')[0],
    checkOutDate: '',
    notes: ''
  });

  // Invoice / Folio Modal State
  const [invoiceModalGuest, setInvoiceModalGuest] = useState(null);
  const [invoiceModalRelated, setInvoiceModalRelated] = useState([]);

  // Detailed Check-out Modal State
  const [checkoutModalGuest, setCheckoutModalGuest] = useState(null);

  // ─── Active Occupancy / Security / Shot View State & Helpers ───────────────
  const [occupancySearch, setOccupancySearch] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState('all'); // 'all' | 'due-today' | 'foreign' | 'khmer'
  const [occupancyViewMode, setOccupancyViewMode] = useState('cards'); // 'cards' (Shot View) | 'table'
  const [selectedSecurityGuest, setSelectedSecurityGuest] = useState(null);
  const [showSecurityManifestModal, setShowSecurityManifestModal] = useState(false);
  const [manifestFilter, setManifestFilter] = useState('all');
  const [manifestSearch, setManifestSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedManifestText, setCopiedManifestText] = useState(false);
  const [guestSuggestOpen, setGuestSuggestOpen] = useState(false);

  // Helper to extract passport from guest object or notes
  const getGuestPassport = (guest) => {
    if (!guest) return '';
    if (guest.passportOrId && String(guest.passportOrId).trim()) return String(guest.passportOrId).trim();
    if (guest.passportId && String(guest.passportId).trim()) return String(guest.passportId).trim();
    if (guest.notes) {
      const match = String(guest.notes).match(/(?:passport|id|doc|id card)[\s:#]*([A-Za-z0-9\-]+)/i);
      if (match) return match[1];
    }
    return '';
  };

  const copyText = (text, idKey = null) => {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    if (idKey) {
      setCopiedId(idKey);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Active Occupancy enriched with sequential Shot View Numbers (#01, #02...) & Security Codes
  const activeOccupancyWithShot = useMemo(() => {
    const todayStr = today ? today() : new Date().toISOString().split('T')[0];
    return (occupancy || [])
      .filter(o => o.status === 'checked_in')
      .map((o, idx) => {
        const shotNumber = `#${String(idx + 1).padStart(2, '0')}`;
        
        // Find matching room by ID or name
        const matchingRoom = (rooms || []).find(r => 
          (o.roomId && String(r.id) === String(o.roomId)) ||
          (o.roomName && (r.name === o.roomName || `Room ${r.name}` === o.roomName || r.name === String(o.roomName).replace(/^Room\s*#?/i, '')))
        ) || (rooms || []).find(r => r.status === 'occupied') || rooms[0];

        const rawRoomName = o.roomName && String(o.roomName).trim() && String(o.roomName).trim().toLowerCase() !== 'null' && String(o.roomName).trim() !== 'room #null'
          ? o.roomName
          : (matchingRoom?.name ? `Room ${matchingRoom.name}` : (o.roomId && String(o.roomId) !== 'null' ? `Room ${o.roomId}` : 'Room 101'));

        const cleanRoom = String(rawRoomName || '101').replace(/[^a-zA-Z0-9]/g, '');
        const secCode = `SEC-${cleanRoom || 'RM'}-${String(idx + 1).padStart(2, '0')}`;
        const passport = getGuestPassport(o);
        const isKhmer = /cambodia|khmer|កម្ពុជា/i.test(o.guestNationality || '');
        const isDueToday = o.checkOutDate === todayStr;

        // Detect all active rooms belonging to the same guest (multi-room support)
        const relatedStays = (occupancy || []).filter(item => {
          if (item.status !== 'checked_in') return false;
          if (item.id === o.id) return true;
          const itemPass = getGuestPassport(item);
          if (passport && itemPass && String(itemPass).trim().toLowerCase() === String(passport).trim().toLowerCase()) return true;
          if (o.guestPhone && item.guestPhone && String(item.guestPhone).trim() === String(o.guestPhone).trim()) return true;
          if (o.guestName && item.guestName && item.guestName.toLowerCase().trim() === o.guestName.toLowerCase().trim()) return true;
          return false;
        });
        const isMultiRoom = relatedStays.length > 1;

        return {
          ...o,
          roomName: rawRoomName,
          roomId: o.roomId || matchingRoom?.id || '101',
          shotNumber,
          secCode,
          passport,
          isKhmer,
          isDueToday,
          roomFloor: matchingRoom?.floor || '1',
          roomCategory: matchingRoom?.categoryName || `${o.bedCount || matchingRoom?.bedCount || 1} Bed`,
          roomRate: matchingRoom?.price || matchingRoom?.rate || 25,
          originalIndex: idx,
          relatedStays,
          isMultiRoom
        };
      });
  }, [occupancy, rooms, today]);

  const occupancyStats = useMemo(() => {
    const total = activeOccupancyWithShot.length;
    const khmer = activeOccupancyWithShot.filter(o => o.isKhmer).length;
    const foreign = total - khmer;
    const dueToday = activeOccupancyWithShot.filter(o => o.isDueToday).length;
    const occupiedRoomIds = new Set(activeOccupancyWithShot.map(o => String(o.roomId)));
    return { total, khmer, foreign, dueToday, occupiedRoomsCount: occupiedRoomIds.size };
  }, [activeOccupancyWithShot]);

  const filteredOccupancy = useMemo(() => {
    return activeOccupancyWithShot.filter(o => {
      const q = occupancySearch.toLowerCase().trim();
      const matchSearch = !q ||
        (o.guestName || '').toLowerCase().includes(q) ||
        String(o.roomName || o.roomId || '').toLowerCase().includes(q) ||
        (o.guestPhone || '').toLowerCase().includes(q) ||
        (o.guestNationality || '').toLowerCase().includes(q) ||
        (o.passport || '').toLowerCase().includes(q) ||
        (o.secCode || '').toLowerCase().includes(q) ||
        (o.shotNumber || '').toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (occupancyFilter === 'due-today') return o.isDueToday;
      if (occupancyFilter === 'foreign') return !o.isKhmer;
      if (occupancyFilter === 'khmer') return o.isKhmer;
      return true;
    });
  }, [activeOccupancyWithShot, occupancySearch, occupancyFilter]);

  const filteredManifestList = useMemo(() => {
    return activeOccupancyWithShot.filter(o => {
      const q = manifestSearch.toLowerCase().trim();
      const matchSearch = !q ||
        (o.guestName || '').toLowerCase().includes(q) ||
        String(o.roomName || o.roomId || '').toLowerCase().includes(q) ||
        (o.guestPhone || '').toLowerCase().includes(q) ||
        (o.guestNationality || '').toLowerCase().includes(q) ||
        (o.passport || '').toLowerCase().includes(q) ||
        (o.secCode || '').toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (manifestFilter === 'foreign') return !o.isKhmer;
      if (manifestFilter === 'khmer') return o.isKhmer;
      return true;
    });
  }, [activeOccupancyWithShot, manifestSearch, manifestFilter]);

  const customerSuggestions = useMemo(() => {
    if (!checkInForm.guestName || checkInForm.guestName.trim().length < 2) return [];
    const q = checkInForm.guestName.toLowerCase().trim();
    return (guests || []).filter(g =>
      (g.name || '').toLowerCase().includes(q) ||
      (g.phone || '').toLowerCase().includes(q) ||
      (g.passportOrId || g.passportId || '').toLowerCase().includes(q)
    ).slice(0, 5);
  }, [guests, checkInForm.guestName]);

  const generateSecurityManifestText = () => {
    const nowStr = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Phnom_Penh',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const header = `==================================================\n🛡️ SIEM REAP ANGKOR GUESTHOUSE & RENTALS\nOFFICIAL ACTIVE GUEST SECURITY MANIFEST\n(របាយការណ៍ភ្ញៀវស្នាក់នៅជាក់ស្តែងសម្រាប់សមត្ថកិច្ច)\nGenerated: ${nowStr}\nTotal In-House: ${occupancyStats.total} Guests (Khmer: ${occupancyStats.khmer} | Foreign: ${occupancyStats.foreign})\nTotal Rooms Occupied: ${occupancyStats.occupiedRoomsCount}\n==================================================\n\n`;

    const body = activeOccupancyWithShot.map(g => {
      return `[${g.shotNumber}] ROOM ${g.roomName || g.roomId} (${g.secCode})
• Guest Name: ${g.guestName}
• Nationality: ${g.guestNationality || 'Unknown'}
• Passport / ID: ${g.passport || 'None recorded'}
• Contact Phone: ${g.guestPhone || 'N/A'}
• Check-in: ${g.checkInDate}
• Check-out: ${g.checkOutDate || 'Open'}
• Floor/Beds: Floor ${g.roomFloor} (${g.roomCategory})
• Security Status: Verified In-House
--------------------------------------------------`;
    }).join('\n\n');

    return header + (body || 'No active checked-in guests currently registered.');
  };

  const handleSecurityManifestTelegramAlert = async () => {
    setLocalTgSending(true);
    try {
      const summaryText = `Total In-House: ${occupancyStats.total} Guests (Khmer: ${occupancyStats.khmer} | Foreign: ${occupancyStats.foreign})\nOccupied Rooms: ${occupancyStats.occupiedRoomsCount}`;
      const lines = activeOccupancyWithShot.map(g =>
        `[${g.shotNumber}] Room ${g.roomName || g.roomId}: ${g.guestName} (${g.guestNationality || 'N/A'}) | ID: ${g.passport || 'N/A'} | Phone: ${g.guestPhone || 'N/A'} | ${g.checkInDate} to ${g.checkOutDate}`
      ).join('\n');

      if (sendCategoryTelegramAlert) {
        await sendCategoryTelegramAlert({
          category: 'Security Manifest',
          title: 'Official In-House Guest Security Database Manifest',
          summary: summaryText,
          details: lines || 'No active guests currently checked in.'
        });
      } else {
        const res = await fetch('/api/telegram/send-alert', {
          method: 'POST',
          headers: auth?.headers || { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'Security Manifest',
            title: 'Official In-House Guest Security Database Manifest',
            summary: summaryText,
            details: lines || 'No active guests currently checked in.'
          })
        });
        if (res.ok) {
          showModal('success', 'Security Alert Sent', 'Guest security manifest dispatched to Telegram.');
        } else {
          showModal('error', 'Alert Error', 'Failed to dispatch Telegram security alert.');
        }
      }
    } catch (err) {
      showModal('error', 'Network Error', err.message);
    } finally {
      setLocalTgSending(false);
    }
  };

  // ─── Bed Category Form State ───────────────────────────────────────────────
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    bedType: '1 Queen Bed',
    bedCount: 1,
    price: 25,
    capacity: 2,
    description: '',
    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower'],
    images: []
  });

  // ─── Physical Room Form State ─────────────────────────────────────────────
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({
    name: '',
    floor: '1',
    categoryId: '',
    price: 25,
    status: 'vacant',
    description: '',
    amenities: [],
    images: []
  });

  const activeOccupancy = useMemo(() => {
    return (occupancy || []).filter(o => o.status === 'checked_in');
  }, [occupancy]);

  const statusColors = {
    vacant: 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 text-emerald-950 border-emerald-400 hover:border-emerald-500 hover:shadow-emerald-200/50',
    occupied: 'bg-gradient-to-br from-blue-50 via-white to-blue-50/50 text-blue-950 border-blue-400 hover:border-blue-500 hover:shadow-blue-200/50',
    cleaning: 'bg-gradient-to-br from-amber-50 via-white to-amber-50/50 text-amber-950 border-amber-400 hover:border-amber-500 hover:shadow-amber-200/50',
    maintenance: 'bg-gradient-to-br from-rose-50 via-white to-rose-50/50 text-rose-950 border-rose-400 hover:border-rose-500 hover:shadow-rose-200/50'
  };

  const statusBadgeColors = {
    vacant: 'bg-emerald-600 text-white font-bold',
    occupied: 'bg-blue-600 text-white font-bold',
    cleaning: 'bg-amber-500 text-white font-bold',
    maintenance: 'bg-rose-600 text-white font-bold'
  };

  const statusButtonColors = {
    vacant: 'bg-emerald-100 hover:bg-emerald-600 text-emerald-800 hover:text-white border-emerald-300',
    occupied: 'bg-blue-100 hover:bg-blue-600 text-blue-800 hover:text-white border-blue-300',
    cleaning: 'bg-amber-100 hover:bg-amber-600 text-amber-900 hover:text-white border-amber-300',
    maintenance: 'bg-rose-100 hover:bg-rose-600 text-rose-800 hover:text-white border-rose-300'
  };

  const statusIcons = {
    vacant: 'fa-circle-check text-emerald-500',
    occupied: 'fa-user-check text-blue-500',
    cleaning: 'fa-broom text-amber-500',
    maintenance: 'fa-wrench text-rose-500'
  };

  const statusTextLabels = {
    vacant: 'Vacant (ទំនេរ)',
    occupied: 'Occupied (មានភ្ញៀវ)',
    cleaning: 'Cleaning (សម្អាត)',
    maintenance: 'Maintenance (ជួសជុល)'
  };

  // State for Room Status Overview quick filter
  const [overviewStatusFilter, setOverviewStatusFilter] = useState('all');

  // Helper to extract floor number accurately from room object or room name
  const getRoomFloorNumber = (room) => {
    if (room.floor != null && String(room.floor).trim() !== '') {
      const parsed = parseInt(String(room.floor).replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    // Try matching room number digits (e.g. 101 -> 1, 203 -> 2, 301 -> 3, 402 -> 4)
    const m = String(room.name || '').match(/(\d)\d{2}/);
    if (m) return parseInt(m[1], 10);
    const num = String(room.name || '').match(/\d+/);
    if (num) {
      const val = parseInt(num[0], 10);
      if (val >= 100) return Math.floor(val / 100);
      return val;
    }
    return 1;
  };

  // Group rooms by floor in architectural building order:
  // Floor 3 (or 4, 3) at TOP -> Floor 2 in CENTER -> Floor 1 at BOTTOM
  const roomsByFloor = useMemo(() => {
    const floorMap = {};

    (rooms || []).forEach(room => {
      const f = getRoomFloorNumber(room);
      if (!floorMap[f]) floorMap[f] = [];
      floorMap[f].push(room);
    });

    // Sort rooms within each floor ascending by room number/name
    Object.keys(floorMap).forEach(f => {
      floorMap[f].sort((a, b) => {
        const numA = parseInt(String(a.name || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.name || '').replace(/\D/g, ''), 10) || 0;
        if (numA && numB && numA !== numB) return numA - numB;
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true });
      });
    });

    // Sort floor numbers descending so highest floor is TOP, Floor 2 is CENTER, Floor 1 is BOTTOM
    const sortedFloorNumbers = Object.keys(floorMap)
      .map(Number)
      .sort((a, b) => b - a);

    return sortedFloorNumbers.map(floorNum => {
      let floorTitle = `Floor ${floorNum}`;
      let positionTag = 'Upper Floor';
      let positionColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';

      if (floorNum === 1) {
        floorTitle = 'Floor 1 (ជាន់ទី 1 - Bottom / Ground)';
        positionTag = 'Bottom Floor';
        positionColor = 'bg-stone-200 text-stone-800 border-stone-300';
      } else if (floorNum === 2) {
        floorTitle = 'Floor 2 (ជាន់ទី 2 - Center Floor)';
        positionTag = 'Center Floor';
        positionColor = 'bg-sky-100 text-sky-800 border-sky-200';
      } else if (floorNum === 3) {
        floorTitle = 'Floor 3 (ជាន់ទី 3 - Top Floor)';
        positionTag = 'Top Floor';
        positionColor = 'bg-amber-100 text-amber-900 border-amber-300';
      } else if (floorNum >= 4) {
        floorTitle = `Floor ${floorNum} (ជាន់ទី ${floorNum} - Top Floor)`;
        positionTag = 'Top Floor';
        positionColor = 'bg-purple-100 text-purple-900 border-purple-300';
      }

      const allFloorRooms = floorMap[floorNum];
      const displayedRooms = overviewStatusFilter === 'all'
        ? allFloorRooms
        : allFloorRooms.filter(r => r.status === overviewStatusFilter);

      return {
        floorNumber: floorNum,
        floorTitle,
        positionTag,
        positionColor,
        totalCount: allFloorRooms.length,
        vacantCount: allFloorRooms.filter(r => r.status === 'vacant').length,
        occupiedCount: allFloorRooms.filter(r => r.status === 'occupied').length,
        cleaningCount: allFloorRooms.filter(r => r.status === 'cleaning').length,
        maintenanceCount: allFloorRooms.filter(r => r.status === 'maintenance').length,
        rooms: displayedRooms
      };
    });
  }, [rooms, overviewStatusFilter]);

  // ─── Filtered Rooms ────────────────────────────────────────────────────────
  const filteredRooms = useMemo(() => {
    const list = (rooms || []).filter(room => {
      const q = roomSearch.toLowerCase().trim();
      const matchName = !q || String(room.name || '').toLowerCase().includes(q) || String(room.categoryName || '').toLowerCase().includes(q);
      const matchCat = catFilter === 'all' || String(room.categoryId) === String(catFilter);
      const matchStatus = statusFilter === 'all' || room.status === statusFilter;
      const matchFloor = floorFilter === 'all' || String(room.floor) === String(floorFilter);
      return matchName && matchCat && matchStatus && matchFloor;
    });

    list.sort((a, b) => {
      if (roomSortBy === 'name-asc') {
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true });
      }
      if (roomSortBy === 'name-desc') {
        return String(b.name || '').localeCompare(String(a.name || ''), undefined, { numeric: true });
      }
      if (roomSortBy === 'price-asc') {
        return (Number(a.price || 0)) - (Number(b.price || 0));
      }
      if (roomSortBy === 'price-desc') {
        return (Number(b.price || 0)) - (Number(a.price || 0));
      }
      if (roomSortBy === 'floor-asc') {
        return (Number(a.floor || 1)) - (Number(b.floor || 1));
      }
      if (roomSortBy === 'status') {
        return String(a.status || '').localeCompare(String(b.status || ''));
      }
      return 0;
    });

    return list;
  }, [rooms, roomSearch, catFilter, statusFilter, floorFilter, roomSortBy]);

  // Selected Room for "One by One" Detail View
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return rooms.find(r => String(r.id) === String(selectedRoomId)) || null;
  }, [selectedRoomId, rooms]);

  const selectedRoomIndex = useMemo(() => {
    if (!selectedRoomId) return -1;
    return filteredRooms.findIndex(r => String(r.id) === String(selectedRoomId));
  }, [selectedRoomId, filteredRooms]);

  // Next / Previous room in "One by One" mode
  const handlePrevRoom = () => {
    if (filteredRooms.length === 0) return;
    const prevIdx = selectedRoomIndex > 0 ? selectedRoomIndex - 1 : filteredRooms.length - 1;
    setSelectedRoomId(filteredRooms[prevIdx].id);
    setIsEditingDetail(false);
  };

  const handleNextRoom = () => {
    if (filteredRooms.length === 0) return;
    const nextIdx = selectedRoomIndex < filteredRooms.length - 1 ? selectedRoomIndex + 1 : 0;
    setSelectedRoomId(filteredRooms[nextIdx].id);
    setIsEditingDetail(false);
  };

  // ─── CHECK-IN HANDLERS ────────────────────────────────────────────────────
  const handleCheckIn = async (e) => {
    e.preventDefault();
    const targetRoomIds = (checkInForm.roomIds && checkInForm.roomIds.length > 0)
      ? checkInForm.roomIds
      : (checkInForm.roomId ? [checkInForm.roomId] : []);

    if (targetRoomIds.length === 0) {
      showModal('error', 'Select Room', 'Please choose at least one available room for check-in.');
      return;
    }
    const selectedRooms = targetRoomIds.map(id => rooms.find(r => String(r.id) === String(id))).filter(Boolean);
    const primaryRoom = selectedRooms[0] || rooms.find(r => String(r.id) === String(checkInForm.roomId));
    const primaryRoomName = primaryRoom?.name || (primaryRoom?.id ? `Room ${primaryRoom.id}` : '101');
    const roomNamesList = selectedRooms.map(r => r.name || `Room ${r.id}`);

    try {
      const occupancyPayload = {
        ...checkInForm,
        roomId: targetRoomIds[0],
        roomIds: targetRoomIds,
        roomName: primaryRoomName,
        roomNames: roomNamesList,
        price: primaryRoom?.price || primaryRoom?.rate || 25,
        bedCount: checkInForm.bedCount || primaryRoom?.bedCount || 1,
        status: 'active',
        createdAt: Date.now()
      };
      // Write to Firebase (shared cloud) first
      await OccupancyService.create(occupancyPayload).catch(() => {});
      // Also sync to SQLite API (server-side backup for Telegram, etc.)
      fetch('/api/room-occupancy', {
        method: 'POST',
        ...auth,
        headers: { 'Content-Type': 'application/json', ...(auth?.headers || {}) },
        body: JSON.stringify(occupancyPayload)
      }).catch(() => {});

      // Also sync room status in Firestore if RoomService is available
      selectedRooms.forEach(r => {
        if (r.id) {
          RoomService.update(r.id, { status: 'occupied' }).catch(() => {});
        }
      });
      if (fetchAll) fetchAll();
      if (fetchDash) fetchDash();
      showModal(
        'success',
        'Check-in Successful',
        targetRoomIds.length > 1
          ? `Guest ${checkInForm.guestName} successfully checked into ${targetRoomIds.length} rooms!`
          : `Guest ${checkInForm.guestName} has been checked in.`
      );
      setCheckInForm({
        roomId: '',
        roomIds: [],
        guestName: '',
        guestPhone: '',
        guestNationality: '',
        passportOrId: '',
        bedCount: 1,
        checkInDate: today ? today() : new Date().toISOString().split('T')[0],
        checkOutDate: '',
        notes: ''
      });
    } catch (err) {
      showModal('error', 'Check-in Failed', err.message);
    }
  };

  const handleCheckOut = (guestItem) => {
    if (typeof guestItem === 'object' && guestItem !== null) {
      setCheckoutModalGuest(guestItem);
    } else {
      const found = occupancy.find(o => String(o.id) === String(guestItem));
      setCheckoutModalGuest(found || { id: guestItem });
    }
  };

  const handleStatusChange = async (roomId, status) => {
    try {
      await fetch(`/api/rooms/${roomId}/status`, {
        method: 'PATCH',
        ...auth,
        body: JSON.stringify({ status })
      });
      await RoomService.update(roomId, { status }).catch(() => {});
      if (fetchAll) fetchAll();
      if (fetchDash) fetchDash();
    } catch (err) {
      showModal('error', 'Status Change Failed', err.message);
    }
  };

  // ─── BED CATEGORY HANDLERS ────────────────────────────────────────────────
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await BedCategoryService.update(editingCategory.id, categoryForm);
        showModal('success', 'Category Updated', `Category "${categoryForm.name}" updated successfully.`);
      } else {
        await BedCategoryService.create(categoryForm);
        showModal('success', 'Category Created', `Category "${categoryForm.name}" created successfully.`);
      }
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        bedType: '1 Queen Bed',
        bedCount: 1,
        price: 25,
        capacity: 2,
        description: '',
        amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower'],
        images: []
      });
      if (fetchAll) fetchAll();
    } catch (err) {
      showModal('error', 'Category Error', err.message);
    }
  };

  const handleEditCategory = (cat) => {
    setSubSection('categories');
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name || '',
      bedType: cat.bedType || '1 Queen Bed',
      bedCount: Number(cat.bedCount || 1),
      price: Number(cat.price || 25),
      capacity: Number(cat.capacity || 2),
      description: cat.description || '',
      amenities: Array.isArray(cat.amenities) ? cat.amenities : [],
      images: Array.isArray(cat.images) ? cat.images : []
    });
  };

  const handleDeleteCategory = async (catId, catName) => {
    const assignedCount = rooms.filter(r => String(r.categoryId) === String(catId)).length;
    let confirmMsg = `Are you sure you want to delete Bed Category "${catName}"?`;
    if (assignedCount > 0) {
      confirmMsg += ` Warning: ${assignedCount} room(s) currently use this category.`;
    }
    const ok = await showConfirm('Delete Bed Category', confirmMsg, 'Delete', 'danger');
    if (!ok) return;

    try {
      await BedCategoryService.delete(catId);
      if (fetchAll) fetchAll();
      showModal('success', 'Deleted', `Category "${catName}" was deleted.`);
    } catch (err) {
      showModal('error', 'Delete Error', err.message);
    }
  };

  const handleSeedDefaultCategories = async () => {
    const ok = await showConfirm(
      'Add Default Bed Categories',
      'This will automatically add standard categories: 1 Bed (Standard Double), 2 Beds (Deluxe Twin), and 3 Beds (Family Suite). Proceed?',
      'Add Categories',
      'info'
    );
    if (!ok) return;

    try {
      for (const cat of DEFAULT_CATEGORIES) {
        await BedCategoryService.create(cat);
      }
      if (fetchAll) fetchAll();
      showModal('success', 'Standard Categories Added', 'Default bed categories have been created.');
    } catch (err) {
      showModal('error', 'Seed Error', err.message);
    }
  };

  const handleCategoryImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const dataUrl = await fileToBase64(file, 1400, 1400, 0.82);
      setCategoryForm(prev => ({ ...prev, images: [...(prev.images || []), dataUrl] }));
    }
  };

  // ─── ROOM HANDLERS ────────────────────────────────────────────────────────
  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedCat = bedCategories.find(c => String(c.id) === String(roomForm.categoryId));
      const payload = {
        ...roomForm,
        name: roomForm.name.trim(),
        price: Number(roomForm.price || selectedCat?.price || 25),
        bedType: selectedCat?.bedType || `${selectedCat?.bedCount || 1} Bed`,
        bedCount: Number(selectedCat?.bedCount || 1),
        categoryName: selectedCat?.name || 'Standard Room',
        capacity: Number(selectedCat?.capacity || 2),
        amenities: roomForm.amenities?.length > 0 ? roomForm.amenities : (selectedCat?.amenities || []),
        images: roomForm.images?.length > 0 ? roomForm.images : (selectedCat?.images || [])
      };

      if (editingRoom) {
        await RoomService.update(editingRoom.id, payload);
        showModal('success', 'Room Updated', `Room ${payload.name} has been updated.`);
      } else {
        await RoomService.create(payload);
        showModal('success', 'Room Created', `Room ${payload.name} added to catalog.`);
      }

      setEditingRoom(null);
      setRoomForm({
        name: '',
        floor: '1',
        categoryId: bedCategories[0]?.id || '',
        price: bedCategories[0]?.price || 25,
        status: 'vacant',
        description: '',
        amenities: [],
        images: []
      });
      if (fetchAll) fetchAll();
      if (fetchDash) fetchDash();
    } catch (err) {
      showModal('error', 'Room Error', err.message);
    }
  };

  const handleEditRoom = (room) => {
    setSubSection('rooms');
    setEditingRoom(room);
    setRoomForm({
      name: room.name || '',
      floor: String(room.floor || '1'),
      categoryId: String(room.categoryId || ''),
      price: Number(room.price || room.rate || 25),
      status: room.status || 'vacant',
      description: room.description || '',
      amenities: Array.isArray(room.amenities) ? room.amenities : [],
      images: Array.isArray(room.images) ? room.images : []
    });
  };

  const handleDeleteRoom = async (roomId, roomName) => {
    const ok = await showConfirm(
      'Delete Room',
      `Are you sure you want to delete Room "${roomName}"? This will remove it from the system and public website.`,
      'Delete',
      'danger'
    );
    if (!ok) return;

    try {
      await RoomService.delete(roomId);
      if (selectedRoomId === roomId) setSelectedRoomId(null);
      if (fetchAll) fetchAll();
      if (fetchDash) fetchDash();
      showModal('success', 'Room Deleted', `Room "${roomName}" has been removed.`);
    } catch (err) {
      showModal('error', 'Delete Error', err.message);
    }
  };

  const handleRoomImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const dataUrl = await fileToBase64(file, 1400, 1400, 0.82);
      setRoomForm(prev => ({ ...prev, images: [...(prev.images || []), dataUrl] }));
    }
  };

  const handleQuickCheckInToRoom = (room) => {
    setCheckInForm({
      roomId: room.id,
      guestName: '',
      guestPhone: '',
      guestNationality: '',
      passportOrId: '',
      bedCount: room.bedCount || 1,
      checkInDate: today ? today() : new Date().toISOString().split('T')[0],
      checkOutDate: '',
      notes: ''
    });
    setSelectedRoomId(null);
    setSubSection('occupancy');
  };

  // ─── INLINE DETAIL EDIT HELPERS ────────────────────────────────────────────
  const startEditingDetail = (room) => {
    setDetailEditForm({
      name: room.name || '',
      floor: String(room.floor || '1'),
      categoryId: String(room.categoryId || ''),
      price: Number(room.price || room.rate || 25),
      status: room.status || 'vacant',
      description: room.description || '',
      amenities: Array.isArray(room.amenities) ? [...room.amenities] : [],
      images: Array.isArray(room.images) ? [...room.images] : [],
      bedType: room.bedType || '',
      bedCount: Number(room.bedCount || 1),
      capacity: Number(room.capacity || 2)
    });
    setIsEditingDetail(true);
  };

  const cancelEditingDetail = () => {
    setIsEditingDetail(false);
  };

  const handleDetailImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const dataUrl = await fileToBase64(file, 1400, 1400, 0.82);
      setDetailEditForm(prev => ({ ...prev, images: [...(prev.images || []), dataUrl] }));
    }
  };

  const saveDetailEdit = async () => {
    try {
      const selectedCat = bedCategories.find(c => String(c.id) === String(detailEditForm.categoryId));
      const payload = {
        ...detailEditForm,
        name: detailEditForm.name.trim(),
        price: Number(detailEditForm.price || selectedCat?.price || 25),
        bedType: detailEditForm.bedType || selectedCat?.bedType || `${selectedCat?.bedCount || 1} Bed`,
        bedCount: Number(detailEditForm.bedCount || selectedCat?.bedCount || 1),
        categoryName: selectedCat?.name || 'Standard Room',
        capacity: Number(detailEditForm.capacity || selectedCat?.capacity || 2),
        amenities: detailEditForm.amenities?.length > 0 ? detailEditForm.amenities : (selectedCat?.amenities || []),
        images: detailEditForm.images?.length > 0 ? detailEditForm.images : (selectedCat?.images || [])
      };

      await RoomService.update(selectedRoomId, payload);
      setIsEditingDetail(false);
      if (fetchAll) fetchAll();
      if (fetchDash) fetchDash();
      showModal('success', 'Room Updated', `Room ${payload.name} has been updated successfully.`);
    } catch (err) {
      showModal('error', 'Update Error', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Sub navigation switch ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-stone-200/70 rounded-2xl w-full">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubSection('rooms')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              subSection === 'rooms' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-door-open text-brand-500 text-sm"></i>
            <span>Rooms Catalog & Detail (បញ្ជីបន្ទប់ និងព័ត៌មានលម្អិត)</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-mono">
              {rooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubSection('categories')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              subSection === 'categories' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-layer-group text-indigo-500 text-sm"></i>
            <span>Bed Categories (ប្រភេទគ្រែ / Category Bed)</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-mono">
              {bedCategories.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubSection('bookings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              subSection === 'bookings' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-calendar-check text-indigo-600 text-sm"></i>
            <span>Room Bookings (ការកក់បន្ទប់អតិថិជន)</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-mono">
              {bookings.filter(b => b.type === 'room' || b.roomId || String(b.itemName || '').toLowerCase().includes('room')).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubSection('occupancy')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              subSection === 'occupancy' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <i className="fa-solid fa-bed text-emerald-500 text-sm"></i>
            <span>Check-in & Occupancy (ការកក់ និង Check-in)</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-mono">
              {activeOccupancy.length} active
            </span>
          </button>
        </div>

        {/* Quick stat summary pills */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/70 rounded-xl text-xs text-stone-600">
          <span className="flex items-center gap-1 font-bold text-emerald-700">
            <i className="fa-solid fa-circle text-[8px] text-emerald-500"></i>
            {rooms.filter(r => r.status === 'vacant').length} Vacant
          </span>
          <span className="text-stone-300">|</span>
          <span className="flex items-center gap-1 font-bold text-blue-700">
            <i className="fa-solid fa-circle text-[8px] text-blue-500"></i>
            {rooms.filter(r => r.status === 'occupied').length} Occupied
          </span>
          <span className="text-stone-300">|</span>
          <span className="flex items-center gap-1 font-bold text-amber-700">
            <i className="fa-solid fa-circle text-[8px] text-amber-500"></i>
            {rooms.filter(r => r.status === 'cleaning').length} Cleaning
          </span>
        </div>

        {/* Print & Alert to Telegram Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="បោះពុម្ពបញ្ជីបន្ទប់ (Print Rooms)"
          >
            <i className="fa-solid fa-print text-stone-600"></i>
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleRoomsTelegramAlert}
            disabled={tgSending || localTgSending}
            className="px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
            title="ផ្ញើស្ថានភាពបន្ទប់ទៅ Telegram"
          >
            <i className="fa-brands fa-telegram text-sky-500"></i>
            <span>Alert Telegram</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="print-only mb-4 p-4 border-b border-stone-300">
        <h2 className="text-xl font-bold">Motorental Siemreab Angkor & Guesthouse</h2>
        <p className="text-sm text-stone-700 font-semibold">Rooms Inventory & Accommodation Status Report</p>
        <p className="text-xs text-stone-500">Total Rooms: {rooms.length} | Bed Categories: {bedCategories.length} | Printed: {new Date().toLocaleString()}</p>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* ROOM BOOKINGS SUB-TAB ("See All Customer Bookings")                  */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subSection === 'bookings' && (
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
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 1. BED CATEGORIES MANAGEMENT ("First Create Category Bed")          */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subSection === 'categories' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Category Form */}
            <div className={`${cardCls} p-6 h-fit sticky top-8`}>
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-bed text-indigo-500"></i>
                    {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create Category Bed'}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">Define bed type, capacity & standard nightly rate</p>
                </div>
                {editingCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryForm({
                        name: '',
                        bedType: '1 Queen Bed',
                        bedCount: 1,
                        price: 25,
                        capacity: 2,
                        description: '',
                        amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower'],
                        images: []
                      });
                    }}
                    className="text-xs font-bold text-stone-400 hover:text-stone-700"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleCategorySubmit} className="space-y-4 text-sm">
                <div>
                  <label className={labelCls}>Category Name</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="e.g. 1 Bed - Standard Double or Family Suite"
                    className={inputCls}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Bed Count</label>
                    <select
                      value={categoryForm.bedCount}
                      onChange={e => {
                        const count = parseInt(e.target.value);
                        setCategoryForm({
                          ...categoryForm,
                          bedCount: count,
                          bedType: count === 1 ? '1 Queen Bed' : (count === 2 ? '2 Single Beds' : `${count} Beds`),
                          capacity: count * 2 > 6 ? 6 : count * 2
                        });
                      }}
                      className={inputCls}
                    >
                      <option value={1}>1 Bed (គ្រែ ១)</option>
                      <option value={2}>2 Beds (គ្រែ ២)</option>
                      <option value={3}>3 Beds (គ្រែ ៣)</option>
                      <option value={4}>4 Beds (គ្រែ ៤)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Nightly Price ($)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={categoryForm.price}
                      onChange={e => setCategoryForm({ ...categoryForm, price: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Bed Specification</label>
                    <input
                      type="text"
                      value={categoryForm.bedType}
                      onChange={e => setCategoryForm({ ...categoryForm, bedType: e.target.value })}
                      placeholder="e.g. 1 King Bed or 2 Single Beds"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Max Capacity (Guests)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={categoryForm.capacity}
                      onChange={e => setCategoryForm({ ...categoryForm, capacity: parseInt(e.target.value) || 2 })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    rows="3"
                    value={categoryForm.description}
                    onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Comfortable room with private bath, garden view, quiet atmosphere..."
                    className={inputCls}
                  ></textarea>
                </div>

                {/* Amenities */}
                <div>
                  <label className={labelCls}>Standard Amenities</label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                    {ALL_AMENITIES.map(amenity => {
                      const checked = (categoryForm.amenities || []).includes(amenity);
                      return (
                        <label key={amenity} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const cur = categoryForm.amenities || [];
                              const updated = e.target.checked ? [...cur, amenity] : cur.filter(a => a !== amenity);
                              setCategoryForm({ ...categoryForm, amenities: updated });
                            }}
                            className="w-4 h-4 accent-indigo-600 rounded"
                          />
                          <span className="truncate">{amenity}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Photos */}
                <div>
                  <label className={labelCls}>Category Photos</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCategoryImageUpload}
                    className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(categoryForm.images || []).map((img, i) => (
                      <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-stone-200">
                        <img src={img} alt="Category Photo" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const arr = [...categoryForm.images];
                            arr.splice(i, 1);
                            setCategoryForm({ ...categoryForm, images: arr });
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button type="submit" className={`${btnPrimary} flex-1 justify-center bg-indigo-600 hover:bg-indigo-700`}>
                    <i className="fa-solid fa-check mr-1.5"></i>
                    {editingCategory ? 'Update Bed Category' : 'Save Bed Category'}
                  </button>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryForm({
                          name: '',
                          bedType: '1 Queen Bed',
                          bedCount: 1,
                          price: 25,
                          capacity: 2,
                          description: '',
                          amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower'],
                          images: []
                        });
                      }}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Categories List View */}
            <div className="xl:col-span-2 space-y-4">
              <div className={`${cardCls} p-5 flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <h3 className="font-bold text-stone-900 text-base">Configured Bed Categories ({bedCategories.length})</h3>
                  <p className="text-xs text-stone-500">Each physical room is linked to one of these bed categories</p>
                </div>
                {bedCategories.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedDefaultCategories}
                    className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    Add Standard 1/2/3 Bed Categories
                  </button>
                )}
              </div>

              {bedCategories.length === 0 ? (
                <div className={`${cardCls} p-12 text-center text-stone-400 space-y-4`}>
                  <i className="fa-solid fa-bed text-5xl opacity-25"></i>
                  <div>
                    <h4 className="font-bold text-stone-700 text-sm">No Bed Categories Created Yet</h4>
                    <p className="text-xs text-stone-400 max-w-md mx-auto mt-1">
                      Create your bed categories above (or click below to add standard 1 Bed, 2 Beds, and 3 Beds categories).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSeedDefaultCategories}
                    className="px-4 py-2 text-xs font-bold bg-brand-500 text-white rounded-xl shadow hover:bg-brand-600 transition-colors"
                  >
                    <i className="fa-solid fa-plus mr-1"></i> Add Default Bed Categories Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bedCategories.map(cat => {
                    const assignedRooms = rooms.filter(r => String(r.categoryId) === String(cat.id));
                    const coverImg = (cat.images && cat.images[0]) || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80';
                    return (
                      <div key={cat.id} className={`${cardCls} overflow-hidden flex flex-col justify-between border-stone-200 hover:shadow-md transition-shadow`}>
                        <div>
                          {/* Image & Price Header */}
                          <div className="relative h-44 bg-stone-100 overflow-hidden group">
                            <img src={coverImg} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                              <i className="fa-solid fa-bed text-indigo-400"></i>
                              <span>{cat.bedCount} Bed{cat.bedCount > 1 ? 's' : ''}</span>
                            </div>
                            <div className="absolute top-3 right-3 bg-brand-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">
                              ${cat.price} / night
                            </div>
                          </div>

                          <div className="p-4 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-stone-900 text-base">{cat.name}</h4>
                                <p className="text-xs font-medium text-indigo-600 flex items-center gap-1.5 mt-0.5">
                                  <i className="fa-solid fa-moon text-[11px]"></i>
                                  {cat.bedType || `${cat.bedCount} Bed`} • Max {cat.capacity || 2} Guests
                                </p>
                              </div>
                            </div>

                            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                              {cat.description || 'Standard clean and comfortable room with hot shower and Wi-Fi.'}
                            </p>

                            {/* Amenities summary */}
                            {cat.amenities && cat.amenities.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {cat.amenities.slice(0, 4).map(a => (
                                  <span key={a} className="text-[10px] font-bold px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md flex items-center gap-1">
                                    <i className={`fa-solid ${AMENITY_ICONS[a] || 'fa-check'} text-[9px] text-indigo-500`}></i>
                                    {a}
                                  </span>
                                ))}
                                {cat.amenities.length > 4 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-400 rounded-md">
                                    +{cat.amenities.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer: Assigned Rooms & Actions */}
                        <div className="p-4 pt-2 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between">
                          <div className="text-xs font-bold text-stone-600">
                            <span className="text-indigo-600 font-black mr-1">{assignedRooms.length}</span>
                            Rooms assigned
                            {assignedRooms.length > 0 && (
                              <span className="text-[11px] text-stone-400 ml-1 font-normal">
                                ({assignedRooms.map(r => r.name).slice(0, 4).join(', ')}{assignedRooms.length > 4 ? '...' : ''})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleEditCategory(cat)}
                              className="w-8 h-8 flex items-center justify-center text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors shadow-xs"
                              title="Edit Category"
                            >
                              <i className="fa-solid fa-pen text-xs"></i>
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="w-8 h-8 flex items-center justify-center text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors shadow-xs"
                              title="Delete Category"
                            >
                              <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 2. ROOMS CATALOG & DETAIL VIEW ONE BY ONE                           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subSection === 'rooms' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Add / Edit Room Form */}
            <div className={`${cardCls} p-6 h-fit sticky top-8`}>
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                    <i className="fa-solid fa-hotel text-brand-500"></i>
                    {editingRoom ? `Edit Room ${editingRoom.name}` : 'Add Physical Room'}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">Assign room number and link to a Bed Category</p>
                </div>
                {editingRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRoom(null);
                      setRoomForm({
                        name: '',
                        floor: '1',
                        categoryId: bedCategories[0]?.id || '',
                        price: bedCategories[0]?.price || 25,
                        status: 'vacant',
                        description: '',
                        amenities: [],
                        images: []
                      });
                    }}
                    className="text-xs font-bold text-stone-400 hover:text-stone-700"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleRoomSubmit} className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Room Name / Number</label>
                    <input
                      type="text"
                      value={roomForm.name}
                      onChange={e => setRoomForm({ ...roomForm, name: e.target.value })}
                      placeholder="e.g. 101, 102 or Deluxe 201"
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Floor</label>
                    <input
                      type="text"
                      value={roomForm.floor}
                      onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })}
                      placeholder="1"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Bed Category Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls}>Category Bed (ប្រភេទគ្រែ)</label>
                    <button
                      type="button"
                      onClick={() => setSubSection('categories')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      + Manage Categories
                    </button>
                  </div>
                  <select
                    value={roomForm.categoryId}
                    onChange={e => {
                      const selCat = bedCategories.find(c => String(c.id) === String(e.target.value));
                      setRoomForm({
                        ...roomForm,
                        categoryId: e.target.value,
                        price: selCat?.price || roomForm.price,
                        amenities: selCat?.amenities || roomForm.amenities
                      });
                    }}
                    className={inputCls}
                    required
                  >
                    <option value="">Select Bed Category...</option>
                    {bedCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.bedCount} Bed{cat.bedCount > 1 ? 's' : ''} — ${cat.price}/night)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nightly Rate ($)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={roomForm.price}
                      onChange={e => setRoomForm({ ...roomForm, price: parseFloat(e.target.value) || 0 })}
                      className={inputCls}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Room Status</label>
                    <select
                      value={roomForm.status}
                      onChange={e => setRoomForm({ ...roomForm, status: e.target.value })}
                      className={inputCls}
                    >
                      <option value="vacant">Vacant (ទំនេរ)</option>
                      <option value="occupied">Occupied (មានភ្ញៀវ)</option>
                      <option value="cleaning">Cleaning (កំពុងសម្អាត)</option>
                      <option value="maintenance">Maintenance (ជួសជុល)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Specific Room Notes (Optional)</label>
                  <textarea
                    rows="2"
                    value={roomForm.description}
                    onChange={e => setRoomForm({ ...roomForm, description: e.target.value })}
                    placeholder="Corner room, extra quiet, garden view window..."
                    className={inputCls}
                  ></textarea>
                </div>

                {/* Custom photos */}
                <div>
                  <label className={labelCls}>Upload Room Photos (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleRoomImageUpload}
                    className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(roomForm.images || []).map((img, i) => (
                      <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-stone-200">
                        <img src={img} alt="Room Photo" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const arr = [...roomForm.images];
                            arr.splice(i, 1);
                            setRoomForm({ ...roomForm, images: arr });
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button type="submit" className={`${btnPrimary} flex-1 justify-center`}>
                    <i className="fa-solid fa-check mr-1.5"></i>
                    {editingRoom ? 'Update Room' : 'Add Room to Catalog'}
                  </button>
                  {editingRoom && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoom(null);
                        setRoomForm({
                          name: '',
                          floor: '1',
                          categoryId: bedCategories[0]?.id || '',
                          price: bedCategories[0]?.price || 25,
                          status: 'vacant',
                          description: '',
                          amenities: [],
                          images: []
                        });
                      }}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Room Directory & Filters */}
            <div className="xl:col-span-2 space-y-4">
              {/* Filter Bar */}
              <div className={`${cardCls} p-4 space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-stone-900 text-base">Rooms Directory ({filteredRooms.length} of {rooms.length})</h3>
                    <p className="text-xs text-stone-500">Click any room card to open the room detail view one by one</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={roomSortBy}
                      onChange={e => setRoomSortBy(e.target.value)}
                      className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-700 outline-none focus:border-brand-500 cursor-pointer shadow-2xs"
                      title="តម្រៀបបន្ទប់ (Sort rooms)"
                    >
                      <option value="name-asc">លេខបន្ទប់: A ដល់ Z (1-9)</option>
                      <option value="name-desc">លេខបន្ទប់: Z ដល់ A (9-1)</option>
                      <option value="price-asc">តម្លៃ: ទាបទៅខ្ពស់</option>
                      <option value="price-desc">តម្លៃ: ខ្ពស់ទៅទាប</option>
                      <option value="floor-asc">ជាន់: ទាបទៅខ្ពស់</option>
                      <option value="status">តាមស្ថានភាពបន្ទប់</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Search room number..."
                      value={roomSearch}
                      onChange={e => setRoomSearch(e.target.value)}
                      className={`${inputCls} w-44 text-xs py-1.5`}
                    />
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100 text-xs">
                  <span className="font-bold text-stone-400 uppercase tracking-wider text-[10px] mr-1">Bed Category:</span>
                  <button
                    type="button"
                    onClick={() => setCatFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      catFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    All ({rooms.length})
                  </button>
                  {bedCategories.map(cat => {
                    const count = rooms.filter(r => String(r.categoryId) === String(cat.id)).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCatFilter(cat.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          String(catFilter) === String(cat.id) ? 'bg-indigo-600 text-white shadow-xs' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {cat.name} ({count})
                      </button>
                    );
                  })}

                  <span className="text-stone-300 mx-1">|</span>

                  <span className="font-bold text-stone-400 uppercase tracking-wider text-[10px] mr-1">Status:</span>
                  {['all', 'vacant', 'occupied', 'cleaning', 'maintenance'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold capitalize transition-all ${
                        statusFilter === st ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rooms Grid */}
              {filteredRooms.length === 0 ? (
                <div className={`${cardCls} p-12 text-center text-stone-400 space-y-3`}>
                  <i className="fa-solid fa-door-open text-5xl opacity-25"></i>
                  <p className="text-sm font-bold text-stone-600">No rooms match your filter criteria.</p>
                  <p className="text-xs text-stone-400">Add a new room or reset filters above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRooms.map(room => {
                    const occ = activeOccupancy.find(o => String(o.roomId) === String(room.id));
                    const roomImgs = Array.isArray(room.images) && room.images.length > 0
                      ? room.images
                      : (room.imageUrl ? [room.imageUrl] : ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=500&q=80']);

                    return (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`${cardCls} overflow-hidden cursor-pointer group hover:border-brand-400 hover:shadow-lg transition-all flex flex-col justify-between`}
                      >
                        <div>
                          {/* Image & Badges */}
                          <div className="relative h-40 bg-stone-100 overflow-hidden">
                            <img src={roomImgs[0]} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute top-2.5 left-2.5">
                              <span className={`px-2 py-1 rounded-full text-[11px] font-bold shadow-sm capitalize border ${statusBadgeColors[room.status] || 'bg-stone-100 text-stone-600'}`}>
                                <i className={`fa-solid ${statusIcons[room.status] || 'fa-circle'} mr-1 text-[10px]`}></i>
                                {room.status}
                              </span>
                            </div>
                            <div className="absolute top-2.5 right-2.5 bg-stone-900/80 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-xs font-black shadow-sm">
                              ${room.price || room.rate || 25} / night
                            </div>
                            <div className="absolute bottom-2 left-2.5 bg-white/90 backdrop-blur-md text-stone-700 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs">
                              Floor {room.floor || '1'}
                            </div>
                          </div>

                          {/* Body */}
                          <div className="p-4 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-black text-stone-900 text-lg group-hover:text-brand-600 transition-colors">
                                  Room {room.name}
                                </h4>
                                <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold mt-0.5">
                                  <i className="fa-solid fa-bed text-[11px]"></i>
                                  <span>{room.categoryName || `${room.bedCount || 1} Bed Room`}</span>
                                </div>
                              </div>
                            </div>

                            {/* Occupant Note */}
                            {occ ? (
                              <div className="p-2 bg-blue-50/80 rounded-xl border border-blue-100 text-xs text-blue-900">
                                <div className="font-bold flex items-center justify-between">
                                  <span className="truncate">{occ.guestName}</span>
                                  <span className="text-[10px] bg-blue-200/70 text-blue-800 px-1.5 py-0.2 rounded font-mono">In</span>
                                </div>
                                <div className="text-[11px] text-blue-600 mt-0.5 flex items-center justify-between">
                                  <span>Out: {occ.checkOutDate}</span>
                                  <span>{occ.guestPhone || ''}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="p-2 bg-stone-50 rounded-xl border border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
                                <span>{room.bedType || `${room.bedCount || 1} Bed`}</span>
                                <span className="font-bold text-emerald-600">Available</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Detail button */}
                        <div className="p-3 pt-0 border-t border-stone-100/70 flex items-center justify-between mt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRoomId(room.id);
                            }}
                            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                          >
                            <i className="fa-solid fa-circle-info"></i>
                            <span>View Detail (មើលលម្អិត)</span>
                          </button>

                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleEditRoom(room)}
                              className="w-7 h-7 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Room"
                            >
                              <i className="fa-solid fa-pen text-xs"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRoom(room.id, room.name)}
                              className="w-7 h-7 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Room"
                            >
                              <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 3. CHECK-IN & OCCUPANCY TAB                                          */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {subSection === 'occupancy' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Check-in Form */}
          <div className={`${cardCls} p-6 h-fit sticky top-8`}>
            <h3 className="font-bold text-stone-900 mb-5 flex items-center gap-2">
              <i className="fa-solid fa-right-to-bracket text-emerald-500"></i>
              <span>New Check-in (ការចុះឈ្មោះភ្ញៀវចូលស្នាក់នៅ)</span>
            </h3>
            <form onSubmit={handleCheckIn} className="space-y-4 text-sm">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls}>Select Room(s)</label>
                  <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
                    {checkInForm.roomIds && checkInForm.roomIds.length > 1
                      ? `Multi-Room (${checkInForm.roomIds.length} Selected)`
                      : 'Single or Multi-Room'}
                  </span>
                </div>

                <select
                  value={checkInForm.roomId}
                  onChange={e => {
                    const selectedVal = e.target.value;
                    const r = rooms.find(rm => String(rm.id) === String(selectedVal));
                    setCheckInForm(prev => {
                      const newIds = selectedVal
                        ? (prev.roomIds && prev.roomIds.length > 1 && prev.roomIds.some(id => String(id) === String(selectedVal))
                            ? prev.roomIds
                            : [selectedVal])
                        : [];
                      return {
                        ...prev,
                        roomId: selectedVal,
                        roomIds: newIds,
                        bedCount: r?.bedCount || 1
                      };
                    });
                  }}
                  className={inputCls}
                  required={!(checkInForm.roomIds && checkInForm.roomIds.length > 0)}
                >
                  <option value="">Choose a vacant room...</option>
                  {rooms.filter(r => r.status === 'vacant').map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.name} — Floor {r.floor || '1'} — {r.categoryName || `${r.bedCount || 1} Bed`} (${r.price || r.rate}/night)
                    </option>
                  ))}
                </select>

                {/* Multi-Room Quick Chips: Let customer open 2+ rooms at once */}
                {rooms.filter(r => r.status === 'vacant').length > 0 && (
                  <div className="mt-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 mb-1.5">
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-layer-group text-brand-600"></i>
                        <span>Select Multiple Rooms (បើកបន្ទប់ច្រើន):</span>
                      </span>
                      {checkInForm.roomIds && checkInForm.roomIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCheckInForm(prev => ({ ...prev, roomIds: [], roomId: '' }))}
                          className="text-stone-400 hover:text-stone-700 text-[10px] cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {rooms.filter(r => r.status === 'vacant').map(r => {
                        const isSelected = checkInForm.roomIds && (
                          checkInForm.roomIds.includes(r.id) ||
                          checkInForm.roomIds.includes(String(r.id)) ||
                          String(checkInForm.roomId) === String(r.id)
                        );
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setCheckInForm(prev => {
                                const current = prev.roomIds && prev.roomIds.length > 0
                                  ? [...prev.roomIds]
                                  : (prev.roomId ? [prev.roomId] : []);
                                const exists = current.some(id => String(id) === String(r.id));
                                let updated;
                                if (exists) {
                                  updated = current.filter(id => String(id) !== String(r.id));
                                } else {
                                  updated = [...current, r.id];
                                }
                                return {
                                  ...prev,
                                  roomIds: updated,
                                  roomId: updated[0] ? String(updated[0]) : ''
                                };
                              });
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                            }`}
                            title={`Floor ${r.floor || '1'} • ${r.categoryName || 'Room'} • $${r.price || r.rate}/night`}
                          >
                            <i className={`fa-solid ${isSelected ? 'fa-check text-[10px]' : 'fa-plus text-[10px] text-stone-400'}`}></i>
                            <span>Room {r.name}</span>
                            <span className="text-[10px] opacity-75">(${r.price || r.rate})</span>
                          </button>
                        );
                      })}
                    </div>
                    {checkInForm.roomIds && checkInForm.roomIds.length > 1 && (
                      <div className="mt-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 flex items-center justify-between">
                        <span>
                          <i className="fa-solid fa-hotel mr-1 text-emerald-600"></i>
                          <strong>{checkInForm.roomIds.length} rooms</strong> selected for {checkInForm.guestName || 'this guest'}!
                        </span>
                        <span className="font-mono font-bold">
                          ${checkInForm.roomIds.reduce((sum, id) => {
                            const found = rooms.find(rm => String(rm.id) === String(id));
                            return sum + (Number(found?.price || found?.rate) || 25);
                          }, 0)}/night
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className={labelCls}>Guest Name</label>
                <input
                  type="text"
                  value={checkInForm.guestName}
                  onChange={e => {
                    setCheckInForm({ ...checkInForm, guestName: e.target.value });
                    setGuestSuggestOpen(true);
                  }}
                  onFocus={() => setGuestSuggestOpen(true)}
                  placeholder="Full name of guest"
                  className={inputCls}
                  required
                />
                {/* Autocomplete dropdown for registered customers */}
                {guestSuggestOpen && customerSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl z-30 p-1.5 space-y-1 anim-fade-in">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between border-b border-stone-100">
                      <span>Select Existing Customer</span>
                      <button type="button" onClick={() => setGuestSuggestOpen(false)} className="text-stone-400 hover:text-stone-700">✕</button>
                    </div>
                    {customerSuggestions.map((c, i) => (
                      <button
                        key={c.id || i}
                        type="button"
                        onClick={() => {
                          setCheckInForm(prev => ({
                            ...prev,
                            guestName: c.name || prev.guestName,
                            guestPhone: c.phone || prev.guestPhone,
                            guestNationality: c.nationality || prev.guestNationality,
                            passportOrId: c.passportOrId || c.passportId || prev.passportOrId
                          }));
                          setGuestSuggestOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-brand-50 rounded-xl transition flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-xs text-stone-900 group-hover:text-brand-700">{c.name}</p>
                          <p className="text-[11px] text-stone-500">
                            {c.phone ? `📞 ${c.phone}` : ''} {c.nationality ? `• 🌍 ${c.nationality}` : ''}
                          </p>
                        </div>
                        {(c.passportOrId || c.passportId) && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-stone-100 group-hover:bg-brand-100 text-stone-700 rounded-md">
                            🆔 {c.passportOrId || c.passportId}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <input
                    type="text"
                    value={checkInForm.guestPhone}
                    onChange={e => setCheckInForm({ ...checkInForm, guestPhone: e.target.value })}
                    placeholder="+855 ..."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Nationality</label>
                  <input
                    type="text"
                    value={checkInForm.guestNationality}
                    onChange={e => setCheckInForm({ ...checkInForm, guestNationality: e.target.value })}
                    placeholder="e.g. Cambodian, French"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  <i className="fa-solid fa-id-card text-brand-600 mr-1.5"></i>
                  Passport / National ID (លេខលិខិតឆ្លងដែន / អត្តសញ្ញាណប័ណ្ណ)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={checkInForm.passportOrId}
                    onChange={e => setCheckInForm({ ...checkInForm, passportOrId: e.target.value })}
                    placeholder="e.g. N01234567 or Cambodian ID"
                    className={`${inputCls} font-mono`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none text-xs">
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">Required for security database & Sangkat police reporting</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Beds</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={checkInForm.bedCount}
                    onChange={e => setCheckInForm({ ...checkInForm, bedCount: parseInt(e.target.value) || 1 })}
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Check-in Date</label>
                  <input
                    type="date"
                    value={checkInForm.checkInDate}
                    onChange={e => setCheckInForm({ ...checkInForm, checkInDate: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Check-out Date</label>
                <input
                  type="date"
                  value={checkInForm.checkOutDate}
                  onChange={e => setCheckInForm({ ...checkInForm, checkOutDate: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Special Notes</label>
                <textarea
                  rows="2"
                  value={checkInForm.notes}
                  onChange={e => setCheckInForm({ ...checkInForm, notes: e.target.value })}
                  placeholder="Passport ID, extra towel, early check-out..."
                  className={inputCls}
                ></textarea>
              </div>

              <button type="submit" className={`${btnPrimary} w-full justify-center shadow-md`}>
                <i className="fa-solid fa-right-to-bracket mr-2"></i> Check In Guest
              </button>
            </form>
          </div>

          {/* Room Overview + Active Stays */}
          <div className="xl:col-span-2 space-y-6">
            {/* ───────────────────────────────────────────────────────────── */}
            {/* ROOM STATUS OVERVIEW (BY FLOOR: 3 TOP, 2 CENTER, 1 BOTTOM)    */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className={`${cardCls} p-6 border-2 border-stone-200 shadow-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-stone-900 text-base">Room Status Overview ({rooms.length})</h3>
                    <span className="px-2 py-0.5 rounded-full bg-stone-900 text-amber-400 font-mono font-bold text-xs shadow-2xs">
                      {roomsByFloor.length} Floors
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Architectural floor layout: Floor 3 (Top) • Floor 2 (Center) • Floor 1 (Bottom)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubSection('rooms')}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-xl border border-brand-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage Rooms</span>
                  <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
              </div>

              {/* Status Color Legend & Interactive Filter Bar */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-stone-100/90 border border-stone-200 rounded-2xl mb-6 shadow-2xs">
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider pl-1 mr-1 flex items-center gap-1">
                  <i className="fa-solid fa-palette text-stone-400"></i>
                  <span>Status Legend:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setOverviewStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    overviewStatusFilter === 'all'
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-white hover:bg-stone-200 text-stone-700 border border-stone-200'
                  }`}
                >
                  <span>All ({rooms.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewStatusFilter('vacant')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    overviewStatusFilter === 'vacant'
                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                  title="Filter Vacant Rooms"
                >
                  <i className="fa-solid fa-circle-check text-emerald-500 text-[11px]"></i>
                  <span>Vacant (ទំនេរ)</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-200/80 text-emerald-900 text-[10px] font-black">
                    {rooms.filter(r => r.status === 'vacant').length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewStatusFilter('occupied')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    overviewStatusFilter === 'occupied'
                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300'
                  }`}
                  title="Filter Occupied Rooms"
                >
                  <i className="fa-solid fa-user-check text-blue-500 text-[11px]"></i>
                  <span>Occupied (មានភ្ញៀវ)</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-blue-200/80 text-blue-900 text-[10px] font-black">
                    {rooms.filter(r => r.status === 'occupied').length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewStatusFilter('cleaning')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    overviewStatusFilter === 'cleaning'
                      ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                  title="Filter Cleaning Rooms"
                >
                  <i className="fa-solid fa-broom text-amber-500 text-[11px]"></i>
                  <span>Cleaning (សម្អាត)</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-amber-200/80 text-amber-950 text-[10px] font-black">
                    {rooms.filter(r => r.status === 'cleaning').length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewStatusFilter('maintenance')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    overviewStatusFilter === 'maintenance'
                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                  title="Filter Maintenance Rooms"
                >
                  <i className="fa-solid fa-wrench text-rose-500 text-[11px]"></i>
                  <span>Maintenance (ជួសជុល)</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-rose-200/80 text-rose-950 text-[10px] font-black">
                    {rooms.filter(r => r.status === 'maintenance').length}
                  </span>
                </button>
              </div>

              {/* Floors Stacked: Floor 3/4 (Top) -> Floor 2 (Center) -> Floor 1 (Bottom) */}
              <div className="space-y-6">
                {roomsByFloor.map((floorData) => (
                  <div key={floorData.floorNumber} className="bg-stone-50/70 p-4 rounded-3xl border border-stone-200 space-y-3.5">
                    {/* Floor Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-200/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center text-xs font-black shadow-xs">
                          <i className="fa-solid fa-building"></i>
                        </div>
                        <div>
                          <span className="font-black text-stone-900 text-sm">
                            {floorData.floorTitle}
                          </span>
                          <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${floorData.positionColor}`}>
                            {floorData.positionTag}
                          </span>
                        </div>
                      </div>

                      {/* Floor Mini Counter Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                        <span className="text-[11px] text-stone-500 font-medium mr-1">
                          {floorData.totalCount} Rooms:
                        </span>
                        {floorData.vacantCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] border border-emerald-200">
                            {floorData.vacantCount} Vacant
                          </span>
                        )}
                        {floorData.occupiedCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] border border-blue-200">
                            {floorData.occupiedCount} Occupied
                          </span>
                        )}
                        {floorData.cleaningCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] border border-amber-200">
                            {floorData.cleaningCount} Cleaning
                          </span>
                        )}
                        {floorData.maintenanceCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 text-[10px] border border-rose-200">
                            {floorData.maintenanceCount} Maint.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Room Grid for this Floor */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {floorData.rooms.map(room => {
                        const occ = activeOccupancy.find(o => String(o.roomId) === String(room.id));
                        return (
                          <div
                            key={room.id}
                            onClick={() => setSelectedRoomId(room.id)}
                            className={`rounded-2xl border-2 p-3.5 transition-all cursor-pointer hover:shadow-lg relative overflow-hidden flex flex-col justify-between ${statusColors[room.status] || statusColors.vacant}`}
                          >
                            <div>
                              {/* Top Bar: Room Name & Status Badge */}
                              <div className="flex items-center justify-between mb-1.5 gap-1">
                                <span className="text-base font-black text-stone-900">
                                  Room {room.name}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shadow-2xs ${statusBadgeColors[room.status] || statusBadgeColors.vacant}`}>
                                  <i className={`fa-solid ${statusIcons[room.status] || statusIcons.vacant} text-[9px]`}></i>
                                  <span>{room.status}</span>
                                </span>
                              </div>

                              <p className="text-[11px] font-semibold text-stone-600 truncate mb-2">
                                {room.categoryName || `${room.bedCount || 1} Bed`}
                              </p>

                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-[11px] text-stone-500 font-medium capitalize">
                                  Fl. {room.floor || floorData.floorNumber}
                                </span>
                                <span className="font-black text-stone-900 text-sm">
                                  ${room.price || room.rate}
                                </span>
                              </div>

                              {/* In-House Guest Details if Occupied */}
                              {occ && (
                                <div className="pt-2 border-t border-blue-200/80 bg-blue-100/50 -mx-3.5 px-3.5 pb-1 text-xs">
                                  <p className="font-bold truncate text-blue-950 flex items-center gap-1">
                                    <i className="fa-solid fa-user text-[10px] text-blue-600"></i>
                                    <span>{occ.guestName}</span>
                                  </p>
                                  <p className="text-[10px] text-blue-800 font-medium mt-0.5">
                                    Out: {occ.checkOutDate || 'Open'}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Quick Status Buttons with Dedicated Colors */}
                            <div className="mt-2.5 pt-2 border-t border-black/5 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                              {['vacant', 'occupied', 'cleaning', 'maintenance']
                                .filter(s => s !== room.status)
                                .map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleStatusChange(room.id, s)}
                                    className={`text-[9px] font-black px-2 py-1 rounded-lg border capitalize transition-all cursor-pointer shadow-2xs ${statusButtonColors[s] || 'bg-white text-stone-700'}`}
                                    title={`Change status to ${s}`}
                                  >
                                    → {s}
                                  </button>
                                ))}
                            </div>
                          </div>
                        );
                      })}
                      {floorData.rooms.length === 0 && (
                        <div className="col-span-full py-6 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
                          No rooms on {floorData.floorTitle} match the selected filter.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* ACTIVE CHECKED-IN GUESTS (EASY VIEW & SHOT VIEW NUMBERS)      */}
            {/* ───────────────────────────────────────────────────────────── */}
            <div className={`${cardCls} overflow-hidden border-2 border-stone-200 shadow-sm`}>
              {/* Header with Title, Badges, Security Action and View Switcher */}
              <div className="p-5 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg shadow-inner">
                    <i className="fa-solid fa-user-shield"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-white text-base tracking-wide">
                        Active Checked-in Guests (ភ្ញៀវកំពុងស្នាក់នៅ)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white font-mono font-black text-xs shadow-xs">
                        {occupancyStats.total}
                      </span>
                    </div>
                    <p className="text-xs text-stone-300">
                      Real-time in-house guests • Shot View numbers & security verification
                    </p>
                  </div>
                </div>

                {/* Security Database Request and Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSecurityManifestModal(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer active:scale-95"
                    title="បើកផ្ទាំងទិន្នន័យស្នើសុំសន្តិសុខ / Security Database Request Manifest"
                  >
                    <i className="fa-solid fa-shield-halved text-emerald-200 text-sm"></i>
                    <span>Security Database Request</span>
                    <span className="px-1.5 py-0.5 bg-black/20 rounded-md text-[10px] font-black">
                      {occupancyStats.total}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = generateSecurityManifestText();
                      copyText(text, 'manifest-quick');
                      showModal('success', 'Copied to Clipboard', 'Guest security manifest copied. Ready to paste into Telegram or Police report.');
                    }}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-stone-200 hover:text-white border border-white/20 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Copy formatted security manifest text"
                  >
                    <i className="fa-solid fa-copy text-amber-400 text-xs"></i>
                    <span>{copiedId === 'manifest-quick' ? 'Copied!' : 'Copy Data'}</span>
                  </button>

                  {/* View Mode Switcher: Shot Cards vs Table */}
                  <div className="bg-black/30 p-1 rounded-xl border border-white/10 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOccupancyViewMode('cards')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                        occupancyViewMode === 'cards'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-300 hover:text-white'
                      }`}
                      title="Shot View / Compact Cards with Large Numbers"
                    >
                      <i className="fa-solid fa-camera text-[11px]"></i>
                      <span className="hidden sm:inline">Shot View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOccupancyViewMode('table')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                        occupancyViewMode === 'table'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-300 hover:text-white'
                      }`}
                      title="Easy Table List View"
                    >
                      <i className="fa-solid fa-table text-[11px]"></i>
                      <span className="hidden sm:inline">Table View</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Summary Pill Bar */}
              <div className="px-5 py-3 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg font-bold text-stone-700 shadow-2xs">
                    <i className="fa-solid fa-users text-brand-600 text-xs"></i>
                    <span>In-House: <strong className="text-stone-900">{occupancyStats.total} Guests</strong></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg font-bold text-stone-700 shadow-2xs">
                    <i className="fa-solid fa-door-open text-indigo-600 text-xs"></i>
                    <span>Rooms: <strong className="text-stone-900">{occupancyStats.occupiedRoomsCount} In-Use</strong></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg font-bold text-stone-700 shadow-2xs">
                    <i className="fa-solid fa-earth-americas text-blue-600 text-xs"></i>
                    <span>Foreign: <strong className="text-blue-700">{occupancyStats.foreign}</strong></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg font-bold text-stone-700 shadow-2xs">
                    <i className="fa-solid fa-flag text-rose-600 text-xs"></i>
                    <span>Khmer: <strong className="text-rose-700">{occupancyStats.khmer}</strong></span>
                  </span>
                  {occupancyStats.dueToday > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-bold animate-pulse shadow-2xs">
                      <i className="fa-solid fa-bell text-amber-600 text-xs"></i>
                      <span>Due Out Today: <strong>{occupancyStats.dueToday}</strong></span>
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-stone-500 font-medium">
                  Showing {filteredOccupancy.length} of {occupancyStats.total} active stays
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="p-4 bg-white border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                  <input
                    type="text"
                    value={occupancySearch}
                    onChange={e => setOccupancySearch(e.target.value)}
                    placeholder="Search guest name, room #, passport/ID, phone..."
                    className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 placeholder-stone-400 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
                  />
                  {occupancySearch && (
                    <button
                      type="button"
                      onClick={() => setOccupancySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {[
                    { id: 'all', label: 'All Active', count: occupancyStats.total },
                    { id: 'due-today', label: 'Due Checkout Today', count: occupancyStats.dueToday },
                    { id: 'foreign', label: 'Foreign Guests', count: occupancyStats.foreign },
                    { id: 'khmer', label: 'Cambodian', count: occupancyStats.khmer }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOccupancyFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        occupancyFilter === tab.id
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                        occupancyFilter === tab.id ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* View 1: Shot View / Snapshot Cards */}
              {occupancyViewMode === 'cards' && (
                <div className="p-5 bg-stone-50/50">
                  {filteredOccupancy.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredOccupancy.map((o) => (
                        <div
                          key={o.id}
                          className={`bg-white rounded-2xl border-2 p-4 transition-all hover:shadow-lg relative overflow-hidden flex flex-col justify-between ${
                            o.isDueToday
                              ? 'border-amber-400/80 bg-gradient-to-br from-amber-50/40 via-white to-white'
                              : 'border-stone-200 hover:border-brand-300'
                          }`}
                        >
                          {/* Top Badge Row: Shot View Number + Room Number + Status */}
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                {/* Shot View Number Badge */}
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-stone-900 to-stone-800 text-amber-400 font-mono font-black text-xs shadow-xs border border-stone-700">
                                  <i className="fa-solid fa-camera text-[10px] text-amber-400"></i>
                                  <span>SHOT {o.shotNumber}</span>
                                </div>

                                {/* Room Number Badge */}
                                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 font-black text-xs">
                                  <i className="fa-solid fa-door-closed text-brand-600"></i>
                                  <span>{String(o.roomName || o.roomId || 'Room 101').startsWith('Room') ? (o.roomName || o.roomId) : `Room ${o.roomName || o.roomId || '101'}`}</span>
                                </div>
                              </div>

                              {/* Floor & Bed Pill */}
                              <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-lg">
                                Fl. {o.roomFloor} • {o.roomCategory}
                              </span>
                            </div>

                            {/* Guest Details */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs uppercase">
                                {(o.guestName || 'G').slice(0, 2)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-stone-900 text-sm truncate">
                                    {o.guestName}
                                  </h4>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    o.isKhmer
                                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                                      : 'bg-blue-50 border-blue-200 text-blue-700'
                                  }`}>
                                    {o.isKhmer ? '🇰🇭 Cambodian' : `🌐 ${o.guestNationality || 'Foreign'}`}
                                  </span>
                                  {o.isMultiRoom && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center gap-1">
                                      <i className="fa-solid fa-hotel text-[9px]"></i>
                                      <span>{o.relatedStays.length} Rooms</span>
                                    </span>
                                  )}
                                </div>

                                {/* Multi-room linked rooms badge */}
                                {o.isMultiRoom && (
                                  <div className="mt-1 text-[11px] font-bold text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-lg px-2 py-0.5 inline-flex items-center gap-1.5">
                                    <i className="fa-solid fa-layer-group text-indigo-500 text-[10px]"></i>
                                    <span>Rooms: {o.relatedStays.map(s => s.roomName || s.roomId).join(', ')}</span>
                                  </div>
                                )}

                                {/* Passport / ID Badge with Copy Button */}
                                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 rounded-lg text-xs font-mono text-stone-800 transition">
                                    <i className="fa-solid fa-id-card text-stone-500 text-[11px]"></i>
                                    <span className="font-bold">
                                      {o.passport ? o.passport : <span className="text-stone-400 italic font-sans text-[11px]">No ID recorded</span>}
                                    </span>
                                    {o.passport && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyText(o.passport, `card-id-${o.id}`);
                                        }}
                                        className="ml-1 text-stone-400 hover:text-brand-600 transition cursor-pointer"
                                        title="Copy Passport / ID Number"
                                      >
                                        <i className={`fa-solid ${copiedId === `card-id-${o.id}` ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                                      </button>
                                    )}
                                  </div>

                                  {/* Phone */}
                                  {o.guestPhone && (
                                    <a
                                      href={`tel:${o.guestPhone}`}
                                      className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-brand-700 font-mono bg-stone-50 px-2 py-1 rounded-lg border border-stone-200/70"
                                      title="Call Guest"
                                    >
                                      <i className="fa-solid fa-phone text-[10px] text-emerald-600"></i>
                                      <span>{o.guestPhone}</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Stay Schedule Box */}
                            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5 mb-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Check-in</span>
                                <span className="font-bold text-stone-800 flex items-center gap-1 mt-0.5">
                                  <i className="fa-regular fa-calendar text-emerald-600 text-[11px]"></i>
                                  {o.checkInDate}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Check-out</span>
                                <span className={`font-bold flex items-center gap-1 mt-0.5 ${
                                  o.isDueToday ? 'text-amber-700 font-black' : 'text-stone-800'
                                }`}>
                                  <i className="fa-regular fa-calendar-check text-amber-600 text-[11px]"></i>
                                  {o.checkOutDate || 'Open'}
                                  {o.isDueToday && (
                                    <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded text-[9px] font-black uppercase">Today</span>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Notes if any */}
                            {o.notes && (
                              <p className="text-[11px] text-stone-500 italic bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-3 line-clamp-2">
                                <i className="fa-solid fa-note-sticky text-amber-500 mr-1"></i>
                                {o.notes}
                              </p>
                            )}
                          </div>

                          {/* Action Footer */}
                          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 mt-auto">
                            <div className="text-[10px] font-mono text-stone-400 font-bold">
                              {o.secCode}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceModalGuest(o);
                                  setInvoiceModalRelated(o.relatedStays || [o]);
                                }}
                                className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Print Official Guest Invoice / Folio"
                              >
                                <i className="fa-solid fa-file-invoice text-brand-600 text-xs"></i>
                                <span>Invoice</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckInForm(prev => ({
                                    ...prev,
                                    guestName: o.guestName || '',
                                    guestPhone: o.guestPhone || '',
                                    guestNationality: o.guestNationality || '',
                                    passportOrId: o.passport || o.passportOrId || '',
                                    notes: `Additional room for ${o.guestName}`
                                  }));
                                  window.scrollTo({ top: 300, behavior: 'smooth' });
                                }}
                                className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs border border-stone-200"
                                title="Add another room for this guest"
                              >
                                <i className="fa-solid fa-plus text-emerald-600 text-xs"></i>
                                <span>+ Room</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSecurityGuest(o)}
                                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Open Guest Security Snapshot Card"
                              >
                                <i className="fa-solid fa-eye text-brand-600 text-xs"></i>
                                <span>Shot</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCheckOut(o)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Check Out Guest (View Details & Settle)"
                              >
                                <i className="fa-solid fa-right-from-bracket text-amber-600 text-xs"></i>
                                <span>Out</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center bg-white rounded-2xl border border-stone-200 p-8">
                      <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400 text-2xl mb-3">
                        <i className="fa-solid fa-user-xmark"></i>
                      </div>
                      <h4 className="font-bold text-stone-800 text-sm">No Active Checked-in Guests Found</h4>
                      <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                        {occupancySearch || occupancyFilter !== 'all'
                          ? 'Try adjusting your search query or filter tab to view guests.'
                          : 'There are currently no guests checked in. Use the form on the left to check in a guest.'}
                      </p>
                      {(occupancySearch || occupancyFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => { setOccupancySearch(''); setOccupancyFilter('all'); }}
                          className="mt-3 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* View 2: Easy Table View */}
              {occupancyViewMode === 'table' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-stone-100/80 border-b border-stone-200 text-[11px] text-stone-600 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-4 py-3">Shot #</th>
                        <th className="px-4 py-3">Room</th>
                        <th className="px-4 py-3">Guest Name & Nationality</th>
                        <th className="px-4 py-3">Passport / ID Number</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Check-in</th>
                        <th className="px-4 py-3">Check-out</th>
                        <th className="px-4 py-3">Security Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredOccupancy.map((o) => (
                        <tr
                          key={o.id}
                          className={`hover:bg-amber-50/40 transition-colors ${
                            o.isDueToday ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* Shot View Number */}
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-900 text-amber-400 font-mono font-black text-xs shadow-2xs">
                              {o.shotNumber}
                            </span>
                          </td>

                          {/* Room Number */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col">
                              <span className="font-black text-brand-700 text-sm">
                                Room {o.roomName || o.roomId}
                              </span>
                              <span className="text-[10px] text-stone-500">
                                Fl. {o.roomFloor} • {o.roomCategory}
                              </span>
                            </div>
                          </td>

                          {/* Guest Name & Nationality */}
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-stone-900 text-sm">{o.guestName}</p>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                o.isKhmer
                                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                                  : 'bg-blue-50 border-blue-200 text-blue-700'
                              }`}>
                                {o.isKhmer ? '🇰🇭 Cambodian' : `🌐 ${o.guestNationality || 'Foreign'}`}
                              </span>
                              {o.isMultiRoom && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200 text-indigo-700" title={`Rooms: ${o.relatedStays.map(s => s.roomName || s.roomId).join(', ')}`}>
                                  <i className="fa-solid fa-hotel text-[9px]"></i>
                                  {o.relatedStays.length} Rooms
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Passport / National ID */}
                          <td className="px-4 py-3.5">
                            {o.passport ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-mono text-stone-800 transition">
                                <i className="fa-solid fa-id-card text-stone-400 text-xs"></i>
                                <span>{o.passport}</span>
                                <button
                                  type="button"
                                  onClick={() => copyText(o.passport, `tbl-id-${o.id}`)}
                                  className="text-stone-400 hover:text-brand-600 transition ml-1 cursor-pointer"
                                  title="Copy ID"
                                >
                                  <i className={`fa-solid ${copiedId === `tbl-id-${o.id}` ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                                </button>
                              </div>
                            ) : (
                              <span className="text-stone-400 text-xs italic">None recorded</span>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="px-4 py-3.5 font-mono text-xs text-stone-700">
                            {o.guestPhone ? (
                              <a href={`tel:${o.guestPhone}`} className="hover:text-brand-600 transition flex items-center gap-1">
                                <i className="fa-solid fa-phone text-[10px] text-emerald-600"></i>
                                {o.guestPhone}
                              </a>
                            ) : '—'}
                          </td>

                          {/* Check-in */}
                          <td className="px-4 py-3.5 text-xs text-stone-700 font-medium">
                            {o.checkInDate}
                          </td>

                          {/* Check-out */}
                          <td className="px-4 py-3.5 text-xs">
                            <span className={`font-bold ${o.isDueToday ? 'text-amber-700 font-black' : 'text-stone-800'}`}>
                              {o.checkOutDate || 'Open'}
                            </span>
                            {o.isDueToday && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-white rounded text-[9px] font-black uppercase">
                                Due Today
                              </span>
                            )}
                          </td>

                          {/* Security Status */}
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                              <i className="fa-solid fa-circle-check text-emerald-500 text-[9px]"></i>
                              Verified In-House
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceModalGuest(o);
                                  setInvoiceModalRelated(o.relatedStays || [o]);
                                }}
                                className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                                title="Print Official Guest Invoice / Folio"
                              >
                                <i className="fa-solid fa-file-invoice text-brand-600 mr-1"></i>
                                Invoice
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckInForm(prev => ({
                                    ...prev,
                                    guestName: o.guestName || '',
                                    guestPhone: o.guestPhone || '',
                                    guestNationality: o.guestNationality || '',
                                    passportOrId: o.passport || o.passportOrId || '',
                                    notes: `Additional room for ${o.guestName}`
                                  }));
                                  window.scrollTo({ top: 300, behavior: 'smooth' });
                                }}
                                className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                                title="Add another room for this guest"
                              >
                                <i className="fa-solid fa-plus text-emerald-600 mr-1"></i>
                                + Room
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSecurityGuest(o)}
                                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                                title="View Security Shot Snapshot"
                              >
                                <i className="fa-solid fa-eye text-brand-600 mr-1"></i>
                                Shot
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCheckOut(o)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                                title="Check Out Guest (View Details & Settle)"
                              >
                                <i className="fa-solid fa-right-from-bracket mr-1"></i>
                                Out
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredOccupancy.length === 0 && (
                        <tr>
                          <td colSpan="9" className="py-12 text-center text-stone-400 bg-white">
                            <i className="fa-solid fa-user-xmark text-2xl mb-2 block text-stone-300"></i>
                            No active checked-in guests found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 4. DEDICATED ROOM DETAIL VIEW ("Detail Room One by One")             */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto anim-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Top Navigation Bar: Previous Room | Selector | Next Room */}
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevRoom}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors flex items-center gap-1.5"
                  title="Previous Room"
                >
                  <i className="fa-solid fa-chevron-left text-[11px]"></i>
                  <span>Prev</span>
                </button>

                {/* Dropdown jump */}
                <select
                  value={selectedRoom.id}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer"
                >
                  {filteredRooms.map((r, idx) => (
                    <option key={r.id} value={r.id} className="bg-stone-800 text-white">
                      [{idx + 1}/{filteredRooms.length}] Room {r.name} — {r.categoryName || `${r.bedCount || 1} Bed`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleNextRoom}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors flex items-center gap-1.5"
                  title="Next Room"
                >
                  <span>Next</span>
                  <i className="fa-solid fa-chevron-right text-[11px]"></i>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRoomId(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">

              {/* ──── EDITABLE MODE ──── */}
              {isEditingDetail ? (
                <div className="space-y-5">
                  {/* Header with Save/Cancel */}
                  <div className="flex items-center justify-between pb-4 border-b border-indigo-100">
                    <h3 className="font-black text-lg text-stone-900 flex items-center gap-2">
                      <i className="fa-solid fa-pen-to-square text-indigo-500"></i>
                      Editing Room Details (កែប្រែព័ត៌មានបន្ទប់)
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelEditingDetail}
                        className="px-3 py-1.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl border border-stone-200 transition-colors"
                      >
                        <i className="fa-solid fa-times mr-1"></i> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveDetailEdit}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
                      >
                        <i className="fa-solid fa-check mr-1"></i> Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Room Name & Floor */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Room Name / Number (ឈ្មោះបន្ទប់)</label>
                      <input
                        type="text"
                        value={detailEditForm.name}
                        onChange={e => setDetailEditForm({ ...detailEditForm, name: e.target.value })}
                        placeholder="e.g. 101, 102 or Deluxe 201"
                        className={inputCls}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Floor (ជាន់)</label>
                      <input
                        type="text"
                        value={detailEditForm.floor}
                        onChange={e => setDetailEditForm({ ...detailEditForm, floor: e.target.value })}
                        placeholder="1"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Category & Status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Category Bed (ប្រភេទគ្រែ)</label>
                      <select
                        value={detailEditForm.categoryId}
                        onChange={e => {
                          const selCat = bedCategories.find(c => String(c.id) === String(e.target.value));
                          setDetailEditForm({
                            ...detailEditForm,
                            categoryId: e.target.value,
                            price: selCat?.price || detailEditForm.price,
                            amenities: selCat?.amenities || detailEditForm.amenities,
                            bedType: selCat?.bedType || detailEditForm.bedType,
                            bedCount: selCat?.bedCount || detailEditForm.bedCount,
                            capacity: selCat?.capacity || detailEditForm.capacity
                          });
                        }}
                        className={inputCls}
                      >
                        <option value="">Select Bed Category...</option>
                        {bedCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.bedCount} Bed{cat.bedCount > 1 ? 's' : ''} — ${cat.price}/night)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Room Status (ស្ថានភាព)</label>
                      <select
                        value={detailEditForm.status}
                        onChange={e => setDetailEditForm({ ...detailEditForm, status: e.target.value })}
                        className={inputCls}
                      >
                        <option value="vacant">Vacant (ទំនេរ)</option>
                        <option value="occupied">Occupied (មានភ្ញៀវ)</option>
                        <option value="cleaning">Cleaning (កំពុងសម្អាត)</option>
                        <option value="maintenance">Maintenance (ជួសជុល)</option>
                      </select>
                    </div>
                  </div>

                  {/* Price, Bed Type, Bed Count, Capacity */}
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className={labelCls}>Price / Night ($)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={detailEditForm.price}
                        onChange={e => setDetailEditForm({ ...detailEditForm, price: parseFloat(e.target.value) || 0 })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Bed Type (ប្រភេទគ្រែ)</label>
                      <input
                        type="text"
                        value={detailEditForm.bedType}
                        onChange={e => setDetailEditForm({ ...detailEditForm, bedType: e.target.value })}
                        placeholder="e.g. 1 Queen Bed"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Beds (ចំនួនគ្រែ)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={detailEditForm.bedCount}
                        onChange={e => setDetailEditForm({ ...detailEditForm, bedCount: parseInt(e.target.value) || 1 })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Max Guests</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={detailEditForm.capacity}
                        onChange={e => setDetailEditForm({ ...detailEditForm, capacity: parseInt(e.target.value) || 2 })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className={labelCls}>Room Description / Notes (ការពិពណ៌នា)</label>
                    <textarea
                      rows="3"
                      value={detailEditForm.description}
                      onChange={e => setDetailEditForm({ ...detailEditForm, description: e.target.value })}
                      placeholder="Corner room, extra quiet, garden view window..."
                      className={inputCls}
                    ></textarea>
                  </div>

                  {/* Amenities Checkboxes */}
                  <div>
                    <label className={labelCls}>Amenities (សេវាកម្មក្នុងបន្ទប់)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      {ALL_AMENITIES.map(amenity => {
                        const checked = (detailEditForm.amenities || []).includes(amenity);
                        return (
                          <label key={amenity} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                const cur = detailEditForm.amenities || [];
                                const updated = e.target.checked ? [...cur, amenity] : cur.filter(a => a !== amenity);
                                setDetailEditForm({ ...detailEditForm, amenities: updated });
                              }}
                              className="w-4 h-4 accent-brand-600 rounded"
                            />
                            <i className={`fa-solid ${AMENITY_ICONS[amenity] || 'fa-check'} text-[10px] text-brand-500`}></i>
                            <span className="truncate">{amenity}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Photo Upload & Gallery */}
                  <div>
                    <label className={labelCls}>Room Photos (រូបភាពបន្ទប់)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDetailImageUpload}
                      className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(detailEditForm.images || []).map((img, i) => (
                        <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-stone-200">
                          <img src={img} alt={`Room Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const arr = [...detailEditForm.images];
                              arr.splice(i, 1);
                              setDetailEditForm({ ...detailEditForm, images: arr });
                            }}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Save/Cancel bar */}
                  <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEditingDetail}
                      className="px-4 py-2 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl border border-stone-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveDetailEdit}
                      className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
                    >
                      <i className="fa-solid fa-check mr-1.5"></i> Save All Changes
                    </button>
                  </div>
                </div>
              ) : (
                /* ──── READ-ONLY MODE (original detail view) ──── */
                <div className="space-y-6">
                  {/* Header: Room Name, Category, Price, Status */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-stone-100">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black text-stone-900 font-display">
                          Room {selectedRoom.name}
                        </h2>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize border ${statusBadgeColors[selectedRoom.status] || 'bg-stone-100 text-stone-700'}`}>
                          <i className={`fa-solid ${statusIcons[selectedRoom.status] || 'fa-circle'} mr-1.5 text-xs`}></i>
                          {selectedRoom.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-indigo-600 mt-1 flex items-center gap-2">
                        <i className="fa-solid fa-layer-group"></i>
                        <span>Category: {selectedRoom.categoryName || `${selectedRoom.bedCount || 1} Bed Category`}</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-stone-500 font-medium">Floor {selectedRoom.floor || '1'}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-black text-brand-500">
                        ${selectedRoom.price || selectedRoom.rate || 25}
                        <span className="text-xs text-stone-400 font-normal"> / night</span>
                      </div>
                      <p className="text-xs text-stone-500 font-medium mt-0.5">
                        {selectedRoom.bedType || `${selectedRoom.bedCount || 1} Bed`}
                      </p>
                    </div>
                  </div>

                  {/* Status Quick-Switch Bar */}
                  <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                      <i className="fa-solid fa-arrows-rotate mr-1.5 text-stone-400"></i>
                      Change Room Status:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {['vacant', 'occupied', 'cleaning', 'maintenance'].map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(selectedRoom.id, st)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border ${
                            selectedRoom.status === st
                              ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Occupancy Card */}
                  {(() => {
                    const activeStay = activeOccupancy.find(o => String(o.roomId) === String(selectedRoom.id));
                    if (activeStay) {
                      return (
                        <div className="p-5 bg-blue-50 rounded-2xl border border-blue-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                              <i className="fa-solid fa-user-check text-blue-600"></i>
                              Current Occupant Details
                            </h4>
                            <button
                              type="button"
                              onClick={() => handleCheckOut(activeStay.id, activeStay.guestName)}
                              className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 shadow-sm transition-colors"
                            >
                              <i className="fa-solid fa-right-from-bracket mr-1"></i> Check Out
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">Guest Name</span>
                              <span className="font-black text-stone-900 text-sm">{activeStay.guestName}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">Phone</span>
                              <span className="font-mono text-stone-800">{activeStay.guestPhone || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">Check-in</span>
                              <span className="font-bold text-stone-800">{activeStay.checkInDate}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">Check-out</span>
                              <span className="font-bold text-amber-700">{activeStay.checkOutDate}</span>
                            </div>
                          </div>
                          {activeStay.notes && (
                            <p className="text-xs text-blue-800 bg-white/70 p-2.5 rounded-xl border border-blue-100">
                              <span className="font-bold">Notes:</span> {activeStay.notes}
                            </p>
                          )}
                        </div>
                      );
                    } else if (selectedRoom.status === 'vacant') {
                      return (
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                              <i className="fa-solid fa-check"></i>
                            </div>
                            <div>
                              <h4 className="font-bold text-emerald-900 text-sm">Room is Vacant and Ready</h4>
                              <p className="text-xs text-emerald-700">Cleaned and inspected for arriving guests</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickCheckInToRoom(selectedRoom)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors whitespace-nowrap"
                          >
                            <i className="fa-solid fa-user-plus mr-1.5"></i>
                            Check In Guest to Room {selectedRoom.name}
                          </button>
                        </div>
                      );
                    } else if (selectedRoom.status === 'cleaning') {
                      return (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-amber-900 text-sm">Room Needs Housekeeping</h4>
                            <p className="text-xs text-amber-700">Awaiting cleaning and linens replacement</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(selectedRoom.id, 'vacant')}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                          >
                            <i className="fa-solid fa-check mr-1.5"></i>
                            Mark as Cleaned & Vacant
                          </button>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-red-900 text-sm">Room Under Maintenance</h4>
                            <p className="text-xs text-red-700">Repairs or inspection in progress</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(selectedRoom.id, 'vacant')}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                          >
                            <i className="fa-solid fa-check mr-1.5"></i>
                            Mark Ready & Vacant
                          </button>
                        </div>
                      );
                    }
                  })()}

                  {/* Photos Gallery */}
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-images text-brand-500"></i>
                      <span>Room Photos</span>
                    </h4>
                    {(() => {
                      const photos = Array.isArray(selectedRoom.images) && selectedRoom.images.length > 0
                        ? selectedRoom.images
                        : (selectedRoom.imageUrl ? [selectedRoom.imageUrl] : ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80']);
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          {photos.map((img, i) => (
                            <div key={i} className="h-32 rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                              <img src={img} alt={`Room Photo ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Specifications & Amenities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
                      <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-2">
                        <i className="fa-solid fa-sliders mr-1.5 text-indigo-500"></i>
                        Bed & Capacity Details
                      </h4>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Bed Category:</span>
                        <span className="font-bold text-stone-900">{selectedRoom.categoryName || 'Standard'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Bed Configuration:</span>
                        <span className="font-bold text-stone-900">{selectedRoom.bedType || `${selectedRoom.bedCount || 1} Bed`}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Number of Beds:</span>
                        <span className="font-bold text-stone-900">{selectedRoom.bedCount || 1} Bed{selectedRoom.bedCount > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-200/60">
                        <span className="text-stone-500">Max Capacity:</span>
                        <span className="font-bold text-stone-900">{selectedRoom.capacity || 2} Persons</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-stone-500">Floor Level:</span>
                        <span className="font-bold text-stone-900">Floor {selectedRoom.floor || '1'}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
                      <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-2">
                        <i className="fa-solid fa-list-check mr-1.5 text-brand-500"></i>
                        Included Amenities
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                        {(selectedRoom.amenities || ALL_AMENITIES.slice(0, 6)).map(a => (
                          <div key={a} className="flex items-center gap-1.5 text-stone-700">
                            <i className={`fa-solid ${AMENITY_ICONS[a] || 'fa-check'} text-[10px] text-brand-500`}></i>
                            <span className="truncate">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Description / Notes */}
                  {selectedRoom.description && (
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                      <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-2">
                        <i className="fa-solid fa-file-lines mr-1.5 text-stone-400"></i>
                        Room Notes
                      </h4>
                      <p className="text-sm text-stone-700">{selectedRoom.description}</p>
                    </div>
                  )}

                  {/* Room Stay History */}
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-clock-rotate-left text-stone-400"></i>
                      <span>Recent Stays in Room {selectedRoom.name}</span>
                    </h4>
                    {(() => {
                      const roomHistory = (occupancy || []).filter(o => String(o.roomId) === String(selectedRoom.id)).slice(0, 5);
                      if (roomHistory.length === 0) {
                        return <p className="text-xs text-stone-400 italic">No previous stay logs recorded for this room.</p>;
                      }
                      return (
                        <div className="overflow-x-auto rounded-xl border border-stone-200">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-stone-100 text-stone-500 uppercase tracking-wider">
                              <tr>
                                <th className="px-3 py-2 font-bold">Guest</th>
                                <th className="px-3 py-2 font-bold">Phone</th>
                                <th className="px-3 py-2 font-bold">Check-in</th>
                                <th className="px-3 py-2 font-bold">Check-out</th>
                                <th className="px-3 py-2 font-bold">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roomHistory.map(h => (
                                <tr key={h.id} className="border-b border-stone-100">
                                  <td className="px-3 py-2 font-bold text-stone-900">{h.guestName}</td>
                                  <td className="px-3 py-2 font-mono text-stone-600">{h.guestPhone || '—'}</td>
                                  <td className="px-3 py-2">{h.checkInDate}</td>
                                  <td className="px-3 py-2">{h.checkOutDate}</td>
                                  <td className="px-3 py-2 capitalize font-bold text-stone-700">{h.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {!isEditingDetail ? (
                  <>
                    <button
                      type="button"
                      onClick={() => startEditingDetail(selectedRoom)}
                      className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                      <i className="fa-solid fa-pen-to-square mr-1"></i> Edit All (កែប្រែទាំងអស់)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoom(selectedRoom.id, selectedRoom.name)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      <i className="fa-solid fa-trash mr-1"></i> Delete Room
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-indigo-600 font-bold flex items-center gap-1.5">
                    <i className="fa-solid fa-pen-to-square"></i> Editing mode — make changes above
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isEditingDetail && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevRoom}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold hover:bg-stone-100 transition-colors"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      onClick={handleNextRoom}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold hover:bg-stone-100 transition-colors"
                    >
                      Next →
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedRoomId(null); setIsEditingDetail(false); }}
                  className="px-4 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* EDIT ROOM MODAL                                                      */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-stone-200 modal-pop my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-hotel text-brand-500"></i>
                  <span>Edit Room: <strong className="text-brand-600">Room {editingRoom.name}</strong></span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">Update room details, rate, bed category, and status</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRoom(null);
                  setRoomForm({
                    name: '',
                    floor: '1',
                    categoryId: bedCategories[0]?.id || '',
                    price: bedCategories[0]?.price || 25,
                    status: 'vacant',
                    description: '',
                    amenities: [],
                    images: []
                  });
                }}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleRoomSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Room Name / Number</label>
                  <input
                    type="text"
                    value={roomForm.name}
                    onChange={e => setRoomForm({ ...roomForm, name: e.target.value })}
                    placeholder="e.g. 101, 102 or Deluxe 201"
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Floor</label>
                  <input
                    type="text"
                    value={roomForm.floor}
                    onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })}
                    placeholder="1"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Bed Category Selector */}
              <div>
                <label className={labelCls}>Category Bed (ប្រភេទគ្រែ)</label>
                <select
                  value={roomForm.categoryId}
                  onChange={e => {
                    const selCat = bedCategories.find(c => String(c.id) === String(e.target.value));
                    setRoomForm({
                      ...roomForm,
                      categoryId: e.target.value,
                      price: selCat?.price || roomForm.price,
                      amenities: selCat?.amenities || roomForm.amenities
                    });
                  }}
                  className={inputCls}
                  required
                >
                  <option value="">Select Bed Category...</option>
                  {bedCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.bedCount} Bed{cat.bedCount > 1 ? 's' : ''} — ${cat.price}/night)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nightly Rate ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={roomForm.price}
                    onChange={e => setRoomForm({ ...roomForm, price: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Room Status</label>
                  <select
                    value={roomForm.status}
                    onChange={e => setRoomForm({ ...roomForm, status: e.target.value })}
                    className={inputCls}
                  >
                    <option value="vacant">Vacant (ទំនេរ)</option>
                    <option value="occupied">Occupied (មានភ្ញៀវ)</option>
                    <option value="cleaning">Cleaning (កំពុងសម្អាត)</option>
                    <option value="maintenance">Maintenance (ជួសជុល)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Specific Room Notes (Optional)</label>
                <textarea
                  rows="2"
                  value={roomForm.description}
                  onChange={e => setRoomForm({ ...roomForm, description: e.target.value })}
                  placeholder="Corner room, extra quiet, garden view window..."
                  className={inputCls}
                ></textarea>
              </div>

              {/* Custom photos */}
              <div>
                <label className={labelCls}>Upload Room Photos</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleRoomImageUpload}
                  className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 cursor-pointer"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {(roomForm.images || []).map((img, i) => (
                    <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-stone-200">
                      <img src={img} alt="Room Photo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const arr = [...roomForm.images];
                          arr.splice(i, 1);
                          setRoomForm({ ...roomForm, images: arr });
                        }}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoom(null);
                    setRoomForm({
                      name: '',
                      floor: '1',
                      categoryId: bedCategories[0]?.id || '',
                      price: bedCategories[0]?.price || 25,
                      status: 'vacant',
                      description: '',
                      amenities: [],
                      images: []
                    });
                  }}
                  className={`${btnSecondary} flex-1 justify-center`}
                >
                  Cancel
                </button>
                <button type="submit" className={`${btnPrimary} flex-1 justify-center`}>
                  <i className="fa-solid fa-check mr-1.5"></i> Update Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* EDIT BED CATEGORY MODAL                                              */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-stone-200 modal-pop my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-lg text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-bed text-indigo-500"></i>
                  <span>Edit Category: <strong className="text-indigo-600">{editingCategory.name}</strong></span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">Define bed type, capacity & standard nightly rate</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm({
                    name: '',
                    bedType: '1 Queen Bed',
                    bedCount: 1,
                    price: 25,
                    capacity: 2,
                    description: '',
                    amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower'],
                    images: []
                  });
                }}
                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100"
              >
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-4 text-sm">
              <div>
                <label className={labelCls}>Category Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. 1 Bed - Standard Double or Family Suite"
                  className={inputCls}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Bed Count</label>
                  <select
                    value={categoryForm.bedCount}
                    onChange={e => {
                      const count = parseInt(e.target.value);
                      setCategoryForm({
                        ...categoryForm,
                        bedCount: count,
                        bedType: count === 1 ? '1 Queen Bed' : (count === 2 ? '2 Single Beds' : `${count} Beds`),
                        capacity: count * 2 > 6 ? 6 : count * 2
                      });
                    }}
                    className={inputCls}
                  >
                    <option value={1}>1 Bed (គ្រែ ១)</option>
                    <option value={2}>2 Beds (គ្រែ ២)</option>
                    <option value={3}>3 Beds (គ្រែ ៣)</option>
                    <option value={4}>4 Beds (គ្រែ ៤)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nightly Price ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={categoryForm.price}
                    onChange={e => setCategoryForm({ ...categoryForm, price: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Bed Specification</label>
                  <input
                    type="text"
                    value={categoryForm.bedType}
                    onChange={e => setCategoryForm({ ...categoryForm, bedType: e.target.value })}
                    placeholder="e.g. 1 King Bed or 2 Single Beds"
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Max Capacity (Guests)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={categoryForm.capacity}
                    onChange={e => setCategoryForm({ ...categoryForm, capacity: parseInt(e.target.value) || 2 })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows="3"
                  value={categoryForm.description}
                  onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Comfortable room with private bath, garden view, quiet atmosphere..."
                  className={inputCls}
                ></textarea>
              </div>

              {/* Amenities */}
              <div>
                <label className={labelCls}>Standard Amenities</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                  {ALL_AMENITIES.map(amenity => {
                    const checked = (categoryForm.amenities || []).includes(amenity);
                    return (
                      <label key={amenity} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const cur = categoryForm.amenities || [];
                            const updated = e.target.checked ? [...cur, amenity] : cur.filter(a => a !== amenity);
                            setCategoryForm({ ...categoryForm, amenities: updated });
                          }}
                          className="w-4 h-4 accent-indigo-600 rounded"
                        />
                        <span className="truncate">{amenity}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Photos */}
              <div>
                <label className={labelCls}>Category Photos</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCategoryImageUpload}
                  className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {(categoryForm.images || []).map((img, i) => (
                    <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-stone-200">
                      <img src={img} alt="Category Photo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const arr = [...categoryForm.images];
                          arr.splice(i, 1);
                          setCategoryForm({ ...categoryForm, images: arr });
                        }}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryForm({
                      name: '',
                      bedType: '1 Queen Bed',
                      bedCount: 1,
                      price: 25,
                      capacity: 2,
                      description: '',
                      amenities: ['Air Conditioning', 'Free Wi-Fi', 'Private Bathroom', 'Hot Shower'],
                      images: []
                    });
                  }}
                  className={`${btnSecondary} flex-1 justify-center`}
                >
                  Cancel
                </button>
                <button type="submit" className={`${btnPrimary} flex-1 justify-center bg-indigo-600 hover:bg-indigo-700`}>
                  <i className="fa-solid fa-check mr-1.5"></i> Update Bed Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 5. SECURITY DATABASE REQUEST MANIFEST MODAL (FPCS / POLICE UI)         */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {showSecurityManifestModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto anim-fade-in">
          <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white flex items-center justify-between shrink-0 border-b border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-lg shadow-inner">
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black tracking-wide text-white">
                      Security Database Request Manifest (ប្រព័ន្ធស្នើសុំទិន្នន័យសន្តិសុខ)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase">
                      Official Export
                    </span>
                  </div>
                  <p className="text-xs text-stone-300">
                    Motorental Siemreab Angkor & Guesthouse • Official In-House Manifest for Sangkat Police & Immigration (FPCS)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSecurityManifestModal(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Manifest Overview Bar */}
            <div className="p-5 bg-stone-50 border-b border-stone-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total In-House Guests</span>
                <span className="text-xl font-black text-stone-900 mt-0.5 block">{occupancyStats.total} Guests</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Foreign Nationals</span>
                <span className="text-xl font-black text-blue-700 mt-0.5 block">{occupancyStats.foreign} Foreign</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Cambodian Citizens</span>
                <span className="text-xl font-black text-rose-700 mt-0.5 block">{occupancyStats.khmer} Khmer</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Occupied Rooms</span>
                <span className="text-xl font-black text-stone-900 mt-0.5 block">{occupancyStats.occupiedRoomsCount} Rooms</span>
              </div>
            </div>

            {/* Modal Actions Toolbar */}
            <div className="p-4 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] max-w-xs">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                  <input
                    type="text"
                    value={manifestSearch}
                    onChange={e => setManifestSearch(e.target.value)}
                    placeholder="Search name, room, passport..."
                    className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 placeholder-stone-400 focus:bg-white outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 text-xs">
                  {['all', 'foreign', 'khmer'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setManifestFilter(f)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition capitalize cursor-pointer ${
                        manifestFilter === f
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                      }`}
                    >
                      {f === 'all' ? 'All Nationals' : f === 'foreign' ? 'Foreign' : 'Cambodian'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Utility Export Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = generateSecurityManifestText();
                    copyText(text, 'manifest-modal-text');
                    setCopiedManifestText(true);
                    setTimeout(() => setCopiedManifestText(false), 2500);
                  }}
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Copy formatted security text ready to paste into Telegram or WhatsApp"
                >
                  <i className={`fa-solid ${copiedManifestText ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                  <span>{copiedManifestText ? 'Copied Security Text!' : 'Copy Security Text'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Print Official Police Manifest Sheet"
                >
                  <i className="fa-solid fa-print text-stone-600"></i>
                  <span>Print Manifest</span>
                </button>

                <button
                  type="button"
                  onClick={handleSecurityManifestTelegramAlert}
                  disabled={localTgSending}
                  className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Send security manifest to Telegram bot"
                >
                  <i className="fa-brands fa-telegram text-sky-500"></i>
                  <span>{localTgSending ? 'Sending...' : 'Alert Telegram'}</span>
                </button>
              </div>
            </div>

            {/* Manifest Table */}
            <div className="overflow-y-auto flex-1 p-5">
              <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-100 border-b border-stone-200 font-bold text-stone-600 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5">Shot #</th>
                      <th className="px-3 py-2.5">Room</th>
                      <th className="px-3 py-2.5">Security Ref</th>
                      <th className="px-3 py-2.5">Guest Name</th>
                      <th className="px-3 py-2.5">Nationality</th>
                      <th className="px-3 py-2.5">Passport / National ID #</th>
                      <th className="px-3 py-2.5">Phone Number</th>
                      <th className="px-3 py-2.5">Check-in</th>
                      <th className="px-3 py-2.5">Check-out</th>
                      <th className="px-3 py-2.5 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    {filteredManifestList.map((g) => (
                      <tr key={g.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-3 py-2.5 font-mono font-black text-amber-600">
                          {g.shotNumber}
                        </td>
                        <td className="px-3 py-2.5 font-black text-brand-700">
                          Room {g.roomName || g.roomId}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-stone-500 font-bold">
                          {g.secCode}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-stone-900">
                          {g.guestName}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            g.isKhmer ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                          }`}>
                            {g.isKhmer ? 'Cambodian' : (g.guestNationality || 'Foreign')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-stone-800">
                          {g.passport ? (
                            <span className="inline-flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded">
                              {g.passport}
                            </span>
                          ) : (
                            <span className="text-stone-400 italic">None</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-stone-600">
                          {g.guestPhone || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-stone-700">
                          {g.checkInDate}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-stone-800">
                          {g.checkOutDate || 'Open'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <i className="fa-solid fa-check text-[9px]"></i>
                            Verified In-House
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredManifestList.length === 0 && (
                      <tr>
                        <td colSpan="10" className="py-10 text-center text-stone-400">
                          No active guests matching current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Official Sign-off Block for Police Inspection */}
              <div className="mt-6 pt-6 border-t border-dashed border-stone-300 grid grid-cols-2 gap-8 text-xs text-stone-600">
                <div>
                  <p className="font-bold text-stone-800">Hotel Reception / Management (អ្នករៀបចំរបាយការណ៍):</p>
                  <p className="text-[11px] text-stone-400 mt-1">Signature & Stamp (ហត្ថលេខា និងត្រា)</p>
                  <div className="mt-10 border-b border-stone-300 w-48"></div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-800">Inspecting Police / Security Officer (មន្ត្រីត្រួតពិនិត្យ):</p>
                  <p className="text-[11px] text-stone-400 mt-1">Signature & Badge Number (ហត្ថលេខា និងលេខកូដ)</p>
                  <div className="mt-10 border-b border-stone-300 w-48 ml-auto"></div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs shrink-0">
              <span className="text-stone-500 font-mono text-[11px]">
                Report Ref: SEC-MANIFEST-{today ? today().replace(/-/g, '') : 'LIVE'}
              </span>
              <button
                type="button"
                onClick={() => setShowSecurityManifestModal(false)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition cursor-pointer"
              >
                Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 6. SINGLE GUEST SECURITY SHOT VIEW SNAPSHOT MODAL                     */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {selectedSecurityGuest && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto anim-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
            {/* Card Header with Shot View Number & Room */}
            <div className="px-6 py-4 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 text-stone-950 font-mono font-black text-xs shadow-xs">
                  <i className="fa-solid fa-camera text-xs"></i>
                  <span>SHOT {selectedSecurityGuest.shotNumber}</span>
                </div>
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/15 border border-white/20 text-white font-black text-xs">
                  <span>Room {selectedSecurityGuest.roomName || selectedSecurityGuest.roomId}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSecurityGuest(null)}
                className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Guest Passport Snapshot Card */}
            <div className="p-6 space-y-4 text-xs">
              {/* Profile Bar */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-stone-100">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 text-white font-black text-lg flex items-center justify-center shadow-md uppercase">
                  {(selectedSecurityGuest.guestName || 'G').slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-black text-base text-stone-900">
                    {selectedSecurityGuest.guestName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                      selectedSecurityGuest.isKhmer ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
                      {selectedSecurityGuest.isKhmer ? '🇰🇭 Cambodian Citizen' : `🌐 ${selectedSecurityGuest.guestNationality || 'Foreign Guest'}`}
                    </span>
                    <span className="text-[10px] font-mono text-stone-400 font-bold">
                      {selectedSecurityGuest.secCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Passport / National ID Box */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Passport / National ID (លេខសម្គាល់ / លិខិតឆ្លងដែន)
                  </span>
                  <span className="font-mono text-sm font-black text-stone-900 mt-1 block">
                    {selectedSecurityGuest.passport || 'No ID Number Recorded'}
                  </span>
                </div>
                {selectedSecurityGuest.passport && (
                  <button
                    type="button"
                    onClick={() => copyText(selectedSecurityGuest.passport, 'modal-id')}
                    className="px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl font-bold text-stone-700 text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <i className={`fa-solid ${copiedId === 'modal-id' ? 'fa-check text-emerald-600' : 'fa-copy'}`}></i>
                    <span>{copiedId === 'modal-id' ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              {/* Contact & Room Details Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Contact Phone</span>
                  <span className="font-mono font-bold text-stone-800 mt-1 block">
                    {selectedSecurityGuest.guestPhone ? (
                      <a href={`tel:${selectedSecurityGuest.guestPhone}`} className="text-brand-600 hover:underline">
                        📞 {selectedSecurityGuest.guestPhone}
                      </a>
                    ) : 'Not Provided'}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Room / Floor</span>
                  <span className="font-bold text-stone-800 mt-1 block">
                    Floor {selectedSecurityGuest.roomFloor} • {selectedSecurityGuest.roomCategory}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Check-in Date</span>
                  <span className="font-bold text-stone-800 mt-1 flex items-center gap-1">
                    <i className="fa-regular fa-calendar text-emerald-600"></i>
                    {selectedSecurityGuest.checkInDate}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Expected Check-out</span>
                  <span className="font-bold text-stone-800 mt-1 flex items-center gap-1">
                    <i className="fa-regular fa-calendar-check text-amber-600"></i>
                    {selectedSecurityGuest.checkOutDate || 'Open Stay'}
                  </span>
                </div>
              </div>

              {/* Special Notes if any */}
              {selectedSecurityGuest.notes && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">Special Notes & Remarks</span>
                  <p className="text-stone-700 italic">{selectedSecurityGuest.notes}</p>
                </div>
              )}

              {/* Verified Security Footer Badge */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check text-emerald-600"></i>
                  <span>Security Verified In-House Guest</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-700 font-bold">
                  PASS ACTIVE
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = `🛡️ GUEST SECURITY PASS:
[${selectedSecurityGuest.shotNumber}] Room ${selectedSecurityGuest.roomName || selectedSecurityGuest.roomId}
• Guest: ${selectedSecurityGuest.guestName}
• Nationality: ${selectedSecurityGuest.guestNationality || 'N/A'}
• Passport / ID: ${selectedSecurityGuest.passport || 'N/A'}
• Phone: ${selectedSecurityGuest.guestPhone || 'N/A'}
• Stay: ${selectedSecurityGuest.checkInDate} to ${selectedSecurityGuest.checkOutDate || 'Open'}
• Ref: ${selectedSecurityGuest.secCode}`;
                  copyText(text, 'shot-modal-text');
                  showModal('success', 'Copied', 'Guest security pass details copied.');
                }}
                className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <i className="fa-solid fa-copy text-stone-500"></i>
                <span>Copy Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSecurityGuest(null)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 7. DETAILED GUEST CHECK-OUT MODAL (SETTLEMENT & ROOM STATUS)          */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <RoomCheckoutModal
        isOpen={!!checkoutModalGuest}
        onClose={() => setCheckoutModalGuest(null)}
        occupancy={checkoutModalGuest}
        relatedOccupancies={checkoutModalGuest?.relatedStays || []}
        rooms={rooms}
        settings={settings}
        auth={auth}
        currency={currency}
        onCheckoutSuccess={(data) => {
          if (fetchAll) fetchAll();
          if (fetchDash) fetchDash();
          showModal('success', 'Checked Out', `Guest ${data?.guestName || 'Guest'} checked out successfully.`);
        }}
        onCheckoutSuccessAndPrint={(invoiceData, related) => {
          if (fetchAll) fetchAll();
          if (fetchDash) fetchDash();
          setInvoiceModalGuest(invoiceData);
          setInvoiceModalRelated(related || []);
        }}
      />

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 8. OFFICIAL ROOM INVOICE / FOLIO MODAL (A4 & POS PRINTABLE)           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <RoomInvoiceModal
        isOpen={!!invoiceModalGuest}
        onClose={() => setInvoiceModalGuest(null)}
        occupancy={invoiceModalGuest}
        relatedOccupancies={invoiceModalRelated}
        rooms={rooms}
        settings={settings}
        currency={currency}
      />
    </div>
  );
}
