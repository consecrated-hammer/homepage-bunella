import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import multer from 'multer';
import fs from 'fs';
import fsp from 'fs/promises';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import sharp, { type Gravity } from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const IMAGES_DIR = process.env.IMAGES_DIR || path.join(__dirname, '../images');
const VARIANTS_DIR = process.env.VARIANTS_DIR || path.join(__dirname, '../variants');
const FRONTEND_DIR = path.join(__dirname, '../frontend/dist');
const LOG_FILE = path.join(DATA_DIR, 'access.log');
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
const COLOR_OPTIONS = ['teal', 'blue', 'purple', 'pink', 'green', 'orange', 'red'] as const;
const IMAGE_FIT_OPTIONS = ['cover', 'contain', 'fill', 'scale-down'] as const;
const RENDER_POSITIONS = ['center', 'east', 'west', 'north', 'south', 'northwest'] as const;
const TIMER_UNITS = ['seconds', 'minutes'] as const;
const ADVANCE_MODES = ['random', 'sequential', 'shuffle'] as const;
const DEFAULT_SETTINGS = {
  display_mode: 'rotation',
  single_image_id: null,
  admin_password_hash: '',
  color_scheme: 'teal',
  page_title: 'Home',
  image_fit: 'cover',
  render_enabled: false,
  render_width: 1872,
  render_height: 922,
  render_position: 'northwest',
  slideshow_enabled: false,
  slideshow_interval_value: 30,
  slideshow_interval_unit: 'seconds',
  slideshow_advance_mode: 'random',
} as const;

type ColorOption = (typeof COLOR_OPTIONS)[number];
type ImageFitOption = (typeof IMAGE_FIT_OPTIONS)[number];
type RenderPosition = (typeof RENDER_POSITIONS)[number];
type TimerUnit = (typeof TIMER_UNITS)[number];
type AdvanceMode = (typeof ADVANCE_MODES)[number];
type DisplayMode = 'single' | 'rotation';

type ImageRecord = {
  id: number;
  filename: string;
  original_name: string;
  upload_date: number;
  in_rotation: number;
  width: number | null;
  height: number | null;
  file_size: number | null;
  content_hash: string | null;
  rotation_order: number | null;
  favourite: number;
};

type PublicSettings = {
  display_mode: DisplayMode;
  single_image_id: number | null;
  color_scheme: ColorOption;
  page_title: string;
  image_fit: ImageFitOption;
  render_enabled: boolean;
  render_width: number | null;
  render_height: number | null;
  render_position: RenderPosition;
  slideshow_enabled: boolean;
  slideshow_interval_value: number;
  slideshow_interval_unit: TimerUnit;
  slideshow_advance_mode: AdvanceMode;
};

type StatsSummary = {
  image_count: number;
  variant_count: number;
  total_original_size: number;
  total_variant_size: number;
};

