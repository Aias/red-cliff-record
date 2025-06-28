import type { BrowserConfig } from '../types';
import { arcConfig } from './arc';
import { diaConfig } from './dia';

export const browserConfigs: Record<string, BrowserConfig> = {
	arc: arcConfig,
	dia: diaConfig,
};

export { arcConfig, diaConfig };
