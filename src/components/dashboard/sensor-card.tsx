'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AlertLevel } from '@/lib/types';

interface SensorCardProps {
  icon: React.ElementType;
  name: string;
  statusText: string;
  isActive: boolean;
  alertLevel: AlertLevel;
}

export function SensorCard({ icon: Icon, name, statusText, isActive, alertLevel }: SensorCardProps) {
    
  const getStatusColor = () => {
    if (!isActive) return 'bg-muted-foreground';
    switch (alertLevel) {
        case 'NORMAL': return 'bg-status-normal';
        case 'LOW_RISK': return 'bg-status-low';
        case 'MEDIUM_RISK': return 'bg-status-medium animate-pulse';
        case 'HIGH_RISK': return 'bg-status-high animate-pulse';
        case 'EMERGENCY': return 'bg-status-emergency animate-ping';
        default: return 'bg-status-normal';
    }
  }

  return (
    <Card className="border-secondary/20 bg-card shadow-md transition-all hover:border-accent">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium font-headline">{name}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <div className="relative flex h-3 w-3">
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', getStatusColor())} />
            <span className={cn('relative inline-flex h-3 w-3 rounded-full', getStatusColor().split(' ')[0])} />
          </div>
          <p className="text-sm text-muted-foreground">{isActive ? statusText : 'Inactive'}</p>
        </div>
      </CardContent>
    </Card>
  );
}
