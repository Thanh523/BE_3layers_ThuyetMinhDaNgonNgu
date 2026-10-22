import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { closePool, getPool, sql } from './db.js';
import { hashPassword } from './passwords.js';

function readHidden(prompt) {
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
        return Promise.reject(
            new Error('Chạy lệnh trong terminal tương tác để nhập mật khẩu an toàn.'),
        );
    }

    return new Promise((resolve, reject) => {
        let value = '';
        stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        function finish(error) {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            stdout.write('\n');
            if (error) reject(error);
            else resolve(value);
        }

        function onData(key) {
            if (key === '\u0003') {
                finish(new Error('Đã hủy.'));
            } else if (key === '\r' || key === '\n') {
                finish();
            } else if (key === '\u0008' || key === '\u007f') {
                if (value.length) {
                    value = value.slice(0, -1);
                    stdout.write('\b \b');
                }
            } else if (!/[\u0000-\u001f\u007f]/.test(key)) {
                value += key;
                stdout.write('*');
            }
        }

        stdin.on('data', onData);
    });
}

const terminal = readline.createInterface({ input: stdin, output: stdout });
let pool;

try {
    const username =
        (await terminal.question('Tài khoản admin cần khôi phục [admin]: ')).trim() || 'admin';
    if (username.length > 50) throw new Error('Tên đăng nhập tối đa 50 ký tự.');

    terminal.close();
    const password = await readHidden('Mật khẩu mới (ít nhất 12 ký tự): ');
    const confirmation = await readHidden('Nhập lại mật khẩu mới: ');
    if (password.length < 12) throw new Error('Mật khẩu phải có ít nhất 12 ký tự.');
    if (password !== confirmation) throw new Error('Hai mật khẩu không khớp.');

    const passwordHash = await hashPassword(password);
    pool = await getPool();
    const result = await pool
        .request()
        .input('username', sql.NVarChar(50), username)
        .input('passwordHash', sql.NVarChar(512), passwordHash).query(`
            UPDATE dbo.AdminAccounts
            SET PasswordHash = @passwordHash,
                IsActive = 1,
                UpdatedAt = SYSUTCDATETIME()
            WHERE Username = @username
              AND UPPER(Role) IN ('ADMIN', 'SUPER_ADMIN');
            SELECT @@ROWCOUNT AS affectedRows;
        `);

    if (result.recordset[0]?.affectedRows !== 1) {
        throw new Error(
            'Không tìm thấy đúng một tài khoản admin/super admin phù hợp; không có tài khoản nào được cập nhật.',
        );
    }
    console.log(`Đã đặt lại mật khẩu và bật tài khoản "${username}" trong dbo.AdminAccounts.`);
} catch (error) {
    console.error(`Không thể khôi phục tài khoản admin: ${error.message}`);
    process.exitCode = 1;
} finally {
    terminal.close();
    if (pool) await closePool();
}
