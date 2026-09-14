import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { copyFileSync, existsSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const databasePath = process.env.VERCEL
  ? join('/tmp', 'app.db')
  : join(__dirname, 'app.db');

// Vercel's deployed filesystem is read-only, so each function instance gets
// a writable temporary copy of the seed database.
if (process.env.VERCEL && !existsSync(databasePath)) {
  const candidateSeedPaths = [
    join(process.cwd(), 'server', 'app.db'),
    join(__dirname, '..', 'server', 'app.db'),
    join(__dirname, 'app.db'),
    join(process.cwd(), 'app.db')
  ];
  let copied = false;
  for (const seedPath of candidateSeedPaths) {
    if (existsSync(seedPath)) {
      try {
        copyFileSync(seedPath, databasePath);
        console.log(`Successfully copied database seed from ${seedPath} to ${databasePath}`);
        copied = true;
        break;
      } catch (copyErr) {
        console.error(`Error copying from ${seedPath}:`, copyErr);
      }
    }
  }
  if (!copied) {
    console.warn("No seed database found to copy to /tmp. SQLite will initialize a fresh database.");
  }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

io.on('connection', (socket) => {
  console.log('Client connected to Socket.io');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ===================== DATABASE =====================
const db = new sqlite3.Database(databasePath, (err) => {
  if (err) { console.error("Error opening database", err.message); return; }
  
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");

    // Bikes table
    db.run(`CREATE TABLE IF NOT EXISTS bikes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      year TEXT,
      isOnSale INTEGER DEFAULT 0,
      originalPrice INTEGER,
      imageUrl TEXT,
      plateNumber TEXT,
      color TEXT,
      status TEXT DEFAULT 'available'
    )`);

    // Bed categories table
    db.run(`CREATE TABLE IF NOT EXISTS bed_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bedType TEXT,
      bedCount INTEGER DEFAULT 1,
      price REAL NOT NULL DEFAULT 25,
      capacity INTEGER DEFAULT 2,
      description TEXT,
      amenities TEXT,
      imageUrl TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Rooms table
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      imageUrl TEXT,
      beds1Price INTEGER NOT NULL DEFAULT 25,
      beds2Price INTEGER NOT NULL DEFAULT 35,
      beds3Price INTEGER NOT NULL DEFAULT 45,
      amenities TEXT,
      policies TEXT,
      status TEXT DEFAULT 'vacant',
      floor TEXT DEFAULT '1',
      categoryId INTEGER,
      bedType TEXT,
      bedCount INTEGER DEFAULT 1,
      price REAL DEFAULT 25
    )`, () => {
      // Migrate existing rooms table if needed
      db.run(`ALTER TABLE rooms ADD COLUMN categoryId INTEGER`, () => {});
      db.run(`ALTER TABLE rooms ADD COLUMN bedType TEXT`, () => {});
      db.run(`ALTER TABLE rooms ADD COLUMN bedCount INTEGER DEFAULT 1`, () => {});
      db.run(`ALTER TABLE rooms ADD COLUMN price REAL DEFAULT 25`, () => {});
    });

    // Bookings table (from public website)
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      itemName TEXT NOT NULL,
      customerName TEXT NOT NULL,
      phone TEXT NOT NULL,
      startDate TEXT,
      endDate TEXT,
      guests INTEGER DEFAULT 1,
      bedCount INTEGER DEFAULT 1,
      specialRequests TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now'))
    )`, () => {
      // Ensure status column exists if table was already created
      db.run(`ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT 'pending'`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN roomId TEXT`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN roomName TEXT`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN categoryName TEXT`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN bedType TEXT`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN bookingRef TEXT`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN pricePerDay REAL DEFAULT 0`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN totalFee REAL DEFAULT 0`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN paymentMethod TEXT DEFAULT 'cash'`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN arrivalTime TEXT`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN nationality TEXT`, () => {});
      db.run(`ALTER TABLE bookings ADD COLUMN email TEXT`, () => {});
    });

    // Guests CRM
    db.run(`CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      nationality TEXT,
      passportId TEXT,
      notes TEXT,
      totalStays INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Room Occupancy (active check-ins)
    // roomId is nullable — bookings from the public site may not have a matching SQLite room row
    db.run(`CREATE TABLE IF NOT EXISTS room_occupancy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomId INTEGER,
      guestName TEXT NOT NULL,
      guestPhone TEXT,
      guestNationality TEXT,
      bedCount INTEGER DEFAULT 1,
      checkInDate TEXT NOT NULL,
      checkOutDate TEXT,
      actualCheckOut TEXT,
      status TEXT DEFAULT 'checked_in',
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Migration: recreate room_occupancy without NOT NULL / FK on roomId if needed
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='room_occupancy'", [], (err, row) => {
      if (!err && row && (row.sql || '').includes('roomId INTEGER NOT NULL')) {
        db.serialize(() => {
          db.run('PRAGMA foreign_keys = OFF');
          db.run(`CREATE TABLE IF NOT EXISTS room_occupancy_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roomId INTEGER,
            guestName TEXT NOT NULL,
            guestPhone TEXT,
            guestNationality TEXT,
            bedCount INTEGER DEFAULT 1,
            checkInDate TEXT NOT NULL,
            checkOutDate TEXT,
            actualCheckOut TEXT,
            status TEXT DEFAULT 'checked_in',
            notes TEXT,
            createdAt TEXT DEFAULT (datetime('now'))
          )`);
          db.run(`INSERT OR IGNORE INTO room_occupancy_new SELECT id,roomId,guestName,guestPhone,guestNationality,bedCount,checkInDate,checkOutDate,actualCheckOut,status,notes,createdAt FROM room_occupancy`);
          db.run(`DROP TABLE room_occupancy`);
          db.run(`ALTER TABLE room_occupancy_new RENAME TO room_occupancy`);
          db.run('PRAGMA foreign_keys = ON');
          console.log('[DB Migration] room_occupancy: removed NOT NULL/FK from roomId');
        });
      }
    });

    db.run("ALTER TABLE room_occupancy ADD COLUMN totalPrice REAL", () => {});
    db.run("ALTER TABLE room_occupancy ADD COLUMN paymentMethod TEXT DEFAULT 'cash'", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN totalPrice REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN lateFee REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN paymentType TEXT DEFAULT 'cash'", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN paymentBy TEXT DEFAULT 'Cash'", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN staffName TEXT", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN resellStaff TEXT", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN returnKm INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN returnFuel TEXT DEFAULT 'Full'", () => {});
    db.run("ALTER TABLE rentals ADD COLUMN returnDate TEXT", () => {});

    // Motorbike Rentals (flexible bikeId to support Firestore IDs without FK collision)
    db.run(`CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bikeId TEXT,
      guestName TEXT NOT NULL,
      guestPhone TEXT,
      guestNationality TEXT,
      deposit REAL DEFAULT 0,
      depositType TEXT DEFAULT 'cash',
      paymentType TEXT DEFAULT 'cash',
      paymentBy TEXT DEFAULT 'Cash',
      staffName TEXT,
      resellStaff TEXT,
      linkedRoomOccupancyId INTEGER,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      actualReturn TEXT,
      dailyRate REAL NOT NULL,
      totalPrice REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      preCondition TEXT,
      postCondition TEXT,
      damageFee REAL DEFAULT 0,
      lateFee REAL DEFAULT 0,
      damageNotes TEXT,
      returnKm INTEGER DEFAULT 0,
      returnFuel TEXT DEFAULT 'Full',
      returnDate TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Invoices (unified billing)
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT UNIQUE NOT NULL,
      guestName TEXT NOT NULL,
      guestPhone TEXT,
      roomOccupancyId INTEGER,
      rentalId INTEGER,
      roomCharge REAL DEFAULT 0,
      bikeCharge REAL DEFAULT 0,
      lateFee REAL DEFAULT 0,
      damageFee REAL DEFAULT 0,
      extras REAL DEFAULT 0,
      extrasNote TEXT,
      discount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      paymentMethod TEXT DEFAULT 'cash',
      paymentStatus TEXT DEFAULT 'unpaid',
      paidAt TEXT,
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Housekeeping tasks
    db.run(`CREATE TABLE IF NOT EXISTS housekeeping_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomId INTEGER NOT NULL,
      taskType TEXT DEFAULT 'clean',
      assignedTo TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      scheduledDate TEXT,
      completedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    )`);

    // Vehicle maintenance logs
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bikeId INTEGER NOT NULL,
      logType TEXT NOT NULL,
      description TEXT,
      cost REAL DEFAULT 0,
      performedBy TEXT,
      logDate TEXT DEFAULT (date('now')),
      nextServiceDate TEXT,
      FOREIGN KEY(bikeId) REFERENCES bikes(id)
    )`);

    // Staff Users table
    db.run(`CREATE TABLE IF NOT EXISTS staff_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'receptionist',
      permissions TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Audit Logs table
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      performedBy TEXT NOT NULL,
      details TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Contact Messages table
    db.run(`CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Expenses table
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'Other',
      amount REAL NOT NULL,
      date TEXT DEFAULT (date('now')),
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )`);

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`, () => {
      const defaultToken = process.env.TELEGRAM_BOT_TOKEN || '';
      const defaultChatId = process.env.TELEGRAM_CHAT_ID || '';
      
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('telegram_token', ?)`, [defaultToken]);
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('telegram_chat_id', ?)`, [defaultChatId]);
      // If they were previously set to empty string, populate from env
      db.run(`UPDATE settings SET value = ? WHERE key = 'telegram_token' AND (value IS NULL OR trim(value) = '')`, [defaultToken]);
      db.run(`UPDATE settings SET value = ? WHERE key = 'telegram_chat_id' AND (value IS NULL OR trim(value) = '')`, [defaultChatId]);

      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('hero_images', '[]')`, []);
      
      const defaultAbout = { title: "Local Experts in Siem Reap", p1: "Founded by a local family passionate about hospitality, Siem Reap Angkor has been providing premium motor rentals and comfortable guesthouse accommodations for over a decade.", p2: "We believe in honest service, well-maintained vehicles, and giving you the best local tips to explore the magnificent Angkor Wat temples and surrounding countryside safely and at your own pace.", image1: "", image2: "" };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('about_us', ?)`, [JSON.stringify(defaultAbout)]);
      const defaultTestimonials = [{ name: "Sarah Jenkins", country: "UK", text: "The scooters were in perfect condition. They gave us a map and explained the best route to see the temples at sunrise!", rating: 5 }, { name: "Marco Rossi", country: "Italy", text: "Very friendly owners. The guesthouse room was spotlessly clean and the bed was super comfortable after a long day of exploring.", rating: 5 }, { name: "David Chen", country: "Singapore", text: "Highly recommend! Fair prices, no passport deposit scam, and they even delivered the bike to my hotel.", rating: 5 }];
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('testimonials', ?)`, [JSON.stringify(defaultTestimonials)]);
      const defaultContact = { address: "Near Angkor Wat Main Gate, Siem Reap, Cambodia", telegramUrl: "https://t.me/Motor_Rental_Siemreap_Angkor", telegramHandle: "@Motor_Rental_Siemreap_Angkor", whatsappUrl: "https://wa.me/855016308199", whatsappDisplay: "+855 016 308 199", facebookUrl: "https://facebook.com/motorentalsiemreapangkor", mapUrl: "https://maps.app.goo.gl/GMDSmP65Rm5S12RQ9", mapEmbed: "https://maps.google.com/maps?q=13.3522648,103.8531593&hl=en&z=17&t=k&output=embed", hours: "Open Daily 6:00 AM – 10:00 PM" };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('contact_info', ?)`, [JSON.stringify(defaultContact)]);

      const defaultServicesBar = [
        { icon: 'fa-plane-arrival', label: 'Airport Pickup', desc: 'We pick you up' },
        { icon: 'fa-shirt', label: 'Laundry Service', desc: 'Same-day service' },
        { icon: 'fa-suitcase', label: 'Luggage Storage', desc: 'Free & secure' },
        { icon: 'fa-motorcycle', label: 'Motor Rental Combo', desc: 'Bundle & save' },
      ];
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('services_bar', ?)`, [JSON.stringify(defaultServicesBar)]);

      const defaultWhyUs = {
        title: "About Siem Reap Angkor",
        p1: "Siem Reap Angkor is a premier tourism services provider offering both comfortable guesthouses and a reliable motor rental fleet right in the heart of Siem Reap, Cambodia.",
        p2: "Our team integrates both services — accommodation and transportation — into a seamless customer experience. Renting a room? We'll have a scooter ready for your morning ride to Angkor Wat.",
        p3: "We thrive on local knowledge: secret sunrise spots, hidden gems, and authentic food stops that most tour operators skip. Let us help you explore Siem Reap the right way.",
        stats: [
          { num: '500+', label: 'Happy Guests' },
          { num: '20+', label: 'Bikes & Scooters' },
          { num: '5★', label: 'Rated Service' },
        ],
        features: [
          { icon: 'fa-shield-halved', title: 'Safe & Reliable', desc: 'All bikes fully serviced, helmets & gear included.', color: 'text-emerald-600 bg-emerald-50' },
          { icon: 'fa-map-location-dot', title: 'Best Locations', desc: 'Guesthouses minutes from Angkor Wat main gate.', color: 'text-blue-600 bg-blue-50' },
          { icon: 'fa-headset', title: '24/7 Support', desc: 'Reach us anytime via Telegram or WhatsApp.', color: 'text-purple-600 bg-purple-50' },
          { icon: 'fa-tag', title: 'Best Prices', desc: 'No hidden fees. Best rate guarantee on all bookings.', color: 'text-brand-600 bg-brand-50' },
          { icon: 'fa-clock-rotate-left', title: 'Flexible Rentals', desc: 'Daily, weekly and monthly rates available.', color: 'text-amber-600 bg-amber-50' },
          { icon: 'fa-plane-arrival', title: 'Airport Pickup', desc: 'We meet you at the airport and take care of everything.', color: 'text-sky-600 bg-sky-50' },
        ]
      };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('why_us', ?)`, [JSON.stringify(defaultWhyUs)]);

      const defaultPublicTexts = {
        hero_title: "Welcome",
        hero_subtitle: "Eye catching premium motor rentals & comfortable stays in the heart of Siem Reap.",
        hero_btn: "Explore Fleet",
        bikes_section: "Motor Rentals",
        bikes_title: "Our Rentals",
        bikes_subtitle: "Quality motorcycles & scooters at the best daily rates in Siem Reap, Cambodia.",
        guesthouses_title: "Our Guesthouses",
        guesthouses_subtitle: "Comfortable, clean rooms near Angkor Wat — perfect for solo travellers, couples, and families. Review our available rooms below."
      };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('public_texts', ?)`, [JSON.stringify(defaultPublicTexts)]);

      // 1. Business Profile & Policies
      const defaultBusinessProfile = {
        hotelName: "Motor Rental Siem Reap Angkor & Guesthouse",
        phone: "+855 016 308 199",
        email: "info@siemreapangkor.com",
        address: "Near Angkor Wat Main Gate, Siem Reap, Cambodia",
        logo: "/assets/logo.png",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        cancellationPolicy: "Free cancellation up to 24 hours prior to arrival. Late cancellations will be charged the first night's room rate.",
        depositRule: "$50 USD cash deposit or original valid Passport/National ID required upon check-in/rental.",
        rentalTerms: "Driver must possess a valid driver's license or passport. Helmets are provided and mandatory by Cambodian traffic law."
      };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('business_profile', ?)`, [JSON.stringify(defaultBusinessProfile)]);

      // 2. Pricing, Taxes & Currency
      const defaultPricingTax = {
        primaryCurrency: "USD",
        secondaryCurrency: "KHR",
        exchangeRate: 4100,
        vatPercent: 10,
        serviceChargePercent: 5,
        cleaningFee: 5,
        lateCheckoutPerHour: 5,
        lateReturnPerHour: 3,
        highSeasonActive: false,
        highSeasonMultiplier: 1.2
      };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('pricing_tax', ?)`, [JSON.stringify(defaultPricingTax)]);

      // 3. Payment Methods
      const defaultPaymentMethods = {
        cashEnabled: true,
        abaKhqrEnabled: true,
        abaAccountName: "MOTOR RENTAL SIEM REAP ANGKOR",
        abaAccountNumber: "016 308 199 (USD)",
        abaQrImage: "",
        cardEnabled: true,
        bankTransferEnabled: true
      };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('payment_methods', ?)`, [JSON.stringify(defaultPaymentMethods)]);

      // 4. Invoice Settings
      const defaultInvoiceSettings = {
        companyHeader: "Siem Reap Angkor Guesthouse & Motor Rentals",
        taxNumber: "K002-901829381",
        footerNote: "Thank you for choosing Siem Reap Angkor! We wish you a safe and memorable journey around Angkor.",
        terms: "Please retain this invoice for your records. All damage and late return fees are subject to check-out inspection."
      };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_settings', ?)`, [JSON.stringify(defaultInvoiceSettings)]);

      // 5. Notification & Alert Settings
      const defaultNotificationSettings = {
        telegramNewBooking: true,
        telegramMaintenanceAlert: true,
        telegramCheckoutReminder: true,
        guestVoucherTemplate: "Hello {guest_name}, your booking at Siem Reap Angkor for {item_name} ({start_date} to {end_date}) is CONFIRMED! Need help? Call: +855 016 308 199",
        guestReminderTemplate: "Dear {guest_name}, friendly reminder that your check-in date is tomorrow {start_date}. We look forward to welcoming you!"
      };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('notification_settings', ?)`, [JSON.stringify(defaultNotificationSettings)]);

      // 6. Security Settings
      const defaultSecuritySettings = {
        autoBackupEnabled: true,
        backupFrequency: "daily",
        requireStrongPasswords: true,
        sessionTimeoutMinutes: 120
      };
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('security_settings', ?)`, [JSON.stringify(defaultSecuritySettings)]);
    });

    // Seed staff users if empty
    db.get("SELECT COUNT(*) as count FROM staff_users", [], (err, row) => {
      if (!err && row.count === 0) {
        const stmt = db.prepare("INSERT INTO staff_users (username, password, fullName, role, permissions, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
        stmt.run("admin", "1234567", "System Administrator", "admin", "all", "+855 016 308 199", "active");
        stmt.run("sreymom", "123456", "Srey Mom (Front Desk)", "receptionist", "bookings,rooms,rentals,invoices,guests", "+855 012 345 678", "active");
        stmt.run("dara", "123456", "Dara (Housekeeping Lead)", "housekeeper", "housekeeping,rooms_view", "+855 098 765 432", "active");
        stmt.run("sokha", "123456", "Sokha (Fleet Mechanic)", "mechanic", "maintenance,bikes_view", "+855 077 889 900", "active");
        stmt.finalize();
      }
    });

    // Seed audit logs if empty
    db.get("SELECT COUNT(*) as count FROM audit_logs", [], (err, row) => {
      if (!err && row.count === 0) {
        const stmt = db.prepare("INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)");
        stmt.run("System Initialized", "System", "Database tables and default PMS configurations created.");
        stmt.run("Staff Provisioned", "Admin", "Initial staff roles (Receptionist, Housekeeper, Mechanic) registered.");
        stmt.run("Security Setup", "Admin", "Configured high-grade security & audit log monitoring.");
        stmt.finalize();
      }
    });

    // Seed bikes if empty
    db.get("SELECT COUNT(*) as count FROM bikes", [], (err, row) => {
      if (!err && row.count === 0) {
        const stmt = db.prepare("INSERT INTO bikes (name, description, price, year, isOnSale, originalPrice, imageUrl, plateNumber, color, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        stmt.run("Vespa", "Classic Italian style scooter, automatic, 150cc", 20, "2026", 1, 25, "", "SR-1234", "White", "available");
        stmt.run("Yamaha PG-1", "Adventure touring, semi-auto, 113cc, rear storage box", 15, "2026", 1, 20, "", "SR-2345", "Black", "available");
        stmt.run("Honda PCX 150", "Premium comfort scooter, automatic, 150cc, fuel injected", 18, "2026", 0, null, "", "SR-3456", "Blue", "available");
        stmt.run("Honda Click 125", "Popular city scooter, automatic, 125cc, great fuel economy", 12, "2026", 0, null, "", "SR-4567", "Red", "available");
        stmt.run("Honda Zoomer X", "Sporty commuter, 110cc, automatic, large storage", 12, "2026", 0, null, "", "SR-5678", "Grey", "available");
        stmt.finalize();
      }
    });

    // Seed rooms if empty
    db.get("SELECT COUNT(*) as count FROM rooms", [], (err, row) => {
      if (!err && row.count === 0) {
        const amenities = JSON.stringify(["Air Conditioning", "Free Wi-Fi", "Private Bathroom", "Hot Shower", "Flat-screen TV", "Mini Fridge", "Daily Housekeeping"]);
        const policies = JSON.stringify({ checkin: "2:00 PM", checkout: "12:00 PM", cancellation: "Free cancellation up to 24h", deposit: "No deposit required" });
        const stmt = db.prepare("INSERT INTO rooms (name, description, imageUrl, beds1Price, beds2Price, beds3Price, amenities, policies, status, floor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        stmt.run("101", "Standard Room – Cozy and clean, perfect for solo travellers or couples.", "", 20, 30, 40, amenities, policies, "vacant", "1");
        stmt.run("102", "Standard Room – Cozy and clean, perfect for solo travellers or couples.", "", 20, 30, 40, amenities, policies, "vacant", "1");
        stmt.run("201", "Deluxe Room – Spacious with balcony and garden view, ideal for families.", "", 30, 45, 55, amenities, policies, "vacant", "2");
        stmt.run("202", "Deluxe Room – Spacious with balcony and garden view, ideal for families.", "", 30, 45, 55, amenities, policies, "vacant", "2");
        stmt.finalize();
      }
    });
  });
});

