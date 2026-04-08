const Database = require('better-sqlite3');
const db = new Database('roms.db');

try {
    const waiterId = 70; // Ahmad
    const tables = db.prepare(`
      SELECT t.* 
      FROM tables t
      JOIN staff_tables st ON t.id = st.table_id
      WHERE st.waiter_id = ?
    `).all(waiterId);
    console.log('Tables for Ahmad:', tables.length);
    console.log(JSON.stringify(tables, null, 2));

    const allStaffTables = db.prepare('SELECT * FROM staff_tables').all();
    console.log('All staff_tables count:', allStaffTables.length);

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
