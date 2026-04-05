import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('restaurant.db');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'waiter', 'kitchen')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    waiter_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('new', 'preparing', 'ready', 'served')) DEFAULT 'new',
    total_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id),
    FOREIGN KEY (waiter_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_id) REFERENCES menu(id)
  );
`);

// Seed initial data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

// Ensure any legacy restaurant.com emails are rewritten to testy.com on startup.
db.prepare("UPDATE users SET email = REPLACE(email, '@restaurant.com', '@testy.com') WHERE email LIKE '%@restaurant.com'").run();

if (userCount.count === 0) {
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Admin User', 'admin@testy.com', hashedPassword, 'admin');
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Waiter User', 'waiter@testy.com', hashedPassword, 'waiter');
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Kitchen User', 'kitchen@testy.com', hashedPassword, 'kitchen');

  db.prepare('INSERT INTO tables (table_number) VALUES (?)').run('Table 1');
  db.prepare('INSERT INTO tables (table_number) VALUES (?)').run('Table 2');
  db.prepare('INSERT INTO tables (table_number) VALUES (?)').run('Table 3');
  db.prepare('INSERT INTO tables (table_number) VALUES (?)').run('Table 4');

  db.prepare('INSERT INTO menu (name, price, category) VALUES (?, ?, ?)').run('Burger', 12.99, 'Main');
  db.prepare('INSERT INTO menu (name, price, category) VALUES (?, ?, ?)').run('Pizza', 15.50, 'Main');
  db.prepare('INSERT INTO menu (name, price, category) VALUES (?, ?, ?)').run('Salad', 8.99, 'Starter');
  db.prepare('INSERT INTO menu (name, price, category) VALUES (?, ?, ?)').run('Coke', 2.50, 'Beverage');
}

export default db;
