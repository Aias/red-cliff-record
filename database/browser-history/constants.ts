import { join } from 'path';
import { homedir } from 'os';

// Path to Arc's History database (Mac OS Only)
export const dbPath = join(homedir(), 'Library/Application Support/Arc/User Data/Default/History');
export const dbCopyPath = join(
	homedir(),
	'Library/Application Support/Arc/User Data/Default/History-copy'
);
