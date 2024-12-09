import { IntegrationType } from '../../operations';
import { runIntegration } from '../../utils/run-integration';
import { syncGitHubStars } from './sync-stars';
import { syncGitHubCommits } from './sync-commits';
import { updatePartialUsers } from './sync-users';

const main = async () => {
	try {
		await runIntegration(IntegrationType.enum.github, syncGitHubStars);
		await runIntegration(IntegrationType.enum.github, syncGitHubCommits);
		await updatePartialUsers();

		process.exit(0);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { main as syncGitHubStars };
