// Maps a dashboard pathname to the licence module that gates it. Mirrors the
// backend app/licensing/router_map.py — the frontend version operates on URL
// prefixes so the route guard can block direct navigation to a module the
// licence doesn't include (UX layer; the API is the real boundary).
//
// `null` (or an unmatched path) means CORE / always-reachable: dashboard,
// inbox, configuration, the licence screen itself, and anything we don't gate.
// Most-specific prefix wins, so /erm/bcm resolves to BCM before /erm → ERM.

type Entry = [prefix: string, moduleCode: string];

// Ordered longest-prefix-first. Sub-modules of ERM are listed before the /erm
// base so they gate on their own code.
const ROUTE_MODULE: Entry[] = [
  ["/erm/bcm", "BCM"],
  ["/erm/controls", "CONTROL"],
  ["/erm/vendors", "VENDOR"],
  ["/erm/insurance", "INSURANCE"],
  ["/erm/kris", "KRI"],
  ["/erm/appetite", "APPETITE"],
  ["/erm/compliance", "ERM_COMPLIANCE"],
  ["/erm/loss", "LOSS"],
  ["/erm", "ERM"],
  ["/observations", "OBSERVATION"],
  ["/near-miss", "NEAR_MISS"],
  ["/ptw", "PTW"],
  ["/flra", "FLRA"],
  ["/incidents", "INCIDENT"],
  ["/hira", "HIRA"],
  ["/eai", "EAI"],
  ["/risk-register", "RISK_AGG"],
  ["/risk-dashboard", "RISK_AGG"],
  ["/capa", "CAPA"],
  ["/moc", "MOC"],
  ["/compliance", "STATUTORY_REGISTERS"],
  ["/facilities", "FACILITIES"],
  ["/cams", "CAMS"],
  ["/audit-compliance", "CAMS"],
  ["/training-intelligence", "COMPETENCY"],
  ["/training", "TRAINING"],
  ["/skill-matrix", "COMPETENCY"],
  ["/sci", "SCI"],
  ["/ppe", "PPE"],
  ["/inspections", "INSPECTION"],
  ["/manhours", "MANHOURS"],
  ["/anomalies", "ANOMALIES"],
  ["/epc", "EPC"],
];

/** The module code that gates `pathname`, or null when the route is core. */
export function moduleForPath(pathname: string): string | null {
  for (const [prefix, code] of ROUTE_MODULE) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return code;
  }
  return null;
}
