require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'campusfind');
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campusfind_db',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

let dbPool = null;
let databaseReady = false;

async function connectDatabase() {
  try {
    dbPool = mysql.createPool(DB_CONFIG);
    const [rows] = await dbPool.query('SELECT 1 AS ok');
    databaseReady = true;
    console.log('MySQL connected successfully.');
    return true;
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    databaseReady = false;
    return false;
  }
}

function saveDataUrlToUpload(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl || '';
  }

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/i);
  if (!match) return dataUrl;

  const format = match[1].toLowerCase() === 'jpg' ? 'jpg' : match[1].toLowerCase();
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`;
  const filePath = path.join(uploadsDir, filename);

  fs.writeFileSync(filePath, buffer);
  return `uploads/${filename}`;
}

function normalizeStoredImage(value) {
  if (!value || typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:image/')) {
    return saveDataUrlToUpload(trimmed);
  }

  if (trimmed.startsWith('/uploads/')) {
    return trimmed.replace(/^\/+/, '');
  }

  return trimmed;
}

function safeResolveFile(urlPath) {
  if (urlPath.startsWith('/uploads/')) {
    const relative = urlPath.slice('/uploads/'.length);
    const resolved = path.normalize(path.join(uploadsDir, relative));
    if (!resolved.startsWith(uploadsDir)) return null;
    return resolved;
  }

  const cleanPath = urlPath === '/' ? '/index.html' : urlPath;
  const resolved = path.normalize(path.join(publicDir, cleanPath));

  if (!resolved.startsWith(publicDir)) {
    return null;
  }

  return resolved;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

async function getItemRows() {
  if (!dbPool) {
    return [];
  }

  const query = `
    SELECT
      i.item_id AS id,
      i.report_type AS type,
      i.item_name AS name,
      c.category_name AS category,
      i.color,
      i.location,
      i.date_reported AS date,
      i.description,
      u.full_name AS reporterName,
      u.contact_info AS contact,
      s.status_name AS status,
      CASE
        WHEN i.image_path IS NOT NULL AND i.image_path <> '' THEN CONCAT('/', i.image_path)
        ELSE ''
      END AS image,
      i.created_at AS createdAt
    FROM items i
    JOIN categories c ON i.category_id = c.category_id
    JOIN users u ON i.reporter_id = u.user_id
    JOIN statuses s ON i.status_id = s.status_id
    ORDER BY i.created_at DESC
  `;

  const [rows] = await dbPool.query(query);
  return rows;
}

async function lookupOrCreateCategory(name) {
  const safeName = (name || 'Personal Items').trim();
  const [rows] = await dbPool.query(
    'SELECT category_id FROM categories WHERE category_name = ? LIMIT 1',
    [safeName]
  );

  if (rows.length) {
    return rows[0].category_id;
  }

  const [result] = await dbPool.query(
    'INSERT INTO categories (category_name) VALUES (?)',
    [safeName]
  );

  return result.insertId;
}

async function lookupOrCreateStatus(name) {
  const safeName = (name || 'Searching').trim();
  const [rows] = await dbPool.query(
    'SELECT status_id FROM statuses WHERE status_name = ? LIMIT 1',
    [safeName]
  );

  if (rows.length) {
    return rows[0].status_id;
  }

  const [result] = await dbPool.query(
    'INSERT INTO statuses (status_name) VALUES (?)',
    [safeName]
  );

  return result.insertId;
}

async function lookupOrCreateUser(fullName, contact) {
  const safeName = (fullName || 'Unknown User').trim();
  const safeContact = (contact || 'No contact provided').trim();

  const [rows] = await dbPool.query(
    'SELECT user_id FROM users WHERE full_name = ? AND contact_info = ? LIMIT 1',
    [safeName, safeContact]
  );

  if (rows.length) {
    return rows[0].user_id;
  }

  const [result] = await dbPool.query(
    'INSERT INTO users (full_name, contact_info) VALUES (?, ?)',
    [safeName, safeContact]
  );

  return result.insertId;
}

async function createItemFromPayload(payload) {
  const type = payload.type || 'Lost';
  const name = payload.name || payload.item_name || 'Untitled item';
  const category = payload.category || 'Personal Items';
  const color = payload.color || '';
  const location = payload.location || '';
  const date = payload.date || payload.date_reported || new Date().toISOString().slice(0, 10);
  const description = payload.description || '';
  const reporterName = payload.reporterName || payload.full_name || 'Unknown User';
  const contact = payload.contact || payload.contact_info || 'No contact provided';
  const status = payload.status || 'Searching';
  const image = normalizeStoredImage(payload.image || payload.image_path || '');

  const categoryId = await lookupOrCreateCategory(category);
  const statusId = await lookupOrCreateStatus(status);
  const userId = await lookupOrCreateUser(reporterName, contact);

  const [result] = await dbPool.query(
    `INSERT INTO items
      (report_type, item_name, category_id, color, location, date_reported, description, reporter_id, status_id, image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, name, categoryId, color, location, date, description, userId, statusId, image]
  );

  return result.insertId;
}

