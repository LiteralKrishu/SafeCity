'use client';
import { Mic, Video, MapPin, PersonStanding } from 'lucide-react';
import { SensorCard } from './sensor-card';
import type { AlertLevel } from '@/lib/types';
import { useState } from 'react';

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
  const [activeSensors] = useState({
    audio: true,
    vision: true,
    location: true,
    motion: true,
  });
  
  const statuses = sensorStatusMap[alertLevel];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SensorCard
        name="Audio Analysis"
        icon={Mic}
        isActive={activeSensors.audio}
        statusText={statuses.Audio}
        alertLevel={alertLevel}
      />
      <SensorCard
        name="Vision Detection"
        icon={Video}
        isActive={activeSensors.vision}
        statusText={statuses.Vision}
        alertLevel={alertLevel}
      />
       <SensorCard
        name="Motion Analysis"
        icon={PersonStanding}
        isActive={activeSensors.motion}
        statusText={statuses.Motion}
        alertLevel={alertLevel}
      />
      <SensorCard
        name="Location Context"
        icon={MapPin}
        isActive={activeSensors.location}
        statusText={statuses.Location}
        alertLevel={alertLevel}
      />
    </div>
  );
}
