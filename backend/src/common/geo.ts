export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Known sectors with centre points (Islamabad / Rawalpindi). */
export const SECTORS: Record<string, [number, number]> = {
  'G-8': [33.7004, 73.0505],
  'G-9': [33.6938, 73.0313],
  'G-10': [33.6845, 73.0136],
  'G-11': [33.668, 72.9958],
  'F-7': [33.7215, 73.056],
  'F-8': [33.71, 73.038],
  'F-10': [33.695, 73.013],
  'F-11': [33.6847, 72.9877],
  'E-11': [33.699, 72.974],
  'I-8': [33.667, 73.075],
  'I-10': [33.649, 73.039],
  'Blue Area': [33.71, 73.06],
  Saddar: [33.5973, 73.0479],
  'Satellite Town': [33.638, 73.071],
  Westridge: [33.613, 73.03],
  'Bahria Town': [33.532, 73.121],
  DHA: [33.531, 73.159],
};

export const sectorPoint = (area?: string | null) => (area ? SECTORS[area.split('/')[0].trim()] : undefined);
