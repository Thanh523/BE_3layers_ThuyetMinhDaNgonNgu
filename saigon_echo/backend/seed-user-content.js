import fs from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { getPool, sql } from './db.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') });

const source = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    'CNPM',
    'user',
    'backend',
    'seed.json',
);

const categoryNames = {
    historyCat: 'Lịch sử',
    architecture: 'Kiến trúc',
    culture: 'Văn hóa',
    river: 'Sông nước',
};

const languageNames = {
    vi: 'Tiếng Việt',
    en: 'English',
    ja: '日本語',
    zh: '中文',
    ko: '한국어',
};

const imageNames = {
    'dinh-doc-lap': 'ddl.jpg',
    'buu-dien': 'buu_dien.jpg',
    'cho-ben-thanh': 'ben_thanh_2.jpg',
    'nha-hat': 'nha-hat.jpg',
    'nguyen-hue': 'nguyen-hue.jpg',
    'bach-dang': 'bach_dang.jpg',
    'bao-tang-chung-tich-chien-tranh': 'bao-tang-chung-tich-chien-tranh.jpg',
    'landmark-81': 'landmark-81.jpg',
    'chua-ngoc-hoang': 'chua-ngoc-hoang.jpg',
};

async function findOrCreateCategory(pool, name) {
    const result = await pool.request().input('name', sql.NVarChar(100), name).query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryName = @name)
            INSERT INTO dbo.Categories (CategoryName, Description) VALUES (@name, @name);
        SELECT TOP (1) CategoryId FROM dbo.Categories WHERE CategoryName = @name;
    `);
    return result.recordset[0].CategoryId;
}

async function seed() {
    const places = JSON.parse(await fs.readFile(source, 'utf8'));
    const pool = await getPool();

    for (const place of places) {
        const categoryId = await findOrCreateCategory(pool, categoryNames[place.category] || place.category);
        const placeResult = await pool.request()
            .input('slug', sql.VarChar(200), place.id)
            .input('name', sql.NVarChar(200), place.name)
            .input('address', sql.NVarChar(300), place.address)
            .input('categoryId', sql.Int, categoryId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM dbo.Places WHERE Slug = @slug)
                    INSERT INTO dbo.Places (CategoryId, PlaceName, Slug, Address)
                    VALUES (@categoryId, @name, @slug, @address);
                ELSE
                    UPDATE dbo.Places
                    SET CategoryId = @categoryId, PlaceName = @name, Address = @address
                    WHERE Slug = @slug;
                SELECT TOP (1) PlaceId FROM dbo.Places WHERE Slug = @slug;
            `);
        const placeId = placeResult.recordset[0].PlaceId;

        for (const [code, content] of Object.entries(place.texts || {})) {
            const languageName = languageNames[code] || code;
            await pool.request()
                .input('code', sql.VarChar(10), code)
                .input('languageName', sql.NVarChar(50), languageName)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM dbo.Languages WHERE LanguageCode = @code)
                        INSERT INTO dbo.Languages (LanguageCode, LanguageName)
                        VALUES (@code, @languageName);
                `);
            await pool.request()
                .input('placeId', sql.Int, placeId)
                .input('code', sql.VarChar(10), code)
                .input('title', sql.NVarChar(200), place.name)
                .input('content', sql.NVarChar(sql.MAX), content)
                .query(`
                    IF EXISTS (
                        SELECT 1 FROM dbo.Narrations
                        WHERE PlaceId = @placeId AND LanguageCode = @code
                    )
                        UPDATE dbo.Narrations
                        SET Title = @title, Content = @content
                        WHERE PlaceId = @placeId AND LanguageCode = @code;
                    ELSE
                        INSERT INTO dbo.Narrations (PlaceId, LanguageCode, Title, Content)
                        VALUES (@placeId, @code, @title, @content);
                `);
        }

        const imageName = imageNames[place.id];
        if (imageName) {
            const fileUrl = `/user-images/${imageName}`;
            await pool.request()
                .input('placeId', sql.Int, placeId)
                .input('fileUrl', sql.NVarChar(1000), fileUrl)
                .query(`
                    IF NOT EXISTS (
                        SELECT 1 FROM dbo.PlaceImages
                        WHERE PlaceId = @placeId AND FileUrl = @fileUrl
                    )
                        INSERT INTO dbo.PlaceImages (PlaceId, FileUrl, SortOrder)
                        VALUES (@placeId, @fileUrl, 1);
                `);
        }

        const narrationResult = await pool.request()
            .input('placeId', sql.Int, placeId)
            .query(`
                SELECT TOP (1) NarrationId
                FROM dbo.Narrations
                WHERE PlaceId = @placeId AND LanguageCode = 'vi'
                ORDER BY NarrationId;
            `);
        const narrationId = narrationResult.recordset[0]?.NarrationId;
        if (narrationId) {
            await pool.request()
                .input('narrationId', sql.Int, narrationId)
                .input('label', sql.NVarChar(100), place.name)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM dbo.QRCodes WHERE NarrationId = @narrationId)
                        INSERT INTO dbo.QRCodes (NarrationId, Code, Label, IsActive)
                        VALUES (@narrationId, NEWID(), @label, 1);
                `);
        }
        console.log(`Seeded: ${place.name}`);
    }

    const counts = await pool.request().query(`
        SELECT
            (SELECT COUNT(*) FROM dbo.Places) AS Places,
            (SELECT COUNT(*) FROM dbo.Narrations) AS Narrations,
            (SELECT COUNT(*) FROM dbo.PlaceImages) AS Images,
            (SELECT COUNT(*) FROM dbo.QRCodes) AS QRCodes;
    `);
    console.log('Seed complete:', counts.recordset[0]);
    await pool.close();
}

seed().catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
});
