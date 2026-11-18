import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import { AuthService } from '../core/services/auth.service.js';
import { DriverService } from '../core/services/driver.service.js';
import { Delivery } from '../core/models/index.js';

@Component({
  selector: 'app-driver',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver.component.html',
  styleUrls: ['./driver.component.css'],
})
export class DriverComponent implements AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private driverService = inject(DriverService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  currentStep: 1 | 2 | 3 | 4 | 5 = 1; // 5 is success

  // Step 1: Scan
  manualCode = '';
  isScanning = false;
  scanError = '';
  activeDelivery: Delivery | null = null;
  private html5QrCode: Html5Qrcode | null = null;

  // Step 2: Photo
  capturedPhotoFile: File | null = null;
  capturedPhotoPreview: string | null = null;
  photoError = '';

  // Step 3: Signature
  @ViewChild('signatureCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;
  private isDrawing = false;
  private hasSignature = false;
  signatureDataUrl: string | null = null;
  sigError = '';

  // Step 4: Geolocation & Submit
  isLocating = false;
  gpsCoords: { latitude: number; longitude: number; accuracy?: number } | null = null;
  gpsError = '';
  isSubmitting = false;
  submitError = '';

  constructor() {}

  ngAfterViewInit(): void {
    // Canvas setup when reaching step 3
  }

  // ================= STEP 1: SCAN =================
  startCameraScanner(): void {
    this.scanError = '';
    this.isScanning = true;

    setTimeout(() => {
      try {
        this.html5QrCode = new Html5Qrcode('qr-reader');
        this.html5QrCode
          .start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              this.stopCameraScanner();
              this.lookupCode(decodedText);
            },
            () => {}
          )
          .catch((err) => {
            this.scanError = 'Unable to access camera. Please enter code manually.';
            this.isScanning = false;
            console.warn('QR Camera start error:', err);
          });
      } catch (err) {
        this.scanError = 'Scanner initialization failed. Use manual entry.';
        this.isScanning = false;
      }
    }, 100);
  }

  stopCameraScanner(): void {
    if (this.html5QrCode && this.html5QrCode.isScanning) {
      this.html5QrCode
        .stop()
        .then(() => {
          this.html5QrCode?.clear();
          this.isScanning = false;
        })
        .catch(() => {
          this.isScanning = false;
        });
    } else {
      this.isScanning = false;
    }
  }

  submitManualCode(): void {
    if (!this.manualCode.trim()) {
      this.scanError = 'Please enter a tracking or delivery number.';
      return;
    }
    this.lookupCode(this.manualCode.trim());
  }

  lookupCode(code: string): void {
    this.scanError = '';
    this.driverService.scanDelivery(code).subscribe({
      next: (res) => {
        this.activeDelivery = res.delivery;
        this.currentStep = 2; // Advance to Photo Step
      },
      error: (err) => {
        this.scanError = err.error?.error || 'Delivery not found or already completed.';
      },
    });
  }

  // ================= STEP 2: PHOTO =================
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        this.photoError = 'Please capture or select an image file.';
        return;
      }
      this.capturedPhotoFile = file;
      this.photoError = '';

      const reader = new FileReader();
      reader.onload = (e) => {
        this.capturedPhotoPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  retakePhoto(): void {
    this.capturedPhotoFile = null;
    this.capturedPhotoPreview = null;
  }

  proceedToSignature(): void {
    if (!this.capturedPhotoFile) {
      this.photoError = 'Photo capture is required before proceeding.';
      return;
    }
    this.currentStep = 3;
    setTimeout(() => this.initCanvas(), 100);
  }

  // ================= STEP 3: SIGNATURE =================
  initCanvas(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    canvas.width = canvas.parentElement?.clientWidth || 320;
    canvas.height = 180;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  startDraw(e: MouseEvent | TouchEvent): void {
    this.isDrawing = true;
    this.hasSignature = true;
    this.sigError = '';
    const ctx = this.canvasRef?.nativeElement.getContext('2d');
    if (!ctx) return;

    const pos = this.getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  draw(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing) return;
    const ctx = this.canvasRef?.nativeElement.getContext('2d');
    if (!ctx) return;

    const pos = this.getCanvasPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    e.preventDefault();
  }

  endDraw(): void {
    this.isDrawing = false;
  }

  clearSignature(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.hasSignature = false;
    this.signatureDataUrl = null;
  }

  private getCanvasPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.canvasRef!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const mouse = e as MouseEvent;
    return {
      x: mouse.clientX - rect.left,
      y: mouse.clientY - rect.top,
    };
  }

  proceedToReview(): void {
    if (!this.hasSignature || !this.canvasRef) {
      this.sigError = 'Customer signature is required.';
      return;
    }
    this.signatureDataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    this.currentStep = 4;
    this.acquireGeolocation();
  }

  // ================= STEP 4: GEOLOCATION & SUBMIT =================
  acquireGeolocation(): void {
    this.isLocating = true;
    this.gpsError = '';

    if (!('geolocation' in navigator)) {
      this.isLocating = false;
      this.gpsCoords = { latitude: 37.774929, longitude: -122.419418 };
      this.gpsError = 'Geolocation API not supported. Standard coordinates assigned.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isLocating = false;
        this.gpsCoords = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        };
      },
      (err) => {
        this.isLocating = false;
        console.warn('Geolocation error:', err);
        // Fallback GPS coordinates so workflow can still be submitted on desktop
        this.gpsCoords = { latitude: 37.774929, longitude: -122.419418 };
        this.gpsError = 'GPS signal unavailable or permission declined. Default coordinates logged.';
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  submitPoD(): void {
    if (!this.activeDelivery || !this.capturedPhotoFile || !this.signatureDataUrl || !this.gpsCoords) {
      this.submitError = 'All Proof-of-Delivery items (photo, signature, GPS) are required.';
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    this.driverService
      .completeDelivery(
        this.activeDelivery.id,
        this.capturedPhotoFile,
        this.signatureDataUrl,
        this.gpsCoords.latitude,
        this.gpsCoords.longitude
      )
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.currentStep = 5; // Success screen
        },
        error: (err) => {
          this.isSubmitting = false;
          this.submitError = err.error?.error || 'Failed to submit Proof of Delivery.';
        },
      });
  }

  resetWorkflow(): void {
    this.activeDelivery = null;
    this.capturedPhotoFile = null;
    this.capturedPhotoPreview = null;
    this.signatureDataUrl = null;
    this.hasSignature = false;
    this.gpsCoords = null;
    this.manualCode = '';
    this.currentStep = 1;
  }

  logout(): void {
    this.stopCameraScanner();
    this.authService.logout();
  }

  ngOnDestroy(): void {
    this.stopCameraScanner();
  }
}
