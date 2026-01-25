import type { Server } from 'bun';

import { describe, it, expect } from 'bun:test';

import { HeaderField } from '../enums';
import { getIps, __internals } from './ip';

function buildRequest(headers: Record<string, string | undefined>): Request {
  const entries = Object.entries(headers).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return new Request('http://localhost', {
    headers: Object.fromEntries(entries),
  });
}

function mockServer(ip?: string | null): {
  server: Server<unknown>;
  calls: { request: number };
} {
  const calls = { request: 0 };
  const server = {
    requestIP: () => {
      calls.request += 1;

      return ip
        ? {
            address: ip,
            family: ip.includes(':') ? 'IPv6' : 'IPv4',
            port: 0,
          }
        : null;
    },
  } as unknown as Server<unknown>;

  return { server, calls };
}

describe('getIps', () => {
  it('prefers the socket IP when trustProxy is false', () => {
    const request = buildRequest({
      [HeaderField.Forwarded]: 'for=203.0.113.1',
      [HeaderField.XForwardedFor]: '198.51.100.2',
      [HeaderField.XRealIp]: '192.0.2.10',
    });
    const { server, calls } = mockServer('198.51.100.10');
    const result = getIps(request, server, false);

    expect(calls.request).toBe(1);
    expect(result.ip).toBe('198.51.100.10');
    expect(result.ips).toBeUndefined();
  });

  it('returns a deduplicated forwarded chain when trustProxy is true', () => {
    const request = buildRequest({
      [HeaderField.Forwarded]: 'for=198.51.100.1; proto=https, for="[2001:db8::abcd]:443"; host=example.com',
      [HeaderField.XForwardedFor]: '198.51.100.1, 192.0.2.10',
      [HeaderField.XRealIp]: '  "192.0.2.20:8080" ',
    });
    const { server } = mockServer('10.0.0.1');
    const result = getIps(request, server, true);

    expect(result.ip).toBe('198.51.100.1');
    expect(result.ips).toEqual(['198.51.100.1', '2001:db8::abcd', '192.0.2.10']);
  });

  it('falls back to x-real-ip when the forwarded chain is empty', () => {
    const request = buildRequest({
      [HeaderField.XRealIp]: ' "::ffff:198.51.100.25:1234" ',
    });
    const { server } = mockServer('203.0.113.50');
    const result = getIps(request, server, true);

    expect(result.ip).toBe('198.51.100.25');
    expect(result.ips).toBeUndefined();
  });

  it('returns undefined when all candidates are invalid', () => {
    const request = buildRequest({
      [HeaderField.Forwarded]: 'for=unknown; proto=https, for=_hidden',
      [HeaderField.XForwardedFor]: 'unknown, none',
      [HeaderField.XRealIp]: '_obfuscated',
    });
    const { server } = mockServer(null);
    const result = getIps(request, server, true);

    expect(result.ip).toBeUndefined();
    expect(result.ips).toBeUndefined();
  });
});

describe('collectForwardedFor', () => {
  it('extracts sanitized IPs from multiple forwarded entries', () => {
    const header = 'for=198.51.100.1; proto=https, for="[2001:db8::1]:443";host=example.com';
    const result = __internals.collectForwardedFor(header);

    expect(result).toEqual(['198.51.100.1', '2001:db8::1']);
  });

  it('ignores segments without a for key or invalid IP values', () => {
    const header = 'for=unknown; host=example.com; for=_hidden, proto=https';
    const result = __internals.collectForwardedFor(header);

    expect(result).toEqual([]);
  });

  it('handles uppercase FOR keys and preserves sanitization', () => {
    const header = 'FOR="198.51.100.2"; proto=http, For= "[2001:db8::2]"; by=proxy';
    const result = __internals.collectForwardedFor(header);

    expect(result).toEqual(['198.51.100.2', '2001:db8::2']);
  });

  it('skips placeholders while keeping mixed IPv4 and IPv6 entries', () => {
    const header = 'for="_hidden"; proto=http, for="198.51.100.3";by=proxy, for="[2001:db8::3]:10443";host';
    const result = __internals.collectForwardedFor(header);

    expect(result).toEqual(['198.51.100.3', '2001:db8::3']);
  });

  it('unescapes nested quotes and strips proxy port suffixes', () => {
    const header = String.raw`for="\"198.51.100.4:8443\"";proto=https,for="\"[2001:db8::4]:10443\""`;
    const result = __internals.collectForwardedFor(header);

    expect(result).toEqual(['198.51.100.4', '2001:db8::4']);
  });
});

