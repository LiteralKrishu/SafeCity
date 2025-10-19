'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, Mic } from 'lucide-react';
import type { AlertLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const MAX_DATA_POINTS = 50;

type AudioDataPoint = {
  time: number;
  volume: number;
};

export function AudioVisualizer({ alertLevel }: { alertLevel: AlertLevel }) {
  const [audioData, setAudioData] = useState<AudioDataPoint[]>([]);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const { toast } = useToast();

  useEffect(() => {
    const setupAudioProcessing = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        setHasMicPermission(true);

        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVisualization = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += Math.abs(dataArray[i] - 128);
            }
            const average = sum / dataArray.length;
            
            setAudioData(prevData => {
              const newData = [...prevData, { time: Date.now(), volume: average }];
              return newData.length > MAX_DATA_POINTS ? newData.slice(newData.length - MAX_DATA_POINTS) : newData;
            });
          }
          animationFrameRef.current = requestAnimationFrame(updateVisualization);
        };
        updateVisualization();

      } catch (error) {
        console.error('Error accessing microphone:', error);
        setHasMicPermission(false);
        toast({
          variant: 'destructive',
          title: 'Microphone Access Denied',
          description: 'Please enable microphone permissions for audio analysis.',
        });
      }
    };

    setupAudioProcessing();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [toast]);
  
  const getAlertColor = (level: AlertLevel) => {
    switch (level) {
        case 'NORMAL': return 'hsl(var(--status-normal))';
        case 'LOW_RISK': return 'hsl(var(--status-low))';
        case 'MEDIUM_RISK': return 'hsl(var(--status-medium))';
        case 'HIGH_RISK': return 'hsl(var(--status-high))';
        case 'EMERGENCY': return 'hsl(var(--status-emergency))';
        default: return 'hsl(var(--status-normal))';
    }
  }

  const alertColor = getAlertColor(alertLevel);

  return (
    <Card className="border-secondary/20 bg-card shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-lg flex items-center gap-2"><Mic className="h-5 w-5" /> Real-time Audio Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        {hasMicPermission === false ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <AlertCircle className="w-10 h-10 mb-2" />
            <p>Microphone access is required to display the audio graph.</p>
          </div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={audioData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={alertColor} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={alertColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide={true} />
                <YAxis domain={[0, 50]} hide={true} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    fontSize: '12px',
                    borderRadius: 'var(--radius)',
                  }}
                  labelFormatter={() => ''}
                  formatter={(value: number) => [value.toFixed(2), 'Volume']}
                />
                <Area type="monotone" dataKey="volume" stroke={alertColor} strokeWidth={2} fill="url(#colorVolume)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
