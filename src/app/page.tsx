'use client';

import { useState, useEffect } from 'react';
import type { AlertLevel } from '@/lib/types';
import { StatusPanel } from '@/components/dashboard/status-panel';
import { SensorStatus } from '@/components/dashboard/sensor-status';
import { RiskAssessment } from '@/components/dashboard/risk-assessment';
import { EmergencyPanel } from '@/components/dashboard/emergency-panel';
import { CameraFeed } from '@/components/dashboard/camera-feed';
import { AudioVisualizer } from '@/components/dashboard/audio-visualizer';

export default function Home() {
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('NORMAL');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const handleManualTrigger = () => {
    setAlertLevel('EMERGENCY');
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-lg md:px-6">
        <h1 className="font-headline text-xl font-bold md:text-2xl">SafeCity</h1>
        <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">v1.0</span>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8 lg:p-12">
        <div className="mx-auto grid max-w-7xl items-start gap-8">
          <StatusPanel alertLevel={alertLevel} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 grid gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <CameraFeed />
                <AudioVisualizer alertLevel={alertLevel} />
              </div>
              <SensorStatus alertLevel={alertLevel} />
            </div>
            <div className="lg:col-span-1">
              <RiskAssessment alertLevel={alertLevel} setAlertLevel={setAlertLevel} />
            </div>
          </div>
          <EmergencyPanel alertLevel={alertLevel} onManualTrigger={handleManualTrigger} />
        </div>
      </main>
      <footer className="mt-auto shrink-0 border-t px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-muted-foreground">
            <p>&copy; {currentYear} SafeCity. All rights reserved.</p>
            <p className="font-headline">Your Personal Guardian</p>
        </div>
      </footer>
    </div>
  );
}
