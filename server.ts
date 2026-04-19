import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DB_PATH || 'roms.db');

// Initialize Database
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
    status TEXT DEFAULT 'new',
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
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_id) REFERENCES menu(id)
  );
`);

// Add missing menu/user fields when upgrading existing database
const menuColumns = db.prepare('PRAGMA table_info(menu)').all().map((col: any) => col.name);
if (!menuColumns.includes('description')) db.prepare('ALTER TABLE menu ADD COLUMN description TEXT DEFAULT ""').run();
if (!menuColumns.includes('preparation_time')) db.prepare('ALTER TABLE menu ADD COLUMN preparation_time INTEGER DEFAULT 0').run();
if (!menuColumns.includes('stock')) db.prepare('ALTER TABLE menu ADD COLUMN stock INTEGER DEFAULT 0').run();
if (!menuColumns.includes('out_of_stock')) db.prepare('ALTER TABLE menu ADD COLUMN out_of_stock INTEGER DEFAULT 0').run();
if (!menuColumns.includes('is_veg')) db.prepare('ALTER TABLE menu ADD COLUMN is_veg INTEGER DEFAULT 1').run();
if (!menuColumns.includes('half_price')) db.prepare('ALTER TABLE menu ADD COLUMN half_price REAL DEFAULT 0').run();
if (!menuColumns.includes('sub_category')) db.prepare('ALTER TABLE menu ADD COLUMN sub_category TEXT DEFAULT ""').run();
if (!menuColumns.includes('type')) db.prepare('ALTER TABLE menu ADD COLUMN type TEXT DEFAULT "veg"').run();
if (!menuColumns.includes('image_url')) db.prepare('ALTER TABLE menu ADD COLUMN image_url TEXT DEFAULT NULL').run();

const orderItemColumns = db.prepare('PRAGMA table_info(order_items)').all().map((col: any) => col.name);
if (!orderItemColumns.includes('portion')) db.prepare("ALTER TABLE order_items ADD COLUMN portion TEXT DEFAULT 'full'").run();
if (!orderItemColumns.includes('notes')) db.prepare("ALTER TABLE order_items ADD COLUMN notes TEXT DEFAULT ''").run();

const ordersTableColumns = db.prepare('PRAGMA table_info(orders)').all().map((col: any) => col.name);
if (!ordersTableColumns.includes('notes')) db.prepare("ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT ''").run();

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((col: any) => col.name);
if (!userColumns.includes('login_count')) db.prepare('ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0').run();
if (!userColumns.includes('last_login')) db.prepare('ALTER TABLE users ADD COLUMN last_login DATETIME').run();
if (!userColumns.includes('active')) db.prepare('ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 0').run();
if (!userColumns.includes('left_company')) db.prepare('ALTER TABLE users ADD COLUMN left_company INTEGER DEFAULT 0').run();

// Normalize any legacy restaurant.com staff emails to @testy.com
db.prepare("UPDATE users SET email = REPLACE(email, '@restaurant.com', '@testy.com') WHERE email LIKE '%@restaurant.com'").run();

// Create staff_tables table
db.exec(`
  CREATE TABLE IF NOT EXISTS staff_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waiter_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    FOREIGN KEY (waiter_id) REFERENCES users(id),
    FOREIGN KEY (table_id) REFERENCES tables(id),
    UNIQUE(waiter_id, table_id)
  );
