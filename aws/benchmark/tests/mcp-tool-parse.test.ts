import { describe, expect, it } from 'vitest';

import {
  findToolBySuffix,
  parseMcpToolJson,
} from '../shared/src/mcp-tool-parse.js';

describe('mcp tool parse', () => {
  it('parses text content JSON', () => {
    const value = parseMcpToolJson({
      content: [{ type: 'text', text: '{"id":"CLM-001"}' }],
    });
    expect(value).toEqual({ id: 'CLM-001' });
  });

  it('finds prefixed gateway tool names', () => {
    const name = findToolBySuffix(
      [
        { name: 'insurance-ai-benchmark-claims-getClaimStatus___getClaimStatus' },
      ],
      'getClaimStatus',
    );
    expect(name).toContain('getClaimStatus');
  });
});