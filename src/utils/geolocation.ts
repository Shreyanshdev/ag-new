
// src/utils/geolocation.ts

/**
 * Calculates the distance between two coordinates in kilometers using the Haversine formula.
 * @param lat1 - Latitude of the first point.
 * @param lon1 - Longitude of the first point.
 * @param lat2 - Latitude of the second point.
 * @param lon2 - Longitude of the second point.
 * @returns The distance in kilometers.
 */
export const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

/**
 * Calculates the delivery fee based on the distance in kilometers.
 * @param distanceInKm - The distance in kilometers.
 * @returns The delivery fee in rupees.
 */
export const calculateDeliveryFee = (distanceInKm: number): number => {
  if (distanceInKm <= 4) {
    return 20;
  } else if (distanceInKm <= 8) {
    return 30;
  } else if (distanceInKm <= 10) {
    return 50;
  } else {
    return 100;
  }
};
