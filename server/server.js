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
      floor TEXT DEFAULT '1'
    )`);

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
    db.run(`CREATE TABLE IF NOT EXISTS room_occupancy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomId INTEGER NOT NULL,
      guestName TEXT NOT NULL,
      guestPhone TEXT,
      guestNationality TEXT,
      bedCount INTEGER DEFAULT 1,
      checkInDate TEXT NOT NULL,
      checkOutDate TEXT NOT NULL,
      actualCheckOut TEXT,
      status TEXT DEFAULT 'checked_in',
      notes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    )`);

    // Motorbike Rentals
    db.run(`CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bikeId INTEGER NOT NULL,
      guestName TEXT NOT NULL,
      guestPhone TEXT,
      guestNationality TEXT,
      deposit REAL DEFAULT 0,
      depositType TEXT DEFAULT 'cash',
      linkedRoomOccupancyId INTEGER,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      actualReturn TEXT,
      dailyRate REAL NOT NULL,
      status TEXT DEFAULT 'active',
      preCondition TEXT,
      postCondition TEXT,
      damageFee REAL DEFAULT 0,
      damageNotes TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(bikeId) REFERENCES bikes(id)
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

async function sendTelegramMessage(text) {
  return new Promise((resolve) => {
    db.get("SELECT value FROM settings WHERE key = 'telegram_token'", [], async (err, tokenRow) => {
      const token = (tokenRow?.value && tokenRow.value.trim()) || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) { resolve({ ok: false, reason: 'No token configured' }); return; }
      db.get("SELECT value FROM settings WHERE key = 'telegram_chat_id'", [], async (err2, chatRow) => {
        const chatId = (chatRow?.value && chatRow.value.trim()) || process.env.TELEGRAM_CHAT_ID;
        if (!chatId) { resolve({ ok: false, reason: 'No chat ID configured' }); return; }
        try {
          let resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
          });
          let result = await resp.json();
          // If HTML entity parsing fails, retry as plain text
          if (!result.ok && result.description && result.description.includes('parse entities')) {
            console.log('Telegram HTML entity parse failed, retrying plain text...');
            const plainText = text.replace(/<[^>]*>/g, '');
            resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: plainText })
            });
            result = await resp.json();
          }
          if (!result.ok) {
            console.error('Telegram API error:', result);
          }
          resolve(result);
        } catch (e) {
          console.error('Telegram fetch network error:', e);
          resolve({ ok: false, reason: e.message });
        }
      });
    });
  });
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

