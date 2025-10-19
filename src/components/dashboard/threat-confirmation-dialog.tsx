'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Siren } from 'lucide-react';
import { Button } from '../ui/button';

interface ThreatConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ThreatConfirmationDialog({ open, onConfirm, onDismiss }: ThreatConfirmationDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Siren className="h-6 w-6 text-status-high" />
            Potential Threat Detected
          </AlertDialogTitle>
          <AlertDialogDescription>
            Our system has detected a potential threat based on audio analysis. Please confirm if this is a real emergency.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onDismiss}>
            False Alarm
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Confirm Emergency
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
