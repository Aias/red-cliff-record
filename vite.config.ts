import babel from '@rolldown/plugin-babel';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { ClientEnvSchema, EnvSchema, PortSchema } from './src/shared/lib/env.ts'; // Extension required for `configLoader: 'native'`

export default defineConfig(({ mode }) => {
  // Load all environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Validate all env vars at build time (fails fast if server env is misconfigured)
  EnvSchema.parse({ ...env, NODE_ENV: mode });

  return {
    build: {
      sourcemap: true,
      rolldownOptions: {
        checks: {
          // Panda is-valid-prop.mjs — harmless misplaced @__PURE__ (chakra-ui/panda#2063)
          invalidAnnotation: false,
        },
        output: {
          codeSplitting: {
            // Name shared chunks honestly instead of after an arbitrary member
            // module. minShareCount keeps route-exclusive modules in their route
            // chunks, matching the automatic splitting this replaces.
            groups: [
              { name: 'vendor', test: /node_modules/, minShareCount: 2 },
              { name: 'shared', minShareCount: 2 },
            ],
          },
        },
      },
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
    ssr: {
      external: ['bun'],
    },
    optimizeDeps: {
      exclude: ['bun'],
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tanstackStart({
        srcDirectory: './src/app',
        spa: { enabled: true },
      }),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  };
});
