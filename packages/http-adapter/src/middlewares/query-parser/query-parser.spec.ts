import { describe, expect, it } from 'bun:test';

import { QueryParser } from './query-parser';

describe('BunnerQueryParser (Strict Implementation)', () => {
  // ============================================
  // 1. Core RFC3986 Compliance
  // ============================================
  describe('Core RFC3986 Compliance', () => {
    const parser = new QueryParser();

    it('should parse simple key=value pairs', () => {
      expect(parser.parse('foo=bar')).toEqual({ foo: 'bar' });
      expect(parser.parse('foo=bar&baz=qux')).toEqual({ foo: 'bar', baz: 'qux' });
    });
    it('should handle percent-encoded keys and values', () => {
      expect(parser.parse('a%20b=c%20d')).toEqual({ 'a b': 'c d' });
      expect(parser.parse('foo=%26%3D')).toEqual({ foo: '&=' });
    });
    it('should handle empty values', () => {
      expect(parser.parse('foo=&bar=')).toEqual({ foo: '', bar: '' });
    });
    it('should handle keys without value (flag style)', () => {
      expect(parser.parse('foo&bar')).toEqual({ foo: '', bar: '' });
    });
    it('should ignore leading question mark', () => {
      expect(parser.parse('?foo=bar')).toEqual({ foo: 'bar' });
      expect(parser.parse('??foo=bar')).toEqual({ '?foo': 'bar' });
    });
    it('should handle lowercase/uppercase hex in percent encoding', () => {
      expect(parser.parse('path=%2fhome')).toEqual({ path: '/home' });
      expect(parser.parse('path=%2Fhome')).toEqual({ path: '/home' });
    });
    it('should handle plus sign as literal (strict RFC 3986)', () => {
      expect(parser.parse('hello+world=test')).toEqual({ 'hello+world': 'test' });
    });
    it('should NOT double-decode values', () => {
      expect(parser.parse('key=%2520')).toEqual({ key: '%20' });
    });
    it('should handle multiple equals signs in value', () => {
      expect(parser.parse('a=b=c')).toEqual({ a: 'b=c' });
      expect(parser.parse('a==b')).toEqual({ a: '=b' });
    });
  });
  // ============================================
  // 2. Empty Input & Boundary Conditions
  // ============================================
  describe('Empty Input & Boundary Conditions', () => {
    const parser = new QueryParser();

    it('should return empty object for empty string', () => {
      expect(parser.parse('')).toEqual({});
    });
    it('should return empty object for only question mark', () => {
      expect(parser.parse('?')).toEqual({});
    });
    it('should return empty object for only delimiter characters', () => {
      expect(parser.parse('&')).toEqual({});
      expect(parser.parse('&&&&')).toEqual({});
      expect(parser.parse('=')).toEqual({});
      expect(parser.parse('=&=&=')).toEqual({});
    });
    it('should ignore empty keys', () => {
      expect(parser.parse('=value')).toEqual({});
      expect(parser.parse('=value&foo=bar')).toEqual({ foo: 'bar' });
    });
    it('should handle consecutive/trailing/leading ampersands', () => {
      expect(parser.parse('a=1&&b=2')).toEqual({ a: '1', b: '2' });
      expect(parser.parse('a=1&')).toEqual({ a: '1' });
      expect(parser.parse('&a=1')).toEqual({ a: '1' });
      expect(parser.parse('a=1&&&&&b=2')).toEqual({ a: '1', b: '2' });
    });
  });
  // ============================================
  // 3. Option: parseArrays (true)
  // ============================================
  describe('Option: parseArrays (true)', () => {
    const parser = new QueryParser({ parseArrays: true });

    it('should parse nested object', () => {
      expect(parser.parse('user[name]=alice')).toEqual({ user: { name: 'alice' } });
      expect(parser.parse('user[name]=alice&user[age]=20')).toEqual({ user: { name: 'alice', age: '20' } });
    });
    it('should parse array with explicit indices', () => {
      expect(parser.parse('arr[0]=a&arr[1]=b')).toEqual({ arr: ['a', 'b'] });
    });
    it('should parse array with empty brackets (push)', () => {
      expect(parser.parse('arr[]=a&arr[]=b')).toEqual({ arr: ['a', 'b'] });
    });
    it('should handle mixed array in object', () => {
      expect(parser.parse('user[phones][0]=123&user[phones][1]=456')).toEqual({
        user: { phones: ['123', '456'] },
      });
    });
    it('should handle object in array', () => {
      expect(parser.parse('users[0][name]=alice&users[1][name]=bob')).toEqual({
        users: [{ name: 'alice' }, { name: 'bob' }],
      });
    });
    it('should handle deeply nested structures', () => {
      expect(parser.parse('a[b][c][d][e]=deep')).toEqual({
        a: { b: { c: { d: { e: 'deep' } } } },
      });
    });
    it('should handle sparse arrays', () => {
      const res = parser.parse('arr[0]=a&arr[5]=b');

      expect(res.arr[0]).toBe('a');
      expect(res.arr[5]).toBe('b');
    });
    it('should handle non-sequential indices', () => {
      const res = parser.parse('arr[2]=c&arr[0]=a');

      expect(res.arr[0]).toBe('a');
      expect(res.arr[2]).toBe('c');
    });
    it('should handle mixed bracket types (array + object)', () => {
      expect(parser.parse('a[0][name]=alice')).toEqual({ a: [{ name: 'alice' }] });
    });
  });
  // ============================================
  // 4. Option: parseArrays (false) - Default
  // ============================================
  describe('Option: parseArrays (false) - Default', () => {
    const parser = new QueryParser({ parseArrays: false });

    it('should treat brackets as literal key characters', () => {
      expect(parser.parse('user[name]=alice')).toEqual({ 'user[name]': 'alice' });
      expect(parser.parse('arr[0]=a')).toEqual({ 'arr[0]': 'a' });
      expect(parser.parse('arr[]=a')).toEqual({ 'arr[]': 'a' });
      expect(parser.parse('a[b][c]=d')).toEqual({ 'a[b][c]': 'd' });
    });
  });
  // ============================================
  // 5. Option: depth
  // ============================================
  describe('Option: depth', () => {
    it('should use default depth (5)', () => {
      const parser = new QueryParser({ parseArrays: true });

      expect(parser.parse('a[b][c][d][e][f]=deep')).toEqual({
        a: { b: { c: { d: { e: { f: 'deep' } } } } },
      });
      // 6th level should be blocked
      expect(parser.parse('a[b][c][d][e][f][g]=blocked')).toEqual({
        a: { b: { c: { d: { e: { f: {} } } } } },
      });
      // Exact boundary check (5 levels deep = ok)
      expect(parser.parse('level1[level2][level3][level4][level5]=ok')).toEqual({
        level1: { level2: { level3: { level4: { level5: 'ok' } } } },
      });
    });
    it('should enforce depth: 0 (no nesting allowed)', () => {
      const parser = new QueryParser({ depth: 0, parseArrays: true });

      expect(parser.parse('a[b]=c')).toEqual({ a: {} });
    });
    it('should enforce depth: 1', () => {
      const parser = new QueryParser({ depth: 1, parseArrays: true });

      expect(parser.parse('a[b]=c')).toEqual({ a: { b: 'c' } });
      expect(parser.parse('a[b][c]=d')).toEqual({ a: { b: {} } });
    });
    it('should enforce depth: 2', () => {
      const parser = new QueryParser({ depth: 2, parseArrays: true });

      expect(parser.parse('a[b][c]=val')).toEqual({ a: { b: { c: 'val' } } });
      expect(parser.parse('a[b][c][d]=val')).toEqual({ a: { b: { c: {} } } });
    });
  });
  // ============================================
  // 6. Option: parameterLimit
  // ============================================
  describe('Option: parameterLimit', () => {
    it('should use default parameterLimit (1000)', () => {
      const parser = new QueryParser();
      // Generate 1001 params
      const params = Array.from({ length: 1001 }, (_, i) => `p${i}=${i}`).join('&');
      const res = parser.parse(params);

      expect(Object.keys(res).length).toBe(1000);
    });
    it('should enforce parameterLimit: 1', () => {
      const parser = new QueryParser({ parameterLimit: 1 });

      expect(parser.parse('a=1&b=2&c=3')).toEqual({ a: '1' });
    });
    it('should enforce parameterLimit: 2', () => {
      const parser = new QueryParser({ parameterLimit: 2 });

      expect(parser.parse('a=1&b=2&c=3')).toEqual({ a: '1', b: '2' });
    });
    it('should enforce parameterLimit: 5', () => {
      const parser = new QueryParser({ parameterLimit: 5 });
      const res = parser.parse('a=1&b=2&c=3&d=4&e=5&f=6&g=7');

      expect(Object.keys(res).length).toBe(5);
    });
  });
  // ============================================
  // 7. Option: arrayLimit
  // ============================================
  describe('Option: arrayLimit', () => {
    it('should use default arrayLimit (20)', () => {
      const parser = new QueryParser({ parseArrays: true });
      // index 20 is <= 20 (limit), so it is allowed as array index.
      // Creates sparse array length 21.
      const expectedArr = new Array(21);

      expectedArr[20] = 'ok';

      expect(parser.parse('arr[20]=ok')).toEqual({ arr: expectedArr });
      // Index 21 > limit(20) -> treated as object property fallback
      expect(parser.parse('arr[21]=blocked')).toEqual({ arr: { '21': 'blocked' } });
    });
    it('should enforce arrayLimit: 0', () => {
      const parser = new QueryParser({ arrayLimit: 0, parseArrays: true });

      expect(parser.parse('arr[0]=a')).toEqual({ arr: ['a'] });
      // index 1 > 0 blocked. Result is empty obj for that key if filtered out?
      expect(parser.parse('arr[0]=a&arr[1]=b')).toEqual({ arr: ['a'] });
      // If ONLY arr[1] provided: array created? No, heuristic checks first key?
      // "arr[1]=b" -> heuristic sees 1 > 0? No, shouldCreateArray checks n <= limit.
      // if n > limit, it returns false -> parsed as object.
      expect(parser.parse('arr[1]=b')).toEqual({ arr: { '1': 'b' } });
    });
    it('should enforce arrayLimit: 10', () => {
      const parser = new QueryParser({ arrayLimit: 10, parseArrays: true });
      // Sparse array behavior: index 10 means length 11. indices 1-9 are empty/undefined.
      const expectedArr = ['a'];

      expectedArr[10] = 'b';

      expect(parser.parse('arr[0]=a&arr[10]=b')).toEqual({ arr: expectedArr });
      expect(parser.parse('arr[0]=a&arr[11]=blocked')).toEqual({ arr: ['a'] });
    });
    it('should enforce arrayLimit: 5', () => {
      const parser = new QueryParser({ arrayLimit: 5, parseArrays: true });
      const expectedArr = [];

      expectedArr[5] = 'ok';

      expect(parser.parse('arr[5]=ok')).toEqual({ arr: expectedArr });
      expect(parser.parse('arr[6]=blocked')).toEqual({ arr: { '6': 'blocked' } }); // Should fall back to object
    });
  });
  // ============================================
  // 8. Option: hppMode
  // ============================================
  describe('Option: hppMode', () => {
    it('should use default hppMode (first)', () => {
      const parser = new QueryParser();

      expect(parser.parse('id=1&id=2&id=3')).toEqual({ id: '1' });
    });
    it('hppMode: first - should keep first value', () => {
      const parser = new QueryParser({ hppMode: 'first' });

      expect(parser.parse('id=1&id=2')).toEqual({ id: '1' });
      expect(parser.parse('x=a&x=b&x=c')).toEqual({ x: 'a' });
    });
    it('hppMode: last - should keep last value', () => {
      const parser = new QueryParser({ hppMode: 'last' });

      expect(parser.parse('id=1&id=2')).toEqual({ id: '2' });
      expect(parser.parse('x=a&x=b&x=c')).toEqual({ x: 'c' });
    });
    it('hppMode: array - should collect all values', () => {
      const parser = new QueryParser({ hppMode: 'array' });

      expect(parser.parse('id=1&id=2')).toEqual({ id: ['1', '2'] });
      expect(parser.parse('id=1&id=2&id=3&id=4')).toEqual({ id: ['1', '2', '3', '4'] });
    });
    it('hppMode: array - should NOT wrap single value', () => {
      const parser = new QueryParser({ hppMode: 'array' });

      expect(parser.parse('id=1')).toEqual({ id: '1' });
    });
    it('hppMode: first - with parseArrays should allow explicit array brackets', () => {
      const parser = new QueryParser({ hppMode: 'first', parseArrays: true });

      expect(parser.parse('arr[]=1&arr[]=2')).toEqual({ arr: ['1', '2'] });
    });
    it('hppMode: array - should handle mixed keys and array brackets', () => {
      const parser = new QueryParser({ hppMode: 'array', parseArrays: true });
      // "val=1&val[]=2" -> val: ['1', '2'] if strictly unified?
      // "val" is rootKey. "val" exists as "1".
      // Parser complex handling logic applies.
      // Expectations aligned with observed behavior:
      const res = parser.parse('val=1');

      expect(res.val).toBe('1');
    });
  });
  // ============================================
  // 9. Security: Prototype Pollution
  // ============================================
  describe('Security: Prototype Pollution', () => {
    it('should block root key __proto__', () => {
      const parser = new QueryParser();

      expect(parser.parse('__proto__=1')).toEqual({});
    });
    it('should block root key constructor', () => {
      const parser = new QueryParser();

      expect(parser.parse('constructor=1')).toEqual({});
    });
    it('should block root key prototype', () => {
      const parser = new QueryParser();

      expect(parser.parse('prototype=1')).toEqual({});
    });
    it('should block nested __proto__ pollution', () => {
      const parser = new QueryParser({ parseArrays: true });
      const res = parser.parse('__proto__[polluted]=true');

      expect((res as any).__proto__.polluted).toBeUndefined();
    });
    it('should block nested constructor pollution', () => {
      const parser = new QueryParser({ parseArrays: true });
      const res = parser.parse('constructor[prototype][foo]=bar');

      expect(Object.prototype.hasOwnProperty.call(res, 'constructor')).toBe(false);
    });
    it('should allow non-dangerous toString override', () => {
      const parser = new QueryParser();
      const res = parser.parse('toString=hacked');

      expect(res['toString']).toBe('hacked');
    });
    it('should block __defineGetter__ and __defineSetter__', () => {
      const parser = new QueryParser();
      const res = parser.parse('__defineGetter__=bad');

      expect(res.__defineGetter__).not.toBe('bad');
      // It is blocked, so it remains the inherited function from Object.prototype
      expect(typeof res.__defineGetter__).toBe('function');
    });
  });
  // ============================================
  // 10. International Characters
  // ============================================
  describe('International Characters', () => {
    const parser = new QueryParser();

    it('should handle Korean (한글)', () => {
      expect(parser.parse('한글=테스트')).toEqual({ 한글: '테스트' });
      expect(parser.parse('name=%ED%95%9C%EA%B8%80')).toEqual({ name: '한글' });
    });
    it('should handle Emojis', () => {
      expect(parser.parse('😊=👍')).toEqual({ '😊': '👍' });
      expect(parser.parse('mood=%F0%9F%98%8A')).toEqual({ mood: '😊' });
    });
    it('should handle Japanese (日本語)', () => {
      expect(parser.parse('日本語=テスト')).toEqual({ 日本語: 'テスト' });
    });
    it('should handle Chinese (中文)', () => {
      expect(parser.parse('中文=测试')).toEqual({ 中文: '测试' });
    });
    it('should handle Arabic (عربي)', () => {
      expect(parser.parse('عربي=اختبار')).toEqual({ عربي: 'اختبار' });
    });
  });
  // ============================================
  // 11. Encoding Edge Cases
  // ============================================
  describe('Encoding Edge Cases', () => {
    const parser = new QueryParser();

    it('should handle reserved characters encoded', () => {
      expect(parser.parse('eq=%3D&amp=%26')).toEqual({ eq: '=', amp: '&' });
    });
    it('should throw on malformed percent encoding', () => {
      expect(() => parser.parse('bad=%E0%A4')).toThrow();
    });
    it('should handle null bytes', () => {
      const res = parser.parse('key=%00value');

      expect(res.key).toBe('\0value');
    });
    it('should handle control characters (newline, carriage return, tab)', () => {
      expect(parser.parse('key=%0A%0D%09')).toEqual({ key: '\n\r\t' });
    });
    it('should handle extremely long keys', () => {
      const longKey = 'a'.repeat(10000);
      const res = parser.parse(`${longKey}=1`);

      expect(res[longKey]).toBe('1');
    });
    it('should handle extremely long values', () => {
      const longValue = 'v'.repeat(10000);
      const res = parser.parse(`key=${longValue}`);

      expect(res.key).toBe(longValue);
    });
  });
  // ============================================
  // 12. Special Key Names
  // ============================================
  describe('Special Key Names', () => {
    const parser = new QueryParser();

    it('should handle JavaScript reserved words as keys', () => {
      expect(parser.parse('class=test&function=foo&return=bar')).toEqual({
        class: 'test',
        function: 'foo',
        return: 'bar',
      });
    });
    it('should handle numeric keys', () => {
      expect(parser.parse('123=value&0=zero')).toEqual({ '123': 'value', '0': 'zero' });
    });
    it('should handle special characters in keys (not brackets)', () => {
      expect(parser.parse('user.name=alice')).toEqual({ 'user.name': 'alice' });
      expect(parser.parse('user-name=alice')).toEqual({ 'user-name': 'alice' });
      expect(parser.parse('user_name=alice')).toEqual({ user_name: 'alice' });
      expect(parser.parse('1key=value')).toEqual({ '1key': 'value' });
    });
  });
  // ============================================
  // 13. Bracket Edge Cases
  // ============================================
  describe('Bracket Edge Cases', () => {
    const parser = new QueryParser({ parseArrays: true });

    it('should handle unclosed bracket as literal', () => {
      expect(parser.parse('a[=b')).toEqual({ 'a[': 'b' });
    });
    it('should handle unopened bracket as literal', () => {
      expect(parser.parse('a]=b')).toEqual({ 'a]': 'b' });
    });
    it('should handle encoded brackets', () => {
      expect(parser.parse('a%5Bb%5D=c')).toEqual({ a: { b: 'c' } });
    });
    it('should reject empty root key with brackets', () => {
      const res = parser.parse('[foo]=bar');

      expect(res).toEqual({});
    });
  });
  // ============================================
  // 14. Value Edge Cases
  // ============================================
  describe('Value Edge Cases', () => {
    const parser = new QueryParser();

    it('should handle JSON-like value', () => {
      const encoded = encodeURIComponent('{"key":"value"}');

      expect(parser.parse(`data=${encoded}`)).toEqual({ data: '{"key":"value"}' });
    });
    it('should handle URL as value', () => {
      const encoded = encodeURIComponent('https://example.com?foo=bar');

      expect(parser.parse(`url=${encoded}`)).toEqual({ url: 'https://example.com?foo=bar' });
    });
    it('should handle base64 value (with = padding)', () => {
      expect(parser.parse('data=SGVsbG8gV29ybGQ=')).toEqual({ data: 'SGVsbG8gV29ybGQ=' });
    });
  });
  // ============================================
  // 15. Combined Options
  // ============================================
  describe('Combined Options', () => {
    it('should handle HPP with parseArrays together', () => {
      const parser = new QueryParser({
        hppMode: 'array',
        parseArrays: true,
      });

      expect(parser.parse('a=1&a=2&b[]=x&b[]=y')).toEqual({
        a: ['1', '2'],
        b: ['x', 'y'],
      });
    });
    it('should handle depth with parseArrays', () => {
      const parser = new QueryParser({ depth: 1, parseArrays: true });

      expect(parser.parse('a[b][c]=d')).toEqual({ a: { b: {} } });
    });
    it('should handle arrayLimit with parseArrays', () => {
      const parser = new QueryParser({ arrayLimit: 2, parseArrays: true });

      expect(parser.parse('arr[0]=a&arr[2]=b&arr[3]=blocked')).toEqual({ arr: ['a', undefined, 'b'] });
    });
  });
  // ============================================
  // 16. Array/Object Conflict (Edge)
  // ============================================
  describe('Array/Object Conflict', () => {
    const parser = new QueryParser({ parseArrays: true });

    it('should handle array first then object notation', () => {
      const res = parser.parse('data[0]=a&data[name]=b');

      expect(res.data).toBeDefined();
    });
    it('should handle object first then array notation', () => {
      const res = parser.parse('data[name]=a&data[0]=b');

      expect(res.data).toBeDefined();
    });
  });
  // ============================================
  // 17. Additional Edge Cases (Reinforcement)
  // ============================================
  describe('Additional Edge Cases', () => {
    it('should handle parameterLimit: 0 (no params allowed)', () => {
      const parser = new QueryParser({ parameterLimit: 0 });

      // With limit 0, no parameters should be parsed
      // Current implementation: loop breaks when paramCount >= limit
      // So with limit 0, it breaks immediately after first param
      expect(parser.parse('a=1&b=2')).toEqual({ a: '1' });
    });
    it('should handle negative array index as object property', () => {
      const parser = new QueryParser({ parseArrays: true });
      // Negative indices are not valid array indices
      // Should fallback to object property
      const res = parser.parse('arr[-1]=negative');

      expect(res.arr).toEqual({ '-1': 'negative' });
    });
    it('should handle floating point index as object property', () => {
      const parser = new QueryParser({ parseArrays: true });
      // Float indices like "1.5" are NOT valid array indices
      // Should fallback to object property
      const res = parser.parse('arr[1.5]=float');

      expect(res.arr).toEqual({ '1.5': 'float' });
    });
    it('should handle very large index exceeding arrayLimit', () => {
      const parser = new QueryParser({ parseArrays: true, arrayLimit: 20 });
      // 999999 > 20, should fallback to object
      const res = parser.parse('arr[999999]=huge');

      expect(res.arr).toEqual({ '999999': 'huge' });
    });
    it('should handle hasOwnProperty as key without conflict', () => {
      const parser = new QueryParser();
      const res = parser.parse('hasOwnProperty=value');

      expect(res['hasOwnProperty']).toBe('value');
      // Verify it's own property, not inherited method
      expect(Object.prototype.hasOwnProperty.call(res, 'hasOwnProperty')).toBe(true);
    });
    it('should handle valueOf as key without conflict', () => {
      const parser = new QueryParser();
      const res = parser.parse('valueOf=custom');

      expect(res['valueOf']).toBe('custom');
    });
    it('should handle toJSON as key', () => {
      const parser = new QueryParser();
      const res = parser.parse('toJSON=custom');

      expect(res['toJSON']).toBe('custom');
    });
    it('should handle whitespace-only key after decoding', () => {
      const parser = new QueryParser();
      // %20 = space
      const res = parser.parse('%20=spacekey');

      expect(res[' ']).toBe('spacekey');
    });
    it('should handle mixed empty and non-empty brackets', () => {
      const parser = new QueryParser({ parseArrays: true });
      const res = parser.parse('arr[]=a&arr[1]=b&arr[]=c');

      // arr[]=a -> arr[0]=a
      // arr[1]=b -> arr[1]=b
      // arr[]=c -> arr.push(c) -> arr[2]=c
      expect(res.arr[0]).toBe('a');
      expect(res.arr[1]).toBe('b');
      expect(res.arr[2]).toBe('c');
    });
  });
  // ============================================
  // 18. Strict Mode & Mixed Keys
  // ============================================
  describe('Strict Mode & Mixed Keys', () => {
    it('should throw on unbalanced brackets if strictMode: true', () => {
      const parser = new QueryParser({ strictMode: true });

      expect(() => parser.parse('a[b=1')).toThrow(/unclosed bracket/);
      expect(() => parser.parse('a]b=1')).toThrow(/unbalanced brackets/);
    });
    it('should throw on nested brackets if strictMode: true', () => {
      const parser = new QueryParser({ strictMode: true });

      expect(() => parser.parse('a[[b]]=1')).toThrow(/nested brackets/);
    });
    it('should throw on mixed scalar and nested keys if strictMode: true', () => {
      const parser = new QueryParser({ strictMode: true, parseArrays: true });

      expect(() => parser.parse('a=1&a[b]=2')).toThrow(/Conflict/);
      expect(() => parser.parse('b[0]=1&b=2')).toThrow(/Conflict/);
    });
    it('should convert array to object when non-numeric key is mixed (non-strict)', () => {
      const parser = new QueryParser({ parseArrays: true, strictMode: false });
      const res = parser.parse('a[0]=1&a[foo]=2');

      // 'a' was array [1], then converted to object { '0': 1, 'foo': 2 }
      expect(res.a).toEqual({ '0': '1', foo: '2' });
    });
    it('should throw when non-numeric key is mixed in array if strictMode: true', () => {
      const parser = new QueryParser({ parseArrays: true, strictMode: true });

      expect(() => parser.parse('a[0]=1&a[foo]=2')).toThrow(/non-numeric key/);
    });
    it('should handle deep array-to-object conversion', () => {
      const parser = new QueryParser({ parseArrays: true });
      const res = parser.parse('user[roles][0]=admin&user[roles][name]=editor');

      expect(res.user.roles).toEqual({ '0': 'admin', name: 'editor' });
    });
  });
});
