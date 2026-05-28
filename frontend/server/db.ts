
import { join } from 'path';
import fs from 'fs';

const DB_PATH = join(process.cwd(), 'data', 'db.json');
const LOCK_FILE = join(process.cwd(), 'data', 'db.json.lock');

// Ensure database file exists
if (!fs.existsSync(join(process.cwd(), 'data'))) {
    fs.mkdirSync(join(process.cwd(), 'data'));
}
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
        anonymousTrialTrackers: [],
        users: [],
        merchantSessions: [],
        staffActivityLogs: [],
        staff: []
    }));
}

export const readDB = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

export const writeDB = (data: any) => {
    // Basic spin lock
    while (fs.existsSync(LOCK_FILE)) {
        // Wait
    }
    fs.writeFileSync(LOCK_FILE, 'locked');
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } finally {
        fs.unlinkSync(LOCK_FILE);
    }
};