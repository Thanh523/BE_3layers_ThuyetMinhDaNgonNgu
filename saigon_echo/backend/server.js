import dotenv from 'dotenv';
import express from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getPool, sql } from './db.js';
import { hashPassword, verifyPassword } from './passwords.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') });

const app = express();
const port = Number(process.env.PORT || 3001);
const uploadsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), 'uploads');
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SESSION_TTL_MS = 30 * 1000;
const ADMIN_SESSION_TTL_MS = 0;
const sessions = new Map();
const ADMIN_SESSION_COOKIE = 'saigon-echo-admin-session';
const USER_SESSION_COOKIE = 'saigon-echo-user-session';
let placeVisibilityMigration;
let narrationVisibilityMigration;
let defaultPlaceImagesMigration;

function cookieOptions(maxAge, path) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        path,
        ...(maxAge ? { maxAge } : {}),
    };
}

function getSessionToken(req, cookieName) {
    const cookie = req.headers.cookie
        ?.split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${cookieName}=`));
    const token = cookie?.slice(cookieName.length + 1);
    return token && /^[\da-f]{64}$/i.test(token) ? token : null;
}

function getCurrentSession(req, cookieName = ADMIN_SESSION_COOKIE) {
    const token = getSessionToken(req, cookieName);
    const session = token ? sessions.get(token) : null;
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return { token, ...session };
}

function categoryValue(name) {
    const normalized = String(name || '').toLowerCase();
    if (normalized.includes('lịch sử')) return 'historyCat';
    if (normalized.includes('văn hóa')) return 'culture';
    if (normalized.includes('kiến trúc')) return 'architecture';
    if (normalized.includes('sông')) return 'river';
    return null;
}

const placeCategoryNames = {
    historyCat: 'Lịch sử',
    architecture: 'Kiến trúc',
    culture: 'Văn hóa',
    river: 'Sông nước',
};

async function getOrCreatePlaceCategoryId(pool, category) {
    const categoryName = placeCategoryNames[category];
    const result = await pool.request()
        .input('name', sql.NVarChar(100), categoryName)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryName = @name)
                INSERT INTO dbo.Categories (CategoryName, Description) VALUES (@name, @name);
            SELECT TOP (1) CategoryId FROM dbo.Categories WHERE CategoryName = @name;
        `);
    const categoryId = result.recordset[0]?.CategoryId;
    if (!categoryId) throw new Error(`Không tìm thấy danh mục "${categoryName}" trong database.`);
    return categoryId;
}

function requireUser(req, res) {
    const session = getCurrentSession(req, USER_SESSION_COOKIE);
    if (!session) {
        res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
        return null;
    }
    return session;
}

async function ensureUserDataTables(pool) {
    await pool.request().query(`
            IF OBJECT_ID(N'dbo.UserFavorites', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.UserFavorites (
                    UserId INT NOT NULL,
                    PlaceId INT NOT NULL,
                    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserFavorites_CreatedAt DEFAULT SYSUTCDATETIME(),
                    CONSTRAINT PK_UserFavorites PRIMARY KEY (UserId, PlaceId)
                );
            END;
            IF OBJECT_ID(N'dbo.UserListeningHistory', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.UserListeningHistory (
                    HistoryId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserListeningHistory PRIMARY KEY,
                    UserId INT NOT NULL,
                    PlaceId INT NOT NULL,
                    LanguageCode NVARCHAR(10) NOT NULL,
                    OccurredAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserListeningHistory_OccurredAt DEFAULT SYSUTCDATETIME()
                );
            END;
    `);
}

async function ensurePlaceVisibilityColumn(pool) {
    if (!placeVisibilityMigration) {
        placeVisibilityMigration = pool.request().query(`
            IF COL_LENGTH(N'dbo.Places', N'IsVisible') IS NULL
                ALTER TABLE dbo.Places
                ADD IsVisible BIT NOT NULL
                    CONSTRAINT DF_Places_IsVisible DEFAULT (1) WITH VALUES;
        `).catch((error) => {
            placeVisibilityMigration = undefined;
            throw error;
        });
    }
    await placeVisibilityMigration;
}

async function ensureNarrationVisibilityColumn(pool) {
    if (!narrationVisibilityMigration) {
        narrationVisibilityMigration = pool.request().query(`
            IF COL_LENGTH(N'dbo.Narrations', N'IsVisible') IS NULL
                ALTER TABLE dbo.Narrations
                ADD IsVisible BIT NOT NULL
                    CONSTRAINT DF_Narrations_IsVisible DEFAULT (1) WITH VALUES;
        `).catch((error) => {
            narrationVisibilityMigration = undefined;
            throw error;
        });
    }
    await narrationVisibilityMigration;
}

async function ensureDefaultPlaceImages(pool) {
    if (!defaultPlaceImagesMigration) {
        defaultPlaceImagesMigration = pool.request().query(`
            INSERT INTO dbo.PlaceImages (PlaceId, FileUrl, SortOrder)
            SELECT p.PlaceId, images.FileUrl, 1
            FROM (VALUES
                ('dinh-doc-lap', '/user-images/ddl.jpg'),
                ('buu-dien', '/user-images/buu_dien.jpg'),
                ('cho-ben-thanh', '/user-images/ben_thanh_2.jpg'),
                ('nha-hat', '/user-images/nha-hat.jpg'),
                ('nguyen-hue', '/user-images/nguyen-hue.jpg'),
                ('bach-dang', '/user-images/bach_dang.jpg'),
                ('bao-tang-chung-tich-chien-tranh', '/user-images/bao-tang-chung-tich-chien-tranh.jpg'),
                ('landmark-81', '/user-images/landmark-81.jpg'),
                ('chua-ngoc-hoang', '/user-images/chua-ngoc-hoang.jpg')
            ) AS images(Slug, FileUrl)
            INNER JOIN dbo.Places p ON p.Slug = images.Slug
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.PlaceImages currentImages
                WHERE currentImages.PlaceId = p.PlaceId
            );
        `).catch((error) => {
            defaultPlaceImagesMigration = undefined;
            throw error;
        });
    }
    await defaultPlaceImagesMigration;
}

async function resolvePlaceId(pool, value) {
    const result = await pool.request().input('place', sql.NVarChar(100), value).query(`
            SELECT TOP (1) PlaceId, Slug
            FROM dbo.Places
            WHERE Slug = @place OR CONVERT(NVARCHAR(100), PlaceId) = @place
    `);
    return result.recordset[0] || null;
}

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('Vary', 'Origin');
    if (req.headers.origin === frontendOrigin) {
        res.setHeader('Access-Control-Allow-Origin', frontendOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});
app.use(express.json({ limit: '30mb' }));
app.use('/uploads', express.static(uploadsDirectory));

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'saigon-echo-admin-backend' });
});

app.post('/api/admin/media-uploads', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    const { dataUrl, kind } = req.body || {};
    if (typeof dataUrl !== 'string' || !['image', 'audio'].includes(kind)) {
        return res.status(400).json({ message: 'Tệp tải lên không hợp lệ.' });
    }
    const match = /^data:(image\/(?:jpeg|png|webp)|audio\/(?:mpeg|wav|x-wav|ogg|mp4|x-m4a));base64,([A-Za-z\d+/]+=*)$/.exec(dataUrl);
    if (!match) return res.status(400).json({ message: 'Định dạng tệp không được hỗ trợ.' });
    const [, mimeType, encoded] = match;
    if ((kind === 'image') !== mimeType.startsWith('image/')) {
        return res.status(400).json({ message: 'Loại tệp không khớp với nội dung tải lên.' });
    }
    const buffer = Buffer.from(encoded, 'base64');
    const maxSize = kind === 'image' ? 8 : 20;
    if (!buffer.length || buffer.length > maxSize * 1024 * 1024) {
        return res.status(413).json({ message: `Tệp phải nhỏ hơn ${maxSize} MB.` });
    }
    const validSignature = mimeType === 'image/jpeg'
        ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
        : mimeType === 'image/png'
          ? buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : mimeType === 'image/webp'
            ? buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
            : mimeType === 'audio/wav' || mimeType === 'audio/x-wav'
              ? buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE'
              : mimeType === 'audio/ogg'
                ? buffer.toString('ascii', 0, 4) === 'OggS'
                : mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a'
                  ? buffer.toString('ascii', 4, 8) === 'ftyp'
                  : buffer.toString('ascii', 0, 3) === 'ID3'
                    || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    if (!validSignature) return res.status(400).json({ message: 'Nội dung tệp không đúng định dạng khai báo.' });

    const extensions = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
        'audio/x-wav': '.wav',
        'audio/ogg': '.ogg',
        'audio/mp4': '.m4a',
        'audio/x-m4a': '.m4a',
    };
    const filename = `${randomUUID()}${extensions[mimeType]}`;
    const directory = resolve(uploadsDirectory, kind === 'image' ? 'images' : 'audio');
    try {
        await mkdir(directory, { recursive: true });
        await writeFile(resolve(directory, filename), buffer, { flag: 'wx' });
        return res.status(201).json({ fileUrl: `/uploads/${kind === 'image' ? 'images' : 'audio'}/${filename}` });
    } catch (error) {
        console.error('Media upload failed:', error);
        return res.status(500).json({ message: 'Không thể lưu tệp trên máy chủ.' });
    }
});