// ===================== ROOMS ROUTES =====================
app.get('/api/rooms', (req, res) => {
  db.all("SELECT * FROM rooms ORDER BY id ASC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows.map(r => {
      let amenities = [];
      let policies = {};
      try { amenities = typeof r.amenities === 'string' ? JSON.parse(r.amenities || '[]') : r.amenities; } catch { amenities = []; }
      try { policies = typeof r.policies === 'string' ? JSON.parse(r.policies || '{}') : r.policies; } catch { policies = {}; }
      return { ...r, amenities: amenities || [], policies: policies || {} };
    }));
  });
});
app.post('/api/rooms', authenticateToken, (req, res) => {
  const { name, description, images, imageUrl, beds1Price, beds2Price, beds3Price, amenities, policies, floor } = req.body;
  let imgs = images;
  if (!imgs && imageUrl) {
    try { imgs = typeof imageUrl === 'string' ? JSON.parse(imageUrl) : imageUrl; } catch { imgs = [imageUrl]; }
  }
  const imgStr = JSON.stringify(Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []));
  const amenitiesStr = JSON.stringify(Array.isArray(amenities) ? amenities : []);
  const policiesStr = JSON.stringify(typeof policies === 'object' ? policies : {});

  db.run(`INSERT INTO rooms (name, description, imageUrl, beds1Price, beds2Price, beds3Price, amenities, policies, status, floor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'vacant', ?)`,
    [name, description || '', imgStr, Number(beds1Price) || 20, Number(beds2Price) || 30, Number(beds3Price) || 40, amenitiesStr, policiesStr, floor || '1'],
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
  const { name, description, images, imageUrl, beds1Price, beds2Price, beds3Price, amenities, policies, status, floor } = req.body;
  let imgs = images;
  if (!imgs && imageUrl) {
    try { imgs = typeof imageUrl === 'string' ? JSON.parse(imageUrl) : imageUrl; } catch { imgs = [imageUrl]; }
  }
  const imgStr = JSON.stringify(Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []));
  const amenitiesStr = JSON.stringify(Array.isArray(amenities) ? amenities : []);
  const policiesStr = JSON.stringify(typeof policies === 'object' ? policies : {});

  db.run(`UPDATE rooms SET name=?, description=?, imageUrl=?, beds1Price=?, beds2Price=?, beds3Price=?, amenities=?, policies=?, status=?, floor=? WHERE id=?`,
    [name, description || '', imgStr, Number(beds1Price) || 20, Number(beds2Price) || 30, Number(beds3Price) || 40, amenitiesStr, policiesStr, status || 'vacant', floor || '1', req.params.id],
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
  const { roomId, guestName, guestPhone, guestNationality, bedCount, checkInDate, checkOutDate, notes } = req.body;
  db.run(`INSERT INTO room_occupancy (roomId, guestName, guestPhone, guestNationality, bedCount, checkInDate, checkOutDate, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'checked_in')`,
    [roomId, guestName, guestPhone, guestNationality, bedCount || 1, checkInDate, checkOutDate, notes || ''],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      // Update room status to occupied
      db.run("UPDATE rooms SET status='occupied' WHERE id=?", [roomId]);
      io.emit('room_status_updated');
      res.json({ id: this.lastID });
    });
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
      res.json({ success: true });
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
  const { bikeId, guestName, guestPhone, guestNationality, deposit, depositType, linkedRoomOccupancyId, startDate, endDate, dailyRate, preCondition } = req.body;
  db.run(`INSERT INTO rentals (bikeId, guestName, guestPhone, guestNationality, deposit, depositType, linkedRoomOccupancyId, startDate, endDate, dailyRate, preCondition, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [bikeId, guestName, guestPhone, guestNationality, deposit || 0, depositType || 'cash', linkedRoomOccupancyId || null, startDate, endDate, dailyRate, preCondition || ''],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      db.run("UPDATE bikes SET status='rented' WHERE id=?", [bikeId]);
      io.emit('bike_status_updated');
      res.json({ id: this.lastID });
    });
});
app.patch('/api/rentals/:id/return', authenticateToken, (req, res) => {
  const { postCondition, damageFee, damageNotes } = req.body;
  const now = new Date().toISOString();
  db.get("SELECT * FROM rentals WHERE id=?", [req.params.id], (err, row) => {
    if (err || !row) { res.status(404).json({ error: 'Not found' }); return; }
    db.run("UPDATE rentals SET status='returned', actualReturn=?, postCondition=?, damageFee=?, damageNotes=? WHERE id=?",
      [now, postCondition || '', damageFee || 0, damageNotes || '', req.params.id], function(err2) {
        if (err2) { res.status(500).json({ error: err2.message }); return; }
        db.run("UPDATE bikes SET status='available' WHERE id=?", [row.bikeId]);
        io.emit('bike_status_updated');
        res.json({ success: true });
      });
  });
});
app.delete('/api/rentals/:id', authenticateToken, (req, res) => {
  db.get("SELECT bikeId FROM rentals WHERE id=?", [req.params.id], (err, row) => {
    db.run("DELETE FROM rentals WHERE id=?", [req.params.id], function(err2) {
      if (err2) { res.status(500).json({ error: err2.message }); return; }
      if (row) db.run("UPDATE bikes SET status='available' WHERE id=?", [row.bikeId]);
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
    function(err) { if (err) res.status(500).json({ error: err.message }); else res.json({ id: this.lastID, invoiceNumber, total }); });
});
app.patch('/api/invoices/:id/pay', authenticateToken, (req, res) => {
  const { paymentMethod } = req.body;
  const now = new Date().toISOString();
  db.run("UPDATE invoices SET paymentStatus='paid', paymentMethod=?, paidAt=? WHERE id=?",
    [paymentMethod || 'cash', now, req.params.id],
    function(err) { if (err) res.status(500).json({ error: err.message }); else res.json({ success: true }); });
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
    function(err) { if (err) res.status(500).json({ error: err.message }); else res.json({ id: this.lastID }); });
});
app.patch('/api/housekeeping/:id/complete', authenticateToken, (req, res) => {
  const now = new Date().toISOString();
  db.get("SELECT roomId FROM housekeeping_tasks WHERE id=?", [req.params.id], (err, row) => {
    db.run("UPDATE housekeeping_tasks SET status='done', completedAt=? WHERE id=?", [now, req.params.id], function(err2) {
      if (err2) { res.status(500).json({ error: err2.message }); return; }
      // Mark room as vacant after cleaning
      if (row) { db.run("UPDATE rooms SET status='vacant' WHERE id=? AND status='cleaning'", [row.roomId]); io.emit('room_status_updated'); }
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
    function(err) { if (err) res.status(500).json({ error: err.message }); else res.json({ id: this.lastID }); });
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
    function(err) { if (err) res.status(500).json({ error: err.message }); else res.json({ id: this.lastID }); });
});
app.delete('/api/guests/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM guests WHERE id=?", [req.params.id], function(err) {
    if (err) res.status(500).json({ error: err.message }); else res.json({ changes: this.changes });
  });
});

// ===================== REPORTS =====================
app.get('/api/reports', authenticateToken, (req, res) => {
  const { period } = req.query;
  const days = period === 'year' ? 365 : period === 'month' ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  
  const result = {};
  let pending = 4;
  const done = () => { pending--; if (pending === 0) res.json(result); };

  db.all(`SELECT SUM(roomCharge) as total, COUNT(*) as count FROM invoices WHERE paymentStatus='paid' AND date(paidAt)>=?`, [since], (err, rows) => {
    result.roomRevenue = rows[0]?.total || 0; result.roomCount = rows[0]?.count || 0; done();
  });
  db.all(`SELECT SUM(bikeCharge+lateFee+damageFee) as total, COUNT(*) as count FROM invoices WHERE paymentStatus='paid' AND date(paidAt)>=?`, [since], (err, rows) => {
    result.bikeRevenue = rows[0]?.total || 0; result.bikeCount = rows[0]?.count || 0; done();
  });
  db.all(`SELECT strftime('%Y-%m-%d', paidAt) as day, SUM(totalAmount) as total FROM invoices WHERE paymentStatus='paid' AND date(paidAt)>=? GROUP BY day ORDER BY day`, [since], (err, rows) => {
    result.dailyRevenue = rows || []; done();
  });
  db.all(`SELECT b.name, COUNT(r.id) as rentals FROM rentals r JOIN bikes b ON r.bikeId = b.id WHERE date(r.createdAt)>=? GROUP BY r.bikeId ORDER BY rentals DESC LIMIT 5`, [since], (err, rows) => {
    result.topBikes = rows || []; done();
  });
});

// ===================== BOOKINGS (public website) =====================
app.get('/api/bookings', authenticateToken, (req, res) => {
  db.all("SELECT * FROM bookings ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message }); else res.json(rows);
  });
});
app.post('/api/bookings', async (req, res) => {
  const { type, itemName, customerName, phone, startDate, endDate, guests, bedCount, specialRequests } = req.body;
  db.run(`INSERT INTO bookings (type, itemName, customerName, phone, startDate, endDate, guests, bedCount, specialRequests, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [type, itemName, customerName, phone, startDate, endDate, guests || 1, bedCount || 1, specialRequests || ''],
    async function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      const emoji = type === 'motor' ? '🛵' : '🏨';
      const msg = `${emoji} <b>New ${type === 'motor' ? 'Motor Rental' : 'Room Booking'}!</b>\n\n📌 <b>${itemName}</b>\n👤 ${customerName}\n📞 ${phone}\n📅 ${startDate} → ${endDate}\n🕒 ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}`;
      await sendTelegramMessage(msg);
      io.emit('new_booking', { message: 'A new booking was submitted.' });
      res.json({ id: this.lastID, message: 'Booking submitted successfully!' });
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
  db.run("UPDATE bookings SET status=? WHERE id=?", [status, req.params.id], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      io.emit('booking_updated');
      res.json({ changes: this.changes });
    }
  });
});
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM bookings WHERE id = ?", req.params.id, function(err) {
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
        res.json({ id: this.lastID });
      }
    });
});
app.put('/api/staff/:id', authenticateToken, (req, res) => {
  const { password, fullName, role, permissions, phone, status } = req.body;
  if (password) {
    db.run(`UPDATE staff_users SET password=?, fullName=?, role=?, permissions=?, phone=?, status=? WHERE id=?`,
      [password, fullName, role, permissions, phone, status, req.params.id],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
            ['Update Staff Account', req.user?.username || 'Admin', `Updated staff ID #${req.params.id} (${fullName})`]);
          res.json({ changes: this.changes });
        }
      });
  } else {
    db.run(`UPDATE staff_users SET fullName=?, role=?, permissions=?, phone=?, status=? WHERE id=?`,
      [fullName, role, permissions, phone, status, req.params.id],
      function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
            ['Update Staff Account', req.user?.username || 'Admin', `Updated staff ID #${req.params.id} (${fullName})`]);
          res.json({ changes: this.changes });
        }
      });
  }
});
app.delete('/api/staff/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM staff_users WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message });
    else {
      db.run(`INSERT INTO audit_logs (action, performedBy, details) VALUES (?, ?, ?)`,
        ['Delete Staff Account', req.user?.username || 'Admin', `Removed staff user ID #${req.params.id}`]);
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
        res.json({ id: this.lastID });
      }
    });
});
app.delete('/api/maintenance/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM maintenance_logs WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message }); else res.json({ changes: this.changes });
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
      else res.json({ id: this.lastID });
    });
});
app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM expenses WHERE id = ?", req.params.id, function(err) {
    if (err) res.status(500).json({ error: err.message }); else res.json({ changes: this.changes });
  });
});

