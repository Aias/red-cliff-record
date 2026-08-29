export const withLightroomApiKey = (url: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}api_key=LightroomWebApp`;
