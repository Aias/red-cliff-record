import { runIntegration } from '../common/run-integration';
import { syncGitHubCommits } from './sync-commits';
import { syncGitHubStars } from './sync-stars';
import { updatePartialUsers } from './sync-users';

async function syncGitHubData(): Promise<void> {
	try {
		await runIntegration('github', syncGitHubStars);
		await runIntegration('github', syncGitHubCommits);
		await updatePartialUsers();
	} catch (err) {
		console.error('Error syncing GitHub data:', err);
		throw err;
	}
}

const main = async () => {
	try {
		await syncGitHubData();
		process.exit(0);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { syncGitHubData };
