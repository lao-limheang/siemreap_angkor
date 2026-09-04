/** Convert Firestore timestamps, Date objects, or ISO strings to YYYY-MM-DD. */
export function toDateStr(value) {
  if (value == null || value === '') return '';

  const localISODate = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (typeof value === 'number') return localISODate(new Date(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const asNum = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(asNum) && asNum > 1e11) return localISODate(new Date(asNum));
    return localISODate(new Date(trimmed)) || trimmed.slice(0, 10);
  }
  if (value instanceof Date) return localISODate(value);
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return localISODate(value.toDate());
    if (typeof value.seconds === 'number') return localISODate(new Date(value.seconds * 1000));
  }
  return '';
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Resolves customer label (name and phone) from customers list.
 */
export function getCustomerLabel(customerId, customers = []) {
  if (!customerId) return '—';
  const c = customers.find(x => String(x.id) === String(customerId));
  return c ? c.name : customerId;
}

/**
 * Resolves motorbike label (Model + Plate number) from motos & models list.
 */
export function getBikeLabel(motoId, motos = [], models = []) {
  if (!motoId) return '—';
  const b = motos.find(x => String(x.id) === String(motoId));
  if (!b) return 'Motorbike';
  let modelName = '';
  if (b.modelId) {
    const m = models.find(x => String(x.id) === String(b.modelId));
    if (m) modelName = m.name || m.model || '';
  }
  const plate = (b.plateNumber || b.plateNo || '').trim();
  const name = b.name || modelName || 'Motor';
  return plate ? `${name} (${plate})` : name;
}

/**
 * Normalizes a rental record from chafe-2026.
 */
export function normalizeRental(r, customers = [], motos = [], models = []) {
  const customer = customers.find(c => String(c.id) === String(r.customerId));
  const moto = motos.find(m => String(m.id) === String(r.motoId));
  const model = models.find(mod => String(mod.id) === String(moto?.modelId));

  const guestName = r.guestName || r.customerName || customer?.name || 'Customer';
  const guestPhone = r.guestPhone || r.customerPhone || customer?.phone || '';
  const bikeName = r.bikeName || r.motoName || (moto ? `${model?.name || moto.name} (${moto.plateNumber || ''})`.trim() : 'Motorbike');
  const plateNumber = r.plateNumber || moto?.plateNumber || '';
  const startDate = toDateStr(r.startDate || r.checkoutDate);
  const endDate = toDateStr(r.endDate || r.returnDueDate);
  const dailyRate = Number(r.dailyRate || r.pricePerDay || (moto?.price || 15));
  const totalDays = Number(r.totalDays || 1);
  const totalPrice = Number(r.totalPrice || r.totalFee || (dailyRate * totalDays));
  const deposit = Number(r.deposit || 0);

  return {
    ...r,
    guestName,
    guestPhone,
    bikeName,
    plateNumber,
    bikeId: r.bikeId || r.motoId || (moto ? moto.id : null),
    motoId: r.motoId || r.bikeId || (moto ? moto.id : null),
    customerId: r.customerId || (customer ? customer.id : null),
    startDate,
    endDate,
    checkoutDate: startDate,
    returnDueDate: endDate,
    timeOut: r.timeOut || r.checkoutTime || '08:00',
    timeDue: r.timeDue || r.returnDueTime || '18:00',
    dailyRate,
    pricePerDay: dailyRate,
    totalDays,
    totalPrice,
    totalFee: totalPrice,
    deposit,
    status: r.status || 'active'
  };
}

/**
 * Normalizes a booking record from chafe-2026.
 */
export function normalizeBooking(b, customers = [], motos = [], models = []) {
  const customer = customers.find(c => String(c.id) === String(b.customerId));
  const moto = motos.find(m => String(m.id) === String(b.motoId));
  const model = models.find(mod => String(mod.id) === String(moto?.modelId));

  const isRoom = b.type === 'room' || Boolean(b.roomId) || Boolean(b.roomName) || String(b.itemName || '').toLowerCase().includes('room');

  const customerName = b.customerName || b.name || customer?.name || 'Guest';
  const phone = b.customerPhone || b.phone || customer?.phone || '';
  const itemName = b.itemName || (isRoom ? `Room ${b.roomName || b.roomId || ''}` : (b.motoName || (moto ? `${model?.name || moto.name} (${moto.plateNumber || ''})`.trim() : (b.modelId || 'Motorbike'))));
  const startDate = toDateStr(b.startDate || b.checkoutDate);
  const endDate = toDateStr(b.endDate || b.returnDueDate);
  const price = Number(b.price || b.pricePerDay || (isRoom ? 25 : 15));
  const totalDays = Number(b.totalDays || 1);
  const totalFee = Number(b.totalFee || b.totalAmount || (price * totalDays));
  const deposit = Number(b.deposit || 0);

  return {
    ...b,
    id: String(b.id || ''),
    type: isRoom ? 'room' : 'motor',
    roomId: b.roomId || '',
    roomName: b.roomName || (isRoom ? String(itemName).replace(/^Room\s*/i, '') : ''),
    categoryName: b.categoryName || '',
    bedType: b.bedType || '',
    bedCount: Number(b.bedCount || 1),
    guests: Number(b.guests || 1),
    bookingRef: b.bookingRef || (isRoom ? `SR-ROOM-${String(b.id || '').slice(-5)}` : `SR-BK-${String(b.id || '').slice(-5)}`),
    paymentMethod: b.paymentMethod || 'cash',
    nationality: b.nationality || '',
    email: b.email || '',
    arrivalTime: b.arrivalTime || '14:00 - 16:00',
    specialRequests: b.specialRequests || b.note || '',
    customerName,
    phone,
    customerPhone: phone,
    itemName,
    startDate,
    endDate,
    checkoutDate: startDate,
    returnDueDate: endDate,
    price,
    pricePerDay: price,
    totalDays,
    totalFee,
    deposit,
    status: b.status || 'confirmed',
    createdAt: b.createdAt || new Date().toISOString()
  };
}