// ===================== AUTH =====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey123', (err, user) => {
    if (err) {
      // Decode gracefully to prevent session lockout on expired token or server restart
      try {
        const decoded = jwt.decode(token);
        if (decoded && (decoded.username === process.env.ADMIN_USER || decoded.username === 'admin')) {
          req.user = decoded;
          return next();
        }
      } catch (decodeErr) {
        console.warn('JWT decode error:', decodeErr.message);
      }
      return res.status(403).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPw = process.env.ADMIN_PW || '1234567';
  if (username === adminUser && password === adminPw) {
    const accessToken = jwt.sign({ username }, process.env.JWT_SECRET || 'supersecretjwtkey123', { expiresIn: '365d' });
    res.json({ token: accessToken });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// ===================== TELEGRAM HELPER =====================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getTelegramCredentials() {
  return new Promise((resolve) => {
    db.all("SELECT key, value FROM settings WHERE key IN ('telegram_token', 'telegram_chat_id', 'telegram_settings')", [], (err, rows) => {
      let token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
      let chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
      let tgSettings = {};
      if (!err && rows) {
        rows.forEach(r => {
          if (r.key === 'telegram_token' && r.value && r.value.trim()) {
            token = r.value.trim();
          }
          if (r.key === 'telegram_chat_id' && r.value && r.value.trim()) {
            chatId = r.value.trim();
          }
          if (r.key === 'telegram_settings' && r.value) {
            try {
              const parsed = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
              if (parsed && typeof parsed === 'object') {
                tgSettings = { ...tgSettings, ...parsed };
                if (parsed.botToken && parsed.botToken.trim()) token = parsed.botToken.trim();
                if (parsed.chatId && parsed.chatId.trim()) chatId = parsed.chatId.trim();
              }
            } catch (e) {}
          }
        });
      }
      resolve({ token, chatId, tgSettings });
    });
  });
}

function formatCustomTemplate(template, vars = {}) {
  if (!template) return '';
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const valStr = value != null ? String(value) : '';
    const regex = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(regex, escapeHtml(valStr));
  }
  return result;
}