`);

// Create customers (CRM) table
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    visits INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add customer_id & payment_method to orders if not present
const ordersColumns = db.prepare('PRAGMA table_info(orders)').all().map((col: any) => col.name);
if (!ordersColumns.includes('customer_id')) db.prepare('ALTER TABLE orders ADD COLUMN customer_id INTEGER DEFAULT NULL').run();
if (!ordersColumns.includes('payment_method')) db.prepare("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'").run();

// ── Migration: remove restrictive CHECK constraint on orders.status ──────────
// The original table had CHECK(status IN ('new','preparing','ready','served'))
// which blocks 'billing' and 'paid'. SQLite can't DROP a constraint, so we
// recreate the table without it (preserving all existing data).
{
  const ordersDDL: string = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'"
  ).get() as any)?.sql ?? '';

  if (ordersDDL.includes("CHECK(status IN")) {
    db.exec(`
      PRAGMA foreign_keys = OFF;

      ALTER TABLE orders RENAME TO orders_old;

      CREATE TABLE orders (
        id          INTEGER  PRIMARY KEY AUTOINCREMENT,
        table_id    INTEGER  NOT NULL,
        waiter_id   INTEGER  NOT NULL,
        status      TEXT     DEFAULT 'new',
        total_price REAL     NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id)  REFERENCES tables(id),
        FOREIGN KEY (waiter_id) REFERENCES users(id)
      );

      INSERT INTO orders SELECT id, table_id, waiter_id, status, total_price, created_at FROM orders_old;

      DROP TABLE orders_old;

      PRAGMA foreign_keys = ON;
    `);
    console.log('[MIGRATION] orders table rebuilt — CHECK constraint removed.');
  }
}

// Fix: ensure items with stock > 0 are not marked out_of_stock (fixes bad initial seed data)
db.prepare("UPDATE menu SET out_of_stock = 0 WHERE stock > 0 AND out_of_stock = 1").run();
// Fix: ensure items with stock = 0 but were seeded with prep_time are marked available (drinks/etc)
// Reset all base seeded items to available if stock wasn't intentionally drained
db.prepare("UPDATE menu SET out_of_stock = 0 WHERE name IN ('Coke','Craft Beer') AND out_of_stock = 1").run();

// Seed initial data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
const salt = bcrypt.genSaltSync(10);
const adminPassword = bcrypt.hashSync('admin', salt);
const defaultPassword = bcrypt.hashSync('password123', salt);
const defaultUsers = [
  { name: 'Admin User', email: 'admin', role: 'admin', password: adminPassword },
  { name: 'Waiter User', email: 'waiter@testy.com', role: 'waiter', password: defaultPassword },
  { name: 'Kitchen User', email: 'kitchen@testy.com', role: 'kitchen', password: defaultPassword },
];

if (userCount.count === 0) {
  defaultUsers.forEach((user) => {
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
      .run(user.name, user.email, user.password, user.role);
  });

  // Seed tables
  for (let i = 1; i <= 10; i++) {
    db.prepare('INSERT INTO tables (table_number) VALUES (?)').run(`Table ${i}`);
  }

  // Seed menu: [name, price, category, description, prep_time, stock, is_veg (1=veg, 0=non-veg)]
  const menuItems = [
    ['Classic Burger', 12.99, 'Main', 'Beef patty with lettuce, tomato, and special sauce', 15, 20, 0],
    ['Margherita Pizza', 15.50, 'Main', 'Tomato, mozzarella, and fresh basil', 20, 15, 1],
    ['Pesto Pasta', 11.00, 'Main', 'Pasta tossed in creamy basil pesto', 18, 12, 1],
    ['Caesar Salad', 8.50, 'Starter', 'Crisp romaine, parmesan, and croutons', 10, 8, 1],
    ['Coke', 2.50, 'Drink', 'Chilled classic cola', 0, 50, 1],
    ['Craft Beer', 5.00, 'Drink', 'Locally brewed ale', 0, 30, 1],
    ['Garlic Bread', 4.00, 'Starter', 'Toasted with herb butter', 8, 25, 1],
    ['Tiramisu', 6.50, 'Dessert', 'Classic Italian coffee dessert', 5, 10, 1],
    ['Chicken Wings', 9.99, 'Starter', 'Crispy fried wings with hot sauce', 12, 18, 0],
    ['Grilled Salmon', 18.99, 'Main', 'Atlantic salmon with herb butter and lemon', 20, 10, 0],
    ['Paneer Tikka', 11.50, 'Starter', 'Grilled cottage cheese with spices', 15, 15, 1],
    ['Dal Makhani', 10.00, 'Main', 'Slow-cooked creamy black lentils', 25, 12, 1],
  ];
  menuItems.forEach(([name, price, cat, desc, prep, stock, is_veg]) => {
    const stockValue = Number(stock);
    db.prepare('INSERT INTO menu (name, price, category, description, preparation_time, stock, out_of_stock, is_veg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, price, cat, desc, prep, stockValue, 0, is_veg); // all seeded items start as available
  });
}

defaultUsers.forEach((user) => {
  db.prepare(
    `INSERT INTO users (name, email, password, role)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       password = excluded.password,
       role = excluded.role`
  ).run(user.name, user.email, user.password, user.role);
});

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

  // ── Multer: image upload ──────────────────────────────────────────────────
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `menu-${Date.now()}${ext}`);
    },
  });
  const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

  // Serve uploaded images
  app.use('/uploads', express.static(uploadsDir));

  const generateRandomPassword = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const makeEmailFromName = (name: string, role: string) => {
    const slug = name.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    return `${slug || role}@testy.com`;
  };

  const ensureUniqueEmail = (email: string) => {
    let candidate = email;
    let suffix = 1;
    while (db.prepare('SELECT 1 FROM users WHERE email = ?').get(candidate)) {
      candidate = `${email.replace(/@.*$/, '')}${suffix}@testy.com`;
      suffix += 1;
    }
    return candidate;
  };

  // Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Auth Routes
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const identifier = (email || '').trim();

    // Security Fix: only check email or name, NOT role
    let user = db.prepare('SELECT * FROM users WHERE email = ? OR name = ?').get(identifier, identifier) as any;

    if (!user && identifier.toLowerCase().includes('@testy.com')) {
      const legacyIdentifier = identifier.replace(/@testy\.com$/i, '@restaurant.com');
      user = db.prepare('SELECT * FROM users WHERE email = ? OR name = ?').get(legacyIdentifier, legacyIdentifier) as any;
    }

    if (!user && identifier.toLowerCase().includes('@restaurant.com')) {
      const modernIdentifier = identifier.replace(/@restaurant\.com$/i, '@testy.com');
      user = db.prepare('SELECT * FROM users WHERE email = ? OR name = ?').get(modernIdentifier, modernIdentifier) as any;
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.email.toLowerCase().endsWith('@restaurant.com')) {
      const updatedEmail = user.email.replace(/@restaurant\.com$/i, '@testy.com');
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(updatedEmail, user.id);
      user.email = updatedEmail;
    }

    db.prepare('UPDATE users SET login_count = COALESCE(login_count, 0) + 1, last_login = CURRENT_TIMESTAMP, active = 1 WHERE id = ?').run(user.id);
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        login_count: (user.login_count || 0) + 1,
        last_login: new Date().toISOString(),
        active: 1,
      },
    });
    io.emit('staff-status-updated');
  });

  app.post('/api/auth/logout', authenticate, (req: any, res: any) => {
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.user.id);
    io.emit('staff-status-updated');
    res.json({ success: true });
  });

  // Change password (any authenticated user can change their own password)
  app.put('/api/auth/change-password', authenticate, (req: any, res: any) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
    res.json({ success: true });
  });


  // Menu Routes
  app.get('/api/menu', (req, res) => {
    const menu = db.prepare('SELECT * FROM menu').all();
    res.json(menu);
  });

  app.post('/api/menu', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { name, price, category, sub_category, type, description, preparation_time, stock, is_veg, half_price } = req.body;
    const out_of_stock = Number(stock) <= 0 ? 1 : 0;

    // backwards compatibility for is_veg if type not provided
    const finalType = type || (is_veg === 0 || is_veg === false ? 'non-veg' : 'veg');

    const result = db.prepare('INSERT INTO menu (name, price, category, sub_category, type, description, preparation_time, stock, out_of_stock, is_veg, half_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, price, category, sub_category || '', finalType, description || '',
        Number(preparation_time) || 0, Number(stock) || 0, out_of_stock,
        finalType === 'veg' ? 1 : 0,
        Number(half_price) || 0);
    io.emit('menu-updated');
    res.json({ id: result.lastInsertRowid });
  });

  app.delete('/api/menu/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.prepare('DELETE FROM menu WHERE id = ?').run(req.params.id);
    io.emit('menu-updated');
    res.json({ success: true });
  });

  app.patch('/api/menu/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'kitchen') return res.status(403).json({ error: 'Forbidden' });
    const { stock, out_of_stock, price, half_price } = req.body;

    // If price / half_price update requested (admin only)
    if (price !== undefined || half_price !== undefined) {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const item = db.prepare('SELECT * FROM menu WHERE id = ?').get(req.params.id) as any;
      if (!item) return res.status(404).json({ error: 'Not found' });
      db.prepare('UPDATE menu SET price = ?, half_price = ? WHERE id = ?')
        .run(
          price !== undefined ? Number(price) : item.price,
          half_price !== undefined ? Number(half_price) : item.half_price,
          req.params.id
        );
      io.emit('menu-updated');
      return res.json({ success: true });
    }

    // Stock toggle
    const stockValue = Number(stock ?? 0);
    const outOfStockValue = out_of_stock ? 1 : 0;
    db.prepare('UPDATE menu SET stock = ?, out_of_stock = ? WHERE id = ?')
      .run(stockValue, outOfStockValue, req.params.id);
    io.emit('menu-updated');
    res.json({ success: true });
  });

  // Staff management for admin
  app.get('/api/admin/staff', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const staff = db.prepare(`
      SELECT
        u.id,
        u.name,
        REPLACE(u.email, '@restaurant.com', '@testy.com') AS email,
        u.role,
        u.active,
        COALESCE(u.login_count, 0) as login_count,
        u.last_login,
        COALESCE(SUM(CASE WHEN o.status != 'served' THEN 1 ELSE 0 END), 0) as activeOrders,
        COALESCE(SUM(CASE WHEN o.status = 'served' THEN 1 ELSE 0 END), 0) as completedOrders,
        COALESCE(COUNT(o.id), 0) as totalOrders
      FROM users u
      LEFT JOIN orders o ON o.waiter_id = u.id
      WHERE u.role IN ('waiter', 'kitchen') AND u.left_company = 0
      GROUP BY u.id
    `).all();
    res.json(staff);
  });

  app.post('/api/admin/staff', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const staff = Array.isArray(req.body.staff) ? req.body.staff : [];
    const created: any[] = [];

    const insertStaff = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');

    staff.forEach((entry: any) => {
      const name = String(entry.name || '').trim();
      const role = entry.role === 'kitchen' ? 'kitchen' : 'waiter';
      const rawEmail = entry.email ? String(entry.email).trim() : makeEmailFromName(name, role);
      const email = ensureUniqueEmail(rawEmail);
      const password = entry.password ? String(entry.password).trim() : generateRandomPassword(8);
      const hashedPassword = bcrypt.hashSync(password, 10);

      insertStaff.run(name || `${role} staff`, email, hashedPassword, role);
      created.push({ name: name || `${role} staff`, role, email, password });
    });

    io.emit('staff-status-updated');
    res.json(created);
  });

  app.delete('/api/admin/staff/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.prepare('UPDATE users SET left_company = 1, active = 0 WHERE id = ?').run(req.params.id);
    io.emit('staff-status-updated');
    res.json({ success: true });
  });

  // Tables Routes
  app.get('/api/tables', authenticate, (req: any, res: any) => {
    const tables = db.prepare('SELECT * FROM tables').all();
    res.json(tables);
  });

  // Admin: add a table
  app.post('/api/admin/tables', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { table_number } = req.body;
    if (!table_number) return res.status(400).json({ error: 'table_number required' });
    try {
      const result = db.prepare('INSERT INTO tables (table_number) VALUES (?)').run(table_number.trim());
      io.emit('staff-status-updated');
      res.json({ id: result.lastInsertRowid, table_number: table_number.trim() });
    } catch (e: any) {
      res.status(400).json({ error: 'Table already exists' });
    }
  });

  // Admin: delete a table
  app.delete('/api/admin/tables/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.prepare('DELETE FROM staff_tables WHERE table_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
    io.emit('staff-status-updated');
    res.json({ success: true });
  });

  // Image upload endpoint
  app.post('/api/admin/upload-image', authenticate, upload.single('image'), (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  // Update menu item image (or full update)
  app.put('/api/menu/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { name, price, category, sub_category, type, description, preparation_time, stock, is_veg, half_price, image_url } = req.body;
    const out_of_stock = Number(stock) <= 0 ? 1 : 0;
    const finalType = type || (is_veg === 0 || is_veg === false ? 'non-veg' : 'veg');
    db.prepare(`UPDATE menu SET name=?, price=?, category=?, sub_category=?, type=?, description=?, preparation_time=?, stock=?, out_of_stock=?, is_veg=?, half_price=?, image_url=? WHERE id=?`)
      .run(name, Number(price), category, sub_category || '', finalType, description || '',
        Number(preparation_time) || 0, Number(stock) || 0, out_of_stock,
        finalType === 'veg' ? 1 : 0, Number(half_price) || 0, image_url || null, req.params.id);
    io.emit('menu-updated');
    res.json({ success: true });
  });

  app.get('/api/waiter/my-tables', authenticate, (req: any, res: any) => {
    try {
      const waiterId = Number(req.user.id);
      const tables = db.prepare(`
        SELECT t.* 
        FROM tables t
        JOIN staff_tables st ON t.id = st.table_id
        WHERE CAST(st.waiter_id AS INTEGER) = CAST(? AS INTEGER)
      `).all(waiterId);
      res.json(tables || []);
    } catch (e: any) {
      console.error('[ERROR] /api/waiter/my-tables:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Staff Table Assignments
  app.get('/api/admin/staff-tables', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const assignments = db.prepare(`
      SELECT st.*, t.table_number, u.name as waiter_name
      FROM staff_tables st
      JOIN tables t ON st.table_id = t.id
      JOIN users u ON st.waiter_id = u.id
    `).all();
    res.json(assignments);
  });

  app.post('/api/admin/staff-tables/assign', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const waiterIdStr = req.body.waiter_id;
    const tableIds: any[] = Array.isArray(req.body.table_ids) ? req.body.table_ids : [];

    if (!waiterIdStr) return res.status(400).json({ error: 'waiter_id is required' });

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM staff_tables WHERE waiter_id = ?').run(Number(waiterIdStr));
      const insert = db.prepare('INSERT INTO staff_tables (waiter_id, table_id) VALUES (?, ?)');
      tableIds.forEach((tid: any) => insert.run(Number(waiterIdStr), Number(tid)));
    });

    transaction();
    io.emit('staff-status-updated');
    res.json({ success: true, assigned: tableIds.length });
  });

  // Orders Routes
  app.get('/api/orders', authenticate, (req: any, res: any) => {
    let query = `
      SELECT o.*, t.table_number, u.name as waiter_name 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      JOIN users u ON o.waiter_id = u.id
    `;

    let params: any[] = [];
    if (req.user.role === 'admin') {
      // Admin sees ALL orders except cancelled normally? No, admin sees all, maybe filter later if needed.
    } else if (req.user.role === 'waiter') {
      if (req.query.history === 'true') {
        query += ` WHERE o.waiter_id = ? AND o.status IN ('paid')`;
        params.push(req.user.id);
      } else {
        // Keep served + billing visible so waiter can request billing & see progress
        query += ` WHERE o.waiter_id = ? AND o.status NOT IN ('paid', 'cancelled')`;
        params.push(req.user.id);
      }
    } else if (req.user.role === 'kitchen') {
      if (req.query.history === 'true') {
        query += ` WHERE o.status IN ('served', 'billing', 'paid', 'cancelled')`;
      } else {
        query += ` WHERE o.status NOT IN ('pending', 'served', 'billing', 'paid', 'cancelled')`;
      }
    }

    query += ` ORDER BY o.created_at DESC`;

    const orders = db.prepare(query).all(...params) as any[];

    const ordersWithItems = orders.map(order => {
      const items = db.prepare(`
        SELECT oi.*, m.name as item_name, m.price, m.is_veg, m.half_price 
        FROM order_items oi 
        JOIN menu m ON oi.menu_id = m.id 
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });

    res.json(ordersWithItems);
  });

  app.post('/api/orders', authenticate, (req: any, res: any) => {
    try {
      const { table_id, items, customer_phone, customer_name, payment_method, notes } = req.body;

      const transaction = db.transaction(() => {
        // Calculate total_price on server to prevent tampering
        let calculatedTotal = 0;
        const menuItems = db.prepare('SELECT id, price, half_price FROM menu').all() as any[];
        const menuMap = new Map(menuItems.map(m => [m.id, m]));

        items.forEach((item: any) => {
          const menuItem = menuMap.get(item.menu_id);
          if (menuItem) {
            const price = item.portion === 'half' ? (menuItem.half_price || menuItem.price / 2) : menuItem.price;
            calculatedTotal += price * item.quantity;
          }
        });

        // Handle CRM customer linkage
        let customerId: number | null = null;
        if (customer_phone) {
          let cust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(customer_phone) as any;
          if (!cust) {
            const r = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(customer_name || 'Guest', customer_phone);
            customerId = r.lastInsertRowid as number;
          } else {
            customerId = cust.id;
          }
        }

        const insertOrder = db.prepare('INSERT INTO orders (table_id, waiter_id, total_price, customer_id, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?)');
        const orderResult = insertOrder.run(table_id, req.user.id, calculatedTotal, customerId, payment_method || 'cash', notes || '');
        const orderId = orderResult.lastInsertRowid;

        const insertItem = db.prepare("INSERT INTO order_items (order_id, menu_id, quantity, portion, notes) VALUES (?, ?, ?, ?, ?)");
        const updateStock = db.prepare("UPDATE menu SET stock = MAX(0, stock - ?), out_of_stock = CASE WHEN MAX(0, stock - ?) <= 0 THEN 1 ELSE out_of_stock END WHERE id = ?");

        items.forEach((item: any) => {
          insertItem.run(orderId, item.menu_id, item.quantity, item.portion || 'full', item.notes || '');
          updateStock.run(item.quantity, item.quantity, item.menu_id);
        });

        // Award loyalty points to customer
        if (customerId) {
          const pts = Math.floor(calculatedTotal / 10);
          db.prepare('UPDATE customers SET visits = visits + 1, total_spent = total_spent + ?, points = points + ? WHERE id = ?')
            .run(calculatedTotal, pts, customerId);
        }
        return orderId;
      });

      const orderId = transaction();
      // Fetch full order for socket broadcast
      const fullOrder = db.prepare(`
        SELECT o.*, t.table_number, u.name as waiter_name 
        FROM orders o 
        JOIN tables t ON o.table_id = t.id 
        JOIN users u ON o.waiter_id = u.id
        WHERE o.id = ?
      `).get(orderId) as any;

      if (fullOrder) {
        fullOrder.items = db.prepare(`
          SELECT oi.*, m.name as item_name, m.price, m.is_veg, m.half_price 
          FROM order_items oi 
          JOIN menu m ON oi.menu_id = m.id 
          WHERE oi.order_id = ?
        `).all(orderId);

        io.emit('new-order', fullOrder);
      }
      io.emit('stats-update');
      res.json(fullOrder || { id: orderId, status: 'new' });
    } catch (error: any) {
      console.error('[API] Error placing order:', error);
      require('fs').writeFileSync(require('path').join(process.cwd(), 'order-error.log'), error.stack || error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/orders/:id/status', authenticate, (req: any, res: any) => {
    const { status } = req.body;
    console.log(`[API] Updating order ${req.params.id} to status: ${status}. User: ${req.user.role}`);
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);

    io.emit('order-status-updated', { id: parseInt(req.params.id), status });
    io.emit('stats-update');
    res.json({ success: true });
  });

  // Add more items to an existing order (running order)
  app.post('/api/orders/:id/add-items', authenticate, (req: any, res: any) => {
    try {
      const { items, notes } = req.body;
      const orderId = parseInt(req.params.id);
      if (!items?.length) return res.status(400).json({ error: 'items required' });

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const menuItems = db.prepare('SELECT id, price, half_price FROM menu').all() as any[];
      const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

      let addedTotal = 0;
      const insertItem = db.prepare("INSERT INTO order_items (order_id, menu_id, quantity, portion, notes) VALUES (?, ?, ?, ?, ?)");
      const updateStock = db.prepare("UPDATE menu SET stock = MAX(0, stock - ?), out_of_stock = CASE WHEN MAX(0, stock - ?) <= 0 THEN 1 ELSE out_of_stock END WHERE id = ?");

      items.forEach((item: any) => {
        const mi = menuMap.get(item.menu_id);
        if (mi) {
          const price = item.portion === 'half' ? (mi.half_price || mi.price / 2) : mi.price;
          addedTotal += price * item.quantity;
        }
        insertItem.run(orderId, item.menu_id, item.quantity, item.portion || 'full', item.notes || '');
        updateStock.run(item.quantity, item.quantity, item.menu_id);
      });

      // Also update order notes if provided
      if (notes) db.prepare('UPDATE orders SET notes = ? WHERE id = ?').run(notes, orderId);

      // Update total price
      db.prepare('UPDATE orders SET total_price = total_price + ? WHERE id = ?').run(addedTotal, orderId);

      // ── KEY FIX: If the order was already served/billing/ready/paid,
      // reset it to 'new' so kitchen gets notified about the extra items.
      const kitchenStatuses = ['served', 'billing', 'ready', 'paid'];
      let newStatus = order.status;
      if (kitchenStatuses.includes(order.status)) {
        newStatus = 'new';
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('new', orderId);
        console.log(`[ADD-ITEMS] Order #${orderId} reset from '${order.status}' → 'new' for kitchen.`);
      }

      // Fetch the updated full order to broadcast to kitchen
      const updatedOrder = db.prepare(`
        SELECT o.*, t.table_number, u.name as waiter_name
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        JOIN users u ON o.waiter_id = u.id
        WHERE o.id = ?
      `).get(orderId) as any;

      if (updatedOrder) {
        updatedOrder.items = db.prepare(`
          SELECT oi.*, m.name as item_name, m.price, m.is_veg, m.half_price
          FROM order_items oi JOIN menu m ON oi.menu_id = m.id
          WHERE oi.order_id = ?
        `).all(orderId);

        // If status was reset → fire new-order so kitchen panel shows it
        if (newStatus === 'new') {
          io.emit('new-order', updatedOrder);
        }
      }

      io.emit('order-status-updated', { id: orderId, status: newStatus });
      io.emit('stats-update');
      res.json({ success: true, added: items.length, extra: addedTotal, newStatus });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // Update order notes
  app.patch('/api/orders/:id/notes', authenticate, (req: any, res: any) => {
    const { notes } = req.body;
    db.prepare('UPDATE orders SET notes = ? WHERE id = ?').run(notes || '', req.params.id);
    io.emit('order-status-updated', { id: parseInt(req.params.id) });
    res.json({ success: true });
  });

  // ── Delete a single item from an order (admin) ──────────────────────────
  app.delete('/api/admin/order-items/:itemId', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const itemId = parseInt(req.params.itemId);
      // Get item details before deleting (to recalculate total)
      const item = db.prepare(`
        SELECT oi.*, m.price, m.half_price FROM order_items oi
        JOIN menu m ON oi.menu_id = m.id WHERE oi.id = ?
      `).get(itemId) as any;
      if (!item) return res.status(404).json({ error: 'Item not found' });

      const price = item.portion === 'half' ? (item.half_price || item.price / 2) : item.price;
      const itemTotal = price * item.quantity;

      // Delete item and reduce order total
      db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
      db.prepare('UPDATE orders SET total_price = MAX(0, total_price - ?) WHERE id = ?').run(itemTotal, item.order_id);

      io.emit('order-status-updated', { id: item.order_id });
      io.emit('stats-update');
      res.json({ success: true, removed: itemTotal });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Apply discount to a table's orders (admin) ─────────────────────────
  app.put('/api/admin/orders/discount', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { order_ids, discount_type, discount_value } = req.body;
      // discount_type: 'flat' | 'percent'
      // discount_value: number
      if (!order_ids?.length || !discount_value) return res.status(400).json({ error: 'Missing params' });

      for (const oid of order_ids) {
        const order = db.prepare('SELECT total_price FROM orders WHERE id = ?').get(oid) as any;
        if (!order) continue;
        let disc = 0;
        if (discount_type === 'percent') disc = (order.total_price * discount_value) / 100;
        else disc = discount_value;
        const newTotal = Math.max(0, order.total_price - disc / order_ids.length);
        db.prepare('UPDATE orders SET total_price = ? WHERE id = ?').run(newTotal, oid);
      }
      io.emit('stats-update');
      io.emit('order-status-updated', {});
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Reset all orders for new month (admin only)
  app.post('/api/admin/reset-orders', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const orderCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any).count;
      db.prepare('DELETE FROM order_items').run();
      db.prepare('DELETE FROM orders').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='orders'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='order_items'").run();
      io.emit('stats-update');
      io.emit('new-order');
      res.json({ success: true, deleted: orderCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── PUBLIC QR ORDERING ROUTES (no auth required) ────────────────────────
  app.get('/api/public/menu', (req, res) => {
    const menu = db.prepare('SELECT * FROM menu WHERE out_of_stock = 0').all();
    res.json(menu);
  });

  app.get('/api/public/table/:number', (req, res: any) => {
    const table = db.prepare('SELECT * FROM tables WHERE table_number = ?').get(req.params.number);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json(table);
  });

  app.post('/api/public/orders', (req: any, res: any) => {
    try {
      const { table_id, items, customer_name, customer_phone } = req.body;
      if (!table_id || !items?.length) return res.status(400).json({ error: 'table_id and items required' });

      // Assign to the waiter responsible for the table, fallback to admin
      let targetWaiterId = 1;
      const assigned = db.prepare("SELECT waiter_id FROM staff_tables WHERE table_id = ?").get(table_id) as any;
      if (assigned) {
        targetWaiterId = assigned.waiter_id;
      } else {
        const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as any;
        if (adminUser) targetWaiterId = adminUser.id;
      }

      // Handle customer CRM
      let customerId: number | null = null;
      if (customer_phone) {
        let cust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(customer_phone) as any;
        if (!cust) {
          const r = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(customer_name || 'Guest', customer_phone);
          customerId = r.lastInsertRowid as number;
        } else {
          customerId = cust.id;
        }
      }

      const transaction = db.transaction(() => {
        let calculatedTotal = 0;
        const menuItems = db.prepare('SELECT id, price, half_price FROM menu').all() as any[];
        const menuMap = new Map(menuItems.map(m => [m.id, m]));
        items.forEach((item: any) => {
          const menuItem = menuMap.get(item.menu_id);
          if (menuItem) {
            const price = item.portion === 'half' ? (menuItem.half_price || menuItem.price / 2) : menuItem.price;
            calculatedTotal += price * item.quantity;
          }
        });

        const orderResult = db.prepare(
          'INSERT INTO orders (table_id, waiter_id, total_price, customer_id, payment_method, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(table_id, targetWaiterId, calculatedTotal, customerId, 'self-order', 'pending');
        const orderId = orderResult.lastInsertRowid;

        const insertItem = db.prepare("INSERT INTO order_items (order_id, menu_id, quantity, portion) VALUES (?, ?, ?, ?)");
        items.forEach((item: any) => insertItem.run(orderId, item.menu_id, item.quantity, item.portion || 'full'));

        // Award loyalty points: 1 per 10 spent
        if (customerId) {
          const pts = Math.floor(calculatedTotal / 10);
          db.prepare('UPDATE customers SET visits = visits + 1, total_spent = total_spent + ?, points = points + ? WHERE id = ?')
            .run(calculatedTotal, pts, customerId);
        }
        return { orderId, total: calculatedTotal };
      });

      const result = transaction() as any;
      const fullOrder = db.prepare(
        `SELECT o.*, t.table_number, u.name as waiter_name FROM orders o
         JOIN tables t ON o.table_id = t.id JOIN users u ON o.waiter_id = u.id WHERE o.id = ?`
      ).get(result.orderId) as any;
      if (fullOrder) {
        fullOrder.items = db.prepare(
          `SELECT oi.*, m.name as item_name, m.price FROM order_items oi JOIN menu m ON oi.menu_id = m.id WHERE oi.order_id = ?`
        ).all(result.orderId);
        io.emit('new-order', { ...fullOrder, self_order: true });
      }
      io.emit('stats-update');
      res.json({ order_id: result.orderId, total: result.total, status: 'new' });
    } catch (e: any) {
      console.error('[Public Order Error]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── CUSTOMER CRM ROUTES ────────────────────────────────────────────────────
  app.get('/api/customers', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const customers = db.prepare('SELECT * FROM customers ORDER BY total_spent DESC').all();
    res.json(customers);
  });

  app.post('/api/customers/lookup', authenticate, (req: any, res: any) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
    res.json(customer || null);
  });

  app.post('/api/customers', authenticate, (req: any, res: any) => {
    const { name, phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    try {
      const result = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(name || 'Guest', phone);
      res.json({ id: result.lastInsertRowid, name: name || 'Guest', phone, points: 0, visits: 0, total_spent: 0 });
    } catch (e: any) {
      // Duplicate phone — return existing
      const existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
      res.json(existing);
    }
  });

  app.patch('/api/customers/:id/points', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { points } = req.body;
    db.prepare('UPDATE customers SET points = ? WHERE id = ?').run(Number(points), req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/customers/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ─── ADVANCED ANALYTICS ROUTE ───────────────────────────────────────────────
  app.get('/api/admin/analytics', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const topItems = db.prepare(`
      SELECT m.name, SUM(oi.quantity) as quantity_sold, SUM(m.price * oi.quantity) as revenue
      FROM order_items oi JOIN menu m ON oi.menu_id = m.id
      JOIN orders o ON oi.order_id = o.id
      GROUP BY m.id ORDER BY quantity_sold DESC LIMIT 8
    `).all();

    const revenueByDay = db.prepare(`
      SELECT DATE(created_at) as date, SUM(total_price) as revenue, COUNT(*) as orders
      FROM orders
      WHERE created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at) ORDER BY date ASC
    `).all();

    const peakHours = db.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as order_count
      FROM orders
      GROUP BY hour ORDER BY hour ASC
    `).all();

    const categoryBreakdown = db.prepare(`
      SELECT m.category, SUM(m.price * oi.quantity) as revenue, SUM(oi.quantity) as qty
      FROM order_items oi JOIN menu m ON oi.menu_id = m.id
      GROUP BY m.category ORDER BY revenue DESC
    `).all();

    const totalCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as any).c;
    const repeatCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers WHERE visits > 1').get() as any).c;
    const totalRevenue = (db.prepare('SELECT SUM(total_price) as t FROM orders').get() as any).t || 0;
    const totalOrders = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c;

    res.json({ topItems, revenueByDay, peakHours, categoryBreakdown, totalCustomers, repeatCustomers, totalRevenue, totalOrders });
  });

  // Export all orders data for excel/pdf (admin only)
  app.get('/api/admin/export-data', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const orders = db.prepare(`
      SELECT o.id, t.table_number, u.name as waiter_name,
             o.status, o.total_price, o.created_at
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      JOIN users u ON o.waiter_id = u.id
      ORDER BY o.created_at DESC
    `).all() as any[];
    const result = orders.map(order => {
      const items = db.prepare(`
        SELECT oi.quantity, oi.portion, m.name as item_name, m.price, m.half_price
        FROM order_items oi JOIN menu m ON oi.menu_id = m.id
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });
    res.json(result);
  });

  // Admin Stats
  app.get('/api/admin/stats', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get() as any;
    const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status NOT IN ('served', 'paid')").get() as any;
    const completedOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('served', 'paid')").get() as any;
    const revenue = db.prepare('SELECT SUM(total_price) as total FROM orders').get() as any;
    const activeStaff = db.prepare("SELECT COUNT(*) as count FROM users WHERE role IN ('waiter', 'kitchen') AND active = 1 AND left_company = 0").get() as any;
    const totalStaff = db.prepare("SELECT COUNT(*) as count FROM users WHERE role IN ('waiter', 'kitchen') AND left_company = 0").get() as any;

    res.json({
      totalOrders: totalOrders.count,
      activeOrders: activeOrders.count,
      completedOrders: completedOrders.count,
      revenue: revenue.total || 0,
      activeStaff: activeStaff.count,
      totalStaff: totalStaff.count,
    });
  });

  // Socket.IO
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('join-room', (role) => {
      socket.join(role);
      console.log(`Socket ${socket.id} joined room: ${role}`);
    });
    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.DIST_PATH || path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
