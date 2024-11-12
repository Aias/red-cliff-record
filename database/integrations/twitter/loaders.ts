import { readFileSync } from 'fs';
import { resolve } from 'path/posix';
import type { TwitterBookmarksArray } from './types';


export async function loadBookmarksData(): Promise<TwitterBookmarksArray> {
	const defaultPath = resolve(process.cwd(), '.temp/bookmark-responses.json');
	try {
		const data = readFileSync(defaultPath, 'utf-8');
		return JSON.parse(data);
	} catch (err) {
		console.error('Error loading Twitter bookmarks data:', err);
		throw err;
	}
}