app.get('/api/health/db', async (_req, res) => {
    try {
        const pool = await getPool();
        await pool.request().query('SELECT 1 AS connected');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        console.error('SQL Server health check failed:', error);
        res.status(503).json({
            status: 'error',
            database: 'disconnected',
            message:
                'Không thể kết nối SQL Server. Kiểm tra cấu hình backend và trạng thái database.',
        });

    }
});

app.post('/api/analytics/session', async (req, res) => {
    const sessionId = randomUUID();
    try {
        const pool = await getPool();
        await pool.request()
            .input('sessionId', sql.UniqueIdentifier, sessionId)
            .query(`
                INSERT INTO dbo.VisitorSessions (SessionId, StartedAt, LastSeenAt)
                VALUES (@sessionId, SYSUTCDATETIME(), SYSUTCDATETIME())
            `);
        return res.status(201).json({ sessionId });
    } catch (error) {
        console.error('Analytics session creation failed:', error);
        return res.status(500).json({ message: 'Không thể ghi nhận phiên truy cập.' });
    }
});

app.post('/api/analytics/play', async (req, res) => {
    const { sessionId, placeId, lang } = req.body || {};
    if (
        typeof sessionId !== 'string' ||
        !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(sessionId) ||
        (typeof placeId !== 'string' && typeof placeId !== 'number') ||
        typeof lang !== 'string'
    ) {
        return res.status(400).json({ message: 'Dữ liệu lượt nghe không hợp lệ.' });
    }
    try {
        const pool = await getPool();
        const narration = await pool.request()
            .input('place', sql.NVarChar(100), String(placeId))
            .input('lang', sql.VarChar(10), lang)
            .query(`
                SELECT TOP (1) n.NarrationId
                FROM dbo.Narrations n
                INNER JOIN dbo.Places p ON p.PlaceId = n.PlaceId
                WHERE (p.Slug = @place OR CONVERT(NVARCHAR(100), p.PlaceId) = @place)
                  AND n.LanguageCode = @lang
            `);
        const narrationId = narration.recordset[0]?.NarrationId;
        if (!narrationId) return res.status(404).json({ message: 'Không tìm thấy bài thuyết minh.' });
        await pool.request()
            .input('sessionId', sql.UniqueIdentifier, sessionId)
            .input('narrationId', sql.Int, narrationId)
            .input('eventId', sql.UniqueIdentifier, randomUUID())
            .query(`
                UPDATE dbo.VisitorSessions
                SET LastSeenAt = SYSUTCDATETIME()
                WHERE SessionId = @sessionId;
                INSERT INTO dbo.UsageEvents
                    (ClientEventId, SessionId, NarrationId, EventType, CreatedAt)
                VALUES
                    (@eventId, @sessionId, @narrationId, 'VIEW', SYSUTCDATETIME())
            `);
        return res.sendStatus(204);
    } catch (error) {
        console.error('Analytics play event failed:', error);
        return res.status(500).json({ message: 'Không thể ghi nhận lượt nghe.' });
    }
});

app.post('/api/admin/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        !username.trim() ||
        !password ||
        username.length > 100 ||
        password.length > 1024
    ) {
        return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.' });
    }

    try {
        const pool = await getPool();
        const loginIdentifier = username.trim();
        const result = await pool.request().input('loginIdentifier', sql.NVarChar(254), loginIdentifier)
            .query(`
                SELECT TOP (1) AdminId, Username, Email, PasswordHash, Role, IsActive
                FROM dbo.AdminAccounts
                WHERE (Username = @loginIdentifier OR Email = @loginIdentifier)
                  AND IsActive = 1
                  AND UPPER(Role) IN ('ADMIN', 'SUPER_ADMIN')
                ORDER BY AdminId
            `);
        const account = result.recordset[0];
        if (
            !account ||
            !account.IsActive ||
            !['ADMIN', 'SUPER_ADMIN'].includes(String(account.Role).toUpperCase())
        ) {
            return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
        }
        if (!(await verifyPassword(password, account.PasswordHash))) {
            return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
        }

        const token = randomBytes(32).toString('hex');
        const user = {
            name: account.Email || account.Username,
            username: account.Username,
            email: account.Email,
            role: 'admin',
        };
        await pool
            .request()
            .input('adminId', sql.Int, account.AdminId)
            .query(
                'UPDATE dbo.AdminAccounts SET LastLoginAt = SYSUTCDATETIME() WHERE AdminId = @adminId',
            );
        sessions.set(token, {
            user,
            expiresAt: ADMIN_SESSION_TTL_MS ? Date.now() + ADMIN_SESSION_TTL_MS : Infinity,
        });
        res.cookie(
            ADMIN_SESSION_COOKIE,
            token,
            cookieOptions(ADMIN_SESSION_TTL_MS, '/api/admin'),
        );
        return res.json({ user });
    } catch (error) {
        console.error('Admin login failed:', error);
        return res.status(500).json({
            message: 'Không thể đăng nhập. Kiểm tra kết nối và cấu trúc dbo.AdminAccounts.',
        });
    }
});

app.post('/api/user/auth/register', async (req, res) => {
    const { email, fullName, password } = req.body || {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedFullName = typeof fullName === 'string' ? fullName.trim() : '';
    if (
        normalizedEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        !normalizedFullName ||
        normalizedFullName.length > 100 ||
        typeof password !== 'string' ||
        password.length < 12 ||
        password.length > 128
    ) {
        return res.status(400).json({
            message:
                'Thông tin chưa hợp lệ. Email đúng định dạng, họ tên tối đa 100 ký tự và mật khẩu từ 12–128 ký tự.',
        });
    }

    try {
        const passwordHash = await hashPassword(password);
        const pool = await getPool();
        const result = await pool
            .request()
            .input('email', sql.NVarChar(254), normalizedEmail)
            .input('fullName', sql.NVarChar(100), normalizedFullName)
            .input('passwordHash', sql.NVarChar(512), passwordHash).query(`
                INSERT INTO dbo.UserAccounts (Email, FullName, PasswordHash, IsActive, CreatedAt)
                OUTPUT INSERTED.UserId, INSERTED.Email, INSERTED.FullName
                VALUES (@email, @fullName, @passwordHash, 1, SYSUTCDATETIME())
            `);
        const account = result.recordset[0];
        const token = randomBytes(32).toString('hex');
        const user = {
            id: account.UserId,
            name: account.FullName,
            username: account.Email,
            email: account.Email,
            role: 'user',
        };
        sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
        res.cookie(
            USER_SESSION_COOKIE,
            token,
            cookieOptions(SESSION_TTL_MS, '/api/user'),
        );
        return res.status(201).json({ user });
    } catch (error) {
        if (error.number === 2601 || error.number === 2627) {
            return res.status(409).json({
                message: 'Email đã được sử dụng.',
            });
        }
        console.error('User registration failed:', error);
        return res.status(500).json({
            message: 'Không thể tạo tài khoản. Kiểm tra kết nối và cấu trúc dbo.UserAccounts.',
        });
    }
});

app.post('/api/user/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        !username.trim() ||
        !password ||
        username.length > 100 ||
        password.length > 1024
    ) {
        return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.' });
    }

    try {
        const pool = await getPool();
        const result = await pool
            .request()
            .input('email', sql.NVarChar(254), username.trim().toLowerCase()).query(`
                SELECT TOP (1) UserId, Email, FullName, PasswordHash, IsActive
                FROM dbo.UserAccounts
                WHERE Email = @email
                  AND IsActive = 1
                ORDER BY UserId
            `);
        const account = result.recordset[0];
        if (!account || !(await verifyPassword(password, account.PasswordHash))) {
            return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
        }

        const token = randomBytes(32).toString('hex');
        const user = {
            id: account.UserId,
            name: account.FullName,
            username: account.Email,
            email: account.Email,
            role: 'user',
        };
        await pool
            .request()
            .input('userId', sql.Int, account.UserId)
            .query(
                'UPDATE dbo.UserAccounts SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @userId',
            );
        sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
        res.cookie(
            USER_SESSION_COOKIE,
            token,
            cookieOptions(SESSION_TTL_MS, '/api/user'),
        );
        return res.json({ user });
    } catch (error) {
        console.error('User login failed:', error);
        return res.status(500).json({
            message: 'Không thể đăng nhập. Kiểm tra kết nối và cấu trúc dbo.UserAccounts.',
        });
    }
});

