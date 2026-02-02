import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'import'],
  rules: {
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    'import/order': 'warn',

    'typescript/await-thenable': 'warn',
    'typescript/no-floating-promises': 'warn',
    'typescript/no-misused-promises': 'warn',
    'typescript/no-for-in-array': 'warn',
    'typescript/require-await': 'warn',

    'typescript/no-base-to-string': 'warn',
    'typescript/unbound-method': 'off',
    'typescript/restrict-template-expressions': 'warn',
    'typescript/no-misused-spread': 'warn',
  },
  ignorePatterns: [
    '**/build/**',
    '**/dist/**',
    '.output/**',
    '.vinxi/**',
    '.nitro/**',
    '.tanstack/**',
    '.temp/**',
  ],
});
