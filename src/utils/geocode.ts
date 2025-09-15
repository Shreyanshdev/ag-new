import axios from 'axios';

// Frontend geocoding utility using Google Maps API
export async function geocodeAddress(addressString: string) {
  try {
    // Using the Google Maps API key from environment variables
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google Maps API key not found in environment variables');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${apiKey}`;
    const response = await axios.get(url);
    
    if (
      response.data &&
      response.data.status === "OK" &&
      response.data.results &&
      response.data.results.length > 0
    ) {
      const loc = response.data.results[0].geometry.location;
      return {
        latitude: loc.lat,
        longitude: loc.lng,
        formattedAddress: response.data.results[0].formatted_address,
      };
    } else {
      throw new Error("Could not geocode address");
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

// Reverse geocoding utility
export async function reverseGeocode(latitude: number, longitude: number) {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google Maps API key not found in environment variables');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
    const response = await axios.get(url);
    
    if (
      response.data &&
      response.data.status === "OK" &&
      response.data.results &&
      response.data.results.length > 0
    ) {
      return response.data.results[0];
    } else {
      throw new Error("Could not reverse geocode coordinates");
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
}
