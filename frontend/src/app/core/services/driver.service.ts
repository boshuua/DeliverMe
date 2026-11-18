import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Delivery, ProofOfDelivery } from '../models/index.js';

@Injectable({
  providedIn: 'root',
})
export class DriverService {
  private apiUrl = '/api/v1/driver';

  constructor(private http: HttpClient) {}

  scanDelivery(code: string): Observable<{ delivery: Delivery }> {
    return this.http.get<{ delivery: Delivery }>(
      `${this.apiUrl}/deliveries/scan/${encodeURIComponent(code)}`
    );
  }

  completeDelivery(
    deliveryId: string,
    photoFile: File,
    signature: Blob | string,
    latitude: number,
    longitude: number
  ): Observable<{ message: string; deliveryId: string; proofOfDelivery: ProofOfDelivery }> {
    const formData = new FormData();
    formData.append('photo', photoFile, 'proof-photo.jpg');

    if (typeof signature === 'string') {
      formData.append('signature', signature);
    } else {
      formData.append('signature', signature, 'signature.png');
    }

    formData.append('latitude', latitude.toString());
    formData.append('longitude', longitude.toString());

    return this.http.post<{ message: string; deliveryId: string; proofOfDelivery: ProofOfDelivery }>(
      `${this.apiUrl}/deliveries/${deliveryId}/complete`,
      formData
    );
  }
}
