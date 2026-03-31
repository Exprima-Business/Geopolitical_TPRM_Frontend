import type { RiskEvent } from "@/types";

// --- Severity helpers ---

export type SeverityLevel = "critical" | "high" | "medium" | "low";

export function getSeverityLevel(score: number): SeverityLevel {
  if (score >= 8) return "critical";
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function getSeverityLabel(score: number): string {
  return getSeverityLevel(score).charAt(0).toUpperCase() + getSeverityLevel(score).slice(1);
}

// --- Human-readable titles ---

const GDELT_VERB_MAP: Record<string, string> = {
  fight: "Armed Conflict",
  assault: "Violent Assault",
  coerce: "Coercive Action",
  threaten: "Threat Issued",
  protest: "Civil Protest",
  demand: "Political Demand",
  disapprove: "Political Disapproval",
  reduce: "Diplomatic Reduction",
  reject: "Diplomatic Rejection",
  investigate: "Investigation",
  "mass killing": "Mass Casualty Event",
  "unconventional mass violence": "Mass Violence Event",
  "use conventional military force": "Military Action",
  "use unconventional violence": "Unconventional Violence",
  "exhibit military posture": "Military Posture",
  "engage in material cooperation": "Material Cooperation",
  "appeal": "Diplomatic Appeal",
  "consult": "Diplomatic Consultation",
  "express intent to cooperate": "Cooperative Intent",
  "yield": "Diplomatic Concession",
};

export function formatEventTitle(event: RiskEvent): string {
  const { title, region } = event;
  if (!title) return "Unknown Event";

  // Try to match the verb from "Verb in Location" pattern
  const match = title.match(/^(.+?)\s+in\s+(.+)$/i);
  if (match) {
    const verb = match[1].trim().toLowerCase();
    const location = match[2].trim();
    const readable = GDELT_VERB_MAP[verb];
    if (readable) return `${readable} in ${location}`;
    // Capitalize if no mapping found
    return `${match[1].trim()} in ${location}`;
  }

  return region ? `${title} — ${region}` : title;
}

export function formatEventDescription(event: RiskEvent): string {
  // If the backend provides a rich description, use it
  if (event.description && !event.description.startsWith("GDELT event")) {
    return event.description;
  }

  // Otherwise build from available data
  const parts: string[] = [];
  const raw = event.raw_data;

  const level = getSeverityLabel(event.severity);
  parts.push(`${level} severity (${event.severity.toFixed(1)}/10)`);

  if (event.confidence) {
    parts.push(`${Math.round(event.confidence * 100)}% confidence`);
  }

  if (event.region) {
    parts.push(event.region);
  }

  if (event.started_at) {
    const date = new Date(event.started_at);
    parts.push(`Started ${date.toLocaleDateString()}`);
  }

  // Add media metrics if raw_data available
  if (raw?.num_mentions && raw.num_mentions > 1) {
    parts.push(`${raw.num_mentions} media mentions`);
  }

  return parts.join(" · ");
}

// --- Country centroid geocoding ---

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [-98.58, 39.83],
  GB: [-1.17, 52.36],
  UK: [-1.17, 52.36],
  IN: [78.96, 20.59],
  CN: [104.20, 35.86],
  RU: [105.32, 61.52],
  DE: [10.45, 51.17],
  FR: [2.21, 46.23],
  JP: [138.25, 36.20],
  BR: [-51.93, -14.24],
  AU: [133.78, -25.27],
  CA: [-106.35, 56.13],
  ZA: [22.94, -30.56],
  MX: [-102.55, 23.63],
  KR: [127.77, 35.91],
  ES: [-3.75, 40.46],
  IT: [12.57, 41.87],
  TR: [35.24, 38.96],
  SA: [45.08, 23.89],
  EG: [30.80, 26.82],
  NG: [8.68, 9.08],
  PK: [69.35, 30.38],
  ID: [113.92, -0.79],
  PH: [121.77, 12.88],
  TH: [100.99, 15.87],
  VN: [108.28, 14.06],
  PL: [19.15, 51.92],
  UA: [31.17, 48.38],
  IR: [53.69, 32.43],
  IQ: [43.68, 33.22],
  SY: [38.99, 34.80],
  AF: [67.71, 33.94],
  KE: [37.91, -0.02],
  ET: [40.49, 9.15],
  CO: [-74.30, 4.57],
  AR: [-63.62, -38.42],
  CL: [-71.54, -35.68],
  PE: [-75.02, -9.19],
  VE: [-66.59, 6.42],
  MY: [101.98, 4.21],
  SG: [103.82, 1.35],
  TW: [120.96, 23.69],
  IL: [34.85, 31.05],
  LB: [35.86, 33.85],
  JO: [36.24, 30.59],
  AE: [53.85, 23.42],
  QA: [51.18, 25.35],
  KW: [47.48, 29.31],
  MM: [95.96, 21.91],
  BD: [90.36, 23.68],
  LK: [80.77, 7.87],
  NP: [84.12, 28.39],
  SE: [18.64, 60.13],
  NO: [8.47, 60.47],
  FI: [25.75, 61.92],
  DK: [9.50, 56.26],
  NL: [5.29, 52.13],
  BE: [4.47, 50.50],
  CH: [8.23, 46.82],
  AT: [14.55, 47.52],
  CZ: [15.47, 49.82],
  RO: [24.97, 45.94],
  HU: [19.50, 47.16],
  GR: [21.82, 39.07],
  PT: [-8.22, 39.40],
  IE: [-8.24, 53.41],
  SO: [46.20, 5.15],
  SD: [30.22, 12.86],
  LY: [17.23, 26.34],
  TN: [9.54, 33.89],
  DZ: [1.66, 28.03],
  MA: [-7.09, 31.79],
  GH: [-1.02, 7.95],
  CM: [12.35, 7.37],
  CD: [21.76, -4.04],
  AO: [17.87, -11.20],
  MZ: [35.53, -18.67],
  TZ: [34.89, -6.37],
  UG: [32.29, 1.37],
  YE: [48.52, 15.55],
  OM: [55.92, 21.51],
  BH: [50.56, 26.07],
  GE: [43.36, 42.32],
  AM: [45.04, 40.07],
  AZ: [47.58, 40.14],
};

