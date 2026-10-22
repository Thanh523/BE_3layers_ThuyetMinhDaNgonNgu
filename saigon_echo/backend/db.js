import dotenv from 'dotenv';
import sql from 'mssql';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') });
export { default as sql } from 'mssql';

const required = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];

function envBoolean(name, defaultValue) {
    const value = process.env[name];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
}

const config = {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeout: 15000,
    requestTimeout: 15000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
    options: {
        encrypt: envBoolean('DB_ENCRYPT', true),
        trustServerCertificate: envBoolean('DB_TRUST_SERVER_CERTIFICATE', false),
    },
};

let poolPromise;

export function getPool() {
    if (!poolPromise) {
        const missing = required.filter((key) => !process.env[key]);
        if (missing.length) {
            throw new Error(`Thiếu biến môi trường SQL Server: ${missing.join(', ')}`);
        }
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = undefined;
            throw error;
        });
    }
    return poolPromise;
}

export async function closePool() {
    if (!poolPromise) return;
    const pool = await poolPromise;
    await pool.close();
    poolPromise = undefined;
}