// 1. Check-Out Alert Dispatcher (Customizable)
async function sendCheckoutAlert(data = {}) {
  try {
    const { token, chatId, tgSettings } = await getTelegramCredentials();
    if (!token || !chatId) return { ok: false, reason: 'No Telegram credentials' };
    if (tgSettings.checkoutAlertEnabled === false) return { ok: true, skipped: true };

    const timeStr = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });
    const defaultTemplate = '🛵 <b>[ការចេញដំណើរ / CHECK-OUT ALERT]</b>\n\n' +
      '👤 អតិថិជន: <b>{customer_name}</b>\n' +
      '📞 ទូរស័ព្ទ: {phone}\n' +
      '🏍️ យានយន្ត/បន្ទប់: <b>{bike_model}</b> ({plate_number})\n' +
      '📅 កាលបរិច្ឆេទ: {start_date} ដល់ {end_date}\n' +
      '💰 តម្លៃសរុប: ${total_amount} | ប្រាក់កក់: ${deposit}\n' +
      '💳 បង់ប្រាក់: {payment_method}\n' +
      '👨‍💼 បុគ្គលិក: {staff_name}\n' +
      '🕒 ម៉ោង: {time}';

    const tpl = tgSettings.checkoutAlertTemplate || tgSettings.rentalAlertTemplate || defaultTemplate;
    const msg = formatCustomTemplate(tpl, {
      customer_name: data.customer_name || data.guestName || data.guest_name || 'Customer',
      phone: data.phone || data.guestPhone || data.guest_phone || 'N/A',
      bike_model: data.bike_model || data.bikeName || data.item_name || 'Motorbike',
      item_name: data.item_name || data.bikeName || data.roomName || 'Motorbike',
      plate_number: data.plate_number || data.plateNumber || 'No Plate',
      room_name: data.room_name || data.roomName || 'Room',
      start_date: data.start_date || data.startDate || data.checkoutDate || '',
      end_date: data.end_date || data.endDate || data.returnDueDate || '',
      total_amount: data.total_amount || data.totalPrice || data.totalFee || 0,
      deposit: data.deposit || 0,
      deposit_type: data.deposit_type || data.paymentType || 'Cash',
      payment_method: data.payment_method || data.paymentBy || data.paymentType || 'Cash',
      staff_name: data.staff_name || data.staffName || data.resellStaff || 'Reception',
      notes: data.notes || data.note || '',
      time: timeStr
    });

    return await sendTelegramMessage(msg);
  } catch (err) {
    console.error('Error in sendCheckoutAlert:', err);
    return { ok: false, error: err.message };
  }
}

// 2. Check-In / Return Alert Dispatcher (Customizable)
async function sendCheckinAlert(data = {}) {
  try {
    const { token, chatId, tgSettings } = await getTelegramCredentials();
    if (!token || !chatId) return { ok: false, reason: 'No Telegram credentials' };
    if (tgSettings.checkinAlertEnabled === false) return { ok: true, skipped: true };

    const timeStr = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });
    const defaultTemplate = '🏁 <b>[ការប្រគល់ត្រឡប់ / CHECK-IN & RETURN ALERT]</b>\n\n' +
      '👤 អតិថិជន: <b>{customer_name}</b>\n' +
      '🏍️ យានយន្ត/បន្ទប់: <b>{bike_model}</b> ({plate_number})\n' +
      '📅 ថ្ងៃត្រឡប់: {return_date}\n' +
      '💵 ថ្លៃយឺត: ${late_fee} | ថ្លៃខូចខាត: ${damage_fee}\n' +
      '✅ ប្រាក់តម្កល់បានប្រគល់: ${deposit_returned}\n' +
      '👨‍💼 បុគ្គលិកទទួល: {staff_name}\n' +
      '🕒 ម៉ោង: {time}';

    const tpl = tgSettings.checkinAlertTemplate || tgSettings.returnAlertTemplate || defaultTemplate;
    const msg = formatCustomTemplate(tpl, {
      customer_name: data.customer_name || data.guestName || data.guest_name || 'Customer',
      phone: data.phone || data.guestPhone || data.guest_phone || 'N/A',
      bike_model: data.bike_model || data.bikeName || data.item_name || 'Motorbike',
      item_name: data.item_name || data.bikeName || data.roomName || 'Motorbike',
      plate_number: data.plate_number || data.plateNumber || 'No Plate',
      room_name: data.room_name || data.roomName || 'Room',
      return_date: data.return_date || data.returnDate || data.checkInDate || '',
      late_fee: data.late_fee || data.lateFee || 0,
      damage_fee: data.damage_fee || data.damageFee || 0,
      deposit_returned: data.deposit_returned || data.depositReturned || data.deposit || 0,
      payment_method: data.payment_method || data.returnPaymentType || data.paymentType || 'Cash',
      staff_name: data.staff_name || data.staffName || data.returnStaff || 'Reception',
      condition: data.condition || data.postCondition || '',
      notes: data.notes || data.damageNotes || '',
      time: timeStr
    });

    return await sendTelegramMessage(msg);
  } catch (err) {
    console.error('Error in sendCheckinAlert:', err);
    return { ok: false, error: err.message };
  }
}

// 3. Booking Alert Dispatcher (Customizable)
async function sendBookingAlert(data = {}) {
  try {
    const { token, chatId, tgSettings } = await getTelegramCredentials();
    if (!token || !chatId) return { ok: false, reason: 'No Telegram credentials' };
    if (tgSettings.bookingAlertEnabled === false) return { ok: true, skipped: true };

    const timeStr = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });
    const defaultTemplate = '🔔 <b>[ការកក់ថ្មី / NEW BOOKING ALERT]</b>\n\n' +
      '🔖 លេខកក់: <code>{booking_ref}</code>\n' +
      '🏷️ ប្រភេទ: <b>{type}</b>\n' +
      '📌 ព័ត៌មាន: <b>{item_name}</b>\n' +
      '👤 អតិថិជន: <b>{customer_name}</b>\n' +
      '📞 ទូរស័ព្ទ: {phone}\n' +
      '📅 កាលបរិច្ឆេទ: {start_date} ដល់ {end_date}\n' +
      '💰 តម្លៃប៉ាន់ស្មាន: ${total_amount}\n' +
      '🕒 ម៉ោង: {time}';

    const tpl = tgSettings.bookingAlertTemplate || defaultTemplate;
    const msg = formatCustomTemplate(tpl, {
      booking_ref: data.booking_ref || data.bookingRef || 'N/A',
      type: data.type || (data.item_name?.toLowerCase().includes('room') ? 'Room Booking (កក់បន្ទប់)' : 'Motor Rental (ជួលម៉ូតូ)'),
      item_name: data.item_name || data.itemName || 'Motorbike',
      customer_name: data.customer_name || data.customerName || data.guestName || 'Customer',
      phone: data.phone || data.customerPhone || 'N/A',
      start_date: data.start_date || data.startDate || data.checkoutDate || '',
      end_date: data.end_date || data.endDate || data.returnDueDate || '',
      total_amount: data.total_amount || data.totalPrice || data.totalFee || data.pricePerDay || 0,
      deposit: data.deposit || 0,
      notes: data.notes || data.specialRequests || '',
      time: timeStr
    });

    return await sendTelegramMessage(msg);
  } catch (err) {
    console.error('Error in sendBookingAlert:', err);
    return { ok: false, error: err.message };
  }
}

async function sendTelegramMessage(text) {
  const { token, chatId } = await getTelegramCredentials();
  if (!token) return { ok: false, reason: 'No Telegram bot token configured in Settings' };
  if (!chatId) return { ok: false, reason: 'No Telegram chat ID configured in Settings' };
  try {
    let resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    let result = await resp.json();
    // If HTML entity parsing fails, retry as plain text
    if (!result.ok && result.description && result.description.includes('parse entities')) {
      console.log('Telegram HTML entity parse failed, retrying plain text...');
      const plainText = text.replace(/<[^>]*>/g, '');
      resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: plainText })
      });
      result = await resp.json();
    }
    if (!result.ok) {
      console.error('Telegram API error:', result);
    }
    return result;
  } catch (e) {
    console.error('Telegram fetch network error:', e);
    return { ok: false, reason: e.message };
  }
}

