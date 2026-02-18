import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import { ClientEnvSchema, EnvSchema, PortSchema } from './src/shared/lib/env';

export default defineConfig(({ mode }) => {
  // Load all environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Validate all env vars at build time (fails fast if server env is misconfigured)
  EnvSchema.parse({ ...env, NODE_ENV: mode });

  return {
    build: {
      sourcemap: true,
    },
    server: {
      port: PortSchema.parse(env.PUBLIC_DEV_PORT),
    },
    envPrefix: ['PUBLIC_', 'VITE_'],
    define: Object.fromEntries(
      Object.entries(ClientEnvSchema.parse({ ...env, NODE_ENV: mode })).map(([key, value]) => [
        `process.env.${key}`,
        JSON.stringify(value),
      ])
    ),
    plugins: [
      tsConfigPaths({ projectDiscovery: 'lazy' }),
      tanstackStart({
        srcDirectory: './src/app',
        importProtection: {
          behavior: {
            dev: 'mock',
            build: 'error',
          },
          client: {
            specifiers: [/^@\/server/],
            files: ['**/src/server/**'],
          },
        },
      }),
      viteReact({
        babel: {
          plugins: [['babel-plugin-react-compiler', { target: '19' }]],
        },
      }),
      tailwindcss(),
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }) as PluginOption,
    ],
  };
});
