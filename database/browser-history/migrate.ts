import { sql } from 'drizzle-orm';
import { db } from './db';

const main = () => {
	const query = sql`SELECT url, title, visit_count from urls;`;
	const history = db.all(query);
	console.log(history);
};

main();
