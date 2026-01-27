import { describe, it, expect } from 'bun:test';

import type { MockServerCalls, MockServerResult } from './interfaces';

import { HeaderField } from '../enums';
import { getIps, __internals } from './ip';

function buildRequest(headers: Record<string, string | undefined>): Request {
  const entries = Object.entries(headers).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return new Request('http://localhost', {
    headers: Object.fromEntries(entries),
  });
}

function mockServer(ip?: string | null): MockServerResult {
  const calls: MockServerCalls = { request: 0 };
  const server: MockServerResult['server'] = {
    requestIP: () => {
      calls.request += 1;

      if (ip === null || ip === undefined || ip.length === 0) {
        return null;
      }

      return {
        address: ip,
        family: ip.includes(':') ? 'IPv6' : 'IPv4',
        port: 0,
      };
    },
  };

  return { server, calls };
}

describe('ip', () => {
  describe('getIps', () => {
    it('should prefer the socket IP when trustProxy is false', () => {
      // Arrange
      const request = buildRequest({
        [HeaderField.Forwarded]: 'for=203.0.113.1',
        [HeaderField.XForwardedFor]: '198.51.100.2',
        [HeaderField.XRealIp]: '192.0.2.10',
      });
      const { server, calls } = mockServer('198.51.100.10');
      // Act
      const result = getIps(request, server, false);

      // Assert
      expect(calls.request).toBe(1);
      expect(result.ip).toBe('198.51.100.10');
      expect(result.ips).toBeUndefined();
    });

    it('should return a deduplicated forwarded chain when trustProxy is true', () => {
      // Arrange
      const request = buildRequest({
        [HeaderField.Forwarded]: 'for=198.51.100.1; proto=https, for="[2001:db8::abcd]:443"; host=example.com',
        [HeaderField.XForwardedFor]: '198.51.100.1, 192.0.2.10',
        [HeaderField.XRealIp]: '  "192.0.2.20:8080" ',
      });
      const { server } = mockServer('10.0.0.1');
      // Act
      const result = getIps(request, server, true);

      // Assert
      expect(result.ip).toBe('198.51.100.1');
      expect(result.ips).toEqual(['198.51.100.1', '2001:db8::abcd', '192.0.2.10']);
    });

    it('should fall back to x-real-ip when the forwarded chain is empty', () => {
      // Arrange
      const request = buildRequest({
        [HeaderField.XRealIp]: ' "::ffff:198.51.100.25:1234" ',
      });
      const { server } = mockServer('203.0.113.50');
      // Act
      const result = getIps(request, server, true);

      // Assert
      expect(result.ip).toBe('198.51.100.25');
      expect(result.ips).toBeUndefined();
    });

    it('should return undefined when all candidates are invalid', () => {
      // Arrange
      const request = buildRequest({
        [HeaderField.Forwarded]: 'for=unknown; proto=https, for=_hidden',
        [HeaderField.XForwardedFor]: 'unknown, none',
        [HeaderField.XRealIp]: '_obfuscated',
      });
      const { server } = mockServer(null);
      // Act
      const result = getIps(request, server, true);

      // Assert
      expect(result.ip).toBeUndefined();
      expect(result.ips).toBeUndefined();
    });
  });

  describe('collectForwardedFor', () => {
    it('should extract sanitized IPs when forwarded entries are provided', () => {
      // Arrange
      const header = 'for=198.51.100.1; proto=https, for="[2001:db8::1]:443";host=example.com';
      // Act
      const result = __internals.collectForwardedFor(header);

      // Assert
      expect(result).toEqual(['198.51.100.1', '2001:db8::1']);
    });

    it('should ignore segments when for keys or IPs are invalid', () => {
      // Arrange
      const header = 'for=unknown; host=example.com; for=_hidden, proto=https';
      // Act
      const result = __internals.collectForwardedFor(header);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle uppercase FOR keys when sanitizing entries', () => {
      // Arrange
      const header = 'FOR="198.51.100.2"; proto=http, For= "[2001:db8::2]"; by=proxy';
      // Act
      const result = __internals.collectForwardedFor(header);

      // Assert
      expect(result).toEqual(['198.51.100.2', '2001:db8::2']);
    });

    it('should skip placeholders when mixed IPv4 and IPv6 entries exist', () => {
      // Arrange
      const header = 'for="_hidden"; proto=http, for="198.51.100.3";by=proxy, for="[2001:db8::3]:10443";host';
      // Act
      const result = __internals.collectForwardedFor(header);

      // Assert
      expect(result).toEqual(['198.51.100.3', '2001:db8::3']);
    });

    it('should unescape nested quotes when stripping proxy port suffixes', () => {
      // Arrange
      const header = String.raw`for="\"198.51.100.4:8443\"";proto=https,for="\"[2001:db8::4]:10443\""`;
      // Act
      const result = __internals.collectForwardedFor(header);

      // Assert
      expect(result).toEqual(['198.51.100.4', '2001:db8::4']);
    });
  });

  describe('collectXForwardedFor', () => {
    it('should return sanitized IPs when the header has comma-separated values', () => {
      // Arrange
      const header = ' 198.51.100.1 , "::ffff:192.0.2.10", invalid ';
      // Act
      const result = __internals.collectXForwardedFor(header);

      // Assert
      expect(result).toEqual(['198.51.100.1', '192.0.2.10']);
    });

    it('should return an empty array when the header is absent', () => {
      // Arrange
      const header = null;
      // Act
      const result = __internals.collectXForwardedFor(header);

      // Assert
      expect(result).toEqual([]);
    });

    it('should preserve duplicates when mixed IPv4 and IPv6 values are present', () => {
      // Arrange
      const header = '198.51.100.1, 2001:db8::4 , 198.51.100.1 , _hidden , "[2001:db8::4]"';
      // Act
      const result = __internals.collectXForwardedFor(header);

      // Assert
      expect(result).toEqual(['198.51.100.1', '2001:db8::4', '198.51.100.1', '2001:db8::4']);
    });
  });

  describe('dedupePreserveOrder', () => {
    it('should remove duplicates when preserving order', () => {
      // Arrange
      const values = ['a', 'b', 'a', 'c', 'b'];
      // Act
      const result = __internals.dedupePreserveOrder(values);

      // Assert
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('extractHeaderIp', () => {
    it('should return sanitized IPs when valid values are provided', () => {
      // Arrange
      const valid = '"198.51.100.1"';
      const invalid = 'unknown';
      // Act
      const validResult = __internals.extractHeaderIp(valid);
      const invalidResult = __internals.extractHeaderIp(invalid);
      const missingResult = __internals.extractHeaderIp(undefined);

      // Assert
      expect(validResult).toBe('198.51.100.1');
      expect(invalidResult).toBeUndefined();
      expect(missingResult).toBeUndefined();
    });
  });

  describe('sanitizeIpCandidate', () => {
    it('should strip quotes and ports when sanitizing candidates', () => {
      // Arrange
      const ipv4 = ' "198.51.100.1:8080" ';
      const ipv6 = '[2001:db8::1]:443';
      const mapped = '::ffff:203.0.113.5';
      const hidden = '_hidden';
      // Act
      const ipv4Result = __internals.sanitizeIpCandidate(ipv4);
      const ipv6Result = __internals.sanitizeIpCandidate(ipv6);
      const mappedResult = __internals.sanitizeIpCandidate(mapped);
      const hiddenResult = __internals.sanitizeIpCandidate(hidden);

      // Assert
      expect(ipv4Result).toBe('198.51.100.1');
      expect(ipv6Result).toBe('2001:db8::1');
      expect(mappedResult).toBe('203.0.113.5');
      expect(hiddenResult).toBeUndefined();
    });

    it('should return undefined when tokens are blank or placeholders', () => {
      // Arrange
      const blank = '   ';
      const obfuscated = ' Obfuscated ';
      const prefixed = '_prefixed';
      // Act
      const blankResult = __internals.sanitizeIpCandidate(blank);
      const obfuscatedResult = __internals.sanitizeIpCandidate(obfuscated);
      const prefixedResult = __internals.sanitizeIpCandidate(prefixed);

      // Assert
      expect(blankResult).toBeUndefined();
      expect(obfuscatedResult).toBeUndefined();
      expect(prefixedResult).toBeUndefined();
    });

    it('should handle malformed mapped prefixes when IPv6 brackets are dangling', () => {
      // Arrange
      const invalidMapped = '::ffff:unknown';
      const danglingBracket = '[2001:db8::5';
      const quotedIpv4 = '" 198.51.100.5 "';
      // Act
      const invalidResult = __internals.sanitizeIpCandidate(invalidMapped);
      const danglingResult = __internals.sanitizeIpCandidate(danglingBracket);
      const quotedResult = __internals.sanitizeIpCandidate(quotedIpv4);

      // Assert
      expect(invalidResult).toBeUndefined();
      expect(danglingResult).toBe('2001:db8::5');
      expect(quotedResult).toBe('198.51.100.5');
    });
  });

  describe('stripOptionalQuotes', () => {
    it('should remove matching quotes when unescaping characters', () => {
      // Arrange
      const doubleQuoted = '"value"';
      const singleQuoted = "'va\\'lue'";
      const plain = 'value';
      // Act
      const doubleResult = __internals.stripOptionalQuotes(doubleQuoted);
      const singleResult = __internals.stripOptionalQuotes(singleQuoted);
      const plainResult = __internals.stripOptionalQuotes(plain);

      // Assert
      expect(doubleResult).toBe('value');
      expect(singleResult).toBe("va'lue");
      expect(plainResult).toBe('value');
    });
  });

  describe('stripPortSuffix', () => {
    it('should handle IPv4 ports when IPv6 segments are legitimate', () => {
      // Arrange
      const ipv4Port = '198.51.100.1:8080';
      const ipv6WithPort = '2001:db8::1:443';
      const ipv6Plain = '2001:db8::1';
      const ipv6InvalidPort = '2001:db8::1:65536';
      // Act
      const ipv4Result = __internals.stripPortSuffix(ipv4Port);
      const ipv6PortResult = __internals.stripPortSuffix(ipv6WithPort);
      const ipv6PlainResult = __internals.stripPortSuffix(ipv6Plain);
      const ipv6InvalidResult = __internals.stripPortSuffix(ipv6InvalidPort);

      // Assert
      expect(ipv4Result).toBe('198.51.100.1');
      expect(ipv6PortResult).toBe('2001:db8::1:443');
      expect(ipv6PlainResult).toBe('2001:db8::1');
      expect(ipv6InvalidResult).toBe('2001:db8::1');
    });
  });

  describe('isIpAddress', () => {
    it('should validate IPv4 and IPv6 values when inputs vary', () => {
      // Arrange
      const ipv4 = '198.51.100.1';
      const ipv6 = '2001:db8::1';
      const host = 'example.com';
      // Act
      const ipv4Result = __internals.isIpAddress(ipv4);
      const ipv6Result = __internals.isIpAddress(ipv6);
      const hostResult = __internals.isIpAddress(host);

      // Assert
      expect(ipv4Result).toBe(true);
      expect(ipv6Result).toBe(true);
      expect(hostResult).toBe(false);
    });
  });

  describe('isIpv4', () => {
    it('should validate dotted quad addresses when values are checked', () => {
      // Arrange
      const valid = '198.51.100.1';
      const overflow = '256.0.0.1';
      const leadingZero = '01.2.3.4';
      // Act
      const validResult = __internals.isIpv4(valid);
      const overflowResult = __internals.isIpv4(overflow);
      const leadingZeroResult = __internals.isIpv4(leadingZero);

      // Assert
      expect(validResult).toBe(true);
      expect(overflowResult).toBe(false);
      expect(leadingZeroResult).toBe(false);
    });

    it('should reject empty and non-numeric octets when validating IPv4', () => {
      // Arrange
      const emptyOctet = '198..100.1';
      const alphaOctet = '198.51a.100.1';
      const overflowOctet = '198.5123.100.1';
      // Act
      const emptyResult = __internals.isIpv4(emptyOctet);
      const alphaResult = __internals.isIpv4(alphaOctet);
      const overflowResult = __internals.isIpv4(overflowOctet);

      // Assert
      expect(emptyResult).toBe(false);
      expect(alphaResult).toBe(false);
      expect(overflowResult).toBe(false);
    });
  });

  describe('isIpv6', () => {
    it('should accept shorthand when IPv6 values are valid', () => {
      // Arrange
      const shorthand = '2001:db8::1';
      const full = '2001:db8:0000:0000:0000:0000:0000:0001';
      const invalid = '2001:db8::g';
      const noColons = 'no-colons-here';
      // Act
      const shorthandResult = __internals.isIpv6(shorthand);
      const fullResult = __internals.isIpv6(full);
      const invalidResult = __internals.isIpv6(invalid);
      const noColonsResult = __internals.isIpv6(noColons);

      // Assert
      expect(shorthandResult).toBe(true);
      expect(fullResult).toBe(true);
      expect(invalidResult).toBe(false);
      expect(noColonsResult).toBe(false);
    });

    it('should reject addresses when more than eight segments are present', () => {
      // Arrange
      const tooManySegments = '1:2:3:4:5:6:7:8:9';
      // Act
      const result = __internals.isIpv6(tooManySegments);

      // Assert
      expect(result).toBe(false);
    });
  });
});
