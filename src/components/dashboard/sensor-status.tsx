'use client';
import { Video, MapPin, PersonStanding } from 'lucide-react';
import { SensorCard } from './sensor-card';
import type { AlertLevel } from '@/lib/types';
import { useState, useEffect } from 'react';

const sensorStatusMap: Record<AlertLevel, Record<string, string>> = {
    NORMAL: {
        Audio: 'Monitoring Ambient Sound',
        Vision: 'Analyzing Surroundings',
        Location: 'Establishing Geofence',
        Motion: 'Calibrating Gyroscope'
    },
    LOW_RISK: {
        Audio: 'Elevated Voice Detected',
        Vision: 'Unusual Motion Detected',
        Location: 'High-Traffic Area',
        Motion: 'Irregular Movement'
    },
    MEDIUM_RISK: {
        Audio: 'Possible Distress Keywords',
        Vision: 'Face Occlusion Detected',
        Location: 'Entering Risky Area',
        Motion: 'Sudden Stop Detected'
    },
    HIGH_RISK: {
        Audio: 'Scream Detected',
        Vision: 'Fall Detected',
        Location: 'Known Incident Hotspot',
        Motion: 'Erratic Motion Detected'
    },
    EMERGENCY: {
        Audio: 'Continuous Distress Signal',
        Vision: 'User Unresponsive',
        Location: 'Last Known Coordinates',
        Motion: 'No Movement'
    }
}

export function SensorStatus({ alertLevel }: { alertLevel: AlertLevel }) {
  const [hasPermission, setHasPermission] = useState({
    vision: false,
    location: false,
    motion: false,
  });

  useEffect(() => {
    // Check for camera and mic permission
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const video = devices.some(d => d.kind === 'videoinput' && d.label);
      setHasPermission(prev => ({...prev, vision: video}));
    });

    // Check for location permission
    navigator.permissions.query({name:'geolocation'}).then(permissionStatus => {
        setHasPermission(prev => ({...prev, location: permissionStatus.state === 'granted'}));
        permissionStatus.onchange = () => {
            setHasPermission(prev => ({...prev, location: permissionStatus.state === 'granted'}));
        }
    });

    // Check for motion sensor permission
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      (DeviceMotionEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            setHasPermission(prev => ({...prev, motion: true}));
          }
        })
    } else {
        // Handle non-iOS 13+ devices.
        window.addEventListener('devicemotion', () => setHasPermission(prev => ({...prev, motion: true})), {once: true});
    }

  }, []);
  
  const statuses = sensorStatusMap[alertLevel];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SensorCard
        name="Vision Detection"
        icon={Video}
        isActive={hasPermission.vision}
        statusText={statuses.Vision}
        alertLevel={alertLevel}
      />
       <SensorCard
        name="Motion Analysis"
        icon={PersonStanding}
        isActive={hasPermission.motion}
        statusText={statuses.Motion}
        alertLevel={alertLevel}
      />
      <SensorCard
        name="Location Context"
        icon={MapPin}
        isActive={hasPermission.location}
        statusText={statuses.Location}
        alertLevel={alertLevel}
      />
    </div>
  );
}