app.get('/api/user/auth/me', (req, res) => {
    const session = getCurrentSession(req, USER_SESSION_COOKIE);
    if (!session) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    return res.json({ user: session.user });
});

app.post('/api/user/auth/activity', (req, res) => {
    const session = getCurrentSession(req, USER_SESSION_COOKIE);
    if (!session) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });

    const expiresAt = Date.now() + SESSION_TTL_MS;
    sessions.set(session.token, { user: session.user, expiresAt });
    res.cookie(
        USER_SESSION_COOKIE,
        session.token,
        cookieOptions(SESSION_TTL_MS, '/api/user'),
    );
    return res.sendStatus(204);
});

app.post('/api/user/auth/logout', (req, res) => {
    const session = getCurrentSession(req, USER_SESSION_COOKIE);
    if (session) sessions.delete(session.token);
    res.clearCookie(USER_SESSION_COOKIE, cookieOptions(undefined, '/api/user'));
    return res.sendStatus(204);
});

app.get('/api/admin/auth/me', (req, res) => {
    const session = getCurrentSession(req);
    if (!session) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    return res.json({ user: session.user });
});

app.post('/api/admin/auth/activity', (req, res) => {
    const session = getCurrentSession(req);
    if (!session) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });

    const expiresAt = ADMIN_SESSION_TTL_MS
        ? Date.now() + ADMIN_SESSION_TTL_MS
        : Infinity;
    sessions.set(session.token, { user: session.user, expiresAt });
    res.cookie(
        ADMIN_SESSION_COOKIE,
        session.token,
        cookieOptions(ADMIN_SESSION_TTL_MS, '/api/admin'),
    );
    return res.sendStatus(204);
});

app.post('/api/admin/auth/logout', (req, res) => {
    const session = getCurrentSession(req);
    if (session) sessions.delete(session.token);
    res.clearCookie(ADMIN_SESSION_COOKIE, cookieOptions(undefined, '/api/admin'));
    return res.sendStatus(204);
});

app.get('/api/places', async (req, res) => {
    try {
        const pool = await getPool();
        await ensurePlaceVisibilityColumn(pool);
        await ensureNarrationVisibilityColumn(pool);
        await ensureDefaultPlaceImages(pool);
        const result = await pool.request().query(`
            SELECT p.PlaceId, p.Slug, p.PlaceName, p.Address,
                   p.IsVisible, cover.ImageUrl, c.CategoryName, n.LanguageCode, n.Content
            FROM dbo.Places p
            INNER JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
            LEFT JOIN dbo.Narrations n ON n.PlaceId = p.PlaceId AND n.IsVisible = 1
            OUTER APPLY (
                SELECT TOP (1) i.FileUrl AS ImageUrl
                FROM dbo.PlaceImages i
                WHERE i.PlaceId = p.PlaceId
                ORDER BY i.SortOrder, i.ImageId
            ) cover
            WHERE p.IsVisible = 1
            ORDER BY p.PlaceName, n.LanguageCode
        `);
        const places = new Map();
        for (const row of result.recordset) {
            const id = row.Slug || String(row.PlaceId);
            if (!places.has(id)) {
                places.set(id, {
                    id,
                    slug: row.Slug || String(row.PlaceId),
                    name: row.PlaceName,
                    address: row.Address || '',
                    visible: row.IsVisible,
                    imageUrl: row.ImageUrl || '',
                    category: categoryValue(row.CategoryName),
                    texts: {},
                });
            }
            if (row.LanguageCode) places.get(id).texts[row.LanguageCode] = row.Content || '';
        }
        const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
        const category = typeof req.query.category === 'string' ? req.query.category : 'all';
        const filtered = [...places.values()].filter((place) => {
            const matchesCategory = category === 'all'
                || category === place.category;
            const haystack = `${place.name} ${place.address}`.toLowerCase();
            return matchesCategory && (!query || haystack.includes(query));
        });

        return res.json(filtered);
    } catch (error) {
        console.error('Public places query failed:', error);
        return res.status(500).json({ message: 'Không thể tải địa điểm từ database.' });
    }
});

app.get('/api/places/:slug', async (req, res) => {
    try {
        const pool = await getPool();
        await ensurePlaceVisibilityColumn(pool);
        await ensureNarrationVisibilityColumn(pool);
        await ensureDefaultPlaceImages(pool);
        const placeResult = await pool.request()
            .input('slug', sql.VarChar(200), req.params.slug)
            .query(`
                SELECT TOP (1) p.PlaceId, p.Slug, p.PlaceName, p.Address, p.IsVisible, c.CategoryName
                FROM dbo.Places p
                INNER JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
                WHERE p.Slug = @slug AND p.IsVisible = 1
            `);
        const first = placeResult.recordset[0];
        if (!first) return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
        const [narrationResult, imageResult] = await Promise.all([
            pool.request().input('placeId', sql.Int, first.PlaceId).query(`
                SELECT n.NarrationId, n.LanguageCode, n.Title, n.Content,
                       a.AudioId, a.FileUrl AS AudioUrl, a.VoiceName, a.DurationSeconds
                FROM dbo.Narrations n
                LEFT JOIN dbo.AudioFiles a ON a.NarrationId = n.NarrationId AND a.IsActive = 1
                WHERE n.PlaceId = @placeId AND n.IsVisible = 1
                ORDER BY n.LanguageCode
            `),
            pool.request().input('placeId', sql.Int, first.PlaceId).query(`
                SELECT ImageId, FileUrl AS ImageUrl, SortOrder
                FROM dbo.PlaceImages
                WHERE PlaceId = @placeId
                ORDER BY SortOrder, ImageId
            `),
        ]);
        const narrations = new Map();
        const images = new Map();
        for (const row of narrationResult.recordset) {
            if (row.NarrationId != null && !narrations.has(row.NarrationId)) {
                narrations.set(row.NarrationId, {
                    id: String(row.NarrationId),
                    lang: row.LanguageCode,
                    title: row.Title,
                    text: row.Content,
                    audio: row.AudioId == null ? null : {
                        id: String(row.AudioId),
                        url: row.AudioUrl,
                        voice: row.VoiceName,
                        duration: row.DurationSeconds,
                    },
                });
            }
        }
        for (const row of imageResult.recordset) {
            images.set(row.ImageId, {
                id: String(row.ImageId),
                url: row.ImageUrl,
                order: row.SortOrder,
            });
        }
        return res.json({
            place: {
                id: first.Slug || String(first.PlaceId),
                slug: first.Slug || String(first.PlaceId),
                name: first.PlaceName,
                address: first.Address || '',
                imageUrl: [...images.values()][0]?.url || '',
                category: categoryValue(first.CategoryName),
                visible: first.IsVisible,
                narrations: [...narrations.values()],
                images: [...images.values()],
            },
        });
    } catch (error) {
        console.error('Public place detail query failed:', error);
        return res.status(500).json({ message: 'Không thể tải chi tiết địa điểm.' });
    }
});

app.post('/api/admin/places', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }
    const { name, address, category = 'historyCat' } = req.body || {};
    const visible = typeof req.body?.visible === 'boolean' ? req.body.visible : true;
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedAddress = typeof address === 'string' ? address.trim() : '';
    const normalizedCategory = typeof category === 'string' ? category : 'historyCat';
    if (!normalizedName || normalizedName.length > 100 || !normalizedAddress || normalizedAddress.length > 220) {
        return res.status(400).json({ message: 'Tên và địa chỉ địa điểm không hợp lệ.' });
    }
    if (!Object.hasOwn(placeCategoryNames, normalizedCategory)) {
        return res.status(400).json({ message: 'Danh mục địa điểm không hợp lệ.' });
    }
    const slug = normalizedName.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dia-diem';
    try {
        const pool = await getPool();
        await ensurePlaceVisibilityColumn(pool);
        await ensureDefaultPlaceImages(pool);
        const categoryId = await getOrCreatePlaceCategoryId(pool, normalizedCategory);
        const result = await pool.request()
            .input('name', sql.NVarChar(100), normalizedName)
            .input('address', sql.NVarChar(220), normalizedAddress)
            .input('slug', sql.VarChar(100), slug)
            .input('categoryId', sql.Int, categoryId)
            .input('visible', sql.Bit, visible)
            .query(`
                IF EXISTS (SELECT 1 FROM dbo.Places WHERE Slug = @slug OR PlaceName = @name)
                    THROW 51000, 'Tên hoặc đường dẫn địa điểm đã tồn tại.', 1;
                INSERT INTO dbo.Places (CategoryId, PlaceName, Slug, Address, IsVisible)
                OUTPUT INSERTED.PlaceId, INSERTED.PlaceName, INSERTED.Slug, INSERTED.Address, INSERTED.IsVisible
                VALUES (@categoryId, @name, @slug, @address, @visible);
            `);
        const place = result.recordset[0];
        if (!place) return res.status(400).json({ message: 'Không tìm thấy danh mục trong database.' });
        return res.status(201).json({
            location: {
                id: place.Slug || String(place.PlaceId),
                slug: place.Slug,
                name: place.PlaceName,
                address: place.Address,
                visible: place.IsVisible,
                category: normalizedCategory,
                texts: {},
            },
        });
    } catch (error) {
        if (error.number === 51000 || error.number === 2627 || error.number === 2601) {
            return res.status(409).json({ message: 'Tên hoặc đường dẫn địa điểm đã tồn tại.' });
        }
        console.error('Place creation failed:', error);
        return res.status(500).json({ message: 'Không thể lưu địa điểm vào database.' });
    }
});

