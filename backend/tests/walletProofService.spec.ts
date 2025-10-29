import { describe, expect, it } from 'vitest';

import { __testables } from '../src/services/walletProofService';

const { normalizeDomain, parseDomainCandidate, collectAllowedDomains, hashNonce } = __testables;

describe('walletProofService helpers', () => {
  describe('normalizeDomain', () => {
    it('trims, lowercases and strips trailing dots', () => {
      expect(normalizeDomain(' Example.COM. ')).toBe('example.com');
    });
  });

  describe('parseDomainCandidate', () => {
    it('parses hostnames without scheme', () => {
      expect(parseDomainCandidate('example.com/path')).toBe('example.com');
    });

    it('parses urls with scheme', () => {
      expect(parseDomainCandidate('https://foo.bar:3000/connect')).toBe('foo.bar:3000');
    });

    it('returns null for invalid input', () => {
      expect(parseDomainCandidate('not a domain')).toBeNull();
    });
  });

  describe('collectAllowedDomains', () => {
    it('includes defaults and merges env/cors values without duplicates', () => {
      const previousEnv = process.env.TON_PROOF_ALLOWED_DOMAINS;
      process.env.TON_PROOF_ALLOWED_DOMAINS = 'Example.com, foo.bar';

      const allowed = collectAllowedDomains();

      process.env.TON_PROOF_ALLOWED_DOMAINS = previousEnv;

      expect(allowed).toContain('example.com');
      expect(allowed).toContain('cladhunter-ai-frontend.vercel.app');
      expect(allowed).toContain('cladhinter-ai-frontend.vercel.app');
      expect(allowed).toContain('foo.bar');
      const unique = new Set(allowed);
      expect(unique.size).toBe(allowed.length);
    });
  });

  describe('hashNonce', () => {
    it('produces deterministic base64url output for identical input', () => {
      const left = hashNonce('abc');
      const right = hashNonce('abc');

      expect(left).toBe(right);
      expect(/^[A-Za-z0-9_-]+$/.test(left)).toBe(true);
    });
  });
});
