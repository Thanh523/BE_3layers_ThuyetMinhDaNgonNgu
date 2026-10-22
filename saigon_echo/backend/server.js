import dotenv from 'dotenv';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getPool, sql } from './db.js';
import { verifyPassword } from './passwords.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') });

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SESSION_TTL_MS = 30 * 1000;
const sessions = new Map();
const SESSION_COOKIE = 'saigon-echo-admin-session';

function cookieOptions(maxAge) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        path: '/api/admin',
        ...(maxAge ? { maxAge } : {}),
    };
}

function getSessionToken(req) {
    const cookie = req.headers.cookie
        ?.split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
    const token = cookie?.slice(SESSION_COOKIE.length + 1);
    return token && /^[\da-f]{64}$/i.test(token) ? token : null;
}

function getCurrentSession(req) {
    const token = getSessionToken(req);
    const session = token ? sessions.get(token) : null;
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return { token, ...session };
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
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'saigon-echo-admin-backend' });
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
        const result = await pool.request().input('username', sql.NVarChar(50), username.trim())
            .query(`
                SELECT TOP (1) AdminId, Username, FullName, PasswordHash, Role, IsActive
                FROM dbo.AdminAccounts
                WHERE Username = @username
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
            name: account.FullName,
            username: account.Username,
            role: 'admin',
        };
        await pool
            .request()
            .input('adminId', sql.Int, account.AdminId)
            .query(
                'UPDATE dbo.AdminAccounts SET LastLoginAt = SYSUTCDATETIME() WHERE AdminId = @adminId',
            );
        sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
        res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS));
        return res.json({ user });
    } catch (error) {
        console.error('Admin login failed:', error);
        return res.status(500).json({
            message: 'Không thể đăng nhập. Kiểm tra kết nối và cấu trúc dbo.AdminAccounts.',
        });
    }
});

app.get('/api/admin/auth/me', (req, res) => {
    const session = getCurrentSession(req);
    if (!session) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    return res.json({ user: session.user });
});

app.post('/api/admin/auth/activity', (req, res) => {
    const session = getCurrentSession(req);
    if (!session) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });

    const expiresAt = Date.now() + SESSION_TTL_MS;
    sessions.set(session.token, { user: session.user, expiresAt });
    res.cookie(SESSION_COOKIE, session.token, cookieOptions(SESSION_TTL_MS));
    return res.sendStatus(204);
});

app.post('/api/admin/auth/logout', (req, res) => {
    const session = getCurrentSession(req);
    if (session) sessions.delete(session.token);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    return res.sendStatus(204);
});

app.get('/api/admin/narrations', async (req, res) => {
    if (!getCurrentSession(req)) {
        return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' });
    }

    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT p.PlaceId, p.Slug, p.PlaceName,
                   n.NarrationId, n.LanguageCode, n.Title, n.Summary, n.Content, n.Status
            FROM dbo.Places p
            LEFT JOIN dbo.Narrations n ON n.PlaceId = p.PlaceId
            WHERE p.DeletedAt IS NULL
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
                    summary: row.Summary || '',
                    text: row.Content,
                    visible: row.Status === 'PUBLISHED',
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
        transaction = new sql.Transaction(pool);
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        const placeResult = await new sql.Request(transaction).input(
            'locationId',
            sql.NVarChar(100),
            locationId.trim(),
        ).query(`
                SELECT TOP (1) PlaceId
                FROM dbo.Places WITH (UPDLOCK, HOLDLOCK)
                WHERE DeletedAt IS NULL
                  AND (
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
            .input('summary', sql.NVarChar(1000), summary.trim() || null)
            .input('text', sql.NVarChar(sql.MAX), text.trim())
            .input('status', sql.VarChar(20), visible ? 'PUBLISHED' : 'DRAFT').query(`
                INSERT INTO dbo.Narrations (PlaceId, LanguageCode, Title, Summary, Content, Status)
                OUTPUT INSERTED.NarrationId, INSERTED.Status
                VALUES (@placeId, @lang, @title, @summary, @text, @status)
            `);
        const narrationId = String(insertResult.recordset[0].NarrationId);
        const status = insertResult.recordset[0].Status;
        await transaction.commit();
        return res.status(201).json({
            narration: {
                id: narrationId,
                locationId: locationId.trim(),
                lang,
                title: title.trim(),
                summary: summary.trim(),
                text: text.trim(),
                visible: status === 'PUBLISHED',
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
        const result = await pool
            .request()
            .input('id', sql.Int, narrationId)
            .input('title', sql.NVarChar(200), title.trim())
            .input('summary', sql.NVarChar(1000), summary.trim() || null)
            .input('text', sql.NVarChar(sql.MAX), text.trim())
            .input('status', sql.VarChar(20), visible ? 'PUBLISHED' : 'DRAFT').query(`
                UPDATE dbo.Narrations
                SET Title = @title,
                    Summary = @summary,
                    Content = @text,
                    Status = @status,
                    UpdatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.NarrationId, INSERTED.PlaceId, INSERTED.LanguageCode,
                       INSERTED.Title, INSERTED.Summary, INSERTED.Content, INSERTED.Status
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
                summary: row.Summary || '',
                text: row.Content,
                visible: row.Status === 'PUBLISHED',
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
                    'Không thể xóa bài thuyết minh đang được âm thanh hoặc lịch sử sử dụng tham chiếu. Hãy ẩn bài thay vì xóa.',
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
                SELECT p.PlaceId, p.Slug, p.PlaceName, p.Address, p.IsVisible,
                       n.LanguageCode
                FROM dbo.Places p
                LEFT JOIN dbo.Narrations n
                    ON n.PlaceId = p.PlaceId
                WHERE p.DeletedAt IS NULL
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
                   AND e.EventType = 'PLAY'
                   AND e.OccurredAt >= @fromDate
                   AND e.OccurredAt < DATEADD(DAY, 1, @toDate)
                WHERE l.IsActive = 1 OR e.EventId IS NOT NULL
                GROUP BY l.LanguageCode, l.LanguageName
                ORDER BY l.LanguageName
            `),
                pool
                    .request()
                    .input('fromDate', sql.Date, fromDate)
                    .input('toDate', sql.Date, toDate).query(`
                SELECT e.PlaceId, COUNT_BIG(*) AS uses
                FROM dbo.UsageEvents e
                WHERE e.EventType = 'PLAY'
                  AND e.OccurredAt >= @fromDate
                  AND e.OccurredAt < DATEADD(DAY, 1, @toDate)
                GROUP BY e.PlaceId
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
                    published: Boolean(row.IsVisible),
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