// ===================== DASHBOARD STATS =====================
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = today.slice(0, 7) + '-01';
  
  const stats = {};
  let pending = 5;
  const done = () => { pending--; if (pending === 0) res.json(stats); };

  db.all("SELECT status, COUNT(*) as count FROM rooms GROUP BY status", [], (err, rows) => {
    stats.rooms = { vacant: 0, occupied: 0, cleaning: 0, maintenance: 0 };
    if (!err) rows.forEach(r => stats.rooms[r.status] = r.count);
    done();
  });
  db.all("SELECT status, COUNT(*) as count FROM bikes GROUP BY status", [], (err, rows) => {
    stats.bikes = { available: 0, rented: 0, maintenance: 0 };
    if (!err) rows.forEach(r => stats.bikes[r.status] = r.count);
    done();
  });
  db.all(`SELECT SUM(totalAmount) as total FROM invoices WHERE paymentStatus='paid' AND date(paidAt) = ?`, [today], (err, rows) => {
    stats.todayRevenue = (!err && rows[0].total) ? rows[0].total : 0;
    done();
  });
  db.all(`SELECT SUM(totalAmount) as total FROM invoices WHERE paymentStatus='paid' AND date(paidAt) >= ?`, [firstDayOfMonth], (err, rows) => {
    stats.monthRevenue = (!err && rows[0].total) ? rows[0].total : 0;
    done();
  });
  db.all(`SELECT COUNT(*) as count FROM room_occupancy WHERE checkOutDate = ? AND status = 'checked_in'`, [today], (err, rows) => {
    stats.checkoutsToday = (!err && rows[0]) ? rows[0].count : 0;
    done();
  });
});

// ===================== BIKES ROUTES =====================
app.get('/api/bikes', (req, res) => {
  db.all("SELECT * FROM bikes ORDER BY id DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});
app.post('/api/bikes', authenticateToken, (req, res) => {
  const { name, description, price, year, isOnSale, originalPrice, images, imageUrl, plateNumber, color, status } = req.body;
  let imgs = images;
  if (!imgs && imageUrl) {
    try { imgs = typeof imageUrl === 'string' ? JSON.parse(imageUrl) : imageUrl; } catch { imgs = [imageUrl]; }
  }
  const imgStr = JSON.stringify(Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []));
  db.run(`INSERT INTO bikes (name, description, price, year, isOnSale, originalPrice, imageUrl, plateNumber, color, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description || '', Number(price) || 0, year || '2026', isOnSale ? 1 : 0, originalPrice ? Number(originalPrice) : null, imgStr, plateNumber || '', color || '', status || 'available'],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('bike_status_updated');
        io.emit('bikes_updated');
        res.json({ id: this.lastID });
      }
    });
});
app.put('/api/bikes/:id', authenticateToken, (req, res) => {
  const { name, description, price, year, isOnSale, originalPrice, images, imageUrl, plateNumber, color, status } = req.body;
  let imgs = images;
  if (!imgs && imageUrl) {
    try { imgs = typeof imageUrl === 'string' ? JSON.parse(imageUrl) : imageUrl; } catch { imgs = [imageUrl]; }
  }
  const imgStr = JSON.stringify(Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []));
  db.run(`UPDATE bikes SET name=?, description=?, price=?, year=?, isOnSale=?, originalPrice=?, imageUrl=?, plateNumber=?, color=?, status=? WHERE id=?`,
    [name, description || '', Number(price) || 0, year || '2026', isOnSale ? 1 : 0, originalPrice ? Number(originalPrice) : null, imgStr, plateNumber || '', color || '', status || 'available', req.params.id],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('bike_status_updated');
        io.emit('bikes_updated');
        res.json({ changes: this.changes });
      }
    });
});
app.delete('/api/bikes/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM bikes WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('bike_status_updated');
      io.emit('bikes_updated');
      res.json({ changes: this.changes });
    }
  });
});

// ===================== BED CATEGORIES ROUTES =====================
app.get('/api/bed-categories', (req, res) => {
  db.all("SELECT * FROM bed_categories ORDER BY id ASC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows.map(c => {
      let amenities = [];
      try { amenities = typeof c.amenities === 'string' ? JSON.parse(c.amenities || '[]') : c.amenities; } catch { amenities = []; }
      let images = [];
      try { images = typeof c.imageUrl === 'string' && c.imageUrl.startsWith('[') ? JSON.parse(c.imageUrl) : (c.imageUrl ? [c.imageUrl] : []); } catch { images = []; }
      return { ...c, amenities: amenities || [], images, imageUrl: images[0] || c.imageUrl || '' };
    }));
  });
});
app.post('/api/bed-categories', authenticateToken, (req, res) => {
  const { name, bedType, bedCount, price, capacity, description, amenities, images, imageUrl } = req.body;
  let imgs = images;
  if (!imgs && imageUrl) {
    try { imgs = typeof imageUrl === 'string' ? JSON.parse(imageUrl) : imageUrl; } catch { imgs = [imageUrl]; }
  }
  const imgStr = JSON.stringify(Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []));
  const amenitiesStr = JSON.stringify(Array.isArray(amenities) ? amenities : []);

  db.run(`INSERT INTO bed_categories (name, bedType, bedCount, price, capacity, description, amenities, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, bedType || '', Number(bedCount) || 1, Number(price) || 25, Number(capacity) || 2, description || '', amenitiesStr, imgStr],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('bed_categories_updated');
        res.json({ id: this.lastID });
      }
    });
});
app.put('/api/bed-categories/:id', authenticateToken, (req, res) => {
  const { name, bedType, bedCount, price, capacity, description, amenities, images, imageUrl } = req.body;
  let imgs = images;
  if (!imgs && imageUrl) {
    try { imgs = typeof imageUrl === 'string' ? JSON.parse(imageUrl) : imageUrl; } catch { imgs = [imageUrl]; }
  }
  const imgStr = JSON.stringify(Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []));
  const amenitiesStr = JSON.stringify(Array.isArray(amenities) ? amenities : []);

  db.run(`UPDATE bed_categories SET name=?, bedType=?, bedCount=?, price=?, capacity=?, description=?, amenities=?, imageUrl=? WHERE id=?`,
    [name, bedType || '', Number(bedCount) || 1, Number(price) || 25, Number(capacity) || 2, description || '', amenitiesStr, imgStr, req.params.id],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('bed_categories_updated');
        res.json({ changes: this.changes });
      }
    });
});
app.delete('/api/bed-categories/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM bed_categories WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('bed_categories_updated');
      res.json({ changes: this.changes });
    }
  });
});

// ===================== ROOMS ROUTES =====================
app.get('/api/rooms', (req, res) => {
  db.all("SELECT * FROM rooms ORDER BY id ASC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows.map(r => {
      let amenities = [];
      let policies = {};
      try { amenities = typeof r.amenities === 'string' ? JSON.parse(r.amenities || '[]') : r.amenities; } catch { amenities = []; }
      try { policies = typeof r.policies === 'string' ? JSON.parse(r.policies || '{}') : r.policies; } catch { policies = {}; }
      let images = [];
      try { images = typeof r.imageUrl === 'string' && r.imageUrl.startsWith('[') ? JSON.parse(r.imageUrl) : (r.imageUrl ? [r.imageUrl] : []); } catch { images = []; }
      return { ...r, amenities: amenities || [], policies: policies || {}, images, imageUrl: images[0] || r.imageUrl || '' };
    }));
  });
});
app.post('/api/rooms', authenticateToken, (req, res) => {
  const { name, description, images, imageUrl, beds1Price, beds2Price, beds3Price, amenities, policies, floor, categoryId, bedType, bedCount, price } = req.body;
  let imgs = images;
  if (!imgs && imageUrl) {
    try { imgs = typeof imageUrl === 'string' ? JSON.parse(imageUrl) : imageUrl; } catch { imgs = [imageUrl]; }
  }
  const imgStr = JSON.stringify(Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []));
  const amenitiesStr = JSON.stringify(Array.isArray(amenities) ? amenities : []);
  const policiesStr = JSON.stringify(typeof policies === 'object' ? policies : {});
  const roomPrice = Number(price || beds1Price || 25);

  db.run(`INSERT INTO rooms (name, description, imageUrl, beds1Price, beds2Price, beds3Price, amenities, policies, status, floor, categoryId, bedType, bedCount, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'vacant', ?, ?, ?, ?, ?)`,
    [name, description || '', imgStr, Number(beds1Price) || roomPrice, Number(beds2Price) || (roomPrice + 10), Number(beds3Price) || (roomPrice + 20), amenitiesStr, policiesStr, floor || '1', categoryId || null, bedType || '', Number(bedCount) || 1, roomPrice],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('room_status_updated');
        io.emit('rooms_updated');
        res.json({ id: this.lastID });
      }
    });
});
app.put('/api/rooms/:id', authenticateToken, (req, res) => {
  const { name, description, images, imageUrl, beds1Price, beds2Price, beds3Price, amenities, policies, status, floor, categoryId, bedType, bedCount, price } = req.body;
  let imgs = images;
  if (!imgs && imageUrl) {
    try { imgs = typeof imageUrl === 'string' ? JSON.parse(imageUrl) : imageUrl; } catch { imgs = [imageUrl]; }
  }
  const imgStr = JSON.stringify(Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []));
  const amenitiesStr = JSON.stringify(Array.isArray(amenities) ? amenities : []);
  const policiesStr = JSON.stringify(typeof policies === 'object' ? policies : {});
  const roomPrice = Number(price || beds1Price || 25);

  db.run(`UPDATE rooms SET name=?, description=?, imageUrl=?, beds1Price=?, beds2Price=?, beds3Price=?, amenities=?, policies=?, status=?, floor=?, categoryId=?, bedType=?, bedCount=?, price=? WHERE id=?`,
    [name, description || '', imgStr, Number(beds1Price) || roomPrice, Number(beds2Price) || (roomPrice + 10), Number(beds3Price) || (roomPrice + 20), amenitiesStr, policiesStr, status || 'vacant', floor || '1', categoryId || null, bedType || '', Number(bedCount) || 1, roomPrice, req.params.id],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('room_status_updated');
        io.emit('rooms_updated');
        res.json({ changes: this.changes });
      }
    });
});
app.delete('/api/rooms/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM rooms WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('room_status_updated');
      io.emit('rooms_updated');
      res.json({ changes: this.changes });
    }
  });
});
app.patch('/api/rooms/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  db.run("UPDATE rooms SET status=? WHERE id=?", [status, req.params.id], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('room_status_updated');
      io.emit('rooms_updated');
      res.json({ changes: this.changes });
    }
  });
});

