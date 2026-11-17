// Tarifa configurable para Chancay (soles)
export const FARE = { base: 3, perKm: 1.2, minimum: 4 };

// Centro de Chancay
export const CHANCAY_CENTER = { latitude: -11.5714, longitude: -77.2711, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimateFare(km: number): number {
  const road = km * 1.25; // factor aproximado por calles
  return Math.max(FARE.minimum, Math.round((FARE.base + road * FARE.perKm) * 10) / 10);
}
