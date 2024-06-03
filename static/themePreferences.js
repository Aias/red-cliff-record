// Adapted from:
// https://chriscoyier.net/2023/01/19/dark-mode-via-a-smallish-script-in-the-head-avoiding-fart/

const MODE_COOKIE = 'barnsworthburning-mode';
const MODES = {
	AUTO: 'auto',
	DARK: 'dark',
	LIGHT: 'light'
};

const DEFAULT_MODE = MODES.AUTO;

const CHROMA_COOKIE = 'barnsworthburning-chroma';
const CHROMA = {
	NEUTRAL: 'neutral',
	CHROMATIC: 'chromatic'
};
const DEFAULT_CHROMA = CHROMA.NEUTRAL;

const PALETTE_COOKIE = 'barnsworthburning-palette';
const DEFAULT_PALETTE = 'gold';

function getCookie(name) {
	let cookieArr = document.cookie.split(';');
	for (let i = 0; i < cookieArr.length; i++) {
		let cookiePair = cookieArr[i].split('=').map((cookie) => cookie.trim());

		if (name == cookiePair[0]) {
			return decodeURIComponent(cookiePair[1]);
		}
	}
	// Return null if the cookie by name does not exist
	return null;
}

const siteModePreference = getCookie(MODE_COOKIE);
const siteChromaPreference = getCookie(CHROMA_COOKIE);
const sitePalettePreference = getCookie(PALETTE_COOKIE);

if (siteModePreference) {
	document.documentElement.classList.add(siteModePreference);
} else {
	document.documentElement.classList.add(DEFAULT_MODE);
}

if (siteChromaPreference) {
	document.documentElement.classList.add(siteChromaPreference);
} else {
	document.documentElement.classList.add(DEFAULT_CHROMA);
}

if (sitePalettePreference) {
	document.documentElement.classList.add(sitePalettePreference);
} else {
	document.documentElement.classList.add(DEFAULT_PALETTE);
}
