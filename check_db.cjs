const Database = require('better-sqlite3');
const db = new Database('roms.db');

try {
  const users = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').all('ahmad@testy.com');
  console.log('User found:', JSON.stringify(users, null, 2));

  if (users.length > 0) {
    const userId = users[0].id;
    const assignments = db.prepare('SELECT * FROM staff_tables WHERE waiter_id = ?').all(userId);
    console.log('Assignments for Ahmad (ID: ' + userId + '):', JSON.stringify(assignments, null, 2));

    const joined = db.prepare(`
      SELECT t.* 
      FROM tables t
      JOIN staff_tables st ON t.id = st.table_id
      WHERE st.waiter_id = ?
    `).all(userId);
    console.log('Joined result:', JSON.stringify(joined, null, 2));
  }

  const allAssignments = db.prepare('SELECT * FROM staff_tables').all();
  console.log('All staff_tables:', JSON.stringify(allAssignments, null, 2));

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