app.get('/api/admin/places', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }
    try {
        const pool = await getPool();
        await ensurePlaceVisibilityColumn(pool);
        await ensureDefaultPlaceImages(pool);
        const result = await pool.request().query(`
            SELECT p.PlaceId, p.Slug, p.PlaceName, p.Address, p.IsVisible,
                   cover.ImageUrl, c.CategoryName,
                   narrationCounts.NarrationCount
            FROM dbo.Places p
            INNER JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
            OUTER APPLY (
                SELECT TOP (1) i.FileUrl AS ImageUrl
                FROM dbo.PlaceImages i
                WHERE i.PlaceId = p.PlaceId
                ORDER BY i.SortOrder, i.ImageId
            ) cover
            OUTER APPLY (
                SELECT COUNT_BIG(*) AS NarrationCount
                FROM dbo.Narrations n
                WHERE n.PlaceId = p.PlaceId
            ) narrationCounts
            ORDER BY p.PlaceName
        `);
        return res.json(result.recordset.map((row) => ({
            id: row.Slug || String(row.PlaceId),
            slug: row.Slug || String(row.PlaceId),
            name: row.PlaceName,
            address: row.Address || '',
            visible: row.IsVisible,
            imageUrl: row.ImageUrl || '',
            category: categoryValue(row.CategoryName),
            narrationCount: Number(row.NarrationCount),
        })));
    } catch (error) {
        console.error('Admin places query failed:', error);
        return res.status(500).json({ message: 'Không thể tải địa điểm từ database.' });
    }
});

app.put('/api/admin/places/:id', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }
    const { name, address, category } = req.body || {};
    const visible = typeof req.body?.visible === 'boolean' ? req.body.visible : null;
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedAddress = typeof address === 'string' ? address.trim() : '';
    if (!normalizedName || normalizedName.length > 100 || !normalizedAddress || normalizedAddress.length > 220) {
        return res.status(400).json({ message: 'Tên và địa chỉ địa điểm không hợp lệ.' });
    }
    if (typeof category !== 'string' || !Object.hasOwn(placeCategoryNames, category)) {
        return res.status(400).json({ message: 'Danh mục địa điểm không hợp lệ.' });
    }
    try {
        const pool = await getPool();
        await ensurePlaceVisibilityColumn(pool);
        const categoryId = await getOrCreatePlaceCategoryId(pool, category);
        const result = await pool.request()
            .input('id', sql.NVarChar(100), req.params.id)
            .input('name', sql.NVarChar(100), normalizedName)
            .input('address', sql.NVarChar(220), normalizedAddress)
            .input('categoryId', sql.Int, categoryId)
            .input('visible', sql.Bit, visible)
            .query(`
                UPDATE p
                SET PlaceName = @name,
                    Address = @address,
                    CategoryId = @categoryId,
                    IsVisible = COALESCE(@visible, p.IsVisible)
                OUTPUT INSERTED.PlaceId, INSERTED.Slug, INSERTED.PlaceName, INSERTED.Address, INSERTED.IsVisible
                FROM dbo.Places p
                WHERE p.Slug = @id OR CONVERT(NVARCHAR(100), p.PlaceId) = @id
            `);
        const row = result.recordset[0];
        if (!row) return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
        return res.json({
            location: {
                id: row.Slug || String(row.PlaceId),
                slug: row.Slug || String(row.PlaceId),
                name: row.PlaceName,
                address: row.Address || '',
                visible: row.IsVisible,
                category,
            },
        });
    } catch (error) {
        console.error('Place update failed:', error);
        return res.status(500).json({ message: 'Không thể cập nhật địa điểm trong database.' });
    }
});

app.delete('/api/admin/places/:id', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }
    const transaction = new sql.Transaction(await getPool());
    try {
        await transaction.begin();
        const placeResult = await new sql.Request(transaction)
            .input('id', sql.NVarChar(100), req.params.id)
            .query('SELECT TOP (1) PlaceId FROM dbo.Places WHERE Slug = @id OR CONVERT(NVARCHAR(100), PlaceId) = @id');
        const place = placeResult.recordset[0];
        if (!place) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
        }
        const request = () => new sql.Request(transaction).input('placeId', sql.Int, place.PlaceId);
        await request().query(`
            DELETE FROM dbo.UserFavorites WHERE PlaceId = @placeId;
            DELETE FROM dbo.UserListeningHistory WHERE PlaceId = @placeId;
            DELETE FROM dbo.PlaceImages WHERE PlaceId = @placeId;
            DELETE FROM dbo.UsageEvents
            WHERE NarrationId IN (SELECT NarrationId FROM dbo.Narrations WHERE PlaceId = @placeId)
               OR AudioId IN (
                   SELECT a.AudioId FROM dbo.AudioFiles a
                   INNER JOIN dbo.Narrations n ON n.NarrationId = a.NarrationId
                   WHERE n.PlaceId = @placeId
               );
            DELETE FROM dbo.QRCodes
            WHERE NarrationId IN (SELECT NarrationId FROM dbo.Narrations WHERE PlaceId = @placeId);
            DELETE FROM dbo.AudioFiles
            WHERE NarrationId IN (SELECT NarrationId FROM dbo.Narrations WHERE PlaceId = @placeId);
            DELETE FROM dbo.Narrations WHERE PlaceId = @placeId;
            DELETE FROM dbo.Places WHERE PlaceId = @placeId;
        `);
        await transaction.commit();
        return res.sendStatus(204);
    } catch (error) {
        try { await transaction.rollback(); } catch (rollbackError) {
            console.error('Place deletion rollback failed:', rollbackError);
        }
        console.error('Place deletion failed:', error);
        return res.status(500).json({
            message: 'Không thể xóa địa điểm. Hãy kiểm tra các dữ liệu liên quan trong database.',
        });
    }
});

app.get('/api/admin/images', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    try {
        const pool = await getPool();
        await ensureDefaultPlaceImages(pool);
        const result = await pool.request().query(`
            SELECT i.ImageId, i.PlaceId, p.Slug, p.PlaceName, i.FileUrl, i.SortOrder
            FROM dbo.PlaceImages i
            INNER JOIN dbo.Places p ON p.PlaceId = i.PlaceId
            ORDER BY p.PlaceName, i.SortOrder, i.ImageId
        `);
        return res.json(result.recordset.map((row) => ({
            id: String(row.ImageId),
            locationId: row.Slug || String(row.PlaceId),
            placeName: row.PlaceName,
            fileUrl: row.FileUrl,
            order: row.SortOrder,
            isCover: row.SortOrder === 1,
        })));
    } catch (error) {
        console.error('Admin images query failed:', error);
        return res.status(500).json({ message: 'Không thể tải hình ảnh từ database.' });
    }
});

app.post('/api/admin/images', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    const { locationId, fileUrl, sortOrder = 0 } = req.body || {};
    if (typeof locationId !== 'string' || !locationId.trim() || typeof fileUrl !== 'string' || !fileUrl.trim()) {
        return res.status(400).json({ message: 'Địa điểm và đường dẫn hình ảnh là bắt buộc.' });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('locationId', sql.NVarChar(100), locationId.trim())
            .input('fileUrl', sql.NVarChar(2000), fileUrl.trim())
            .input('sortOrder', sql.Int, Number.isInteger(sortOrder) ? sortOrder : 0)
            .query(`
                INSERT INTO dbo.PlaceImages (PlaceId, FileUrl, SortOrder)
                OUTPUT INSERTED.ImageId
                SELECT PlaceId, @fileUrl, @sortOrder
                FROM dbo.Places
                WHERE Slug = @locationId OR CONVERT(NVARCHAR(100), PlaceId) = @locationId
            `);
        if (!result.recordset[0]) return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
        return res.status(201).json({ image: { id: String(result.recordset[0].ImageId), locationId, fileUrl: fileUrl.trim(), order: sortOrder } });
    } catch (error) {
        console.error('Image creation failed:', error);
        return res.status(500).json({ message: 'Không thể lưu hình ảnh vào database.' });
    }
});

