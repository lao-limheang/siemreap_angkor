/**
 * Checks if two date ranges [s1, e1] and [s2, e2] overlap.
 */
export function isDateRangeOverlapping(start1, end1, start2, end2) {
  if (!start1 || !end1 || !start2 || !end2) return false;
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 <= e2 && s2 <= e1;
}

/**
 * Calculates real-time booking stock and availability for all models and bikes
 * across a specified date range.
 *
 * @param {Array} motos - All motorbikes
 * @param {Array} models - Motorbike models
 * @param {Array} rentals - Current rentals
 * @param {Array} bookings - Existing bookings
 * @param {string} startDate - Selected start date (YYYY-MM-DD)
 * @param {string} endDate - Selected end date (YYYY-MM-DD)
 * @returns {Object} Detailed stock metrics and model breakdown
 */
export function calculateBookingStock(motos = [], models = [], rentals = [], bookings = [], startDate, endDate) {
  const start = startDate || new Date().toISOString().split('T')[0];
  const end = endDate || start;

  // 1. Identify active rentals overlapping with the selected dates
  const overlappingRentals = rentals.filter(r => {
    if (r.status === 'returned' || r.status === 'cancelled') return false;
    const rStart = r.startDate || r.checkoutDate;
    const rEnd = r.endDate || r.returnDueDate;
    return isDateRangeOverlapping(rStart, rEnd, start, end);
  });

  // Set of bike IDs currently rented out during this period
  const rentedBikeIds = new Set(overlappingRentals.map(r => String(r.bikeId || r.motoId)).filter(Boolean));

  // 2. Identify active bookings overlapping with the selected dates
  const overlappingBookings = bookings.filter(b => {
    if (b.status === 'cancelled' || b.status === 'rejected') return false;
    const bStart = b.checkoutDate || b.startDate;
    const bEnd = b.returnDueDate || b.endDate;
    return isDateRangeOverlapping(bStart, bEnd, start, end);
  });

  // Set of bike IDs booked
  const bookedBikeIds = new Set();
  const bookedCountsByModel = {};

  overlappingBookings.forEach(b => {
    const motoId = String(b.motoId || b.bikeId || '');
    if (motoId) {
      bookedBikeIds.add(motoId);
    }
    const modelKey = b.modelId || b.motoName || b.bikeName || 'Other';
    bookedCountsByModel[modelKey] = (bookedCountsByModel[modelKey] || 0) + 1;
  });

  // 3. Stock metrics per individual motorbike
  const motoStock = motos.map(m => {
    const mId = String(m.id);
    const isRented = rentedBikeIds.has(mId) || m.status === 'rented';
    const isBooked = bookedBikeIds.has(mId);
    const inMaintenance = m.status === 'maintenance';

    let availability = 'available';
    if (inMaintenance) availability = 'maintenance';
    else if (isRented) availability = 'rented';
    else if (isBooked) availability = 'booked';

    return {
      ...m,
      availability,
      isAvailableForDates: availability === 'available',
      activeRental: overlappingRentals.find(r => String(r.bikeId || r.motoId) === mId) || null,
      activeBooking: overlappingBookings.find(b => String(b.motoId || b.bikeId) === mId) || null
    };
  });

  // 4. Stock metrics grouped by Model
  const modelStock = models.map(mod => {
    const modId = String(mod.id);
    const modBikes = motoStock.filter(m => String(m.modelId) === modId || m.name === mod.name);

    const totalFleet = modBikes.length;
    const rentedCount = modBikes.filter(m => m.availability === 'rented').length;
    const bookedCount = modBikes.filter(m => m.availability === 'booked').length;
    const maintenanceCount = modBikes.filter(m => m.availability === 'maintenance').length;
    const availableCount = modBikes.filter(m => m.availability === 'available').length;

    let stockStatus = 'in_stock';
    if (availableCount <= 0) stockStatus = 'out_of_stock';
    else if (availableCount === 1) stockStatus = 'low_stock';

    return {
      id: mod.id,
      name: mod.name,
      photoUrl: mod.photoUrl || mod.imageUrl || '',
      price: mod.price || (modBikes[0]?.price || 15),
      totalFleet,
      rentedCount,
      bookedCount,
      maintenanceCount,
      availableCount,
      stockStatus,
      bikes: modBikes
    };
  });

  // 5. Total overview
  const totalFleet = motos.length;
  const totalRented = overlappingRentals.length;
  const totalBooked = overlappingBookings.length;
  const totalAvailable = motoStock.filter(m => m.availability === 'available').length;

  return {
    startDate: start,
    endDate: end,
    totalFleet,
    totalRented,
    totalBooked,
    totalAvailable,
    modelStock,
    motoStock,
    overlappingRentals,
    overlappingBookings
  };
}
