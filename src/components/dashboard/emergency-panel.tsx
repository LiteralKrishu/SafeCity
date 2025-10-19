'use client';
import type { AlertLevel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PhoneForwarded, ShieldQuestion, Siren } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmergencyPanel({ alertLevel, onManualTrigger }: { alertLevel: AlertLevel, onManualTrigger: () => void }) {
  const isEmergency = alertLevel === 'EMERGENCY';

  return (
    <div className={cn(
        "mt-8 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-secondary/20 p-8 text-center transition-all",
        isEmergency ? "border-status-emergency/40 bg-status-emergency/10" : ""
    )}>
      {isEmergency ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-emergency/20">
            <PhoneForwarded className="h-8 w-8 text-status-emergency" />
          </div>
          <h3 className="mt-4 font-headline text-2xl font-bold text-status-emergency">Emergency Alert Sent</h3>
          <p className="mt-2 max-w-lg text-muted-foreground">
            Your emergency contacts have been notified with your current location and status. Help is on the way.
          </p>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20">
            <ShieldQuestion className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 font-headline text-2xl font-bold">Need Immediate Help?</h3>
          <p className="mt-2 max-w-lg text-muted-foreground">
            If you are in danger, you can manually trigger an emergency alert. This will immediately notify your emergency contacts and local authorities.
          </p>
          <Button onClick={onManualTrigger} variant="destructive" size="lg" className="mt-6 font-bold">
            <Siren className="mr-2 h-5 w-5" />
            TRIGGER MANUAL SOS
          </Button>
        </>
      )}
    </div>
  );
}
