import { eq, isNull } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import {
	airtableCreators,
	airtableExtracts,
	airtableSpaces,
	type AirtableCreatorSelect,
	type AirtableExtractSelect,
	type AirtableSpaceSelect,
} from '~/server/db/schema/integrations/airtable';
import { createEmbedding, type EmbeddingType } from '~/server/services/ai/create-embedding';

type CreatorWithExtracts = AirtableCreatorSelect & {
	creatorExtracts?: {
		extract: Pick<AirtableExtractSelect, 'title'>;
	}[];
};

type SpaceWithExtracts = AirtableSpaceSelect & {
	spaceExtracts?: {
		extract: Pick<AirtableExtractSelect, 'title'>;
	}[];
};

type ExtractWithRelations = AirtableExtractSelect & {
	extractCreators?: {
		creator: Pick<AirtableCreatorSelect, 'name'>;
	}[];
	extractSpaces?: {
		space: Pick<AirtableSpaceSelect, 'name'>;
	}[];
};

// Creator implementation
class AirtableCreator implements EmbeddingType {
	constructor(private creator: CreatorWithExtracts) {}

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
class AirtableSpace implements EmbeddingType {
	constructor(private space: SpaceWithExtracts) {}

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
class AirtableExtract implements EmbeddingType {
	constructor(private extract: ExtractWithRelations) {}

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

// Fetch and update functions
async function updateCreatorEmbeddings() {
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
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const creator of creators) {
		const embeddingText = new AirtableCreator(creator).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db.update(airtableCreators).set({ embedding }).where(eq(airtableCreators.id, creator.id));
		count++;
	}
	return count;
}

async function updateSpaceEmbeddings() {
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
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const space of spaces) {
		const embeddingText = new AirtableSpace(space).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db.update(airtableSpaces).set({ embedding }).where(eq(airtableSpaces.id, space.id));
		count++;
	}
	return count;
}

async function updateExtractEmbeddings() {
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
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const extract of extracts) {
		const embeddingText = new AirtableExtract(extract).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db.update(airtableExtracts).set({ embedding }).where(eq(airtableExtracts.id, extract.id));
		count++;
	}
	return count;
}

// Sync function
async function syncAirtableEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync creators
	totalCount += await updateCreatorEmbeddings();

	// Sync spaces
	totalCount += await updateSpaceEmbeddings();

	// Sync extracts
	totalCount += await updateExtractEmbeddings();

	return totalCount;
}

export { syncAirtableEmbeddings };