/**
 * Normalizes a bed category record.
 */
export function normalizeBedCategory(c) {
  const bedCount = Number(c.bedCount || 1);
  const price = Number(c.price || 25);
  let images = [];
  if (c.images) {
    images = Array.isArray(c.images) ? c.images : [c.images];
  } else if (c.imageUrl) {
    try {
      images = typeof c.imageUrl === 'string' && c.imageUrl.startsWith('[') ? JSON.parse(c.imageUrl) : [c.imageUrl];
    } catch {
      images = [c.imageUrl];
    }
  }

  let amenities = [];
  if (Array.isArray(c.amenities)) {
    amenities = c.amenities;
  } else if (typeof c.amenities === 'string') {
    try {
      amenities = JSON.parse(c.amenities);
    } catch {
      amenities = c.amenities.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  return {
    ...c,
    id: String(c.id || ''),
    name: c.name || `${bedCount} Bed Category`,
    bedType: c.bedType || (bedCount === 1 ? '1 Queen Bed' : (bedCount === 2 ? '2 Single Beds' : `${bedCount} Beds`)),
    bedCount,
    price,
    capacity: Number(c.capacity || (bedCount * 2 > 4 ? 4 : bedCount * 2)),
    description: c.description || '',
    amenities,
    images
  };
}

/**
 * Normalizes a room record from chafe-2026 (hotel_rooms) or local db.
 */
export function normalizeRoom(r, categories = []) {
  const num = String(r.number || r.name || '01');
  const name = r.name || (num.startsWith('លេខ') ? num : `បន្ទប់ ${num}`);
  const catId = String(r.categoryId || r.bedCategoryId || '');
  const cat = categories.find(c => String(c.id) === catId);
  const bedCount = Number(r.bedCount || cat?.bedCount || r.beds || 1);
  const bedType = r.bedType || cat?.bedType || (bedCount === 1 ? '1 Queen Bed' : (bedCount === 2 ? '2 Single Beds' : `${bedCount} Beds`));
  const rate = Number(r.price || r.rate || cat?.price || r.beds1Price || 25);

  let images = [];
  if (r.images) {
    images = Array.isArray(r.images) ? r.images : [r.images];
  } else if (r.imageUrl) {
    try {
      images = typeof r.imageUrl === 'string' && r.imageUrl.startsWith('[') ? JSON.parse(r.imageUrl) : [r.imageUrl];
    } catch {
      images = [r.imageUrl];
    }
  }
  if (images.length === 0 && cat?.images && cat.images.length > 0) {
    images = cat.images;
  }

  let amenities = [];
  if (Array.isArray(r.amenities)) {
    amenities = r.amenities;
  } else if (typeof r.amenities === 'string') {
    try {
      amenities = JSON.parse(r.amenities);
    } catch {
      amenities = r.amenities.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (amenities.length === 0 && cat?.amenities) {
    amenities = cat.amenities;
  }

  return {
    ...r,
    id: String(r.id || ''),
    name,
    number: num,
    categoryId: catId || (cat?.id || ''),
    categoryName: cat?.name || r.categoryName || r.type || `${bedCount} Bed Room`,
    bedType,
    bedCount,
    capacity: Number(r.capacity || cat?.capacity || (bedCount * 2)),
    rate,
    price: rate,
    beds1Price: Number(r.beds1Price || rate),
    beds2Price: Number(r.beds2Price || (rate + 10)),
    beds3Price: Number(r.beds3Price || (rate + 20)),
    floor: String(r.floor || '1'),
    type: cat?.name || r.type || 'Standard',
    beds: bedCount,
    status: r.status || 'vacant',
    description: r.description || cat?.description || '',
    images,
    amenities
  };
}

/**
 * Normalizes a moto record from chafe-2026.
 */
export function normalizeMoto(m, models = []) {
  const model = models.find(mod => String(mod.id) === String(m.modelId));
  const name = m.name || model?.name || 'Motorbike';
  const price = Number(m.price || model?.dailyPrice || 15);

  return {
    ...m,
    name,
    modelName: model?.name || name,
    price,
    dailyPrice: price,
    plateNumber: m.plateNumber || '',
    status: m.status || 'available'
  };
}
