import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private http = inject(HttpClient);

  /**
   * Gets the current geolocation of the user.
   */
  getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      }
    });
  }

  /**
   * Performs reverse geocoding using Nominatim API to get location name from coordinates.
   */
  async reverseGeocode(lat: number, lon: number): Promise<string> {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    try {
      const response: any = await firstValueFrom(this.http.get(url));
      // Nominatim response display_name is often very long, we might want a shorter version if available
      return response.display_name || 'Unknown Location';
    } catch (error) {
      console.error('Error fetching location from Nominatim:', error);
      throw error;
    }
  }
}
