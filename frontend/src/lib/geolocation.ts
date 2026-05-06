export interface BrowserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const getBrowserLocation = (): Promise<BrowserLocation> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location access is required. Please enable location and try again.'));
            return;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Your location could not be determined. Please move to an open area and try again.'));
            return;
          case error.TIMEOUT:
            reject(new Error('Location request timed out. Please try again.'));
            return;
          default:
            reject(new Error('Unable to access your location. Please try again.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