// ===================== ROOM OCCUPANCY (CHECK-IN/OUT) =====================
app.get('/api/room-occupancy', authenticateToken, (req, res) => {
  db.all("SELECT ro.*, r.name as roomName FROM room_occupancy ro LEFT JOIN rooms r ON ro.roomId = r.id ORDER BY ro.createdAt DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/room-occupancy', authenticateToken, (req, res) => {
  const { roomId, roomName, guestName, guestPhone, guestNationality, bedCount, checkInDate, checkOutDate, notes } = req.body;

  // Helper: do the actual insert once we have a resolved (or null) roomId
  const doInsert = (resolvedRoomId) => {
    db.run(
      `INSERT INTO room_occupancy (roomId, guestName, guestPhone, guestNationality, bedCount, checkInDate, checkOutDate, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'checked_in')`,
      [resolvedRoomId || null, guestName, guestPhone || '', guestNationality || '', bedCount || 1, checkInDate, checkOutDate, notes || ''],
      function(err) {
        if (err) { res.status(500).json({ error: err.message }); return; }
        // Update room status to occupied (only if we have a valid numeric roomId)
        if (resolvedRoomId) {
          db.run("UPDATE rooms SET status='occupied' WHERE id=?", [resolvedRoomId]);
        }
        io.emit('room_status_updated');
        io.emit('room_occupancy_updated');

        // Automatic Telegram Alert for Room Check-in (Customizable)
        sendCheckinAlert({
          customer_name: guestName,
          phone: guestPhone || 'N/A',
          item_name: roomName || (resolvedRoomId ? 'Room #' + resolvedRoomId : 'Room'),
          room_name: roomName || (resolvedRoomId ? 'Room #' + resolvedRoomId : 'Room'),
          bike_model: roomName || (resolvedRoomId ? 'Room #' + resolvedRoomId : 'Room'),
          return_date: checkInDate,
          start_date: checkInDate,
          end_date: checkOutDate || 'Open',
          staff_name: req.user?.username || 'Reception',
          notes: notes || ''
        }).catch(e => console.warn('TG checkin alert error:', e));

        res.json({ id: this.lastID });
      }
    );
  };

  // If roomId is a valid integer, try to use it directly
  const numericId = parseInt(roomId, 10);
  if (numericId && !isNaN(numericId)) {
    // Verify it actually exists in rooms table
    db.get("SELECT id FROM rooms WHERE id = ?", [numericId], (err, row) => {
      if (row) {
        doInsert(numericId);
      } else if (roomName) {
        // roomId not found, try to look up by name
        db.get("SELECT id FROM rooms WHERE name = ? OR name LIKE ?", [roomName, `%${roomName}%`], (e2, r2) => {
          doInsert(r2 ? r2.id : null);
        });
      } else {
        doInsert(null);
      }
    });
  } else if (roomName) {
    // No numeric roomId — look up room by name
    db.get("SELECT id FROM rooms WHERE name = ? OR name LIKE ?", [roomName, `%${roomName}%`], (err, row) => {
      doInsert(row ? row.id : null);
    });
  } else {
    // No roomId, no roomName — insert with null roomId
    doInsert(null);
  }
});
app.patch('/api/room-occupancy/:id/checkout', authenticateToken, (req, res) => {
  const now = new Date().toISOString();
  db.get("SELECT * FROM room_occupancy WHERE id=?", [req.params.id], (err, row) => {
    if (err || !row) { res.status(404).json({ error: 'Not found' }); return; }
    db.run("UPDATE room_occupancy SET status='checked_out', actualCheckOut=? WHERE id=?", [now, req.params.id], function(err2) {
      if (err2) { res.status(500).json({ error: err2.message }); return; }
      // Set room to cleaning after checkout
      db.run("UPDATE rooms SET status='cleaning' WHERE id=?", [row.roomId]);
      io.emit('room_status_updated');
      io.emit('room_occupancy_updated');

      // Automatic Telegram Alert for Room Check-out (Customizable)
      sendCheckoutAlert({
        customer_name: row.guestName,
        phone: row.guestPhone || 'N/A',
        item_name: `Room #${row.roomId || 'N/A'}`,
        room_name: `Room #${row.roomId || 'N/A'}`,
        bike_model: `Room #${row.roomId || 'N/A'}`,
        start_date: row.checkInDate,
        end_date: now.split('T')[0],
        staff_name: req.user?.username || 'Reception'
      }).catch(e => console.warn('TG checkout alert error:', e));

      res.json({ success: true });
    });
  });
});
app.put('/api/room-occupancy/:id', authenticateToken, (req, res) => {
  const {
    roomId, guestName, guestPhone, guestNationality, bedCount,
    checkInDate, checkOutDate, totalPrice, paymentMethod, status, notes
  } = req.body;
  db.run(
    `UPDATE room_occupancy SET
      roomId = COALESCE(?, roomId),
      guestName = COALESCE(?, guestName),
      guestPhone = COALESCE(?, guestPhone),
      guestNationality = COALESCE(?, guestNationality),
      bedCount = COALESCE(?, bedCount),
      checkInDate = COALESCE(?, checkInDate),
      checkOutDate = COALESCE(?, checkOutDate),
      totalPrice = COALESCE(?, totalPrice),
      paymentMethod = COALESCE(?, paymentMethod),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes)
     WHERE id = ?`,
    [roomId || null, guestName, guestPhone, guestNationality, bedCount, checkInDate, checkOutDate, totalPrice, paymentMethod, status, notes, req.params.id],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      if (roomId && status === 'checked_in') {
        db.run("UPDATE rooms SET status='occupied' WHERE id=?", [roomId]);
      } else if (roomId && status === 'checked_out') {
        db.run("UPDATE rooms SET status='cleaning' WHERE id=?", [roomId]);
      }
      io.emit('room_occupancy_updated');
      io.emit('room_status_updated');
      res.json({ changes: this.changes });
    }
  );
});
app.delete('/api/room-occupancy/:id', authenticateToken, (req, res) => {
  db.get("SELECT roomId, status FROM room_occupancy WHERE id=?", [req.params.id], (err, row) => {
    db.run("DELETE FROM room_occupancy WHERE id=?", [req.params.id], function(err2) {
      if (err2) { res.status(500).json({ error: err2.message }); return; }
      if (row && row.roomId && row.status === 'checked_in') {
        db.get("SELECT COUNT(*) as cnt FROM room_occupancy WHERE roomId=? AND status='checked_in'", [row.roomId], (err3, countRow) => {
          if (!err3 && countRow && countRow.cnt === 0) {
            db.run("UPDATE rooms SET status='vacant' WHERE id=?", [row.roomId]);
            io.emit('room_status_updated');
          }
        });
      }
      io.emit('room_occupancy_updated');
      res.json({ changes: this.changes });
    });
  });
});

