export const toTitleCase = (str: string) => str.replace(/\b\w/g, (char) => char.toUpperCase());

export const formatNumber = (num: number) => new Intl.NumberFormat().format(Math.round(num));

export const formatTime = (date: Date | string) =>
	new Date(date).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
	});

export const formatISODate = (date: Date): string => date.toISOString().split('T')[0]!;
