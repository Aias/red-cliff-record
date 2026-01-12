import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { emptyStringToNull } from './formatting';

describe('emptyStringToNull', () => {
	describe('with z.string()', () => {
		const schema = emptyStringToNull(z.string());

		test('transforms empty string to null', () => {
			expect(schema.parse('')).toBe(null);
		});

		test('passes through null', () => {
			expect(schema.parse(null)).toBe(null);
		});

		test('passes through valid string', () => {
			expect(schema.parse('hello')).toBe('hello');
		});
	});

	describe('with z.url()', () => {
		const schema = emptyStringToNull(z.url());

		test('transforms empty string to null', () => {
			expect(schema.parse('')).toBe(null);
		});

		test('passes through null', () => {
			expect(schema.parse(null)).toBe(null);
		});

		test('passes through valid URL', () => {
			expect(schema.parse('https://example.com')).toBe('https://example.com');
		});

		test('rejects invalid URL', () => {
			expect(() => schema.parse('not-a-url')).toThrow();
		});
	});

	describe('with z.email()', () => {
		const schema = emptyStringToNull(z.email());

		test('transforms empty string to null', () => {
			expect(schema.parse('')).toBe(null);
		});

		test('passes through valid email', () => {
			expect(schema.parse('test@example.com')).toBe('test@example.com');
		});

		test('rejects invalid email', () => {
			expect(() => schema.parse('not-an-email')).toThrow();
		});
	});

	describe('with z.url().nullable() (already nullable)', () => {
		const schema = emptyStringToNull(z.url().nullable());

		test('transforms empty string to null', () => {
			expect(schema.parse('')).toBe(null);
		});

		test('passes through null', () => {
			expect(schema.parse(null)).toBe(null);
		});

		test('passes through valid URL', () => {
			expect(schema.parse('https://example.com')).toBe('https://example.com');
		});
	});

	describe('type inference', () => {
		test('output type is string | null for z.string()', () => {
			const schema = emptyStringToNull(z.string());
			const result: string | null = schema.parse('test');
			expect(result).toBe('test');
		});

		test('output type is string | null for z.url()', () => {
			const schema = emptyStringToNull(z.url());
			const result: string | null = schema.parse('https://example.com');
			expect(result).toBe('https://example.com');
		});
	});
});
