import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';

import {
  extractCalibratedMotionFeatures,
  SAFETY_CALIBRATION,
  type CalibratedMotionPoint,
} from '@/inference/safetyCalibration';
import type { MotionFeatures } from '@/types/domain';

export class MotionWindow {
  private points: CalibratedMotionPoint[] = [];

  add(measurement: DeviceMotionMeasurement): void {
    const acceleration = measurement.accelerationIncludingGravity ?? measurement.acceleration;
    if (!acceleration) return;
    const magnitudeMetersPerSecondSquared = Math.sqrt(
      acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2,
    );
    const magnitude = magnitudeMetersPerSecondSquared / DeviceMotion.Gravity;
    const rotationRate = measurement.rotationRate;
    const rotationDps = rotationRate
      ? Math.sqrt(rotationRate.alpha ** 2 + rotationRate.beta ** 2 + rotationRate.gamma ** 2)
      : 0;
    const sensorTimestampSeconds =
      acceleration.timestamp || rotationRate?.timestamp || Number.NaN;
    const at = Number.isFinite(sensorTimestampSeconds)
      ? sensorTimestampSeconds * 1_000
      : Date.now();
    this.addCalibratedPoint({ at, magnitudeG: magnitude, rotationDps });
  }

  addCalibratedPoint(point: CalibratedMotionPoint): void {
    this.points.push(point);
    this.points = this.points.filter(
      (candidate) => point.at - candidate.at <= SAFETY_CALIBRATION.motionWindowMs,
    );
  }

  snapshot(): MotionFeatures {
    return extractCalibratedMotionFeatures(this.points);
  }
}
