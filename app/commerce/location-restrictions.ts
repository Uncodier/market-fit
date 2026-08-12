export interface LocationRestriction {
  enabled: boolean;
  included_addresses?: Address[];
  excluded_addresses?: Address[];
}

export interface Address {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

function normalize(str?: string): string {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Collapse common ISO / name variants so MX matches Mexico, US matches United States, etc. */
function normalizeCountry(str?: string): string {
  const n = normalize(str);
  const aliases: Record<string, string> = {
    mx: 'mexico',
    mexico: 'mexico',
    us: 'united states',
    usa: 'united states',
    'united states': 'united states',
    'united states of america': 'united states',
    gb: 'united kingdom',
    uk: 'united kingdom',
    'united kingdom': 'united kingdom',
  };
  return aliases[n] || n;
}

function addressMatches(rule: Address, target: Address): boolean {
  if (rule.country) {
    if (target.country) {
      if (normalizeCountry(rule.country) !== normalizeCountry(target.country)) return false;
    } else if (!rule.city && !rule.state && !rule.zip && !rule.address) {
      // Country-only rule cannot match a buyer with no country
      return false;
    }
    // Rule has city/zip too: allow match on those when store pick omitted country
  }
  if (rule.state) {
    if (target.state) {
      if (normalize(rule.state) !== normalize(target.state)) return false;
    } else if (!rule.city && !rule.zip && !rule.address) {
      return false;
    }
  }
  if (rule.city && normalize(rule.city) !== normalize(target.city)) return false;
  if (rule.zip && normalize(rule.zip) !== normalize(target.zip)) return false;
  
  // If rule has an address line, we do a basic includes match (or exact).
  // Usually exclusions are by city or zip.
  if (rule.address) {
    const ruleAddr = normalize(rule.address);
    const targetAddr = normalize(target.address);
    if (ruleAddr && !targetAddr.includes(ruleAddr)) return false;
  }
  
  // Must match at least one geographical criteria (don't match empty rule to everything)
  const hasCriteria = !!(rule.country || rule.state || rule.city || rule.zip || rule.address);
  return hasCriteria;
}

export function evaluateLocationRestrictions(
  locations: Array<{ restrictions?: LocationRestriction }>,
  buyerAddress: Address
): { available: boolean; reason?: 'excluded' | 'outside_service_area' } {
  if (!locations || locations.length === 0) return { available: true };
  if (!buyerAddress.country && !buyerAddress.city && !buyerAddress.zip) {
    // If we have no buyer location at all, we can't restrict them yet.
    return { available: true };
  }

  const activeRestrictions = locations
    .map(loc => loc.restrictions)
    .filter((r): r is LocationRestriction => !!r?.enabled);

  if (activeRestrictions.length === 0) return { available: true };

  // 1. Check exclusions (Exclude wins over include)
  for (const restriction of activeRestrictions) {
    if (restriction.excluded_addresses) {
      for (const rule of restriction.excluded_addresses) {
        if (addressMatches(rule, buyerAddress)) {
          return { available: false, reason: 'excluded' };
        }
      }
    }
  }

  // 2. Check inclusions ("solo trabajo")
  // Ignore blank placeholder rows (enabled + empty city/country) — those used to block everyone.
  const meaningfulIncludes = (addrs?: Address[]) =>
    (addrs || []).filter(
      (a) => !!(a.country || a.state || a.city || a.zip || a.address)
    );

  const hasAnyInclusions = activeRestrictions.some(
    (r) => meaningfulIncludes(r.included_addresses).length > 0
  );

  if (hasAnyInclusions) {
    let matchedInclude = false;
    for (const restriction of activeRestrictions) {
      for (const rule of meaningfulIncludes(restriction.included_addresses)) {
        if (addressMatches(rule, buyerAddress)) {
          matchedInclude = true;
          break;
        }
      }
      if (matchedInclude) break;
    }

    if (!matchedInclude) {
      return { available: false, reason: 'outside_service_area' };
    }
  }

  return { available: true };
}
