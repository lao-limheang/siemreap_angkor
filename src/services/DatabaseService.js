import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { dbMotos, dbRooms } from '../firebase';

export class BaseModel {
  constructor(db, collectionName) {
    this.db = db;
    this.collectionName = collectionName;
    this.collectionRef = collection(db, collectionName);
  }

  validate(data, isUpdate = false) {
    return { valid: true, errors: [] };
  }

  async getAll() {
    try {
      const snap = await getDocs(this.collectionRef);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(`Error reading ${this.collectionName}:`, e);
      return [];
    }
  }

  async create(data) {
    const { valid, errors } = this.validate(data, false);
    if (!valid) throw new Error(errors.join(', '));
    const cleanData = { ...data, createdAt: data.createdAt || Date.now() };
    const docRef = await addDoc(this.collectionRef, cleanData);
    return { id: docRef.id, ...cleanData };
  }

  async update(id, data) {
    const { valid, errors } = this.validate(data, true);
    if (!valid) throw new Error(errors.join(', '));
    const docRef = doc(this.db, this.collectionName, String(id));
    const cleanData = { ...data, updatedAt: Date.now() };
    await setDoc(docRef, cleanData, { merge: true });
    return { id, ...cleanData };
  }

  async delete(id) {
    const docRef = doc(this.db, this.collectionName, String(id));
    await deleteDoc(docRef);
  }

  /**
   * Listen to real-time changes in Firestore (onSnapshot).
   * Any change made on https://checkin-chafe1.web.app/motor.html triggers this instantly!
   */
  subscribe(callback, sortFn) {
    return onSnapshot(this.collectionRef, (snap) => {
      let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (sortFn) items.sort(sortFn);
      callback(items);
    }, (err) => {
      console.error(`Realtime subscription error on ${this.collectionName}:`, err);
    });
  }
}

// ─── SERVICES CONNECTED TO chafe-2026 (Live Old System Database) ─────────────

export class MotoModel extends BaseModel {
  constructor() {
    super(dbMotos, 'motos');
  }
}

export class BikeModelModel extends BaseModel {
  constructor() {
    // Old system uses 'motor_models' in chafe-2026
    super(dbMotos, 'motor_models');
  }
}

export class BookingModel extends BaseModel {
  constructor() {
    // Old system uses 'bookings' in chafe-2026
    super(dbMotos, 'bookings');
  }

  validate(data, isUpdate = false) {
    if (isUpdate) return { valid: true, errors: [] };
    const errors = [];
    if (!data.customerName && !data.name) errors.push("Customer name is required");
    return { valid: errors.length === 0, errors };
  }
}

export class RoomModel extends BaseModel {
  constructor() {
    // Connect directly to hotel_rooms in chafe-2026
    super(dbMotos, 'hotel_rooms');
  }
}

export class BedCategoryModel extends BaseModel {
  constructor() {
    super(dbMotos, 'bed_categories');
  }
}

export const MotoService = new MotoModel();
export const BikeModelService = new BikeModelModel();
export const BookingService = new BookingModel();
export const RoomService = new RoomModel();
export const BedCategoryService = new BedCategoryModel();

export const CustomerService = new BaseModel(dbMotos, 'customers');
export const RentalService = new BaseModel(dbMotos, 'rentals');
export const ReturnService = new BaseModel(dbMotos, 'returns');
export const MaintenanceService = new BaseModel(dbMotos, 'maintenance');
export const ExpenseService = new BaseModel(dbMotos, 'expenses');
export const HotelRoomService = RoomService;
export const HotelBookingService = new BaseModel(dbMotos, 'hotel_bookings');
export const UserService = new BaseModel(dbMotos, 'users');
export const CustomizerService = new BaseModel(dbMotos, 'customizer_settings');
export const PublicSettingsService = new BaseModel(dbMotos, 'public_settings');

// Fallback services
export const OccupancyService = new BaseModel(dbRooms, 'occupancy');
export const InvoiceService = new BaseModel(dbRooms, 'invoices');
export const HousekeepingService = new BaseModel(dbRooms, 'housekeeping');
export const GuestService = new BaseModel(dbRooms, 'guests');
export const StaffService = new BaseModel(dbRooms, 'staff');
export const AuditLogService = new BaseModel(dbRooms, 'audit-logs');

