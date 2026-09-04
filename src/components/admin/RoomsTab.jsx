import { useState, useMemo } from 'react';
import { useModal } from '../common/ModalProvider';
import { RoomService, BedCategoryService } from '../../services/DatabaseService';
import { fileToBase64 } from '../../utils/imageUtils';
import RoomBookingsTab from './RoomBookingsTab';

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
  currency
}) {
  const { showModal, showConfirm } = useModal();

  // Sub-navigation: 'occupancy' | 'categories' | 'rooms'
  const [subSection, setSubSection] = useState('rooms');

  // Filter & Search states for rooms
  const [roomSearch, setRoomSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');

  // Room Detail Modal / "One by One" view state
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  // Check-in form state
  const [checkInForm, setCheckInForm] = useState({
    roomId: '',
    guestName: '',
    guestPhone: '',
    guestNationality: '',
    bedCount: 1,
    checkInDate: today ? today() : new Date().toISOString().split('T')[0],
    checkOutDate: '',
    notes: ''
  });

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
    vacant: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400',
    occupied: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400',
    cleaning: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400',
    maintenance: 'bg-red-50 text-red-700 border-red-200 hover:border-red-400'
  };

  const statusBadgeColors = {
    vacant: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    occupied: 'bg-blue-100 text-blue-700 border-blue-200',
    cleaning: 'bg-amber-100 text-amber-700 border-amber-200',
    maintenance: 'bg-red-100 text-red-700 border-red-200'
  };

  const statusIcons = {
    vacant: 'fa-circle-check text-emerald-500',
    occupied: 'fa-user-check text-blue-500',
    cleaning: 'fa-broom text-amber-500',
    maintenance: 'fa-wrench text-red-500'
  };

  // ─── Filtered Rooms ────────────────────────────────────────────────────────
  const filteredRooms = useMemo(() => {
    return (rooms || []).filter(room => {
      const q = roomSearch.toLowerCase().trim();
      const matchName = !q || String(room.name || '').toLowerCase().includes(q) || String(room.categoryName || '').toLowerCase().includes(q);
      const matchCat = catFilter === 'all' || String(room.categoryId) === String(catFilter);
      const matchStatus = statusFilter === 'all' || room.status === statusFilter;
      const matchFloor = floorFilter === 'all' || String(room.floor) === String(floorFilter);
      return matchName && matchCat && matchStatus && matchFloor;
    });
  }, [rooms, roomSearch, catFilter, statusFilter, floorFilter]);

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
  };

  const handleNextRoom = () => {
    if (filteredRooms.length === 0) return;
    const nextIdx = selectedRoomIndex < filteredRooms.length - 1 ? selectedRoomIndex + 1 : 0;
    setSelectedRoomId(filteredRooms[nextIdx].id);
  };

  // ─── CHECK-IN HANDLERS ────────────────────────────────────────────────────
  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!checkInForm.roomId) {
      showModal('error', 'Select Room', 'Please choose an available room for check-in.');
      return;
    }
    try {
      await fetch('/api/room-occupancy', {
        method: 'POST',
        ...auth,
        body: JSON.stringify(checkInForm)
      });
      if (fetchAll) fetchAll();
      if (fetchDash) fetchDash();
      showModal('success', 'Check-in Successful', `Guest ${checkInForm.guestName} has been checked in.`);
      setCheckInForm({
        roomId: '',
        guestName: '',
        guestPhone: '',
        guestNationality: '',
        bedCount: 1,
        checkInDate: today ? today() : new Date().toISOString().split('T')[0],
        checkOutDate: '',
        notes: ''
      });
    } catch (err) {
      showModal('error', 'Check-in Failed', err.message);
    }
  };

  const handleCheckOut = async (occupancyId, guestName) => {
    const ok = await showConfirm(
      'Confirm Check-out',
      `Are you sure you want to check out ${guestName || 'this guest'}?`,
      'Check Out',
      'warning'
    );
    if (!ok) return;

    try {
      await fetch(`/api/room-occupancy/${occupancyId}/checkout`, {
        method: 'PATCH',
        ...auth
      });
      if (fetchAll) fetchAll();
      if (fetchDash) fetchDash();
      showModal('success', 'Checked Out', 'Guest checked out successfully.');
    } catch (err) {
      showModal('error', 'Check-out Error', err.message);
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
      bedCount: room.bedCount || 1,
      checkInDate: today ? today() : new Date().toISOString().split('T')[0],
      checkOutDate: '',
      notes: ''
    });
    setSelectedRoomId(null);
    setSubSection('occupancy');
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

                  <div className="flex items-center gap-2">
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
                <label className={labelCls}>Select Room</label>
                <select
                  value={checkInForm.roomId}
                  onChange={e => {
                    const r = rooms.find(rm => String(rm.id) === String(e.target.value));
                    setCheckInForm({
                      ...checkInForm,
                      roomId: e.target.value,
                      bedCount: r?.bedCount || 1
                    });
                  }}
                  className={inputCls}
                  required
                >
                  <option value="">Choose a vacant room...</option>
                  {rooms.filter(r => r.status === 'vacant').map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.name} — Floor {r.floor || '1'} — {r.categoryName || `${r.bedCount || 1} Bed`} (${r.price || r.rate}/night)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Guest Name</label>
                <input
                  type="text"
                  value={checkInForm.guestName}
                  onChange={e => setCheckInForm({ ...checkInForm, guestName: e.target.value })}
                  placeholder="Full name of guest"
                  className={inputCls}
                  required
                />
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
            {/* Room Status Overview */}
            <div className={`${cardCls} p-6`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-stone-900">Room Status Overview ({rooms.length})</h3>
                  <p className="text-xs text-stone-500">Quick view of all rooms with instant status switcher</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubSection('rooms')}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700"
                >
                  Manage Rooms →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {rooms.map(room => {
                  const occ = activeOccupancy.find(o => String(o.roomId) === String(room.id));
                  return (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`rounded-2xl border-2 p-3.5 transition-all cursor-pointer hover:shadow-md ${statusColors[room.status] || statusColors.vacant}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-black">Room {room.name}</span>
                        <i className={`fa-solid ${statusIcons[room.status] || statusIcons.vacant} text-sm`}></i>
                      </div>

                      <p className="text-[11px] font-semibold text-indigo-700 truncate mb-2">
                        {room.categoryName || `${room.bedCount || 1} Bed`}
                      </p>

                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold capitalize">{room.status}</span>
                        <span className="font-black text-stone-800">${room.price || room.rate}</span>
                      </div>

                      {occ && (
                        <div className="pt-2 border-t border-blue-200/60 text-xs">
                          <p className="font-bold truncate text-blue-900">{occ.guestName}</p>
                          <p className="text-[10px] text-blue-700">Out: {occ.checkOutDate}</p>
                        </div>
                      )}

                      {/* Quick Status Buttons */}
                      <div className="mt-2.5 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                        {['vacant', 'occupied', 'cleaning', 'maintenance']
                          .filter(s => s !== room.status)
                          .map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleStatusChange(room.id, s)}
                              className="text-[9px] font-bold px-1.5 py-0.5 bg-white/80 hover:bg-white rounded border border-stone-200 capitalize transition-colors"
                            >
                              → {s}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Stays Table */}
            <div className={`${cardCls} overflow-hidden`}>
              <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                <h3 className="font-bold text-stone-900">Active Checked-in Guests ({activeOccupancy.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-stone-50 border-b border-stone-100 text-xs text-stone-500 uppercase tracking-wider">
                    <tr>
                      {['Room', 'Guest Name', 'Phone', 'Check-in', 'Check-out', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeOccupancy.map(o => (
                      <tr key={o.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-black text-brand-600">
                          Room {o.roomName || o.roomId}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-stone-900">{o.guestName}</p>
                          <p className="text-xs text-stone-400">{o.guestNationality || '—'}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{o.guestPhone || '—'}</td>
                        <td className="px-4 py-3 text-xs">{o.checkInDate}</td>
                        <td className="px-4 py-3 text-xs font-bold text-amber-700">{o.checkOutDate}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleCheckOut(o.id, o.guestName)}
                            className="text-xs font-bold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors whitespace-nowrap shadow-xs"
                          >
                            <i className="fa-solid fa-right-from-bracket mr-1"></i> Check Out
                          </button>
                        </td>
                      </tr>
                    ))}
                    {activeOccupancy.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-10 text-center text-stone-400">
                          No active check-ins right now.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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

            {/* Modal Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleEditRoom(selectedRoom);
                    setSelectedRoomId(null);
                  }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                  <i className="fa-solid fa-pen mr-1"></i> Edit Room
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRoom(selectedRoom.id, selectedRoom.name)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  <i className="fa-solid fa-trash mr-1"></i> Delete Room
                </button>
              </div>

              <div className="flex items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => setSelectedRoomId(null)}
                  className="px-4 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
