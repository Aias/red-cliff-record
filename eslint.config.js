// @ts-nocheck
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import drizzle from 'eslint-plugin-drizzle';
import importPlugin from 'eslint-plugin-import';
import reactCompiler from 'eslint-plugin-react-compiler';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	{
		plugins: {
			'react-compiler': reactCompiler,
			import: importPlugin,
			drizzle: drizzle,
		},
		rules: {
			'react-compiler/react-compiler': 'error',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/ban-ts-comment': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{
					prefer: 'type-imports',
					fixStyle: 'inline-type-imports',
				},
			],
			'import/order': [
				'warn',
				{
					groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
					pathGroups: [
						{
							pattern: 'react',
							group: 'external',
							position: 'before',
						},
						{
							pattern: 'react-dom/**',
							group: 'external',
							position: 'before',
						},
						{
							pattern: '~/**',
							group: 'internal',
							position: 'before',
						},
					],
					pathGroupsExcludedImportTypes: ['builtin', 'object'],
					'newlines-between': 'never',
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
					named: {
						enabled: true,
						types: 'types-last',
					},
					warnOnUnassignedImports: true,
				},
			],
			'drizzle/enforce-delete-with-where': [
				'error',
				{
					drizzleObjectName: ['db', 'ctx.db'],
				},
			],
			'drizzle/enforce-update-with-where': [
				'error',
				{
					drizzleObjectName: ['db', 'ctx.db'],
				},
			],
		},
	},
	{
		files: ['**/*.{ts,tsx}'],
		rules: {
			'drizzle/enforce-delete-with-where': ['error', { drizzleObjectName: ['db', 'ctx.db'] }],
			'drizzle/enforce-update-with-where': ['error', { drizzleObjectName: ['db', 'ctx.db'] }],
		},
	},
	{
		ignores: ['**/build/**', '**/dist/**', '.output/**', '.vinxi/**'],
	}
);
