import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';

import type { MotionFeatures } from '@/types/domain';

interface MotionPoint {
  at: number;
  magnitude: number;
  rotation: number;
}

export class MotionWindow {
  private points: MotionPoint[] = [];

  add(measurement: DeviceMotionMeasurement): void {
    const acceleration = measurement.accelerationIncludingGravity ?? measurement.acceleration;
    if (!acceleration) return;
    const magnitudeMetersPerSecondSquared = Math.sqrt(
      acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2,
    );
    const magnitude = magnitudeMetersPerSecondSquared / DeviceMotion.Gravity;
    const rotationRate = measurement.rotationRate;
    const rotation = rotationRate
      ? Math.sqrt(rotationRate.alpha ** 2 + rotationRate.beta ** 2 + rotationRate.gamma ** 2)
      : 0;
    const now = Date.now();
    this.points.push({ at: now, magnitude, rotation });
    this.points = this.points.filter((point) => now - point.at <= 5_000);
  }

  snapshot(): MotionFeatures {
    if (this.points.length < 2) {
      return {
        peakAccelerationG: 0,
        jerkRms: 0,
        rotationRms: 0,
        freeFallObserved: false,
        impactAfterFreeFall: false,
        sampleCount: this.points.length,
      };
    }

    const jerks: number[] = [];
    let freeFallAt: number | null = null;
    let impactAfterFreeFall = false;
    for (let index = 1; index < this.points.length; index += 1) {
      const previous = this.points[index - 1];
      const current = this.points[index];
      if (!previous || !current) continue;
      const seconds = Math.max((current.at - previous.at) / 1_000, 0.02);
      jerks.push(Math.abs(current.magnitude - previous.magnitude) / seconds);
      if (current.magnitude < 0.3) freeFallAt = current.at;
      if (freeFallAt && current.at - freeFallAt <= 1_500 && current.magnitude > 2.6) {
        impactAfterFreeFall = true;
      }
    }

    const rms = (values: number[]) =>
      values.length
        ? Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length)
        : 0;
    return {
      peakAccelerationG: Math.max(...this.points.map((point) => point.magnitude)),
      jerkRms: rms(jerks),
      rotationRms: rms(this.points.map((point) => point.rotation)),
      freeFallObserved: freeFallAt !== null,
      impactAfterFreeFall,
      sampleCount: this.points.length,
    };
  }
}