describe('collectXForwardedFor', () => {
  it('returns sanitized IPs split by commas', () => {
    const header = ' 198.51.100.1 , "::ffff:192.0.2.10", invalid ';
    const result = __internals.collectXForwardedFor(header);

    expect(result).toEqual(['198.51.100.1', '192.0.2.10']);
  });

  it('returns an empty array when the header is absent', () => {
    expect(__internals.collectXForwardedFor(null)).toEqual([]);
  });

  it('preserves duplicate entries while keeping mixed IPv4 and IPv6 values', () => {
    const header = '198.51.100.1, 2001:db8::4 , 198.51.100.1 , _hidden , "[2001:db8::4]"';
    const result = __internals.collectXForwardedFor(header);

    expect(result).toEqual(['198.51.100.1', '2001:db8::4', '198.51.100.1', '2001:db8::4']);
  });
});

describe('dedupePreserveOrder', () => {
  it('removes duplicates while preserving order', () => {
    const values = ['a', 'b', 'a', 'c', 'b'];

    expect(__internals.dedupePreserveOrder(values)).toEqual(['a', 'b', 'c']);
  });
});

describe('extractHeaderIp', () => {
  it('returns sanitized IPs and rejects invalid values', () => {
    expect(__internals.extractHeaderIp('"198.51.100.1"')).toBe('198.51.100.1');
    expect(__internals.extractHeaderIp('unknown')).toBeUndefined();
    expect(__internals.extractHeaderIp(undefined)).toBeUndefined();
  });
});

describe('sanitizeIpCandidate', () => {
  it('strips quotes, underscores, IPv6 brackets, port suffixes, and mapped prefixes', () => {
    expect(__internals.sanitizeIpCandidate(' "198.51.100.1:8080" ')).toBe('198.51.100.1');
    expect(__internals.sanitizeIpCandidate('[2001:db8::1]:443')).toBe('2001:db8::1');
    expect(__internals.sanitizeIpCandidate('::ffff:203.0.113.5')).toBe('203.0.113.5');
    expect(__internals.sanitizeIpCandidate('_hidden')).toBeUndefined();
  });

  it('returns undefined for blank or placeholder tokens after trimming', () => {
    expect(__internals.sanitizeIpCandidate('   ')).toBeUndefined();
    expect(__internals.sanitizeIpCandidate(' Obfuscated ')).toBeUndefined();
    expect(__internals.sanitizeIpCandidate('_prefixed')).toBeUndefined();
  });

  it('handles malformed mapped prefixes and dangling IPv6 brackets', () => {
    expect(__internals.sanitizeIpCandidate('::ffff:unknown')).toBeUndefined();
    expect(__internals.sanitizeIpCandidate('[2001:db8::5')).toBe('2001:db8::5');
    expect(__internals.sanitizeIpCandidate('" 198.51.100.5 "')).toBe('198.51.100.5');
  });
});

describe('stripOptionalQuotes', () => {
  it('removes matching quotes and unescapes characters', () => {
    expect(__internals.stripOptionalQuotes('"value"')).toBe('value');
    expect(__internals.stripOptionalQuotes("'va\\'lue'")).toBe("va'lue");
    expect(__internals.stripOptionalQuotes('value')).toBe('value');
  });
});

describe('stripPortSuffix', () => {
  it('handles IPv4 ports while keeping legitimate IPv6 segments intact', () => {
    expect(__internals.stripPortSuffix('198.51.100.1:8080')).toBe('198.51.100.1');
    expect(__internals.stripPortSuffix('2001:db8::1:443')).toBe('2001:db8::1:443');
    expect(__internals.stripPortSuffix('2001:db8::1')).toBe('2001:db8::1');
    expect(__internals.stripPortSuffix('2001:db8::1:65536')).toBe('2001:db8::1');
  });
});

describe('isIpAddress', () => {
  it('validates IPv4 and IPv6 values', () => {
    expect(__internals.isIpAddress('198.51.100.1')).toBe(true);
    expect(__internals.isIpAddress('2001:db8::1')).toBe(true);
    expect(__internals.isIpAddress('example.com')).toBe(false);
  });
});

describe('isIpv4', () => {
  it('validates dotted quad addresses and rejects invalid ones', () => {
    expect(__internals.isIpv4('198.51.100.1')).toBe(true);
    expect(__internals.isIpv4('256.0.0.1')).toBe(false);
    expect(__internals.isIpv4('01.2.3.4')).toBe(false);
  });

  it('rejects empty and non-numeric octets', () => {
    expect(__internals.isIpv4('198..100.1')).toBe(false);
    expect(__internals.isIpv4('198.51a.100.1')).toBe(false);
    expect(__internals.isIpv4('198.5123.100.1')).toBe(false);
  });
});

describe('isIpv6', () => {
  it('accepts shorthand and rejects malformed values', () => {
    expect(__internals.isIpv6('2001:db8::1')).toBe(true);
    expect(__internals.isIpv6('2001:db8:0000:0000:0000:0000:0000:0001')).toBe(true);
    expect(__internals.isIpv6('2001:db8::g')).toBe(false);
    expect(__internals.isIpv6('no-colons-here')).toBe(false);
  });

  it('rejects addresses with more than eight segments', () => {
    expect(__internals.isIpv6('1:2:3:4:5:6:7:8:9')).toBe(false);
  });
});
