import Database from 'better-sqlite3';
try {
  const db = new Database('./roms.db');
  console.log(db.prepare("PRAGMA table_info(tables)").all());
  db.close();
} catch (err) {
  console.log(err.message);
}