async function updateItemById(id, payload) {
  const type = payload.type || 'Lost';
  const name = payload.name || payload.item_name || 'Untitled item';
  const category = payload.category || 'Personal Items';
  const color = payload.color || '';
  const location = payload.location || '';
  const date = payload.date || payload.date_reported || new Date().toISOString().slice(0, 10);
  const description = payload.description || '';
  const reporterName = payload.reporterName || payload.full_name || 'Unknown User';
  const contact = payload.contact || payload.contact_info || 'No contact provided';
  const status = payload.status || 'Searching';
  const image = normalizeStoredImage(payload.image || payload.image_path || '');

  const categoryId = await lookupOrCreateCategory(category);
  const statusId = await lookupOrCreateStatus(status);
  const userId = await lookupOrCreateUser(reporterName, contact);

  await dbPool.query(
    `UPDATE items
     SET report_type = ?, item_name = ?, category_id = ?, color = ?, location = ?, date_reported = ?,
         description = ?, reporter_id = ?, status_id = ?, image_path = ?
     WHERE item_id = ?`,
    [type, name, categoryId, color, location, date, description, userId, statusId, image, id]
  );

  return true;
}

async function handleApiRequest(req, res, url) {
  if (!url.pathname.startsWith('/api/')) {
    return false;
  }

  try {
    if (url.pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        database: databaseReady ? 'connected' : 'disconnected'
      });
      return true;
    }

    if (url.pathname === '/api/items' && req.method === 'GET') {
      const rows = await getItemRows();
      sendJson(res, 200, rows);
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/items') {
      if (!databaseReady) {
        sendJson(res, 503, { message: 'Database is not connected.' });
        return true;
      }

      const payload = await parseJsonBody(req);
      const itemId = await createItemFromPayload(payload);
      sendJson(res, 201, { message: 'Item created', itemId });
      return true;
    }

    const itemMatch = url.pathname.match(/^\/api\/items\/(\d+)$/);
    if (itemMatch) {
      const itemId = Number(itemMatch[1]);

      if (req.method === 'GET') {
        if (!dbPool) {
          sendJson(res, 503, { message: 'Database is not connected.' });
          return true;
        }

        const [rows] = await dbPool.query(
          `SELECT i.item_id AS id, i.report_type AS type, i.item_name AS name, c.category_name AS category,
                  i.color, i.location, i.date_reported AS date, i.description,
                  u.full_name AS reporterName, u.contact_info AS contact, s.status_name AS status,
                  CASE
                    WHEN i.image_path IS NOT NULL AND i.image_path <> '' THEN CONCAT('/', i.image_path)
                    ELSE ''
                  END AS image, i.created_at AS createdAt
           FROM items i
           JOIN categories c ON i.category_id = c.category_id
           JOIN users u ON i.reporter_id = u.user_id
           JOIN statuses s ON i.status_id = s.status_id
           WHERE i.item_id = ? LIMIT 1`,
          [itemId]
        );

        if (!rows.length) {
          sendJson(res, 404, { message: 'Item not found' });
          return true;
        }

        sendJson(res, 200, rows[0]);
        return true;
      }

      if (req.method === 'PUT') {
        const payload = await parseJsonBody(req);
        await updateItemById(itemId, payload);
        sendJson(res, 200, { message: 'Item updated', itemId });
        return true;
      }

      if (req.method === 'DELETE') {
        if (!dbPool) {
          sendJson(res, 503, { message: 'Database is not connected.' });
          return true;
        }

        await dbPool.query('DELETE FROM items WHERE item_id = ?', [itemId]);
        sendJson(res, 200, { message: 'Item deleted', itemId });
        return true;
      }
    }

    sendJson(res, 404, { message: 'API route not found' });
    return true;
  } catch (error) {
    console.error('API request error:', error.message);
    sendJson(res, 500, { message: 'Server error', error: error.message });
    return true;
  }
}

function serveStaticFile(req, res, requestUrl) {
  const filePath = safeResolveFile(requestUrl);

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return true;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server error');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    const handled = await handleApiRequest(req, res, url);
    if (handled) return;
  }

  if (pathname.startsWith('/uploads/')) {
    serveStaticFile(req, res, pathname);
    return;
  }

  serveStaticFile(req, res, pathname);
});

async function startServer() {
  const connected = await connectDatabase();

  server.listen(PORT, () => {
    console.log(`CampusFind server running at http://localhost:${PORT}`);
    console.log(`Database status: ${connected ? 'connected' : 'not connected'}`);
  });
}

startServer();