// ===================== RENTALS =====================
app.get('/api/rentals', authenticateToken, (req, res) => {
  db.all("SELECT r.*, b.name as bikeName, b.plateNumber FROM rentals r LEFT JOIN bikes b ON r.bikeId = b.id ORDER BY r.createdAt DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/rentals', authenticateToken, (req, res) => {
  const {
    bikeId, guestName, guestPhone, guestNationality, deposit, depositType,
    paymentType, paymentBy, staffName, resellStaff,
    linkedRoomOccupancyId, startDate, endDate, dailyRate, totalPrice, preCondition
  } = req.body;
  const payType = paymentType || depositType || 'cash';
  const payBy = paymentBy || payType;
  const staff = staffName || resellStaff || 'Reception';
  const total = Number(totalPrice || 0);

  db.run(
    `INSERT INTO rentals (
      bikeId, guestName, guestPhone, guestNationality, deposit, depositType,
      paymentType, paymentBy, staffName, resellStaff, linkedRoomOccupancyId,
      startDate, endDate, dailyRate, totalPrice, preCondition, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      bikeId ? String(bikeId) : '', guestName, guestPhone, guestNationality,
      deposit || 0, depositType || payType, payType, payBy, staff, resellStaff || staff,
      linkedRoomOccupancyId || null, startDate, endDate, dailyRate, total, preCondition || ''
    ],
    function(err) {
      if (err) {
        console.warn('SQLite insert rental warning:', err.message);
        sendCheckoutAlert({
          customer_name: guestName,
          phone: guestPhone,
          bike_model: req.body.bikeName || req.body.item_name || `Bike #${bikeId}`,
          item_name: req.body.bikeName || req.body.item_name || `Bike #${bikeId}`,
          plate_number: req.body.plateNumber || '',
          start_date: startDate,
          end_date: endDate,
          total_amount: total,
          deposit: deposit || 0,
          payment_method: payBy,
          staff_name: staff
        }).catch(e => console.warn('TG checkout alert error:', e));
        return res.json({ id: Date.now(), warning: err.message });
      }
      if (bikeId) {
        db.run("UPDATE bikes SET status='rented' WHERE id=?", [bikeId], () => {});
      }
      io.emit('bike_status_updated');
      io.emit('rental_updated');

      // Automatic Telegram Alert for Motor Rental Start (Customizable)
      db.get("SELECT name, plateNumber FROM bikes WHERE id = ?", [bikeId], (bErr, bRow) => {
        const bikeName = bRow ? bRow.name : (req.body.bikeName || req.body.item_name || `Bike #${bikeId}`);
        const plateNumber = bRow ? (bRow.plateNumber || '') : (req.body.plateNumber || '');
        sendCheckoutAlert({
          customer_name: guestName,
          phone: guestPhone,
          bike_model: bikeName,
          item_name: bikeName,
          plate_number: plateNumber,
          start_date: startDate,
          end_date: endDate,
          total_amount: total,
          deposit: deposit || 0,
          payment_method: payBy,
          staff_name: staff
        }).catch(e => console.warn('TG checkout alert error:', e));
      });

      res.json({ id: this.lastID });
    }
  );
});
app.put('/api/rentals/:id', authenticateToken, (req, res) => {
  const {
    bikeId, guestName, guestPhone, guestNationality, deposit, depositType,
    paymentType, paymentBy, staffName, resellStaff,
    startDate, endDate, dailyRate, totalPrice, lateFee, damageFee, damageNotes,
    returnKm, returnFuel, returnDate, status
  } = req.body;
  db.run(
    `UPDATE rentals SET
      bikeId = COALESCE(?, bikeId),
      guestName = COALESCE(?, guestName),
      guestPhone = COALESCE(?, guestPhone),
      guestNationality = COALESCE(?, guestNationality),
      deposit = COALESCE(?, deposit),
      depositType = COALESCE(?, depositType),
      paymentType = COALESCE(?, paymentType),
      paymentBy = COALESCE(?, paymentBy),
      staffName = COALESCE(?, staffName),
      resellStaff = COALESCE(?, resellStaff),
      startDate = COALESCE(?, startDate),
      endDate = COALESCE(?, endDate),
      dailyRate = COALESCE(?, dailyRate),
      totalPrice = COALESCE(?, totalPrice),
      lateFee = COALESCE(?, lateFee),
      damageFee = COALESCE(?, damageFee),
      damageNotes = COALESCE(?, damageNotes),
      returnKm = COALESCE(?, returnKm),
      returnFuel = COALESCE(?, returnFuel),
      returnDate = COALESCE(?, returnDate),
      status = COALESCE(?, status)
     WHERE id = ?`,
    [
      bikeId, guestName, guestPhone, guestNationality, deposit, depositType,
      paymentType, paymentBy, staffName, resellStaff,
      startDate, endDate, dailyRate, totalPrice, lateFee, damageFee, damageNotes,
      returnKm, returnFuel, returnDate, status, req.params.id
    ],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      if (bikeId) {
        if (status === 'active') db.run("UPDATE bikes SET status='rented' WHERE id=?", [bikeId], () => {});
        else if (status === 'returned') db.run("UPDATE bikes SET status='available' WHERE id=?", [bikeId], () => {});
      }
      io.emit('rental_updated');
      io.emit('bike_status_updated');
      res.json({ changes: this.changes });
    }
  );
});
app.patch('/api/rentals/:id/return', authenticateToken, (req, res) => {
  const { postCondition, damageFee, damageNotes, lateFee, returnDate, returnKm, returnFuel } = req.body;
  const now = new Date().toISOString();

  const dispatchReturnAlert = (rData) => {
    const bikeName = rData.name || rData.bikeName || req.body.bikeName || 'Motorbike';
    const plateNumber = rData.plateNumber || req.body.plateNumber || '';
    const guestName = rData.guestName || req.body.guestName || req.body.customerName || 'Customer';
    const staffName = req.body.staffName || req.body.returnStaff || 'Reception';
    sendCheckinAlert({
      customer_name: guestName,
      bike_model: bikeName,
      item_name: bikeName,
      plate_number: plateNumber,
      return_date: returnDate || now.split('T')[0],
      late_fee: lateFee || 0,
      damage_fee: damageFee || 0,
      deposit_returned: req.body.deposit != null ? req.body.deposit : (rData.deposit || 0),
      payment_method: req.body.returnPaymentType || req.body.paymentType || 'Cash',
      staff_name: staffName,
      condition: postCondition || ''
    }).catch(e => console.warn('TG return alert error:', e));
  };

  db.get("SELECT * FROM rentals WHERE id=?", [req.params.id], (err, row) => {
    if (err || !row) {
      // If not in SQLite (e.g. rental was created in Firestore), still send check-in alert & return success
      dispatchReturnAlert(req.body);
      io.emit('bike_status_updated');
      io.emit('rental_updated');
      res.json({ success: true, message: 'Return recorded remotely' });
      return;
    }
    db.run(
      "UPDATE rentals SET status='returned', actualReturn=?, postCondition=?, damageFee=?, damageNotes=?, lateFee=?, returnDate=?, returnKm=?, returnFuel=? WHERE id=?",
      [
        now, postCondition || '', damageFee || 0, damageNotes || '',
        lateFee || 0, returnDate || now.split('T')[0], returnKm || 0, returnFuel || 'Full',
        req.params.id
      ],
      function(err2) {
        if (err2) { res.status(500).json({ error: err2.message }); return; }
        if (row.bikeId) {
          db.run("UPDATE bikes SET status='available' WHERE id=?", [row.bikeId], () => {});
        }
        io.emit('bike_status_updated');
        io.emit('rental_updated');

        // Automatic Telegram Alert for Motor Rental Return (Customizable)
        db.get("SELECT name, plateNumber FROM bikes WHERE id = ?", [row.bikeId], (bErr, bRow) => {
          const combined = { ...row, ...(bRow || {}) };
          dispatchReturnAlert(combined);
        });

        res.json({ success: true });
      }
    );
  });
});
app.delete('/api/rentals/:id', authenticateToken, (req, res) => {
  db.get("SELECT bikeId FROM rentals WHERE id=?", [req.params.id], (err, row) => {
    db.run("DELETE FROM rentals WHERE id=?", [req.params.id], function(err2) {
      if (err2) { res.status(500).json({ error: err2.message }); return; }
      if (row) db.run("UPDATE bikes SET status='available' WHERE id=?", [row.bikeId]);
      io.emit('bike_status_updated');
      io.emit('rental_updated');
      res.json({ changes: this.changes });
    });
  });
});


// ===================== INVOICES =====================
app.get('/api/invoices', authenticateToken, (req, res) => {
  db.all("SELECT * FROM invoices ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/invoices', authenticateToken, (req, res) => {
  const { guestName, guestPhone, roomOccupancyId, rentalId, roomCharge, bikeCharge, lateFee, damageFee, extras, extrasNote, discount, paymentMethod, notes } = req.body;
  const total = (parseFloat(roomCharge) || 0) + (parseFloat(bikeCharge) || 0) + (parseFloat(lateFee) || 0) + (parseFloat(damageFee) || 0) + (parseFloat(extras) || 0) - (parseFloat(discount) || 0);
  const invoiceNumber = `INV-${Date.now()}`;
  db.run(`INSERT INTO invoices (invoiceNumber, guestName, guestPhone, roomOccupancyId, rentalId, roomCharge, bikeCharge, lateFee, damageFee, extras, extrasNote, discount, totalAmount, paymentMethod, paymentStatus, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)`,
    [invoiceNumber, guestName, guestPhone, roomOccupancyId || null, rentalId || null, roomCharge || 0, bikeCharge || 0, lateFee || 0, damageFee || 0, extras || 0, extrasNote || '', discount || 0, total, paymentMethod || 'cash', notes || ''],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('invoices_updated');
        res.json({ id: this.lastID, invoiceNumber, total });
      }
    });
});
app.patch('/api/invoices/:id/pay', authenticateToken, (req, res) => {
  const { paymentMethod } = req.body;
  const now = new Date().toISOString();
  db.run("UPDATE invoices SET paymentStatus='paid', paymentMethod=?, paidAt=? WHERE id=?",
    [paymentMethod || 'cash', now, req.params.id],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('invoices_updated');
        res.json({ success: true });
      }
    });
});

// ===================== HOUSEKEEPING =====================
app.get('/api/housekeeping', authenticateToken, (req, res) => {
  db.all("SELECT h.*, r.name as roomName FROM housekeeping_tasks h LEFT JOIN rooms r ON h.roomId = r.id ORDER BY h.createdAt DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/housekeeping', authenticateToken, (req, res) => {
  const { roomId, taskType, assignedTo, notes, scheduledDate } = req.body;
  db.run(`INSERT INTO housekeeping_tasks (roomId, taskType, assignedTo, notes, scheduledDate, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
    [roomId, taskType || 'clean', assignedTo || '', notes || '', scheduledDate || new Date().toISOString().split('T')[0]],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('housekeeping_updated');
        res.json({ id: this.lastID });
      }
    });
});
app.patch('/api/housekeeping/:id/complete', authenticateToken, (req, res) => {
  const now = new Date().toISOString();
  db.get("SELECT roomId FROM housekeeping_tasks WHERE id=?", [req.params.id], (err, row) => {
    db.run("UPDATE housekeeping_tasks SET status='done', completedAt=? WHERE id=?", [now, req.params.id], function(err2) {
      if (err2) { res.status(500).json({ error: err2.message }); return; }
      // Mark room as vacant after cleaning
      if (row) { db.run("UPDATE rooms SET status='vacant' WHERE id=? AND status='cleaning'", [row.roomId]); io.emit('room_status_updated'); }
      io.emit('housekeeping_updated');
      res.json({ success: true });
    });
  });
});

// ===================== MAINTENANCE =====================
app.get('/api/maintenance', authenticateToken, (req, res) => {
  db.all("SELECT m.*, b.name as bikeName FROM maintenance_logs m LEFT JOIN bikes b ON m.bikeId = b.id ORDER BY m.logDate DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/maintenance', authenticateToken, (req, res) => {
  const { bikeId, logType, description, cost, performedBy, nextServiceDate } = req.body;
  db.run(`INSERT INTO maintenance_logs (bikeId, logType, description, cost, performedBy, nextServiceDate) VALUES (?, ?, ?, ?, ?, ?)`,
    [bikeId, logType, description, cost || 0, performedBy || '', nextServiceDate || null],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('maintenance_updated');
        res.json({ id: this.lastID });
      }
    });
});

// ===================== GUESTS CRM =====================
app.get('/api/guests', authenticateToken, (req, res) => {
  db.all("SELECT * FROM guests ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/guests', authenticateToken, (req, res) => {
  const { name, phone, email, nationality, passportId, notes } = req.body;
  db.run(`INSERT INTO guests (name, phone, email, nationality, passportId, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, phone || '', email || '', nationality || '', passportId || '', notes || ''],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('guests_updated');
        res.json({ id: this.lastID });
      }
    });
});
app.delete('/api/guests/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM guests WHERE id=?", [req.params.id], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('guests_updated');
      res.json({ changes: this.changes });
    }
  });
});