[DATA_DIR, IMAGES_DIR, VARIANTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const db = new Database(path.join(DATA_DIR, 'database.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    upload_date INTEGER NOT NULL,
    in_rotation INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const ensureColumn = (table: string, name: string, definition: string) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
};

ensureColumn('images', 'width', 'INTEGER');
ensureColumn('images', 'height', 'INTEGER');
ensureColumn('images', 'file_size', 'INTEGER');
ensureColumn('images', 'content_hash', 'TEXT');
ensureColumn('images', 'rotation_order', 'INTEGER');
ensureColumn('images', 'favourite', 'INTEGER DEFAULT 0');

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_images_rotation_order ON images(rotation_order);
  CREATE INDEX IF NOT EXISTS idx_images_content_hash ON images(content_hash);
`);

const setSetting = (key: string, value: unknown) => {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
};

const getSetting = <T>(key: string, fallback: T): T => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) {
    return fallback;
  }
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
};

const readSettings = (): PublicSettings => ({
  display_mode: getSetting<DisplayMode>('display_mode', DEFAULT_SETTINGS.display_mode),
  single_image_id: getSetting<number | null>('single_image_id', DEFAULT_SETTINGS.single_image_id),
  color_scheme: getSetting<ColorOption>('color_scheme', DEFAULT_SETTINGS.color_scheme),
  page_title: getSetting<string>('page_title', DEFAULT_SETTINGS.page_title),
  image_fit: getSetting<ImageFitOption>('image_fit', DEFAULT_SETTINGS.image_fit),
  render_enabled: getSetting<boolean>('render_enabled', DEFAULT_SETTINGS.render_enabled),
  render_width: getSetting<number | null>('render_width', DEFAULT_SETTINGS.render_width),
  render_height: getSetting<number | null>('render_height', DEFAULT_SETTINGS.render_height),
  render_position: getSetting<RenderPosition>('render_position', DEFAULT_SETTINGS.render_position),
  slideshow_enabled: getSetting<boolean>('slideshow_enabled', DEFAULT_SETTINGS.slideshow_enabled),
  slideshow_interval_value: getSetting<number>('slideshow_interval_value', DEFAULT_SETTINGS.slideshow_interval_value),
  slideshow_interval_unit: getSetting<TimerUnit>('slideshow_interval_unit', DEFAULT_SETTINGS.slideshow_interval_unit),
  slideshow_advance_mode: getSetting<AdvanceMode>('slideshow_advance_mode', DEFAULT_SETTINGS.slideshow_advance_mode),
});

const initializeSettings = async () => {
  const existingPasswordHash = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password_hash') as { value: string } | undefined;
  if (!existingPasswordHash) {
    const bootstrapPassword = process.env.HOMEPAGE_BUNELLA_BOOTSTRAP_PASSWORD;
    if (!bootstrapPassword || bootstrapPassword.length < 16) {
      throw new Error('HOMEPAGE_BUNELLA_BOOTSTRAP_PASSWORD must be set to initialise admin access');
    }
    setSetting('admin_password_hash', await bcrypt.hash(bootstrapPassword, 12));
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!existing) {
      setSetting(key, value);
    }
  }
};

const logMessage = (message: string) => {
  console.log(message.trim());
  try {
    fs.appendFileSync(LOG_FILE, `${message.endsWith('\n') ? message : `${message}\n`}`);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
};

const nowTimestamp = () => new Date().toLocaleString('en-AU', {
  timeZone: 'Australia/Adelaide',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const fileExists = async (targetPath: string) => {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const safeUnlink = async (targetPath: string) => {
  if (await fileExists(targetPath)) {
    await fsp.unlink(targetPath);
  }
};

const formatBytes = (input: number | null) => input ?? 0;

const getImagePath = (filename: string) => path.join(IMAGES_DIR, filename);
const getVariantDirectoryForImage = (imageId: number) => path.join(VARIANTS_DIR, String(imageId));

const getNextRotationOrder = () => {
  const row = db.prepare('SELECT COALESCE(MAX(rotation_order), 0) AS maxOrder FROM images').get() as { maxOrder: number };
  return Number(row.maxOrder || 0) + 1;
};

const getImageById = (id: number) => db.prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRecord | undefined;
const getImages = () => db.prepare('SELECT * FROM images ORDER BY upload_date DESC').all() as ImageRecord[];
const getRotationImages = () => db.prepare('SELECT * FROM images WHERE in_rotation = 1 ORDER BY COALESCE(rotation_order, 2147483647) ASC, upload_date DESC').all() as ImageRecord[];

const calculateFileHash = async (targetPath: string) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(targetPath);
  return new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

const hydrateImageMetadata = async (image: ImageRecord) => {
  const imagePath = getImagePath(image.filename);
  if (!(await fileExists(imagePath))) {
    return;
  }

  const stat = await fsp.stat(imagePath);
  const metadata = await sharp(imagePath).metadata();
  const contentHash = image.content_hash || await calculateFileHash(imagePath);
  const rotationOrder = image.rotation_order ?? image.id;

  db.prepare(`
    UPDATE images
    SET width = ?, height = ?, file_size = ?, content_hash = ?, rotation_order = ?, favourite = COALESCE(favourite, 0)
    WHERE id = ?
  `).run(
    metadata.width ?? null,
    metadata.height ?? null,
    stat.size,
    contentHash,
    rotationOrder,
    image.id,
  );
};

const backfillExistingImages = async () => {
  const images = getImages();
  for (const image of images) {
    if (
      image.width == null ||
      image.height == null ||
      image.file_size == null ||
      image.content_hash == null ||
      image.rotation_order == null
    ) {
      await hydrateImageMetadata(image);
    }
  }
};

const clearVariantsForImage = async (imageId: number) => {
  const variantDir = getVariantDirectoryForImage(imageId);
  if (await fileExists(variantDir)) {
    await fsp.rm(variantDir, { recursive: true, force: true });
  }
};

const clearAllVariants = async () => {
  if (await fileExists(VARIANTS_DIR)) {
    await fsp.rm(VARIANTS_DIR, { recursive: true, force: true });
  }
  await fsp.mkdir(VARIANTS_DIR, { recursive: true });
};

const getDirectoryStats = async (targetDir: string) => {
  if (!(await fileExists(targetDir))) {
    return { count: 0, totalSize: 0 };
  }

  let count = 0;
  let totalSize = 0;
  const queue = [targetDir];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else {
        const stat = await fsp.stat(fullPath);
        count += 1;
        totalSize += stat.size;
      }
    }
  }

  return { count, totalSize };
};

const getStatsSummary = async (): Promise<StatsSummary> => {
  const imageCountRow = db.prepare('SELECT COUNT(*) AS count FROM images').get() as { count: number };
  const originalsSizeRow = db.prepare('SELECT COALESCE(SUM(file_size), 0) AS total FROM images').get() as { total: number };
  const variants = await getDirectoryStats(VARIANTS_DIR);

  return {
    image_count: imageCountRow.count,
    variant_count: variants.count,
    total_original_size: Number(originalsSizeRow.total || 0),
    total_variant_size: variants.totalSize,
  };
};

const positionToGravity = (position: RenderPosition): Gravity => {
  switch (position) {
    case 'northwest':
      return 'northwest';
    case 'east':
      return 'east';
    case 'west':
      return 'west';
    case 'north':
      return 'north';
    case 'south':
      return 'south';
    default:
      return 'centre';
  }
};

const buildRenderFilename = async (image: ImageRecord, width: number, height: number, position: RenderPosition) => {
  const imagePath = getImagePath(image.filename);
  const stat = await fsp.stat(imagePath);
  const sourceKey = image.content_hash || `${stat.mtimeMs}`;
  const ext = path.extname(image.filename) || '.jpg';
  return `${width}x${height}-${position}-${sourceKey}${ext}`;
};

const ensureVariant = async (image: ImageRecord, width: number, height: number, position: RenderPosition) => {
  const sourcePath = getImagePath(image.filename);
  const variantDir = getVariantDirectoryForImage(image.id);
  await fsp.mkdir(variantDir, { recursive: true });
  const variantFilename = await buildRenderFilename(image, width, height, position);
  const variantPath = path.join(variantDir, variantFilename);

  if (!(await fileExists(variantPath))) {
    await sharp(sourcePath)
      .resize({
        width,
        height,
        fit: 'cover',
        position: positionToGravity(position),
        withoutEnlargement: false,
      })
      .toFile(variantPath);
  }

  return variantPath;
};

const isAuthenticated = (req: express.Request): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Basic ')) {
    return false;
  }

  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  if (username !== 'admin' || !password) {
    return false;
  }

  const passwordHash = getSetting<string>('admin_password_hash', '');
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compareSync(password, passwordHash);
};

const requireAuth: express.RequestHandler = (req, res, next) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.use(cors({ origin: false }));
app.use(express.json({ limit: '2mb' }));
app.use('/images', express.static(IMAGES_DIR));

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  logMessage(`[${nowTimestamp()}] ${req.method} ${req.path} - IP: ${ip}`);
  next();
});

const storage = multer.diskStorage({
  destination: IMAGES_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/gif', '.gif'], ['image/webp', '.webp']]);
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.get(file.mimetype) === extension || (file.mimetype === 'image/jpeg' && extension === '.jpeg')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

const normalizeSettingsUpdate = (payload: Record<string, unknown>) => {
  const updates: Partial<PublicSettings> & { new_password?: string } = {};

  if (payload.display_mode === 'single' || payload.display_mode === 'rotation') {
    updates.display_mode = payload.display_mode;
  }
  if (payload.single_image_id === null || typeof payload.single_image_id === 'number') {
    updates.single_image_id = payload.single_image_id;
  }
  if (typeof payload.color_scheme === 'string' && COLOR_OPTIONS.includes(payload.color_scheme as ColorOption)) {
    updates.color_scheme = payload.color_scheme as ColorOption;
  }
  if (typeof payload.page_title === 'string') {
    updates.page_title = payload.page_title.trim() || DEFAULT_SETTINGS.page_title;
  }
  if (typeof payload.image_fit === 'string' && IMAGE_FIT_OPTIONS.includes(payload.image_fit as ImageFitOption)) {
    updates.image_fit = payload.image_fit as ImageFitOption;
  }
  if (typeof payload.render_enabled === 'boolean') {
    updates.render_enabled = payload.render_enabled;
  }
  if (payload.render_width === null || typeof payload.render_width === 'number') {
    updates.render_width = payload.render_width as number | null;
  }
  if (payload.render_height === null || typeof payload.render_height === 'number') {
    updates.render_height = payload.render_height as number | null;
  }
  if (typeof payload.render_position === 'string' && RENDER_POSITIONS.includes(payload.render_position as RenderPosition)) {
    updates.render_position = payload.render_position as RenderPosition;
  }
  if (typeof payload.slideshow_enabled === 'boolean') {
    updates.slideshow_enabled = payload.slideshow_enabled;
  }
  if (typeof payload.slideshow_interval_value === 'number' && Number.isFinite(payload.slideshow_interval_value)) {
    updates.slideshow_interval_value = Math.max(1, Math.round(payload.slideshow_interval_value));
  }
  if (typeof payload.slideshow_interval_unit === 'string' && TIMER_UNITS.includes(payload.slideshow_interval_unit as TimerUnit)) {
    updates.slideshow_interval_unit = payload.slideshow_interval_unit as TimerUnit;
  }
  if (typeof payload.slideshow_advance_mode === 'string' && ADVANCE_MODES.includes(payload.slideshow_advance_mode as AdvanceMode)) {
    updates.slideshow_advance_mode = payload.slideshow_advance_mode as AdvanceMode;
  }
  if (typeof payload.new_password === 'string' && payload.new_password.trim()) {
    updates.new_password = payload.new_password;
  }

  return updates;
};

const getCurrentImage = (settings: PublicSettings) => {
  if (settings.display_mode === 'single' && settings.single_image_id != null) {
    const image = getImageById(settings.single_image_id);
    if (image) {
      return image;
    }
  }

  const rotationImages = getRotationImages();
  if (rotationImages.length === 0) {
    return null;
  }

  return rotationImages[Math.floor(Math.random() * rotationImages.length)] ?? null;
};

app.post('/api/login', async (req, res) => {
  const { password } = req.body as { password?: string };
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const passwordHash = getSetting<string>('admin_password_hash', '');
  const isValid = passwordHash ? await bcrypt.compare(password, passwordHash) : false;
  const tag = isValid ? 'AUTH SUCCESS' : 'AUTH FAILED';
  logMessage(`[${nowTimestamp()}] [${tag}] Admin login from IP: ${ip}`);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({ success: true });
});

app.get('/api/image', (req, res) => {
  const settings = readSettings();
  const image = getCurrentImage(settings);
  if (!image) {
    return res.status(404).json({ error: 'No images available' });
  }

  res.json(image);
});

app.get('/api/rotation-images', (req, res) => {
  res.json(getRotationImages());
});

app.get('/api/public-settings', (req, res) => {
  res.json(readSettings());
});

app.get('/api/images', requireAuth, (req, res) => {
  res.json(getImages());
});

app.get('/api/stats', requireAuth, async (req, res) => {
  res.json(await getStatsSummary());
});

app.get('/api/images/:id/render', async (req, res) => {
  const imageId = Number(req.params.id);
  const width = Number(req.query.w);
  const height = Number(req.query.h);
  const position = (typeof req.query.position === 'string' ? req.query.position : 'center') as RenderPosition;

  if (!Number.isInteger(imageId) || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 16_000_000) {
    return res.status(400).json({ error: 'Valid image id, width, and height are required' });
  }
  if (!RENDER_POSITIONS.includes(position)) {
    return res.status(400).json({ error: 'Invalid render position' });
  }

  const image = getImageById(imageId);
  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  try {
    const variantPath = await ensureVariant(image, Math.round(width), Math.round(height), position);
    return res.sendFile(variantPath);
  } catch (error) {
    console.error('Render failed:', error);
    return res.status(500).json({ error: 'Failed to render image' });
  }
});

app.post('/api/upload', requireAuth, upload.any(), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const acceptedFiles = files.filter((file) => file.fieldname === 'images' || file.fieldname === 'image');

  if (acceptedFiles.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploaded: ImageRecord[] = [];
  const failed: Array<{ original_name: string; error: string }> = [];
  const duplicates: Array<{ original_name: string; matched_image_id: number; matched_filename: string }> = [];

  for (const file of acceptedFiles) {
    const filePath = getImagePath(file.filename);
    try {
      const [metadata, stat, contentHash] = await Promise.all([
        sharp(filePath).metadata(),
        fsp.stat(filePath),
        calculateFileHash(filePath),
      ]);

      const duplicate = db.prepare('SELECT id, filename FROM images WHERE content_hash = ? LIMIT 1').get(contentHash) as { id: number; filename: string } | undefined;
      const result = db.prepare(`
        INSERT INTO images (
          filename, original_name, upload_date, in_rotation, width, height, file_size, content_hash, rotation_order, favourite
        ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 0)
      `).run(
        file.filename,
        file.originalname,
        Date.now(),
        metadata.width ?? null,
        metadata.height ?? null,
        stat.size,
        contentHash,
        getNextRotationOrder(),
      );

      const image = getImageById(Number(result.lastInsertRowid));
      if (image) {
        uploaded.push(image);
      }
      if (duplicate) {
        duplicates.push({ original_name: file.originalname, matched_image_id: duplicate.id, matched_filename: duplicate.filename });
      }
    } catch (error) {
      console.error('Upload processing failed:', error);
      failed.push({
        original_name: file.originalname,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      });
      await safeUnlink(filePath);
    }
  }

  res.json({ uploaded, failed, duplicates });
});

app.put('/api/images/:id', requireAuth, async (req, res) => {
  const imageId = Number(req.params.id);
  const image = getImageById(imageId);
  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const updates = req.body as Partial<{ in_rotation: boolean; favourite: boolean; rotation_order: number }>;
  if (typeof updates.in_rotation === 'boolean') {
    db.prepare('UPDATE images SET in_rotation = ? WHERE id = ?').run(updates.in_rotation ? 1 : 0, imageId);
  }
  if (typeof updates.favourite === 'boolean') {
    db.prepare('UPDATE images SET favourite = ? WHERE id = ?').run(updates.favourite ? 1 : 0, imageId);
  }
  if (typeof updates.rotation_order === 'number') {
    db.prepare('UPDATE images SET rotation_order = ? WHERE id = ?').run(Math.round(updates.rotation_order), imageId);
  }

  res.json(getImageById(imageId));
});

app.put('/api/images/order', requireAuth, (req, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds as number[] : [];
  if (orderedIds.length === 0) {
    return res.status(400).json({ error: 'orderedIds is required' });
  }

  const transaction = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => {
      db.prepare('UPDATE images SET rotation_order = ? WHERE id = ?').run(index + 1, id);
    });
  });
  transaction(orderedIds);

  res.json({ success: true, images: getRotationImages() });
});

app.post('/api/images/bulk', requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as number[]).map(Number).filter(Number.isFinite) : [];
  const action = req.body?.action as string | undefined;

  if (ids.length === 0 || !action) {
    return res.status(400).json({ error: 'ids and action are required' });
  }

  if (action === 'delete') {
    const images = ids.map((id) => getImageById(id)).filter(Boolean) as ImageRecord[];
    for (const image of images) {
      await clearVariantsForImage(image.id);
      await safeUnlink(getImagePath(image.filename));
    }
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM images WHERE id IN (${placeholders})`).run(...ids);
    return res.json({ success: true });
  }

  if (action === 'enable-rotation' || action === 'disable-rotation') {
    const nextValue = action === 'enable-rotation' ? 1 : 0;
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE images SET in_rotation = ? WHERE id IN (${placeholders})`).run(nextValue, ...ids);
    return res.json({ success: true, images: getImages() });
  }

  if (action === 'favourite' || action === 'unfavourite') {
    const nextValue = action === 'favourite' ? 1 : 0;
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE images SET favourite = ? WHERE id IN (${placeholders})`).run(nextValue, ...ids);
    return res.json({ success: true, images: getImages() });
  }

  return res.status(400).json({ error: 'Unsupported bulk action' });
});

