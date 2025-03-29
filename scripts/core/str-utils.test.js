import { SplitString } from './str-utils.js';


describe('SplitString', () => {
	test('splits a simple string by spaces', () => {
		expect(SplitString('a b c')).toEqual(['a', 'b', 'c']);
	});

	test('preserves spaces inside quoted strings', () => {
		expect(SplitString('a "b c" d')).toEqual(['a', '"b c"', 'd']);
	});

	test('handles escaped quotes inside quoted strings', () => {
		expect(SplitString('a "b\\"c" d')).toEqual(['a', '"b\\"c"', 'd']);
	});

	test('splits on brackets and preserves their content', () => {
		expect(SplitString('a (b c) d')).toEqual(['a', '(', 'b c', ')', 'd']);
	});

	test('handles nested brackets', () => {
		expect(SplitString('a [b {c}] d')).toEqual(['a', '[', 'b {c}', ']', 'd']);
	});

	test('combines quotes and brackets', () => {
		expect(SplitString('a "b (c)" d')).toEqual(['a', '"b (c)"', 'd']);
	});

	test('handles mixed escaped quotes and brackets', () => {
		expect(SplitString('a "b\\" (c)" d')).toEqual(['a', '"b\\" (c)"', 'd']);
	});

	test('returns empty array for empty string', () => {
		expect(SplitString('')).toEqual([]);
	});

	test('returns empty array for string with only spaces', () => {
		expect(SplitString('   ')).toEqual([]);
	});

	test('throws error for unmatched quotes', () => {
		expect(() => SplitString('a "b c')).toThrow('Unmatched quote');
	});

	test('throws error for unmatched brackets', () => {
		expect(() => SplitString('a (b c')).toThrow('Unmatched bracket');
	});
});