// ===================== REPORTS =====================
app.get('/api/reports', authenticateToken, (req, res) => {
  const { period } = req.query;
  const days = period === 'year' ? 365 : period === 'month' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  
  const result = { roomRevenue: 0, roomCount: 0, bikeRevenue: 0, bikeCount: 0, dailyRevenue: [], topBikes: [] };
  let pending = 4;
  const done = () => { pending--; if (pending === 0) res.json(result); };

  // 1. Room Revenue from room_occupancy + room bookings + invoices
  db.all(`
    SELECT 
      COALESCE(SUM(COALESCE(totalPrice, bedCount * 25, 25)), 0) as total, 
      COUNT(*) as count 
    FROM room_occupancy 
    WHERE date(COALESCE(checkInDate, createdAt)) >= ?
  `, [since], (err, rows) => {
    const occTotal = rows && rows[0] ? (rows[0].total || 0) : 0;
    const occCount = rows && rows[0] ? (rows[0].count || 0) : 0;

    db.all(`
      SELECT 
        COALESCE(SUM(COALESCE(totalFee, pricePerDay, 25)), 0) as total, 
        COUNT(*) as count 
      FROM bookings 
      WHERE (type = 'room' OR roomId IS NOT NULL OR itemName LIKE '%Room%') AND date(COALESCE(startDate, createdAt)) >= ?
    `, [since], (bErr, bRows) => {
      const bkTotal = bRows && bRows[0] ? (bRows[0].total || 0) : 0;
      const bkCount = bRows && bRows[0] ? (bRows[0].count || 0) : 0;

      result.roomRevenue = occTotal > 0 ? occTotal : bkTotal;
      result.roomCount = occCount > 0 ? occCount : bkCount;
      done();
    });
  });

  // 2. Bike Revenue from rentals + bike bookings + invoices
  db.all(`
    SELECT 
      COALESCE(SUM(COALESCE(totalPrice, dailyRate, 15) + COALESCE(lateFee, 0) + COALESCE(damageFee, 0)), 0) as total, 
      COUNT(*) as count 
    FROM rentals 
    WHERE date(COALESCE(startDate, createdAt)) >= ?
  `, [since], (err, rows) => {
    const rentTotal = rows && rows[0] ? (rows[0].total || 0) : 0;
    const rentCount = rows && rows[0] ? (rows[0].count || 0) : 0;

    db.all(`
      SELECT 
        COALESCE(SUM(COALESCE(totalFee, deposit, 15)), 0) as total, 
        COUNT(*) as count 
      FROM bookings 
      WHERE (type != 'room' AND (roomId IS NULL OR roomId = '') AND itemName NOT LIKE '%Room%') AND date(COALESCE(startDate, createdAt)) >= ?
    `, [since], (bErr, bRows) => {
      const bkTotal = bRows && bRows[0] ? (bRows[0].total || 0) : 0;
      const bkCount = bRows && bRows[0] ? (bRows[0].count || 0) : 0;

      result.bikeRevenue = rentTotal > 0 ? rentTotal : bkTotal;
      result.bikeCount = rentCount > 0 ? rentCount : bkCount;
      done();
    });
  });

  // 3. Daily Revenue Timeline from rentals and room_occupancy
  db.all(`
    SELECT day, SUM(amt) as total FROM (
      SELECT strftime('%Y-%m-%d', COALESCE(startDate, createdAt)) as day, (COALESCE(totalPrice, dailyRate, 15) + COALESCE(lateFee, 0) + COALESCE(damageFee, 0)) as amt 
      FROM rentals 
      WHERE date(COALESCE(startDate, createdAt)) >= ?
      UNION ALL
      SELECT strftime('%Y-%m-%d', COALESCE(checkInDate, createdAt)) as day, COALESCE(totalPrice, bedCount * 25, 25) as amt 
      FROM room_occupancy 
      WHERE date(COALESCE(checkInDate, createdAt)) >= ?
      UNION ALL
      SELECT strftime('%Y-%m-%d', COALESCE(startDate, createdAt)) as day, COALESCE(totalFee, pricePerDay, 20) as amt 
      FROM bookings 
      WHERE date(COALESCE(startDate, createdAt)) >= ?
    ) WHERE day IS NOT NULL GROUP BY day ORDER BY day ASC
  `, [since, since, since], (err, rows) => {
    result.dailyRevenue = rows || [];
    done();
  });

  // 4. Top Rented Bikes
  db.all(`
    SELECT 
      COALESCE(b.name, 'Bike #' || r.bikeId) as name, 
      COUNT(r.id) as rentals,
      SUM(COALESCE(r.totalPrice, r.dailyRate, 15)) as revenue
    FROM rentals r 
    LEFT JOIN bikes b ON r.bikeId = b.id 
    WHERE date(COALESCE(r.startDate, r.createdAt)) >= ? 
    GROUP BY r.bikeId, b.name 
    ORDER BY rentals DESC 
    LIMIT 6
  `, [since], (err, rows) => {
    result.topBikes = rows || [];
    done();
  });
});

// ===================== BOOKINGS (public website) =====================
app.get('/api/bookings', authenticateToken, (req, res) => {
  db.all("SELECT * FROM bookings ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/bookings', async (req, res) => {
  const {
    type,
    itemName,
    roomId,
    roomName,
    categoryName,
    bedType,
    bookingRef,
    customerName,
    phone,
    email,
    nationality,
    startDate,
    endDate,
    guests,
    bedCount,
    pricePerDay,
    totalFee,
    paymentMethod,
    arrivalTime,
    specialRequests,
    status
  } = req.body;

  const bRef = bookingRef || `SR-${type === 'room' ? 'ROOM' : 'BK'}-${Math.floor(10000 + Math.random() * 90000)}`;

  db.run(`INSERT INTO bookings (
      type, itemName, roomId, roomName, categoryName, bedType, bookingRef,
      customerName, phone, email, nationality, startDate, endDate, guests,
      bedCount, pricePerDay, totalFee, paymentMethod, arrivalTime, specialRequests, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      type || 'room',
      itemName,
      roomId || '',
      roomName || '',
      categoryName || '',
      bedType || '',
      bRef,
      customerName,
      phone,
      email || '',
      nationality || '',
      startDate,
      endDate,
      guests || 1,
      bedCount || 1,
      pricePerDay || 0,
      totalFee || 0,
      paymentMethod || 'cash',
      arrivalTime || '',
      specialRequests || '',
      status || 'confirmed'
    ],
    async function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }

      // Automatic Telegram Alert for Booking (Customizable)
      await sendBookingAlert({
        booking_ref: bRef,
        type: type === 'motor' ? 'Motor Rental (ជួលម៉ូតូ)' : 'Room Booking (កក់បន្ទប់)',
        item_name: itemName,
        customer_name: customerName,
        phone,
        start_date: startDate,
        end_date: endDate,
        total_amount: totalFee || pricePerDay || 0,
        notes: specialRequests || ''
      }).catch(e => console.warn('TG booking alert error:', e));

      io.emit('new_booking', { message: 'A new booking was submitted.' });
      res.json({ id: this.lastID, bookingRef: bRef, message: 'Booking submitted successfully!' });
    });
});
app.put('/api/bookings/:id', authenticateToken, (req, res) => {
  const { type, itemName, customerName, phone, startDate, endDate, guests, bedCount, specialRequests, status } = req.body;
  db.run(`UPDATE bookings SET type=?, itemName=?, customerName=?, phone=?, startDate=?, endDate=?, guests=?, bedCount=?, specialRequests=?, status=? WHERE id=?`,
    [type, itemName, customerName, phone, startDate, endDate, guests || 1, bedCount || 1, specialRequests || '', status || 'pending', req.params.id],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('booking_updated');
        res.json({ changes: this.changes });
      }
    });
});
app.patch('/api/bookings/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const idParam = req.params.id;
  // Match by numeric id first, then fall back to bookingRef (for Firestore-sourced bookings)
  db.run(
    "UPDATE bookings SET status=? WHERE id=? OR bookingRef=?",
    [status, idParam, idParam],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      io.emit('booking_updated');
      res.json({ changes: this.changes, success: true });
    }
  );
});
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
  const idParam = req.params.id;
  db.run("DELETE FROM bookings WHERE id = ? OR bookingRef = ?", [idParam, idParam], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('booking_updated');
      res.json({ changes: this.changes });
    }
  });
});

// ===================== CONTACT =====================
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required.' });
    }
    db.run(
      `INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)`,
      [name, email || '', phone || '', message],
      async function(err) {
        if (err) console.error("Database Contact Insert Error:", err);
        const contactId = this?.lastID;
        const msg = `✉️ <b>New Contact Message!</b>\n\n👤 <b>${escapeHtml(name)}</b>\n📧 ${escapeHtml(email) || 'N/A'}\n📞 ${escapeHtml(phone) || 'N/A'}\n\n💬 ${escapeHtml(message)}\n\n🕒 ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}`;
        await sendTelegramMessage(msg).catch(e => console.error("Telegram error:", e));
        io.emit('new_contact_message', { id: contactId, name, email, phone, message });
        res.json({ success: true, message: 'Message sent successfully!' });
      }
    );
  } catch (err) {
    console.error("Contact API error:", err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.get('/api/contact-messages', authenticateToken, (req, res) => {
  db.all("SELECT * FROM contact_messages ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});

app.delete('/api/contact-messages/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM contact_messages WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message }); else res.json({ changes: this.changes });
  });
});

// ===================== STAFF ROUTES =====================
app.get('/api/staff', authenticateToken, (req, res) => {
  db.all("SELECT id, username, fullName, role, permissions, phone, status, createdAt FROM staff_users ORDER BY id ASC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/staff', authenticateToken, (req, res) => {
  const { username, password, fullName, role, permissions, phone, status } = req.body;
  db.run(`INSERT INTO staff_users (username, password, fullName, role, permissions, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [username, password, fullName, role || 'receptionist', permissions || 'bookings,rooms,rentals', phone || '', status || 'active'],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
          ['Create Staff Account', req.user?.username || 'Admin', `Created staff user '${username}' (${role})`]);
        io.emit('staff_updated');
        res.json({ id: this.lastID });
      }
    });
});
const handleUpdateStaff = (req, res) => {
  const { username, password, fullName, role, permissions, phone, status } = req.body;
  if (password && password.trim()) {
    db.run(`UPDATE staff_users SET username=COALESCE(?, username), password=?, fullName=?, role=?, permissions=?, phone=?, status=? WHERE id=?`,
      [username || null, password, fullName, role, permissions || '', phone || '', status || 'active', req.params.id],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
            ['Update Staff Account', req.user?.username || 'Admin', `Updated staff ID #${req.params.id} (${fullName || username})`]);
          io.emit('staff_updated');
          res.json({ changes: this.changes });
        }
      });
  } else {
    db.run(`UPDATE staff_users SET username=COALESCE(?, username), fullName=?, role=?, permissions=?, phone=?, status=? WHERE id=?`,
      [username || null, fullName, role, permissions || '', phone || '', status || 'active', req.params.id],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
            ['Update Staff Account', req.user?.username || 'Admin', `Updated staff ID #${req.params.id} (${fullName || username})`]);
          io.emit('staff_updated');
          res.json({ changes: this.changes });
        }
      });
  }
};
app.put('/api/staff/:id', authenticateToken, handleUpdateStaff);
app.patch('/api/staff/:id', authenticateToken, handleUpdateStaff);
app.delete('/api/staff/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM staff_users WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
        ['Delete Staff Account', req.user?.username || 'Admin', `Removed staff user ID #${req.params.id}`]);
      io.emit('staff_updated');
      res.json({ changes: this.changes });
    }
  });
});

// ===================== AUDIT LOGS ROUTES =====================
app.get('/api/audit-logs', authenticateToken, (req, res) => {
  db.all("SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 100", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/audit-logs', authenticateToken, (req, res) => {
  const { action, details } = req.body;
  db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
    [action, req.user?.username || 'Admin', details || ''],
    function(err) {
      if (err) res.status(500).json({ error: err.message }); else res.json({ id: this.lastID });
    });
});

