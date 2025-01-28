import { db } from '~/server/db/connections';
import {
	type airtableCreators,
	type airtableExtracts,
	type airtableSpaces,
} from '~/server/db/schema/integrations/airtable';
import { syncEmbeddings, type EmbeddableDocument } from '../common/embeddings';
import { runIntegration } from '../common/run-integration';

type CreatorWithExtracts = typeof airtableCreators.$inferSelect & {
	creatorExtracts?: {
		extract: Pick<typeof airtableExtracts.$inferSelect, 'title'>;
	}[];
};

type SpaceWithExtracts = typeof airtableSpaces.$inferSelect & {
	spaceExtracts?: {
		extract: Pick<typeof airtableExtracts.$inferSelect, 'title'>;
	}[];
};

type ExtractWithRelations = typeof airtableExtracts.$inferSelect & {
	extractCreators?: {
		creator: Pick<typeof airtableCreators.$inferSelect, 'name'>;
	}[];
	extractSpaces?: {
		space: Pick<typeof airtableSpaces.$inferSelect, 'name'>;
	}[];
};

// Creator implementation
class AirtableCreator implements EmbeddableDocument {
	constructor(private creator: CreatorWithExtracts) {}

	get id() {
		return this.creator.id;
	}

	get tableName() {
		return 'integrations.airtable_creators';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

	getEmbeddingText(): string {
		const textParts = [
			'# Creator',
			[
				`Name: ${this.creator.name || '—'}`,
				`Type: ${this.creator.type || '—'}`,
				`Primary Project: ${this.creator.primaryProject || '—'}`,
				`Website: ${this.creator.website || '—'}`,
				`Professions: ${this.creator.professions?.join(', ') || '—'}`,
				`Organizations: ${this.creator.organizations?.join(', ') || '—'}`,
				`Nationalities: ${this.creator.nationalities?.join(', ') || '—'}`,
			].join(' // '),
		];

		// Add linked extracts if they exist
		if (this.creator.creatorExtracts?.length) {
			textParts.push(
				'',
				'# Linked Extracts',
				...this.creator.creatorExtracts.map(({ extract }) => extract.title)
			);
		}

		return textParts.join('\n');
	}
}

// Space implementation
class AirtableSpace implements EmbeddableDocument {
	constructor(private space: SpaceWithExtracts) {}

	get id() {
		return this.space.id;
	}

	get tableName() {
		return 'integrations.airtable_spaces';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

	getEmbeddingText(): string {
		const textParts = [
			'# Space',
			[
				`Name: ${this.space.name || '—'}`,
				`Full Name: ${this.space.fullName || '—'}`,
				`Icon: ${this.space.icon || '—'}`,
			].join(' // '),
		];

		// Add linked extracts if they exist
		if (this.space.spaceExtracts?.length) {
			textParts.push(
				'',
				'# Linked Extracts',
				...this.space.spaceExtracts.map(({ extract }) => extract.title)
			);
		}

		return textParts.join('\n');
	}
}

// Extract implementation
class AirtableExtract implements EmbeddableDocument {
	constructor(private extract: ExtractWithRelations) {}

	get id() {
		return this.extract.id;
	}

	get tableName() {
		return 'integrations.airtable_extracts';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

	getEmbeddingText(): string {
		const textParts = [
			'# Extract',
			[
				`Title: ${this.extract.title || '—'}`,
				`Format: ${this.extract.format || '—'}`,
				`Source: ${this.extract.source || '—'}`,
				`Content: ${this.extract.content || '—'}`,
				`Notes: ${this.extract.notes || '—'}`,
				`Attachment Caption: ${this.extract.attachmentCaption || '—'}`,
			].join(' // '),
		];

		// Add linked creators if they exist
		if (this.extract.extractCreators?.length) {
			textParts.push(
				'',
				'# Linked Creators',
				...this.extract.extractCreators.map(({ creator }) => creator.name)
			);
		}

		// Add linked spaces if they exist
		if (this.extract.extractSpaces?.length) {
			textParts.push(
				'',
				'# Linked Spaces',
				...this.extract.extractSpaces.map(({ space }) => space.name)
			);
		}

		return textParts.join('\n');
	}
}

// Fetch functions
async function getCreatorsWithoutEmbeddings() {
	const creators = await db.query.airtableCreators.findMany({
		with: {
			creatorExtracts: {
				columns: {},
				with: {
					extract: {
						columns: {
							title: true,
						},
					},
				},
			},
		},
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return creators.map((creator) => new AirtableCreator(creator));
}

async function getSpacesWithoutEmbeddings() {
	const spaces = await db.query.airtableSpaces.findMany({
		with: {
			spaceExtracts: {
				columns: {},
				with: {
					extract: {
						columns: {
							title: true,
						},
					},
				},
			},
		},
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return spaces.map((space) => new AirtableSpace(space));
}

async function getExtractsWithoutEmbeddings() {
	const extracts = await db.query.airtableExtracts.findMany({
		with: {
			extractCreators: {
				columns: {},
				with: {
					creator: {
						columns: {
							name: true,
						},
					},
				},
			},
			extractSpaces: {
				columns: {},
				with: {
					space: {
						columns: {
							name: true,
						},
					},
				},
			},
		},
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return extracts.map((extract) => new AirtableExtract(extract));
}

// Sync functions
async function syncAirtableEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync creators
	totalCount += await syncEmbeddings(getCreatorsWithoutEmbeddings, 'airtable-creators');

	// Sync spaces
	totalCount += await syncEmbeddings(getSpacesWithoutEmbeddings, 'airtable-spaces');

	// Sync extracts
	totalCount += await syncEmbeddings(getExtractsWithoutEmbeddings, 'airtable-extracts');

	return totalCount;
}

const main = async () => {
	try {
		await runIntegration('embeddings', syncAirtableEmbeddings);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./embeddings.ts')) {
	main();
}

export { syncAirtableEmbeddings };
