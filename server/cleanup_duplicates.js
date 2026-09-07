import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new sqlite3.Database(join(__dirname, 'app.db'));

db.serialize(() => {
  // Show current records
  db.all('SELECT id, guestName, checkInDate, checkOutDate FROM room_occupancy ORDER BY id', [], (err, rows) => {
    console.log('Current records:', rows?.length);
    rows?.forEach(r => console.log(' ', r.id, r.guestName, r.checkInDate));
  });

  // Delete duplicates — keep only the latest (max id) per guest+checkInDate combo
  db.run(`
    DELETE FROM room_occupancy 
    WHERE id NOT IN (
      SELECT MAX(id) FROM room_occupancy 
      GROUP BY guestName, checkInDate, checkOutDate
    )
  `, function(err) {
    if (err) console.error('Error:', err.message);
    else console.log('Deleted', this.changes, 'duplicate occupancy records');
  });

  db.all('SELECT id, guestName, checkInDate FROM room_occupancy ORDER BY id', [], (err, rows) => {
    console.log('After cleanup:', rows?.length, 'records remain');
    rows?.forEach(r => console.log(' ', r.id, r.guestName, r.checkInDate));
    db.close();
  });
});
