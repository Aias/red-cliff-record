import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'import', 'react'],
  options: {
    typeAware: true,
  },
  rules: {
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    // Type-aware rules
    'typescript/await-thenable': 'warn',
    'typescript/no-floating-promises': 'warn',
    'typescript/no-misused-promises': 'warn',
    'typescript/no-for-in-array': 'warn',
    'typescript/require-await': 'warn',
    'typescript/no-base-to-string': 'warn',
    'typescript/restrict-template-expressions': 'warn',
    'typescript/no-misused-spread': 'warn',
    'typescript/no-deprecated': 'warn',
    'typescript/no-unnecessary-type-assertion': 'warn',
    'typescript/no-implied-eval': 'warn',
    'typescript/no-array-delete': 'warn',
    'typescript/return-await': 'warn',
    'typescript/prefer-optional-chain': 'warn',
    'typescript/prefer-includes': 'warn',
    'typescript/no-redundant-type-constituents': 'warn',
    'typescript/no-unnecessary-template-expression': 'warn',
    'typescript/restrict-plus-operands': 'warn',
    'typescript/unbound-method': 'off',
    // 'typescript/no-unnecessary-condition': 'warn',
    // 'typescript/switch-exhaustiveness-check': 'warn',
    // 'typescript/no-unsafe-enum-comparison': 'warn',
    // 'typescript/only-throw-error': 'warn',

    // React
    'react/jsx-key': 'warn',
    'react/rules-of-hooks': 'error',
    'react/self-closing-comp': 'warn',
    'react/jsx-no-useless-fragment': 'warn',

    // General
    'eslint/eqeqeq': 'warn',
    'eslint/prefer-const': 'warn',
    'import/no-duplicates': 'warn',
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
