'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhoneOutgoing } from 'lucide-react';

const helpLines = [
    { name: 'National Emergency Number', number: '911', country: 'USA/Canada' },
    { name: 'National Suicide Prevention Lifeline', number: '988', country: 'USA' },
    { name: 'Emergency Medical Services', number: '112', country: 'EU' },
    { name: 'Police', number: '100', country: 'India' },
]

export function HelpLine() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emergency Help Lines</CardTitle>
        <CardDescription>Quick access to emergency services.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {helpLines.map(line => (
            <div key={line.name} className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                <div>
                    <p className="font-semibold">{line.name} <span className="text-xs text-muted-foreground">({line.country})</span></p>
                    <p className="text-lg font-mono font-bold text-primary">{line.number}</p>
                </div>
                <Button asChild size="icon" variant="outline">
                    <a href={`tel:${line.number}`}>
                        <PhoneOutgoing className="h-5 w-5" />
                        <span className="sr-only">Call {line.name}</span>
                    </a>
                </Button>
            </div>
        ))}
      </CardContent>
    </Card>
  );
}
