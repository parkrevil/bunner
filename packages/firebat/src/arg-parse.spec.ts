import { describe, expect, it } from 'bun:test';
import * as path from 'node:path';

import { parseArgs } from './arg-parse';

describe('arg-parse', () => {
  it('should return default options when no args are provided', () => {
    // Arrange
    let argv: string[] = [];
    // Act
    let result = parseArgs(argv);

    // Assert
    expect(result.targets).toEqual([]);
    expect(result.format).toBe('text');
    expect(result.minTokens).toBe('auto');
    expect(result.exitOnFindings).toBe(true);
    expect(result.detectors).toEqual([
      'duplicates',
      'waste',
      'dependencies',
      'coupling',
      'duplication',
      'nesting',
      'early-return',
      'noop',
      'api-drift',
    ]);
    expect(result.help).toBe(false);
  });

  it('should return help mode with defaults when help flag is provided', () => {
    // Arrange
    let argv = ['--help'];
    // Act
    let result = parseArgs(argv);

    // Assert
    expect(result.help).toBe(true);
    expect(result.targets).toEqual([]);
    expect(result.format).toBe('text');
    expect(result.minTokens).toBe('auto');
    expect(result.exitOnFindings).toBe(true);
    expect(result.detectors).toEqual([
      'duplicates',
      'waste',
      'dependencies',
      'coupling',
      'duplication',
      'nesting',
      'early-return',
      'noop',
      'api-drift',
    ]);
  });

  it('should parse format, minTokens, and targets when options are provided', () => {
    // Arrange
    let argv = ['--format', 'json', '--min-tokens', '120', 'packages'];
    // Act
    let result = parseArgs(argv);

    // Assert
    expect(result.format).toBe('json');
    expect(result.minTokens).toBe(120);
    expect(result.targets).toEqual([path.resolve('packages')]);
    expect(result.detectors).toEqual([
      'duplicates',
      'waste',
      'dependencies',
      'coupling',
      'duplication',
      'nesting',
      'early-return',
      'noop',
      'api-drift',
    ]);
    expect(result.help).toBe(false);
  });

  it('should parse detectors when --only is provided', () => {
    // Arrange
    let argv = ['--only', 'waste', 'packages'];
    // Act
    let result = parseArgs(argv);

    // Assert
    expect(result.detectors).toEqual(['waste']);
  });

  it('should throw a validation error when an unknown option is provided', () => {
    // Arrange
    let argv = ['--nope'];

    // Act
    let act = () => parseArgs(argv);

    // Assert
    expect(act).toThrow('[firebat] Unknown option: --nope');
  });
});