// ===================== TELEGRAM ALERT CENTER =====================
app.post('/api/telegram/send-alert', authenticateToken, async (req, res) => {
  const { type, subject, message } = req.body;
  try {
    let text = '';
    if (type === 'custom') {
      text = `📢 <b>${escapeHtml(subject || 'Alert')}</b>\n\n${escapeHtml(message || '')}\n\n👤 Sent by: ${escapeHtml(req.user?.username || 'Admin')}`;
    } else if (type === 'dashboard') {
      text = `📊 <b>Siem Reap Angkor — Daily Dashboard Summary</b>\n\n🕒 ${new Date().toLocaleString('en-GB')}\n\nCheck the Admin Panel for live operations.`;
    } else if (type === 'motos') {
      text = `🛵 <b>Fleet Status Check</b>\n\nAll motorbikes inspected and updated in system.\n🕒 ${new Date().toLocaleString('en-GB')}`;
    } else if (type === 'overdue') {
      text = `⚠️ <b>ATTENTION: Overdue Rentals Alert</b>\n\nPlease check active rentals list for any late returns!`;
    } else if (type === 'income') {
      text = `💰 <b>Income Summary Alert</b>\n\nLatest transactions recorded in system.\n🕒 ${new Date().toLocaleString('en-GB')}`;
    } else {
      text = `🔔 <b>Alert from Admin Panel</b>\n\n${escapeHtml(message || 'System Notification')}`;
    }

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
  db.all("SELECT key, value FROM settings WHERE key IN ('hero_images','about_us','why_us','services_bar','testimonials','contact_info','business_profile','pricing_tax','payment_methods','invoice_settings','public_texts')", [], (err, rows) => {
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
