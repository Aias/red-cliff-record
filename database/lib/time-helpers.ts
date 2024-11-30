// Calculate seconds between Chrome epoch and Unix epoch
export const CHROME_EPOCH_TO_UNIX_SECONDS =
	Math.floor(Date.UTC(1970, 0, 1) - Date.UTC(1601, 0, 1)) / 1000;

export const chromeEpochMicrosecondsToDatetime = (
	chromeEpochMicroseconds: number | bigint
): Date => {
	return new Date(
		(Number(chromeEpochMicroseconds) / 1000000 - CHROME_EPOCH_TO_UNIX_SECONDS) * 1000
	);
};

export const datetimeToChromeEpochMicroseconds = (datetime: Date): bigint => {
	return BigInt(datetime.getTime() * 1000 + CHROME_EPOCH_TO_UNIX_SECONDS * 1000000);
};