// ─── SYNC HELPERS (Two-Way Realtime with https://checkin-chafe1.web.app/motor.html) ─────

/**
 * Saves a new booking into chafe-2026 Firestore 'bookings' collection.
 * The old system watches 'bookings' via onSnapshot, so it sees this in real time!
 */
export async function syncBookingToOldSystem(booking) {
  try {
    const totalDays = booking.totalDays || (booking.startDate && booking.endDate
      ? Math.max(1, Math.ceil((new Date(booking.endDate) - new Date(booking.startDate)) / 86400000))
      : 1);

    const pricePerDay = Number(booking.pricePerDay || booking.price || 15);
    const totalFee = Number(booking.totalFee || booking.totalPrice || (pricePerDay * totalDays));
    const deposit = Number(booking.deposit || 0);

    const isRoom = booking.type === 'room' || Boolean(booking.roomId) || Boolean(booking.roomName);

    const payload = {
      type: isRoom ? 'room' : 'motor',
      customerName: booking.customerName || booking.name || 'Website Guest',
      customerPhone: booking.customerPhone || booking.phone || '',
      phone: booking.customerPhone || booking.phone || '',
      email: booking.email || '',
      nationality: booking.nationality || '',
      motoId: booking.motoId || booking.bikeId || '',
      motoName: booking.motoName || booking.bikeName || (!isRoom ? booking.itemName : '') || '',
      roomId: booking.roomId || '',
      roomName: booking.roomName || '',
      categoryName: booking.categoryName || '',
      bedType: booking.bedType || '',
      bedCount: Number(booking.bedCount || 1),
      guests: Number(booking.guests || 1),
      bookingRef: booking.bookingRef || `SR-${isRoom ? 'ROOM' : 'BK'}-${Math.floor(10000 + Math.random() * 90000)}`,
      paymentMethod: booking.paymentMethod || 'cash',
      arrivalTime: booking.arrivalTime || '14:00 - 16:00',
      specialRequests: booking.specialRequests || booking.note || '',
      itemName: booking.itemName || (isRoom ? `Room ${booking.roomName || booking.roomId}` : 'Motorbike'),
      startDate: booking.startDate || booking.checkoutDate || new Date().toISOString().split('T')[0],
      endDate: booking.endDate || booking.returnDueDate || new Date().toISOString().split('T')[0],
      checkoutDate: booking.checkoutDate || booking.startDate || new Date().toISOString().split('T')[0],
      returnDueDate: booking.returnDueDate || booking.endDate || new Date().toISOString().split('T')[0],
      totalDays: Number(totalDays),
      pricePerDay: pricePerDay,
      totalFee: totalFee,
      deposit: deposit,
      status: booking.status || 'pending',
      deliveryType: booking.deliveryType || 'Pickup at Shop',
      contactFrom: booking.contactFrom || 'Website Online Booking',
      halfDay: Boolean(booking.halfDay),
      note: booking.specialRequests || booking.note || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const res = await BookingService.create(payload);
    if (isRoom) {
      await HotelBookingService.create(payload).catch(() => {});
    }
    console.log('Synced booking to chafe-2026 real-time Firestore:', res.id);
    return res;
  } catch (e) {
    console.error('Failed to sync booking to chafe-2026:', e);
  }
}

/**
 * Saves a new rental check-out into chafe-2026 Firestore 'rentals' collection
 * and marks the moto as 'rented'.
 */
export async function syncRentalCheckoutToOldSystem(rental) {
  try {
    const paymentType = rental.paymentType || rental.depositType || 'cash';
    const paymentBy = rental.paymentBy || rental.paymentType || rental.depositType || 'Cash';
    const staffName = rental.staffName || rental.resellStaff || 'Reception';
    const resellStaff = rental.resellStaff || rental.staffName || '';

    const payload = {
      guestName: rental.guestName || '',
      customerName: rental.guestName || '',
      phone: rental.guestPhone || '',
      customerPhone: rental.guestPhone || '',
      passportOrId: rental.guestDoc || '',
      motoId: rental.bikeId || rental.motoId || '',
      bikeId: rental.bikeId || rental.motoId || '',
      motoName: rental.bikeName || '',
      bikeName: rental.bikeName || '',
      plateNumber: rental.plateNumber || '',
      checkoutDate: rental.startDate || new Date().toISOString().split('T')[0],
      startDate: rental.startDate || new Date().toISOString().split('T')[0],
      returnDueDate: rental.endDate || new Date().toISOString().split('T')[0],
      endDate: rental.endDate || new Date().toISOString().split('T')[0],
      timeOut: rental.timeOut || '08:00',
      timeDue: rental.timeDue || '18:00',
      rentalType: rental.rentalType || 'full',
      extraHalfDay: Boolean(rental.extraHalfDay),
      dailyRate: Number(rental.dailyRate || 0),
      totalPrice: Number(rental.totalPrice || 0),
      totalFee: Number(rental.totalPrice || 0),
      deposit: Number(rental.deposit || 0),
      depositType: rental.depositType || paymentType,
      paymentType,
      paymentBy,
      fuelOut: rental.fuelOut || 'Full',
      kmOut: Number(rental.kmOut || 0),
      helmets: Number(rental.helmets || 1),
      staffName,
      resellStaff,
      note: rental.notes || rental.note || '',
      notes: rental.notes || rental.note || '',
      status: 'active',
      createdAt: Date.now()
    };

    const res = await RentalService.create(payload);

    // Also update moto status to 'rented' in chafe-2026
    const motoId = rental.bikeId || rental.motoId;
    if (motoId) {
      await MotoService.update(motoId, { status: 'rented' }).catch(err => {
        console.warn('Failed to update moto status to rented:', err);
      });
    }

    console.log('Synced rental check-out to chafe-2026:', res.id);
    return res;
  } catch (e) {
    console.error('Failed to sync rental to chafe-2026:', e);
    throw e;
  }
}

/**
 * Marks rental as returned and updates moto status back to 'available' in chafe-2026.
 */
export async function syncRentalReturnToOldSystem(rentalId, motoId, returnData = {}) {
  try {
    const returnDate = returnData.returnDate || new Date().toISOString().split('T')[0];
    const returnTime = returnData.returnTime || new Date().toTimeString().slice(0, 5);
    const returnKm = Number(returnData.returnKm || returnData.kilometerIn || 0);
    const returnFuel = returnData.returnFuel || returnData.fuelIn || 'Full';
    const lateFee = Number(returnData.lateFee || 0);
    const damageFee = Number(returnData.damageFee || 0);
    const returnPaymentType = returnData.paymentType || returnData.returnPaymentType || 'cash';
    const staffName = returnData.staffName || returnData.returnStaff || '';

    if (rentalId) {
      await RentalService.update(rentalId, {
        status: 'returned',
        returnDate,
        returnTime,
        returnKm,
        returnFuel,
        lateFee,
        damageFee,
        returnPaymentType,
        returnStaff: staffName,
        returnedAt: Date.now()
      }).catch(err => console.warn('RentalService.update return error:', err));
    }

    if (motoId) {
      await MotoService.update(motoId, { status: 'available' }).catch(err => {
        console.warn('MotoService.update return error:', err);
      });
    }

    // Add entry in 'returns' collection to sync with motor.html
    await ReturnService.create({
      rentalId: String(rentalId || ''),
      motoId: String(motoId || ''),
      returnDate,
      returnTime,
      kilometerIn: returnKm,
      fuelIn: returnFuel,
      lateFee,
      damageFee,
      paymentType: returnPaymentType,
      staffName,
      createdAt: Date.now()
    }).catch(err => console.warn('ReturnService.create error:', err));

    console.log('Synced rental return to chafe-2026 for rental:', rentalId);
    return { success: true };
  } catch (e) {
    console.error('Failed to sync return to chafe-2026:', e);
    throw e;
  }
}