app.put('/api/admin/images/:id', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    const id = Number(req.params.id);
    const sortOrder = req.body?.sortOrder;
    const fileUrl = typeof req.body?.fileUrl === 'string' ? req.body.fileUrl.trim() : '';
    if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !Number.isInteger(sortOrder) ||
        sortOrder < 1 ||
        (req.body?.fileUrl !== undefined && !fileUrl)
    ) {
        return res.status(400).json({ message: 'Thứ tự hình ảnh không hợp lệ.' });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('sortOrder', sql.Int, sortOrder)
            .input('fileUrl', sql.NVarChar(2000), fileUrl || null)
            .query(`
                UPDATE dbo.PlaceImages
                SET SortOrder = @sortOrder,
                    FileUrl = COALESCE(@fileUrl, FileUrl)
                OUTPUT INSERTED.ImageId, INSERTED.PlaceId, INSERTED.FileUrl, INSERTED.SortOrder
                WHERE ImageId = @id
            `);
        const row = result.recordset[0];
        if (!row) return res.status(404).json({ message: 'Không tìm thấy hình ảnh.' });
        return res.json({ image: { id: String(row.ImageId), fileUrl: row.FileUrl, order: row.SortOrder } });
    } catch (error) {
        console.error('Image update failed:', error);
        return res.status(500).json({ message: 'Không thể cập nhật hình ảnh trong database.' });
    }
});

app.delete('/api/admin/images/:id', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    try {
        const pool = await getPool();
        const result = await pool.request().input('id', sql.Int, Number(req.params.id))
            .query('DELETE FROM dbo.PlaceImages OUTPUT DELETED.ImageId WHERE ImageId = @id');
        return result.recordset.length ? res.sendStatus(204) : res.status(404).json({ message: 'Không tìm thấy hình ảnh.' });
    } catch (error) {
        console.error('Image deletion failed:', error);
        return res.status(500).json({ message: 'Không thể xóa hình ảnh khỏi database.' });
    }
});

