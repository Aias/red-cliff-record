import { z } from 'zod';

export const toTitleCase = (str: string) => str.replace(/\b\w/g, (char) => char.toUpperCase());

export const formatNumber = (num: number) => new Intl.NumberFormat().format(Math.round(num));

export const formatTime = (date: Date | string) =>
	new Date(date).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
	});

export const formatISODate = (date: Date): string => date.toISOString().split('T')[0]!;

export const getArticle = (str: string) => (/^[aeiou]/i.test(str) ? 'an' : 'a');

export const formatCreatorDescription = (
	type: string,
	professions?: string[],
	nationalities?: string[]
) => {
	// Format nationalities if present (hyphenated, maintain case)
	const nationalityString = nationalities?.length ? nationalities.join('-') + ' ' : '';

	// Format professions if present (lowercase, proper comma/and formatting)
	const professionString = professions?.length
		? professions
				.map((p) => p.toLowerCase())
				.reduce((acc, curr, idx, arr) => {
					if (idx === 0) return curr;
					if (arr.length === 2) return `${acc} and ${curr}`;
					if (idx === arr.length - 1) return `${acc}, and ${curr}`;
					return `${acc}, ${curr}`;
				})
		: type.toLowerCase();

	// Use existing getArticle helper function
	const firstWord = nationalityString || professionString;
	const article = toTitleCase(getArticle(firstWord));

	return `${article} ${nationalityString}${professionString}.`;
};

const urlSchema = z.string().url();

export const validateAndFormatUrl = (url: string): string => {
	// Add https:// if no protocol is present
	const formattedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

	return urlSchema.parse(formattedUrl);
};
