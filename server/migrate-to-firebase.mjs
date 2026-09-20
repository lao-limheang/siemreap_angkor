import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, doc, setDoc } from "firebase/firestore";
import sqlite3 from 'sqlite3';

const configMotos = {
  apiKey: "AIzaSyCTeiJTMlOMh9N_7uzVh9DN1xZvSK5Ja2c",
  authDomain: "chafe-2026.firebaseapp.com",
  projectId: "chafe-2026",
  storageBucket: "chafe-2026.firebasestorage.app",
  messagingSenderId: "222708339754",
  appId: "1:222708339754:web:6f4f23c49aaeeae5935f53"
};

const app = initializeApp(configMotos, "migrator");
const firestore = getFirestore(app);
const db = new sqlite3.Database('server/app.db');

const querySql = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

async function migrate() {
  console.log("=== STARTING MIGRATION: SQLite -> Firebase Firestore ===");

  // 1. Get Firestore rooms to build mapping (roomNumber -> firestoreId)
  const roomSnap = await getDocs(collection(firestore, 'hotel_rooms'));
  const roomMap = {}; // number -> docId
  roomSnap.forEach(d => {
    const data = d.data();
    const num = String(data.number || data.roomNumber || data.name || '').replace(/[^0-9]/g, '');
    if (num) roomMap[num] = d.id;
  });
  console.log("Firestore room mapping:", roomMap);

  // 2. Migrate Staff Users
  const staffRows = await querySql("SELECT * FROM staff_users");
  console.log(`Found ${staffRows.length} staff rows in SQLite.`);
  const existingStaffSnap = await getDocs(collection(firestore, 'staff'));
  const existingUsernames = new Set();
  existingStaffSnap.forEach(d => {
    const data = d.data();
    if (data.username) existingUsernames.add(data.username.toLowerCase());
  });

  for (const s of staffRows) {
    if (existingUsernames.has((s.username || '').toLowerCase())) {
      console.log(` - Staff ${s.username} already in Firestore, skipping.`);
      continue;
    }
    const staffData = {
      username: s.username || '',
      fullName: s.fullName || s.username || '',
      role: s.role || 'receptionist',
      phone: s.phone || '',
      status: s.status || 'active',
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now()
    };
    await addDoc(collection(firestore, 'staff'), staffData);
    console.log(` + Migrated staff: ${s.username} (${s.fullName})`);
  }

  // 3. Migrate Room Occupancy
  const occRows = await querySql("SELECT * FROM room_occupancy");
  console.log(`Found ${occRows.length} room_occupancy rows in SQLite.`);
  const existingOccSnap = await getDocs(collection(firestore, 'room_occupancy'));
  const existingOccGuests = new Set();
  existingOccSnap.forEach(d => {
    const data = d.data();
    if (data.guestName && data.checkInDate) {
      existingOccGuests.add(`${data.guestName}_${data.checkInDate}`);
    }
  });

  for (const o of occRows) {
    const key = `${o.guestName}_${o.checkInDate}`;
    if (existingOccGuests.has(key)) {
      console.log(` - Occupancy for ${o.guestName} (${o.checkInDate}) already exists, skipping.`);
      continue;
    }
    // Room ID mapping: 1 -> 101 -> docId
    const targetRoomId = roomMap["101"] || Object.values(roomMap)[0] || "9YSKz6zL40ExaQNI3eiv";
    const occData = {
      roomId: targetRoomId,
      roomIds: [targetRoomId],
      roomName: "101",
      roomNames: ["101"],
      guestName: o.guestName || '',
      guestPhone: o.guestPhone || '',
      guestNationality: o.guestNationality || 'Cambodia',
      passportOrId: o.passportOrId || '',
      bedCount: Number(o.bedCount || 1),
      checkInDate: o.checkInDate || '',
      checkOutDate: o.checkOutDate || '',
      actualCheckOut: o.actualCheckOut || '',
      status: o.status || 'checked_out',
      notes: o.notes || '',
      price: Number(o.totalPrice || 25),
      totalPrice: Number(o.totalPrice || 25),
      paymentMethod: o.paymentMethod || 'cash',
      createdAt: o.createdAt ? new Date(o.createdAt).getTime() : Date.now()
    };
    await addDoc(collection(firestore, 'room_occupancy'), occData);
    console.log(` + Migrated room occupancy: ${o.guestName} in room 101`);
  }

  // 4. Migrate Audit Logs
  const logRows = await querySql("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50");
  console.log(`Found ${logRows.length} audit logs to migrate.`);
  const existingLogsSnap = await getDocs(collection(firestore, 'audit_logs'));
  if (existingLogsSnap.size === 0) {
    for (const l of logRows) {
      const logData = {
        action: l.action || '',
        entity: l.entity || l.module || '',
        entityId: l.entityId || l.recordId || '',
        details: l.details || '',
        userId: l.userId || '',
        username: l.username || 'system',
        ipAddress: l.ipAddress || '',
        timestamp: l.timestamp ? new Date(l.timestamp).getTime() : Date.now(),
        createdAt: l.timestamp ? new Date(l.timestamp).getTime() : Date.now()
      };
      await addDoc(collection(firestore, 'audit_logs'), logData);
    }
    console.log(` + Migrated ${logRows.length} audit logs to Firestore.`);
  } else {
    console.log(` - Firestore already has ${existingLogsSnap.size} audit logs.`);
  }

  // 5. Migrate SQLite settings
  const settingsRows = await querySql("SELECT key, value FROM settings");
  if (settingsRows.length > 0) {
    const setObj = {};
    for (const r of settingsRows) {
      try {
        setObj[r.key] = JSON.parse(r.value);
      } catch {
        setObj[r.key] = r.value;
      }
    }
    await setDoc(doc(firestore, 'settings', 'public_settings'), setObj, { merge: true });
    console.log(` + Synced ${settingsRows.length} settings to Firestore public_settings.`);
  }

  console.log("=== MIGRATION COMPLETE! ===");
  db.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration error:", err);
  db.close();
  process.exit(1);
});
