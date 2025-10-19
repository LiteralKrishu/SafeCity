'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Clock, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function RiskAssessment() {
  const [location, setLocation] = useState<string | null>(null);
  const [time, setTime] = useState<string>('--:--:--');
  const [riskScore, setRiskScore] = useState<number>(0);

  useEffect(() => {
    // Get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real app, you'd reverse geocode this. For now, just show coords.
          const { latitude, longitude } = position.coords;
          setLocation(`${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`);
        },
        () => {
          setLocation('Permission Denied');
        }
      );
    } else {
      setLocation('Not Supported');
    }

    // Update time and risk score every second
    const intervalId = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
      
      // Simplified risk score calculation (e.g., higher risk at night)
      const hour = now.getHours();
      let score = 20; // Base score
      if (hour < 6 || hour > 20) { // Night time
        score += 40;
      }
      if (location && (location === 'Permission Denied' || location === 'Not Supported')) {
        score += 15;
      }
      setRiskScore(Math.min(100, score));

    }, 1000);

    return () => clearInterval(intervalId);
  }, [location]);

  const getRiskColor = (score: number) => {
    if (score > 75) return 'text-status-high';
    if (score > 50) return 'text-status-medium';
    if (score > 25) return 'text-status-low';
    return 'text-status-normal';
  };

  return (
    <Card className="border-secondary/20 bg-card shadow-md h-full">
      <CardHeader>
        <CardTitle className="font-headline text-lg">Contextual Risk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center">
          <Globe className="mr-3 h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Location:</span>
          {location ? <span className="ml-2 font-mono">{location}</span> : <Skeleton className="ml-2 h-4 w-32" />}
        </div>
        <div className="flex items-center">
          <Clock className="mr-3 h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Time:</span>
          <span className="ml-2 font-mono">{time}</span>
        </div>
        <div className="flex items-center">
          <ShieldAlert className="mr-3 h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Dynamic Risk Score:</span>
          <span className={cn('ml-2 font-bold font-mono', getRiskColor(riskScore))}>{riskScore} / 100</span>
        </div>
      </CardContent>
    </Card>
  );
}
