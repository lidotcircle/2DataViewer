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

	test('handles multiple spaces between tokens', () => {
		expect(SplitString('a    b')).toEqual(['a', 'b']);
	});
	test('handles tabs and newlines as spaces', () => {
		expect(SplitString('a\tb\nc')).toEqual(['a', 'b', 'c']);
	});
	test('handles mixed whitespace', () => {
		expect(SplitString('a \t b\n c')).toEqual(['a', 'b', 'c']);
	});
	test('handles escaped brackets', () => {
		expect(SplitString('a \\(b c\\) d')).toEqual(['a', '\\', '(', 'b c\\', ')', 'd']);
	});
	test('handles escaped spaces', () => {
		expect(SplitString('a\\ b c')).toEqual(['a\\', 'b', 'c']);
	});
	test('handles escaped backslashes', () => {
		expect(SplitString('a \\\\ b')).toEqual(['a', '\\\\', 'b']);
	});
	test('handles empty quoted strings', () => {
		expect(SplitString('a "" b')).toEqual(['a', '""', 'b']);
	});
	test('handles empty brackets', () => {
		expect(SplitString('a () b')).toEqual(['a', '(', ')', 'b']);
	});
	test('handles nested quotes', () => {
		expect(SplitString('a "b \'c\'" d')).toEqual(['a', '"b \'c\'"', 'd']);
	});
	test('handles nested quotes with brackets', () => {
		expect(SplitString('a "b (c)" d')).toEqual(['a', '"b (c)"', 'd']);
	});
	test('handles nested quotes with escaped quotes', () => {
		expect(SplitString('a "b \\"c\\"" d')).toEqual(['a', '"b \\"c\\""', 'd']);
	});
	test('handles nested quotes with escaped brackets', () => {
		expect(SplitString('a "b \\(c\\)" d')).toEqual(['a', '"b \\(c\\)"', 'd']);
	});
	test('handles nested quotes with escaped spaces', () => {
		expect(SplitString('a "b\\ c" d')).toEqual(['a', '"b\\ c"', 'd']);
	});
	test('handles nested quotes with escaped backslashes', () => {
		expect(SplitString('a "b\\\\ c" d')).toEqual(['a', '"b\\\\ c"', 'd']);
	});
	test('handles nested quotes with mixed whitespace', () => {
		expect(SplitString('a "b \t c" d')).toEqual(['a', '"b \t c"', 'd']);
	});
	test('handles nested quotes with mixed escaped characters', () => {
		expect(SplitString('a "b \\\\ c" d')).toEqual(['a', '"b \\\\ c"', 'd']);
	});
	test('handles nested quotes with mixed escaped characters and whitespace', () => {
		expect(SplitString('a "b \\\\ c" d')).toEqual(['a', '"b \\\\ c"', 'd']);
	});
});
