import { db } from './db';
import { integrations, IntegrationType } from './schema';

async function seedIntegrations() {
	try {
		// Delete existing records to avoid duplicates
		await db.delete(integrations);

		// Insert one row for each integration type
		const integrationsData = [
			{
				type: IntegrationType.BROWSER_HISTORY,
				description:
					'Imports web browsing history from Arc, capturing visited URLs, page titles, visit durations, and search patterns. Other browsers may be supported in the future.'
			},
			{
				type: IntegrationType.AIRTABLE,
				description:
					'Imports data from the barnsworthburning Airtable base. Includes extracts, creators, and spaces.'
			},
			{
				type: IntegrationType.AI_CHAT,
				description:
					'Collects conversation history from AI chat platforms Perplexity, Claude, ChatGPT, and others.'
			},
			{
				type: IntegrationType.RAINDROP,
				description:
					'Imports bookmarks and saved articles from Raindrop.io, including tags, collections, and highlights'
			}
		];

		const result = await db.insert(integrations).values(integrationsData);

		console.log('Successfully seeded integrations table');
		console.log('Inserted rows:', result);
	} catch (error) {
		console.error('Error seeding integrations:', error);
		throw error;
	}
}

// Run the seed function
seedIntegrations().catch((error) => {
	console.error('Failed to seed database:', error);
	process.exit(1);
});