// US state approximate centroids for "State, United States" patterns
const US_STATE_CENTROIDS: Record<string, [number, number]> = {
  alabama: [-86.90, 32.32], alaska: [-153.37, 64.20], arizona: [-111.09, 34.05],
  arkansas: [-91.83, 35.20], california: [-119.42, 36.78], colorado: [-105.31, 39.55],
  connecticut: [-72.76, 41.60], delaware: [-75.51, 38.91], florida: [-81.52, 27.66],
  georgia: [-83.50, 32.17], hawaii: [-155.47, 19.90], idaho: [-114.48, 44.07],
  illinois: [-89.40, 40.63], indiana: [-86.13, 40.27], iowa: [-93.10, 41.88],
  kansas: [-98.48, 38.51], kentucky: [-84.27, 37.84], louisiana: [-91.87, 30.98],
  maine: [-69.45, 45.25], maryland: [-76.64, 39.05], massachusetts: [-71.53, 42.41],
  michigan: [-84.54, 44.31], minnesota: [-94.69, 46.73], mississippi: [-89.68, 32.35],
  missouri: [-91.83, 37.96], montana: [-109.53, 46.88], nebraska: [-99.90, 41.49],
  nevada: [-116.42, 38.80], "new hampshire": [-71.57, 43.19], "new jersey": [-74.41, 40.06],
  "new mexico": [-105.87, 34.52], "new york": [-75.01, 43.00], "north carolina": [-79.01, 35.76],
  "north dakota": [-101.00, 47.55], ohio: [-82.91, 40.42], oklahoma: [-97.09, 35.47],
  oregon: [-120.55, 43.80], pennsylvania: [-77.21, 41.20], "rhode island": [-71.48, 41.58],
  "south carolina": [-81.16, 33.84], "south dakota": [-99.90, 43.97], tennessee: [-86.58, 35.52],
  texas: [-99.90, 31.97], utah: [-111.09, 39.32], vermont: [-72.58, 44.56],
  virginia: [-78.66, 37.43], washington: [-120.74, 47.75], "west virginia": [-80.45, 38.60],
  wisconsin: [-89.62, 43.78], wyoming: [-107.29, 43.08], "district of columbia": [-77.03, 38.91],
};

export function getEventCoordinates(event: RiskEvent): [number, number] | null {
  // Use actual coordinates if available
  if (event.latitude != null && event.longitude != null) {
    return [event.longitude, event.latitude];
  }

  // Try to extract US state from region like "Ohio, United States"
  if (event.region) {
    const usMatch = event.region.match(/^(.+?),\s*United States$/i);
    if (usMatch) {
      const state = usMatch[1].trim().toLowerCase();
      // Check if it's "City, State, United States" or "State, United States"
      const parts = usMatch[1].split(",");
      const stateName = parts.length > 1 ? parts[parts.length - 1].trim().toLowerCase() : state;
      if (US_STATE_CENTROIDS[stateName]) return US_STATE_CENTROIDS[stateName];
      if (US_STATE_CENTROIDS[state]) return US_STATE_CENTROIDS[state];
    }
  }

  // Fall back to country centroid
  if (event.country_code) {
    const code = event.country_code.toUpperCase();
    if (COUNTRY_CENTROIDS[code]) return COUNTRY_CENTROIDS[code];
  }

  // Try to extract country from region string
  if (event.region) {
    const regionLower = event.region.toLowerCase();
    if (regionLower.includes("united states")) return COUNTRY_CENTROIDS["US"];
    if (regionLower.includes("united kingdom")) return COUNTRY_CENTROIDS["GB"];
    if (regionLower.includes("india")) return COUNTRY_CENTROIDS["IN"];
    if (regionLower.includes("china")) return COUNTRY_CENTROIDS["CN"];
    if (regionLower.includes("spain")) return COUNTRY_CENTROIDS["ES"];
    if (regionLower.includes("france")) return COUNTRY_CENTROIDS["FR"];
    if (regionLower.includes("germany")) return COUNTRY_CENTROIDS["DE"];
    if (regionLower.includes("russia")) return COUNTRY_CENTROIDS["RU"];
    if (regionLower.includes("japan")) return COUNTRY_CENTROIDS["JP"];
    if (regionLower.includes("brazil")) return COUNTRY_CENTROIDS["BR"];
    if (regionLower.includes("australia")) return COUNTRY_CENTROIDS["AU"];
    if (regionLower.includes("canada")) return COUNTRY_CENTROIDS["CA"];
  }

  return null;
}
