import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
    const salt = randomBytes(16);
    const derivedKey = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
    const [algorithm, saltHex, keyHex] = String(storedHash).split('$');
    if (
        algorithm !== 'scrypt' ||
        !/^[\da-f]{32}$/i.test(saltHex || '') ||
        !/^[\da-f]{128}$/i.test(keyHex || '')
    ) {
        return false;
    }

    const expected = Buffer.from(keyHex, 'hex');
    const actual = await scrypt(
        password,
        Buffer.from(saltHex, 'hex'),
        expected.length,
        SCRYPT_OPTIONS,
    );
    return timingSafeEqual(expected, actual);
}
