import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { closePool, getPool, sql } from './db.js';
import { hashPassword } from './passwords.js';

function readHidden(prompt) {
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
        throw new Error('Hãy chạy lệnh này trực tiếp trong PowerShell hoặc Command Prompt.');
    }

    return new Promise((resolve, reject) => {
        let value = '';
        stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        const finish = (error) => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            stdout.write('\n');
            if (error) reject(error);
            else resolve(value);
        };

        const onData = (key) => {
            if (key === '\u0003') finish(new Error('Đã hủy.'));
            else if (key === '\r' || key === '\n') finish();
            else if (key === '\u0008' || key === '\u007f') value = value.slice(0, -1);
            else if (!/[\u0000-\u001f\u007f]/.test(key)) value += key;
        };

        stdin.on('data', onData);
    });
}

const terminal = readline.createInterface({ input: stdin, output: stdout });
let pool;

try {
    const username = (await terminal.question('Tên đăng nhập admin [admin]: ')).trim() || 'admin';
    const email = (await terminal.question(`Email admin [${username}@saigonecho.local]: `)).trim()
        || `${username}@saigonecho.local`;
    terminal.close();

    if (!/^[A-Za-z0-9_.-]{1,50}$/.test(username)) {
        throw new Error('Tên đăng nhập chỉ được chứa chữ cái không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
        throw new Error('Email admin không hợp lệ.');
    }

    const password = await readHidden('Mật khẩu mới (ít nhất 12 ký tự): ');
    const confirmation = await readHidden('Nhập lại mật khẩu mới: ');
    if (password.length < 12) throw new Error('Mật khẩu phải có ít nhất 12 ký tự.');
    if (password !== confirmation) throw new Error('Hai mật khẩu không khớp.');

    pool = await getPool();
    const passwordHash = await hashPassword(password);
    await pool.request()
        .input('username', sql.NVarChar(50), username)
        .input('email', sql.NVarChar(254), email.toLowerCase())
        .input('passwordHash', sql.NVarChar(512), passwordHash)
        .query(`
            MERGE dbo.AdminAccounts AS target
            USING (SELECT @username AS Username) AS source
            ON target.Username = source.Username
            WHEN MATCHED THEN
                UPDATE SET Email = @email,
                           PasswordHash = @passwordHash,
                           Role = 'SUPER_ADMIN',
                           IsActive = 1,
                           UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (Username, Email, PasswordHash, Role, IsActive, CreatedAt, UpdatedAt)
                VALUES (@username, @email, @passwordHash, 'SUPER_ADMIN', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
        `);
    console.log(`Đã tạo hoặc cập nhật tài khoản admin "${username}".`);
} catch (error) {
    console.error(`Không thể tạo tài khoản admin: ${error.message}`);
    process.exitCode = 1;
} finally {
    terminal.close();
    if (pool) await closePool();
}