app.get('/api/admin/audios', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT a.AudioId, a.NarrationId, n.LanguageCode, n.Title,
                   p.PlaceId, p.Slug, p.PlaceName, a.FileUrl, a.VoiceName, a.DurationSeconds, a.IsActive
            FROM dbo.AudioFiles a
            INNER JOIN dbo.Narrations n ON n.NarrationId = a.NarrationId
            INNER JOIN dbo.Places p ON p.PlaceId = n.PlaceId
            ORDER BY p.PlaceName, n.LanguageCode
        `);
        return res.json(result.recordset.map((row) => ({
            id: String(row.AudioId),
            narrationId: String(row.NarrationId),
            locationId: row.Slug || String(row.PlaceId),
            placeName: row.PlaceName,
            lang: row.LanguageCode,
            title: row.Title || row.VoiceName || '',
            fileUrl: row.FileUrl,
            voiceName: row.VoiceName,
            duration: row.DurationSeconds,
            active: row.IsActive,
        })));
    } catch (error) {
        console.error('Admin audio query failed:', error);
        return res.status(500).json({ message: 'Không thể tải âm thanh từ database.' });
    }
});

app.post('/api/admin/audios', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    const { narrationId, fileUrl, voiceName = '', durationSeconds = 0 } = req.body || {};
    const parsedNarrationId = Number(narrationId);
    if (!Number.isSafeInteger(parsedNarrationId) || parsedNarrationId <= 0 || typeof fileUrl !== 'string' || !fileUrl.trim()) {
        return res.status(400).json({ message: 'Bài thuyết minh và đường dẫn âm thanh là bắt buộc.' });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('narrationId', sql.Int, parsedNarrationId)
            .input('fileUrl', sql.NVarChar(2000), fileUrl.trim())
            .input('voiceName', sql.NVarChar(200), typeof voiceName === 'string' ? voiceName.trim() : '')
            .input('duration', sql.Int, Number.isInteger(durationSeconds) && durationSeconds >= 0 ? durationSeconds : 0)
            .query(`
                INSERT INTO dbo.AudioFiles (NarrationId, FileUrl, VoiceName, DurationSeconds, IsActive)
                OUTPUT INSERTED.AudioId
                VALUES (@narrationId, @fileUrl, @voiceName, @duration, 1)
            `);
        return res.status(201).json({ audio: { id: String(result.recordset[0].AudioId), narrationId: String(parsedNarrationId), fileUrl: fileUrl.trim() } });
    } catch (error) {
        console.error('Audio creation failed:', error);
        return res.status(500).json({ message: 'Không thể lưu âm thanh vào database.' });
    }
});

app.put('/api/admin/audios/:id', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    const id = Number(req.params.id);
    const { fileUrl, voiceName = '', durationSeconds = 0 } = req.body || {};
    if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        typeof fileUrl !== 'string' ||
        !fileUrl.trim() ||
        typeof voiceName !== 'string' ||
        !Number.isInteger(durationSeconds) ||
        durationSeconds < 0
    ) {
        return res.status(400).json({ message: 'Thông tin âm thanh không hợp lệ.' });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('fileUrl', sql.NVarChar(2000), fileUrl.trim())
            .input('voiceName', sql.NVarChar(200), voiceName.trim())
            .input('duration', sql.Int, durationSeconds)
            .query(`
                UPDATE dbo.AudioFiles
                SET FileUrl = @fileUrl, VoiceName = @voiceName, DurationSeconds = @duration
                OUTPUT INSERTED.AudioId, INSERTED.NarrationId, INSERTED.FileUrl,
                       INSERTED.VoiceName, INSERTED.DurationSeconds
                WHERE AudioId = @id
            `);
        const row = result.recordset[0];
        if (!row) return res.status(404).json({ message: 'Không tìm thấy âm thanh.' });
        return res.json({
            audio: {
                id: String(row.AudioId),
                narrationId: String(row.NarrationId),
                fileUrl: row.FileUrl,
                voiceName: row.VoiceName,
                duration: row.DurationSeconds,
            },
        });
    } catch (error) {
        console.error('Audio update failed:', error);
        return res.status(500).json({ message: 'Không thể cập nhật âm thanh trong database.' });
    }
});

app.delete('/api/admin/audios/:id', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    try {
        const pool = await getPool();
        const result = await pool.request().input('id', sql.Int, Number(req.params.id))
            .query('DELETE FROM dbo.AudioFiles OUTPUT DELETED.AudioId WHERE AudioId = @id');
        return result.recordset.length ? res.sendStatus(204) : res.status(404).json({ message: 'Không tìm thấy âm thanh.' });
    } catch (error) {
        console.error('Audio deletion failed:', error);
        return res.status(500).json({ message: 'Không thể xóa âm thanh khỏi database.' });
    }
});

app.get('/api/admin/qrs', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    try {
        const pool = await getPool();
        await ensurePlaceVisibilityColumn(pool);
        await ensureNarrationVisibilityColumn(pool);
        const result = await pool.request().query(`
            SELECT q.QRCodeId, q.Code, q.Label, q.IsActive, n.NarrationId,
                   p.PlaceId, p.Slug, p.PlaceName, p.IsVisible, n.LanguageCode
            FROM dbo.QRCodes q
            INNER JOIN dbo.Narrations n ON n.NarrationId = q.NarrationId
            INNER JOIN dbo.Places p ON p.PlaceId = n.PlaceId
            ORDER BY p.PlaceName, n.LanguageCode
        `);
        return res.json(result.recordset.map((row) => ({
            id: String(row.QRCodeId),
            code: row.Code,
            label: row.Label,
            active: row.IsActive,
            narrationId: String(row.NarrationId),
            locationId: row.Slug || String(row.PlaceId),
            placeName: row.PlaceName,
            visible: row.IsVisible,
            lang: row.LanguageCode,
        })));
    } catch (error) {
        console.error('Admin QR query failed:', error);
        return res.status(500).json({ message: 'Không thể tải mã QR từ database.' });
    }
});

app.post('/api/admin/qrs', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    const requestedNarrationId = Number(req.body?.narrationId);
    const locationId = typeof req.body?.locationId === 'string' ? req.body.locationId.trim() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    if (
        ((!Number.isSafeInteger(requestedNarrationId) || requestedNarrationId <= 0) && !locationId) ||
        locationId.length > 100
    ) {
        return res.status(400).json({ message: 'Hãy chọn địa điểm hoặc bài thuyết minh.' });
    }
    try {
        const pool = await getPool();
        await ensurePlaceVisibilityColumn(pool);
        await ensureNarrationVisibilityColumn(pool);
        let narrationId = requestedNarrationId;
        if (locationId) {
            const narrationResult = await pool.request()
                .input('locationId', sql.NVarChar(100), locationId)
                .query(`
                    SELECT TOP (1) n.NarrationId
                    FROM dbo.Places p
                    INNER JOIN dbo.Narrations n ON n.PlaceId = p.PlaceId
                    WHERE (p.Slug = @locationId OR CONVERT(NVARCHAR(100), p.PlaceId) = @locationId)
                      AND p.IsVisible = 1
                      AND n.IsVisible = 1
                    ORDER BY CASE WHEN n.LanguageCode = 'vi' THEN 0 ELSE 1 END, n.LanguageCode
                `);
            if (!narrationResult.recordset.length) {
                const placeResult = await pool.request()
                    .input('locationId', sql.NVarChar(100), locationId)
                    .query(`
                        SELECT TOP (1) PlaceId, IsVisible
                        FROM dbo.Places
                        WHERE Slug = @locationId OR CONVERT(NVARCHAR(100), PlaceId) = @locationId
                    `);
                if (!placeResult.recordset.length) return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
                if (!placeResult.recordset[0].IsVisible) return res.status(409).json({ message: 'Địa điểm đang ẩn.' });
                return res.status(409).json({ message: 'Địa điểm chưa có bài thuyết minh để liên kết mã QR.' });
            }
            narrationId = narrationResult.recordset[0].NarrationId;
        }
        const result = await pool.request().input('narrationId', sql.Int, narrationId)
            .input('label', sql.NVarChar(200), label)
            .query(`
                INSERT INTO dbo.QRCodes (NarrationId, Label, IsActive)
                OUTPUT INSERTED.QRCodeId, INSERTED.Code
                VALUES (@narrationId, @label, 1)
            `);
        return res.status(201).json({ qr: { id: String(result.recordset[0].QRCodeId), code: result.recordset[0].Code, narrationId: String(narrationId), label } });
    } catch (error) {
        console.error('QR creation failed:', error);
        return res.status(500).json({ message: 'Không thể lưu mã QR vào database.' });
    }
});

app.delete('/api/admin/qrs/:id', async (req, res) => {
    if (!getCurrentSession(req)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    try {
        const pool = await getPool();
        const result = await pool.request().input('id', sql.Int, Number(req.params.id))
            .query('DELETE FROM dbo.QRCodes OUTPUT DELETED.QRCodeId WHERE QRCodeId = @id');
        return result.recordset.length ? res.sendStatus(204) : res.status(404).json({ message: 'Không tìm thấy mã QR.' });
    } catch (error) {
        console.error('QR deletion failed:', error);
        return res.status(500).json({ message: 'Không thể xóa mã QR khỏi database.' });
    }
});

app.get('/api/qr/resolve', async (req, res) => {
    const rawCode = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const value = rawCode.startsWith('SGECHO:') ? rawCode.slice(7) : rawCode;
    if (!value) return res.status(400).json({ message: 'Mã QR không hợp lệ.' });
    try {
        const pool = await getPool();
        await ensurePlaceVisibilityColumn(pool);
        await ensureNarrationVisibilityColumn(pool);
        await ensureDefaultPlaceImages(pool);
        const result = await pool.request().input('place', sql.NVarChar(100), value).query(`
            SELECT p.PlaceId, p.Slug, p.PlaceName, p.Address,
                   p.IsVisible, cover.ImageUrl, c.CategoryName, n.LanguageCode, n.Content
            FROM dbo.Places p
            INNER JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
            LEFT JOIN dbo.Narrations n ON n.PlaceId = p.PlaceId AND n.IsVisible = 1
            LEFT JOIN dbo.QRCodes q ON q.NarrationId = n.NarrationId AND q.IsActive = 1
            OUTER APPLY (
                SELECT TOP (1) i.FileUrl AS ImageUrl
                FROM dbo.PlaceImages i
                WHERE i.PlaceId = p.PlaceId
                ORDER BY i.SortOrder, i.ImageId
            ) cover
            WHERE p.IsVisible = 1
              AND (
                  p.Slug = @place
                  OR CONVERT(NVARCHAR(100), p.PlaceId) = @place
                  OR CONVERT(NVARCHAR(100), q.Code) = @place
              )
            ORDER BY n.LanguageCode
        `);
        const first = result.recordset[0];
        if (!first) return res.status(404).json({ message: 'Không tìm thấy địa điểm từ mã QR.' });
        const place = {
            id: first.Slug || String(first.PlaceId),
            slug: first.Slug || String(first.PlaceId),
            name: first.PlaceName,
            address: first.Address || '',
            imageUrl: first.ImageUrl || '',
            visible: first.IsVisible,
            category: categoryValue(first.CategoryName),
            texts: {},
        };
        for (const row of result.recordset) {
            if (row.LanguageCode) place.texts[row.LanguageCode] = row.Content || '';
        }
        return res.json(place);
    } catch (error) {
        console.error('QR resolve failed:', error);
        return res.status(500).json({ message: 'Không thể xử lý mã QR.' });
    }
});

app.get('/api/user/favorites', async (req, res) => {
    const session = requireUser(req, res);
    if (!session) return;
    try {
        const pool = await getPool();
        await ensureUserDataTables(pool);
        const result = await pool.request().input('userId', sql.Int, session.user.id).query(`
            SELECT COALESCE(p.Slug, CONVERT(NVARCHAR(100), p.PlaceId)) AS placeId
            FROM dbo.UserFavorites f
            INNER JOIN dbo.Places p ON p.PlaceId = f.PlaceId
            WHERE f.UserId = @userId
        `);
        return res.json(result.recordset.map((row) => row.placeId));
    } catch (error) {
        console.error('Favorites query failed:', error);
        return res.status(500).json({ message: 'Không thể tải địa điểm yêu thích.' });
    }
});

app.put('/api/user/favorites/:placeId', async (req, res) => {
    const session = requireUser(req, res);
    if (!session) return;
    try {
        const pool = await getPool();
        await ensureUserDataTables(pool);
        const place = await resolvePlaceId(pool, req.params.placeId);
        if (!place) return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
        await pool.request().input('userId', sql.Int, session.user.id)
            .input('placeId', sql.Int, place.PlaceId)
            .query('INSERT INTO dbo.UserFavorites (UserId, PlaceId) VALUES (@userId, @placeId)');
        return res.sendStatus(204);
    } catch (error) {
        if (error.number === 2627 || error.number === 2601) return res.sendStatus(204);
        console.error('Favorite save failed:', error);
        return res.status(500).json({ message: 'Không thể lưu địa điểm yêu thích.' });
    }
});

app.delete('/api/user/favorites/:placeId', async (req, res) => {
    const session = requireUser(req, res);
    if (!session) return;
    try {
        const pool = await getPool();
        await ensureUserDataTables(pool);
        const place = await resolvePlaceId(pool, req.params.placeId);
        if (!place) return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
        await pool.request().input('userId', sql.Int, session.user.id)
            .input('placeId', sql.Int, place.PlaceId)
            .query('DELETE FROM dbo.UserFavorites WHERE UserId = @userId AND PlaceId = @placeId');
        return res.sendStatus(204);
    } catch (error) {
        console.error('Favorite deletion failed:', error);
        return res.status(500).json({ message: 'Không thể bỏ địa điểm yêu thích.' });
    }
});

app.get('/api/user/history', async (req, res) => {
    const session = requireUser(req, res);
    if (!session) return;
    try {
        const pool = await getPool();
        await ensureUserDataTables(pool);
        const result = await pool.request().input('userId', sql.Int, session.user.id).query(`
            SELECT TOP (200) h.HistoryId, COALESCE(p.Slug, CONVERT(NVARCHAR(100), p.PlaceId)) AS placeId,
                   h.LanguageCode, h.OccurredAt
            FROM dbo.UserListeningHistory h
            INNER JOIN dbo.Places p ON p.PlaceId = h.PlaceId
            WHERE h.UserId = @userId
            ORDER BY h.OccurredAt DESC
        `);
        return res.json(result.recordset.map((row) => ({
            id: String(row.HistoryId),
            place_id: row.placeId,
            lang: row.LanguageCode,
            time: new Date(row.OccurredAt).toISOString(),
        })));
    } catch (error) {
        console.error('History query failed:', error);
        return res.status(500).json({ message: 'Không thể tải lịch sử nghe.' });
    }
});

app.post('/api/user/history', async (req, res) => {
    const session = requireUser(req, res);
    if (!session) return;
    const { placeId, lang } = req.body || {};
    if (typeof placeId !== 'string' || !['vi', 'en', 'ja', 'zh', 'ko'].includes(lang)) {
        return res.status(400).json({ message: 'Thông tin lịch sử nghe không hợp lệ.' });
    }
    try {
        const pool = await getPool();
        await ensureUserDataTables(pool);
        const place = await resolvePlaceId(pool, placeId);
        if (!place) return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
        await pool.request().input('userId', sql.Int, session.user.id)
            .input('placeId', sql.Int, place.PlaceId)
            .input('lang', sql.NVarChar(10), lang)
            .query('INSERT INTO dbo.UserListeningHistory (UserId, PlaceId, LanguageCode) VALUES (@userId, @placeId, @lang)');
        return res.sendStatus(204);
    } catch (error) {
        console.error('History save failed:', error);
        return res.status(500).json({ message: 'Không thể lưu lịch sử nghe.' });
    }
});

app.delete('/api/user/history', async (req, res) => {
    const session = requireUser(req, res);
    if (!session) return;
    try {
        const pool = await getPool();
        await ensureUserDataTables(pool);
        await pool.request().input('userId', sql.Int, session.user.id)
            .query('DELETE FROM dbo.UserListeningHistory WHERE UserId = @userId');
        return res.sendStatus(204);
    } catch (error) {
        console.error('History deletion failed:', error);
        return res.status(500).json({ message: 'Không thể xóa lịch sử nghe.' });
    }
});

app.get('/api/admin/narrations', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }

    try {
        const pool = await getPool();
        await ensureNarrationVisibilityColumn(pool);
        const result = await pool.request().query(`
            SELECT p.PlaceId, p.Slug, p.PlaceName,
                   n.NarrationId, n.LanguageCode, n.Title, n.Content, n.IsVisible
            FROM dbo.Places p
            LEFT JOIN dbo.Narrations n ON n.PlaceId = p.PlaceId
            ORDER BY p.PlaceName, n.LanguageCode
        `);

        const places = new Map();
        const narrations = [];
        for (const row of result.recordset) {
            const locationId = row.Slug || String(row.PlaceId);
            if (!places.has(locationId)) {
                places.set(locationId, {
                    id: locationId,
                    name: row.PlaceName,
                });
            }
            if (row.NarrationId != null) {
                narrations.push({
                    id: String(row.NarrationId),
                    locationId,
                    lang: row.LanguageCode,
                    title: row.Title,
                    summary: '',
                    text: row.Content,
                    visible: row.IsVisible,
                });
            }
        }

        return res.json({ places: [...places.values()], narrations });
    } catch (error) {
        console.error('Narrations query failed:', error);
        return res.status(500).json({
            message: 'Không thể tải nội dung thuyết minh từ database.',
        });
    }
});

app.post('/api/admin/narrations', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }

    const { locationId, lang, title, summary = '', text, visible = true } = req.body || {};
    if (
        typeof locationId !== 'string' ||
        !locationId.trim() ||
        locationId.length > 100 ||
        !['vi', 'en', 'ja'].includes(lang) ||
        typeof title !== 'string' ||
        !title.trim() ||
        title.length > 200 ||
        typeof summary !== 'string' ||
        summary.length > 1000 ||
        typeof text !== 'string' ||
        !text.trim() ||
        text.length > 15000 ||
        typeof visible !== 'boolean'
    ) {
        return res.status(400).json({ message: 'Thông tin bài thuyết minh không hợp lệ.' });
    }

    let transaction;
    try {
        const pool = await getPool();
        await ensureNarrationVisibilityColumn(pool);
        transaction = new sql.Transaction(pool);
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        const placeResult = await new sql.Request(transaction).input(
            'locationId',
            sql.NVarChar(100),
            locationId.trim(),
        ).query(`
                SELECT TOP (1) PlaceId
                FROM dbo.Places WITH (UPDLOCK, HOLDLOCK)
                WHERE (
                      Slug = @locationId
                      OR (Slug IS NULL AND CONVERT(NVARCHAR(100), PlaceId) = @locationId)
                  )
            `);
        const place = placeResult.recordset[0];
        if (!place) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Không tìm thấy địa điểm.' });
        }

        const duplicateResult = await new sql.Request(transaction)
            .input('placeId', sql.Int, place.PlaceId)
            .input('lang', sql.VarChar(10), lang).query(`
                SELECT TOP (1) NarrationId
                FROM dbo.Narrations WITH (UPDLOCK, HOLDLOCK)
                WHERE PlaceId = @placeId AND LanguageCode = @lang
            `);
        if (duplicateResult.recordset.length) {
            await transaction.rollback();
            return res.status(409).json({
                message: 'Địa điểm đã có nội dung bằng ngôn ngữ này.',
            });
        }

        const insertResult = await new sql.Request(transaction)
            .input('placeId', sql.Int, place.PlaceId)
            .input('lang', sql.VarChar(10), lang)
            .input('title', sql.NVarChar(200), title.trim())
            .input('text', sql.NVarChar(sql.MAX), text.trim())
            .input('visible', sql.Bit, visible)
            .query(`
                INSERT INTO dbo.Narrations (PlaceId, LanguageCode, Title, Content, IsVisible)
                OUTPUT INSERTED.NarrationId, INSERTED.IsVisible
                VALUES (@placeId, @lang, @title, @text, @visible)
            `);
        const narrationId = String(insertResult.recordset[0].NarrationId);
        await transaction.commit();
        return res.status(201).json({
            narration: {
                id: narrationId,
                locationId: locationId.trim(),
                lang,
                title: title.trim(),
                summary: summary.trim(),
                text: text.trim(),
                visible: insertResult.recordset[0].IsVisible,
            },
        });
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Narration transaction rollback failed:', rollbackError);
            }
        }
        console.error('Narration creation failed:', error);
        return res.status(500).json({
            message: 'Không thể lưu bài thuyết minh vào database.',
        });
    }
});

app.put('/api/admin/narrations/:id', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }

    const narrationId = Number(req.params.id);
    const { title, summary = '', text, visible } = req.body || {};
    if (
        !Number.isSafeInteger(narrationId) ||
        narrationId <= 0 ||
        typeof title !== 'string' ||
        !title.trim() ||
        title.length > 200 ||
        typeof summary !== 'string' ||
        summary.length > 1000 ||
        typeof text !== 'string' ||
        !text.trim() ||
        text.length > 15000 ||
        typeof visible !== 'boolean'
    ) {
        return res.status(400).json({ message: 'Thông tin bài thuyết minh không hợp lệ.' });
    }

    try {
        const pool = await getPool();
        await ensureNarrationVisibilityColumn(pool);
        const result = await pool
            .request()
            .input('id', sql.Int, narrationId)
            .input('title', sql.NVarChar(200), title.trim())
            .input('text', sql.NVarChar(sql.MAX), text.trim())
            .input('visible', sql.Bit, visible).query(`
                UPDATE dbo.Narrations
                SET Title = @title,
                    Content = @text,
                    IsVisible = @visible
                OUTPUT INSERTED.NarrationId, INSERTED.PlaceId, INSERTED.LanguageCode,
                       INSERTED.Title, INSERTED.Content, INSERTED.IsVisible
                WHERE NarrationId = @id
            `);
        const row = result.recordset[0];
        if (!row) return res.status(404).json({ message: 'Không tìm thấy bài thuyết minh.' });

        const placeResult = await pool
            .request()
            .input('placeId', sql.Int, row.PlaceId)
            .query('SELECT Slug FROM dbo.Places WHERE PlaceId = @placeId');
        return res.json({
            narration: {
                id: String(row.NarrationId),
                locationId: placeResult.recordset[0]?.Slug || String(row.PlaceId),
                lang: row.LanguageCode,
                title: row.Title,
                summary: '',
                text: row.Content,
                visible: row.IsVisible,
            },
        });
    } catch (error) {
        console.error('Narration update failed:', error);
        return res.status(500).json({
            message: 'Không thể cập nhật bài thuyết minh trong database.',
        });
    }
});

app.delete('/api/admin/narrations/:id', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }

    const narrationId = Number(req.params.id);
    if (!Number.isSafeInteger(narrationId) || narrationId <= 0) {
        return res.status(400).json({ message: 'Mã bài thuyết minh không hợp lệ.' });
    }

    let transaction;
    try {
        transaction = new sql.Transaction(await getPool());
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const narrationResult = await new sql.Request(transaction).input('id', sql.Int, narrationId)
            .query(`
                SELECT NarrationId
                FROM dbo.Narrations WITH (UPDLOCK, HOLDLOCK)
                WHERE NarrationId = @id
            `);
        if (!narrationResult.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Không tìm thấy bài thuyết minh.' });
        }

        const references = await new sql.Request(transaction).input('id', sql.Int, narrationId)
            .query(`
                SELECT
                    (SELECT COUNT_BIG(*) FROM dbo.AudioFiles WHERE NarrationId = @id) AS AudioCount,
                    (SELECT COUNT_BIG(*) FROM dbo.UsageEvents WHERE NarrationId = @id) AS EventCount
            `);
        const { AudioCount, EventCount } = references.recordset[0];
        if (AudioCount > 0 || EventCount > 0) {
            await transaction.rollback();
            return res.status(409).json({
                message:
                    'Không thể xóa bài thuyết minh đang được âm thanh hoặc lịch sử sử dụng tham chiếu.',
            });
        }

        await new sql.Request(transaction)
            .input('id', sql.Int, narrationId)
            .query('DELETE FROM dbo.Narrations WHERE NarrationId = @id');
        await transaction.commit();
        return res.sendStatus(204);
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Narration deletion rollback failed:', rollbackError);
            }
        }
        console.error('Narration deletion failed:', error);
        return res.status(500).json({
            message: 'Không thể xóa bài thuyết minh khỏi database.',
        });
    }
});

app.get('/api/admin/dashboard', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const today = new Date().toISOString().slice(0, 10);
    const defaultFrom = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    const from = req.query.from || defaultFrom;
    const to = req.query.to || today;
    const parsedFrom = new Date(`${from}T00:00:00.000Z`);
    const parsedTo = new Date(`${to}T00:00:00.000Z`);
    if (
        typeof from !== 'string' ||
        typeof to !== 'string' ||
        !datePattern.test(from) ||
        !datePattern.test(to) ||
        Number.isNaN(parsedFrom.getTime()) ||
        Number.isNaN(parsedTo.getTime()) ||
        parsedFrom.toISOString().slice(0, 10) !== from ||
        parsedTo.toISOString().slice(0, 10) !== to ||
        parsedFrom > parsedTo
    ) {
        return res.status(400).json({ message: 'Khoảng ngày thống kê không hợp lệ.' });
    }
    const rangeDays = Math.floor((parsedTo - parsedFrom) / (24 * 60 * 60 * 1000)) + 1;
    if (rangeDays > 366) {
        return res.status(400).json({ message: 'Khoảng ngày thống kê tối đa là 366 ngày.' });
    }

    try {
        const pool = await getPool();
        const fromDate = new Date(`${from}T00:00:00.000Z`);
        const toDate = new Date(`${to}T00:00:00.000Z`);
        const [placeResult, narrationResult, visitResult, languageResult, usageResult] =
            await Promise.all([
                pool.request().query(`
                SELECT p.PlaceId, p.Slug, p.PlaceName, p.Address,
                       n.LanguageCode
                FROM dbo.Places p
                LEFT JOIN dbo.Narrations n
                    ON n.PlaceId = p.PlaceId
                ORDER BY p.PlaceId, n.LanguageCode
            `),
                pool.request().query(`
                SELECT COUNT_BIG(*) AS NarrationCount
                FROM dbo.Narrations
            `),
                pool
                    .request()
                    .input('fromDate', sql.Date, fromDate)
                    .input('toDate', sql.Date, toDate).query(`
                SELECT CONVERT(CHAR(10), CONVERT(DATE, StartedAt), 23) AS [date],
                       COUNT_BIG(*) AS total
                FROM dbo.VisitorSessions
                WHERE StartedAt >= @fromDate
                  AND StartedAt < DATEADD(DAY, 1, @toDate)
                GROUP BY CONVERT(DATE, StartedAt)
                ORDER BY CONVERT(DATE, StartedAt)
            `),
                pool
                    .request()
                    .input('fromDate', sql.Date, fromDate)
                    .input('toDate', sql.Date, toDate).query(`
                SELECT l.LanguageCode AS code, l.LanguageName AS name,
                        COUNT_BIG(e.EventId) AS uses
                FROM dbo.Languages l
                LEFT JOIN dbo.Narrations n ON n.LanguageCode = l.LanguageCode
                LEFT JOIN dbo.UsageEvents e
                    ON e.NarrationId = n.NarrationId
                    AND e.EventType = 'VIEW'
                    AND e.CreatedAt >= @fromDate
                    AND e.CreatedAt < DATEADD(DAY, 1, @toDate)
                GROUP BY l.LanguageCode, l.LanguageName
                ORDER BY l.LanguageName
            `),
                pool
                    .request()
                    .input('fromDate', sql.Date, fromDate)
                    .input('toDate', sql.Date, toDate).query(`
                SELECT n.PlaceId, COUNT_BIG(*) AS uses
                FROM dbo.UsageEvents e
                INNER JOIN dbo.Narrations n ON n.NarrationId = e.NarrationId
                WHERE e.EventType = 'VIEW'
                  AND e.CreatedAt >= @fromDate
                  AND e.CreatedAt < DATEADD(DAY, 1, @toDate)
                GROUP BY n.PlaceId
            `),
            ]);

        const placesById = new Map();
        const placeKeyByDbId = new Map();
        for (const row of placeResult.recordset) {
            const id = row.Slug || String(row.PlaceId);
            placeKeyByDbId.set(row.PlaceId, id);
            if (!placesById.has(id)) {
                placesById.set(id, {
                    id,
                    name: row.PlaceName,
                    address: row.Address,
                    published: true,
                    languages: [],
                    uses: 0,
                });
            }
            if (row.LanguageCode && !placesById.get(id).languages.includes(row.LanguageCode))
                placesById.get(id).languages.push(row.LanguageCode);
        }

        const placesByKey = new Map(
            [...placesById.values()].map((place) => [place.id, place]),
        );
        for (const row of usageResult.recordset) {
            const place = placesByKey.get(placeKeyByDbId.get(row.PlaceId));
            if (place) place.uses = Number(row.uses);
        }

        const places = [...placesById.values()].sort(
            (left, right) => right.uses - left.uses || left.name.localeCompare(right.name, 'vi'),
        );
        const totalUses = Number(
            usageResult.recordset.reduce((sum, place) => sum + Number(place.uses), 0),
        );
        const visitsByDate = new Map(
            visitResult.recordset.map((row) => [row.date, Number(row.total)]),
        );
        const dailyVisits = Array.from({ length: rangeDays }, (_, index) => {
            const date = new Date(fromDate.getTime() + index * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);
            return { date, total: visitsByDate.get(date) || 0 };
        });
        const languageUsage = languageResult.recordset.map((row) => ({
            code: row.code,
            name: row.name,
            uses: Number(row.uses),
        }));

        return res.json({
            range: { from, to },
            totals: {
                visits: Number(dailyVisits.reduce((sum, day) => sum + day.total, 0)),
                narrationUses: totalUses,
                places: places.length,
                visiblePlaces: places.filter((place) => place.published).length,
                hiddenPlaces: places.filter((place) => !place.published).length,
                narrations: Number(narrationResult.recordset[0].NarrationCount),
            },
            dailyVisits,
            languageUsage,
            places: places.map((place) => ({
                ...place,
                share: totalUses ? (place.uses / totalUses) * 100 : 0,
            })),
        });
    } catch (error) {
        console.error('Dashboard query failed:', error);
        return res.status(500).json({
            message:
                'Không thể tải thống kê từ database. Kiểm tra các bảng Places, Narrations, Languages, VisitorSessions và UsageEvents.',
        });
    }
});

app.use((_req, res) => {
    res.status(404).json({ message: 'Không tìm thấy endpoint.' });
});

app.use((error, _req, res, _next) => {
    console.error('Backend request failed:', error);
    const status = error.status === 400 ? 400 : 500;
    res.status(status).json({
        message: status === 400 ? 'Request JSON không hợp lệ.' : 'Lỗi nội bộ của backend.',
    });
});

const server = app.listen(port, () => {
    console.log(`Sài Gòn Echo API đang chạy tại http://localhost:${port}`);
    console.log(`SQL Server được kiểm tra tại http://localhost:${port}/api/health/db`);
});

async function shutdown() {
    server.close(async (error) => {
        if (error) {
            console.error('Không thể dừng HTTP server sạch sẽ:', error);
            process.exitCode = 1;
        }
        try {
            await closePool();
        } catch (poolError) {
            console.error('Không thể đóng SQL Server connection pool:', poolError);
            process.exitCode = 1;
        }
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
