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

  const customerName = b.customerName || b.name || customer?.name || 'Guest';
  const phone = b.customerPhone || b.phone || customer?.phone || '';
  const itemName = b.itemName || b.motoName || (moto ? `${model?.name || moto.name} (${moto.plateNumber || ''})`.trim() : (b.modelId || 'Motorbike'));
  const startDate = toDateStr(b.startDate || b.checkoutDate);
  const endDate = toDateStr(b.endDate || b.returnDueDate);
  const price = Number(b.price || b.pricePerDay || 15);
  const totalDays = Number(b.totalDays || 1);
  const totalFee = Number(b.totalFee || b.totalAmount || (price * totalDays));
  const deposit = Number(b.deposit || 0);

  return {
    ...b,
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
    status: b.status || 'confirmed'
  };
}

/**
 * Normalizes a room record from chafe-2026 (hotel_rooms).
 */
export function normalizeRoom(r) {
  const num = String(r.number || r.name || '01');
  const name = r.name || (num.startsWith('លេខ') ? num : `បន្ទប់ ${num}`);
  const rate = Number(r.rate || r.beds1Price || r.price || 10);

  return {
    ...r,
    name,
    number: num,
    rate,
    beds1Price: rate,
    price: rate,
    floor: r.floor || '1',
    type: r.type || 'Standard',
    beds: r.beds || '1',
    status: r.status || 'available'
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
