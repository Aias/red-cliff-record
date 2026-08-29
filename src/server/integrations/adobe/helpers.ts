/**
 * Adobe requires an api_key query parameter to download renditions from a
 * publicly shared album anonymously; the album JSON endpoint itself does not.
 * LightroomWebApp is the key the Lightroom web client sends.
 */
export const withLightroomApiKey = (url: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}api_key=LightroomWebApp`;
