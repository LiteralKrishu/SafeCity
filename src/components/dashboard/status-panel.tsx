'use client';
import type { AlertLevel } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, AlertTriangle, Siren, ShieldOff, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContext } from 'react';
import { AppContext } from '@/context/app-context';

type StatusInfo = {
  icon: React.ElementType;
  label: string;
  className: string;
  description: string;
};

const statusMap: Record<AlertLevel, StatusInfo> = {
  NORMAL: {
    icon: ShieldCheck,
    label: 'All Clear',
    description: 'Systems are operating normally. No threats detected.',
    className: 'text-status-normal',
  },
  LOW_RISK: {
    icon: Bell,
    label: 'Caution Advised',
    description: 'Slight anomalies detected. Remain aware of your surroundings.',
    className: 'text-status-low',
  },
  MEDIUM_RISK: {
    icon: AlertTriangle,
    label: 'Potential Threat',
    description: 'Potential distress signals identified. System is on high alert.',
    className: 'text-status-medium animate-pulse',
  },
  HIGH_RISK: {
    icon: Siren,
    label: 'High Alert',
    description: 'Multiple distress indicators confirmed. Escalation may be required.',
    className: 'text-status-high animate-pulse [animation-duration:1s]',
  },
  EMERGENCY: {
    icon: ShieldOff,
    label: 'SOS Broadcast',
    description: 'Emergency protocol initiated. Your contacts are being notified.',
    className: 'text-status-emergency',
  },
};

export function StatusPanel({ alertLevel }: { alertLevel: AlertLevel }) {
  const { isMonitoring } = useContext(AppContext);
  
  if (!isMonitoring) {
    return (
        <Card className="w-full border-secondary/20 bg-card shadow-xl">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center md:p-10">
                <div className="rounded-full bg-secondary/30 p-3 md:p-4">
                    <ShieldOff className="h-16 w-16 text-muted-foreground md:h-20 md:w-20" />
                </div>
                <h1 className="mt-4 font-headline text-3xl font-bold tracking-tighter text-muted-foreground md:text-5xl">
                    Monitoring Off
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
                    Real-time threat analysis is currently disabled. Turn on monitoring to activate protection.
                </p>
            </CardContent>
        </Card>
    );
  }

  const { icon: Icon, label, description, className } = statusMap[alertLevel];

  return (
    <Card className={cn(
        "w-full border-secondary/20 bg-card shadow-xl transition-all duration-500", 
        alertLevel === 'EMERGENCY' ? 'border-status-emergency/50 bg-status-emergency/10' : ''
    )}>
      <CardContent className="flex flex-col items-center justify-center p-6 text-center md:p-10">
        <div className="relative">
            {alertLevel === 'EMERGENCY' && <div className="absolute h-full w-full animate-ping rounded-full bg-status-emergency/50"></div>}
            <div className={cn('relative z-10 rounded-full bg-secondary/30 p-3 md:p-4 transition-all', {'bg-status-emergency/20': alertLevel === 'EMERGENCY'})}>
                <Icon className={cn('h-16 w-16 transition-colors md:h-20 md:w-20', className)} />
            </div>
        </div>
        <h1 className={cn('mt-4 font-headline text-3xl font-bold tracking-tighter transition-colors md:text-5xl', className)}>
          {label}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">{description}</p>
      </CardContent>
    </Card>
  );
}