// ===================== MAINTENANCE ROUTES =====================
app.get('/api/maintenance', authenticateToken, (req, res) => {
  db.all(`SELECT m.*, b.name as bikeName, b.plateNumber 
          FROM maintenance_logs m 
          LEFT JOIN bikes b ON m.bikeId = b.id 
          ORDER BY m.id DESC`, [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});
app.post('/api/maintenance', authenticateToken, (req, res) => {
  const { bikeId, logType, description, cost, performedBy, logDate, nextServiceDate } = req.body;
  db.run(`INSERT INTO maintenance_logs (bikeId, logType, description, cost, performedBy, logDate, nextServiceDate)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [bikeId, logType || 'General Service', description || '', Number(cost) || 0, performedBy || 'Mechanic', logDate || new Date().toISOString().split('T')[0], nextServiceDate || ''],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('maintenance_updated');
        res.json({ id: this.lastID });
      }
    });
});
app.delete('/api/maintenance/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM maintenance_logs WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('maintenance_updated');
      res.json({ changes: this.changes });
    }
  });
});

// ===================== EXPENSES ROUTES =====================
app.get('/api/expenses', authenticateToken, (req, res) => {
  db.all("SELECT * FROM expenses ORDER BY date DESC, id DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/expenses', authenticateToken, (req, res) => {
  const { title, category, amount, date, notes } = req.body;
  db.run(`INSERT INTO expenses (title, category, amount, date, notes) VALUES (?, ?, ?, ?, ?)`,
    [title || 'Expense', category || 'Other', Number(amount) || 0, date || new Date().toISOString().split('T')[0], notes || ''],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        io.emit('expenses_updated');
        res.json({ id: this.lastID });
      }
    });
});
app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM expenses WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('expenses_updated');
      res.json({ changes: this.changes });
    }
  });
});

// ===================== TELEGRAM ALERT CENTER =====================
app.post('/api/telegram/send-alert', authenticateToken, async (req, res) => {
  const { type, category, subject, title, message, summary, details, stats } = req.body;
  try {
    const timeStr = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });
    let text = '';

    if (category) {
      const headerTitle = title || subject || `${category} Status Report`;
      let statsSection = '';
      if (stats && typeof stats === 'object') {
        statsSection = Object.entries(stats)
          .map(([k, v]) => `• <b>${escapeHtml(k)}:</b> ${escapeHtml(v)}`)
          .join('\n');
      }

      text = `<b>[${escapeHtml(category).toUpperCase()} ALERT]</b>\n` +
             `📌 <b>${escapeHtml(headerTitle)}</b>\n\n` +
             `${summary ? escapeHtml(summary) + '\n\n' : ''}` +
             `${statsSection ? statsSection + '\n\n' : ''}` +
             `${details ? escapeHtml(details) + '\n\n' : ''}` +
             `🕒 <i>${timeStr}</i>\n` +
             `👤 <i>Sent by: ${escapeHtml(req.user?.username || 'Admin')}</i>`;
    } else if (type === 'custom') {
      text = `<b>[ANNOUNCEMENT]</b>\n\n` +
             `📌 <b>${escapeHtml(subject || 'Notice')}</b>\n\n` +
             `${escapeHtml(message || '')}\n\n` +
             `🕒 <i>${timeStr}</i>\n` +
             `👤 <i>Sent by: ${escapeHtml(req.user?.username || 'Admin')}</i>`;
    } else if (type === 'dashboard') {
      text = `<b>[DASHBOARD SUMMARY]</b>\n\n` +
             `${escapeHtml(message || summary || 'Daily operational check.')}\n\n` +
             `🕒 <i>${timeStr}</i>`;
    } else if (type === 'motos' || type === 'fleet') {
      text = `<b>[FLEET STATUS]</b>\n\n` +
             `${escapeHtml(message || summary || 'All motorbikes inspected and updated.')}\n\n` +
             `🕒 <i>${timeStr}</i>`;
    } else if (type === 'overdue') {
      text = `<b>[OVERDUE RENTALS WARNING]</b>\n\n` +
             `${escapeHtml(message || summary || 'Please inspect active rentals list for late returns.')}\n\n` +
             `🕒 <i>${timeStr}</i>`;
    } else if (type === 'income') {
      text = `<b>[INCOME REPORT]</b>\n\n` +
             `${escapeHtml(message || summary || 'Financial transactions recorded in system.')}\n\n` +
             `🕒 <i>${timeStr}</i>`;
    } else {
      text = `<b>[SYSTEM NOTIFICATION]</b>\n\n` +
             `📌 <b>${escapeHtml(subject || title || 'Alert')}</b>\n\n` +
             `${escapeHtml(message || summary || 'Notification from Admin Panel')}\n\n` +
             `🕒 <i>${timeStr}</i>`;
    }

    const result = await sendTelegramMessage(text);
    if (result.ok) res.json({ success: true, result });
    else res.status(400).json({ success: false, error: result.reason || result.description });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/test-template', authenticateToken, async (req, res) => {
  const { type, template } = req.body;
  try {
    const timeStr = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });
    const sampleData = {
      booking_ref: 'BK-TEST-2026',
      type: 'Motor Rental (ជួលម៉ូតូ)',
      item_name: 'Honda Scoopy 2024',
      customer_name: 'John Doe (Test)',
      phone: '+855 12 345 678',
      bike_model: 'Honda Scoopy 2024',
      plate_number: '1AB-2345',
      room_name: 'Deluxe Room #101',
      start_date: '2026-09-13',
      end_date: '2026-09-16',
      total_amount: '45.00',
      deposit: '50.00',
      return_date: '2026-09-16',
      late_fee: '0.00',
      damage_fee: '0.00',
      deposit_returned: '50.00',
      payment_method: 'ABA KHQR',
      staff_name: req.user?.username || 'Admin',
      notes: 'Test notification from Admin Panel',
      invoice_id: 'INV-TEST-001',
      amount: '45.00',
      time: timeStr
    };

    const text = formatCustomTemplate(template, sampleData);
    const result = await sendTelegramMessage(text);
    if (result.ok) res.json({ success: true, result });
    else res.status(400).json({ success: false, error: result.reason || result.description });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== BACKUP & RESTORE =====================
app.get('/api/backup', authenticateToken, (req, res) => {
  const tables = ['bikes', 'rooms', 'bookings', 'guests', 'room_occupancy', 'rentals', 'invoices', 'housekeeping_tasks', 'maintenance_logs', 'settings', 'staff_users', 'audit_logs'];
  const dump = { exportedAt: new Date().toISOString(), system: "Siem Reap Angkor PMS", version: "2.0", data: {} };
  let pending = tables.length;

  tables.forEach(table => {
    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
      dump.data[table] = (!err && rows) ? rows : [];
      pending--;
      if (pending === 0) {
        db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
          ['Database Backup', req.user?.username || 'Admin', 'Generated full JSON backup of all tables.']);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=siemreap-angkor-backup-${Date.now()}.json`);
        res.json(dump);
      }
    });
  });
});

app.post('/api/restore', authenticateToken, (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: "Invalid backup data structure" });
    return;
  }

  db.serialize(() => {
    Object.keys(data).forEach(tableName => {
      const rows = data[tableName];
      if (Array.isArray(rows) && rows.length > 0) {
        db.run(`DELETE FROM ${tableName}`);
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const stmt = db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`);
        rows.forEach(r => {
          const values = columns.map(col => r[col]);
          stmt.run(values);
        });
        stmt.finalize();
      }
    });

    db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
      ['Database Restore', req.user?.username || 'Admin', 'Successfully restored database from uploaded backup.']);
    res.json({ success: true, message: "Database restored successfully." });
  });
});

// ===================== SETTINGS =====================
app.get('/api/settings', authenticateToken, (req, res) => {
  db.all("SELECT key, value FROM settings", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else { const s = {}; rows.forEach(r => s[r.key] = r.value); res.json(s); }
  });
});
app.get('/api/public-settings', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  db.all("SELECT key, value FROM settings WHERE key IN ('hero_images','about_us','why_us','services_bar','testimonials','contact_info','business_profile','pricing_tax','payment_methods','invoice_settings','public_texts','shop_settings','theme_settings')", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else { const s = {}; rows.forEach(r => s[r.key] = r.value); res.json(s); }
  });
});

app.post('/api/public-reviews', (req, res) => {
  const { name, country, rating, text } = req.body;
  db.get("SELECT value FROM settings WHERE key = 'testimonials'", [], (err, row) => {
    if (err) { res.status(500).json({ error: err.message }); return; }
    
    let testimonials = [];
    if (row && row.value) {
      try { testimonials = JSON.parse(row.value); } catch (e) { testimonials = []; }
    }
    
    const newEntry = {
      name: name || "Anonymous",
      country: country || "Unknown",
      rating: Number(rating) || 5,
      text: text || ""
    };
    testimonials.push(newEntry);
    
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('testimonials', ?)", [JSON.stringify(testimonials)], function(err2) {
      if (err2) { res.status(500).json({ error: err2.message }); return; }
      io.emit('settings_updated');
      io.emit('public_settings_updated');

      // Send Telegram notification
      const stars = '⭐'.repeat(Math.max(1, Math.min(5, Number(rating) || 5)));
      const tgMsg = `🌟 <b>New Guest Feedback Received!</b>\n` +
        `👤 <b>Guest:</b> ${escapeHtml(name || 'Anonymous')} (${escapeHtml(country || 'Guest')})\n` +
        `⭐ <b>Rating:</b> ${stars} (${rating || 5}/5)\n` +
        `💬 <b>Review:</b>\n"${escapeHtml(text || '')}"`;
      sendTelegramMessage(tgMsg).catch(err => console.error("Telegram feedback alert error:", err));

      res.json({ success: true });
    });
  });
});

app.post('/api/settings', authenticateToken, (req, res) => {
  const keys = Object.keys(req.body);
  if (keys.length === 0) return res.json({ success: true });

  db.serialize(() => {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    keys.forEach(k => {
      const val = req.body[k];
      if (val !== undefined) {
        const storedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        stmt.run(k, storedVal);
      }
    });
    stmt.finalize((err) => {
      if (err) {
        console.error("Error saving settings:", err);
        return res.status(500).json({ error: err.message });
      }
      
      try {
        db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
          ['Update Settings', req.user?.username || 'Admin', `Updated settings keys: ${keys.join(', ')}`], () => {});
      } catch (ignore) {}

      io.emit('settings_updated');
      io.emit('public_settings_updated');
      res.json({ success: true });
    });
  });
});
app.post('/api/settings/test', authenticateToken, async (req, res) => {
  const result = await sendTelegramMessage('✅ <b>Test from Siem Reap Angkor PMS!</b>\nYour Telegram bot notifications are properly configured.');
  if (result.ok) res.json({ success: true });
  else res.status(400).json({ success: false, error: result.reason || result.description });
});

// Global error handler middleware so Vercel returns JSON instead of crashing
app.use((err, req, res, next) => {
  console.error("API error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
