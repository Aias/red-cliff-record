/**
 * Resolves the database URL based on NODE_ENV and environment variables.
 * Priority: environment-specific URL (DATABASE_URL_PROD/DEV) → fallback (DATABASE_URL)
 */
export const getDatabaseUrl = (): string => {
  const nodeEnv = process.env.NODE_ENV;
  const prodUrl = process.env.DATABASE_URL_PROD;
  const devUrl = process.env.DATABASE_URL_DEV;
  const fallbackUrl = process.env.DATABASE_URL;

  if (nodeEnv === 'production') {
    const url = prodUrl || fallbackUrl;
    if (!url) {
      throw new Error('No production database URL configured (DATABASE_URL_PROD)');
    }
    return url;
  }

  if (nodeEnv === 'development' || nodeEnv === 'test') {
    const url = devUrl || fallbackUrl;
    if (!url) {
      throw new Error('No development database URL configured (DATABASE_URL_DEV)');
    }
    return url;
  }

  if (!fallbackUrl) {
    throw new Error(`No database URL configured for NODE_ENV=${nodeEnv}`);
  }
  return fallbackUrl;
};