app.delete('/api/images/:id', requireAuth, async (req, res) => {
  const imageId = Number(req.params.id);
  const image = getImageById(imageId);
  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  await clearVariantsForImage(imageId);
  await safeUnlink(getImagePath(image.filename));
  db.prepare('DELETE FROM images WHERE id = ?').run(imageId);
  res.json({ success: true });
});

app.get('/api/settings', requireAuth, (req, res) => {
  res.json(readSettings());
});

app.put('/api/settings', requireAuth, async (req, res) => {
  const updates = normalizeSettingsUpdate(req.body ?? {});

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'new_password' || value === undefined) {
      continue;
    }
    setSetting(key, value);
  }

  if (updates.new_password) {
    const passwordHash = await bcrypt.hash(updates.new_password, 10);
    setSetting('admin_password_hash', passwordHash);
  }

  res.json(readSettings());
});

app.post('/api/cache/clear', requireAuth, async (req, res) => {
  const imageIds = Array.isArray(req.body?.imageIds) ? (req.body.imageIds as number[]).map(Number).filter(Number.isFinite) : null;

  if (imageIds && imageIds.length > 0) {
    await Promise.all(imageIds.map((imageId) => clearVariantsForImage(imageId)));
  } else {
    await clearAllVariants();
  }

  res.json({ success: true, stats: await getStatsSummary() });
});

app.use(express.static(FRONTEND_DIR));
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

await initializeSettings();
await backfillExistingImages();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Images directory: ${IMAGES_DIR}`);
  console.log(`Variants directory: ${VARIANTS_DIR}`);
});
