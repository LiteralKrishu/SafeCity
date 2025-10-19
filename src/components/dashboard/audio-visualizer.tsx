'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, Mic, Zap } from 'lucide-react';
import type { AlertLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { analyzeAudioForDistress } from '@/ai/flows/analyze-audio-for-distress';

const MAX_DATA_POINTS = 50;
const VOLUME_THRESHOLD = 25; // Average volume to trigger analysis
const PITCH_THRESHOLD = 2000; // Pitch in Hz to be considered a scream (fallback)
const THREAT_COOLDOWN = 10000; // 10 seconds
const AUDIO_CAPTURE_DURATION = 3000; // 3 seconds

type AudioDataPoint = {
  time: number;
  volume: number;
  pitch: number;
};

interface AudioVisualizerProps {
  alertLevel: AlertLevel;
  setAlertLevel: (level: AlertLevel) => void;
}

export function AudioVisualizer({ alertLevel, setAlertLevel }: AudioVisualizerProps) {
  const [audioData, setAudioData] = useState<AudioDataPoint[]>([]);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const lastThreatTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isAnalyzingRef = useRef<boolean>(false);

  const { toast } = useToast();

  const handleAudioAnalysis = async () => {
    if (isAnalyzingRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      return;
    }
    isAnalyzingRef.current = true;
    
    // Stop recording to get the blob
    mediaRecorderRef.current.stop();

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = []; // Clear chunks for next recording
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        try {
          const { isDistress } = await analyzeAudioForDistress({ audioDataUri: base64Audio });
          if (isDistress) {
            const now = Date.now();
            if (alertLevel !== 'EMERGENCY' && now - lastThreatTimeRef.current > THREAT_COOLDOWN) {
              lastThreatTimeRef.current = now;
              setAlertLevel('HIGH_RISK');
            }
          }
        } catch(e) {
            console.error("AI analysis failed: ", e);
        } finally {
            isAnalyzingRef.current = false;
            // Restart recording
            if(mediaRecorderRef.current && mediaRecorderRef.current.state !== 'recording') {
              mediaRecorderRef.current.start();
            }
        }
      };
    };
  };


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
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;

        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current.start();

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const timeDomainArray = new Uint8Array(analyser.fftSize);

        const updateVisualization = () => {
          if (analyserRef.current && audioContextRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            analyserRef.current.getByteTimeDomainData(timeDomainArray);
            
            let sum = 0;
            for (let i = 0; i < timeDomainArray.length; i++) {
              sum += Math.abs(timeDomainArray[i] - 128);
            }
            const averageVolume = sum / timeDomainArray.length;

            let maxIndex = 0;
            let maxVal = -1;
            for (let i = 0; i < dataArray.length; i++) {
                if(dataArray[i] > maxVal){
                    maxVal = dataArray[i];
                    maxIndex = i;
                }
            }
            const dominantPitch = maxIndex * audioContextRef.current.sampleRate / analyserRef.current.fftSize;

            const now = Date.now();
            setAudioData(prevData => {
              const newData = [...prevData, { time: now, volume: averageVolume, pitch: dominantPitch }];
              return newData.length > MAX_DATA_POINTS ? newData.slice(newData.length - MAX_DATA_POINTS) : newData;
            });
            
            if (
              !isAnalyzingRef.current &&
              alertLevel !== 'EMERGENCY' &&
              averageVolume > VOLUME_THRESHOLD &&
              (now - lastThreatTimeRef.current > THREAT_COOLDOWN)
            ) {
                // If pitch is very high, trigger immediately (fallback for screams).
                if(dominantPitch > PITCH_THRESHOLD) {
                    lastThreatTimeRef.current = now;
                    setAlertLevel('HIGH_RISK');
                } else {
                    // Otherwise, run AI analysis
                    handleAudioAnalysis();
                }
            }
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
      if(mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, setAlertLevel, alertLevel]);
  
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
  const lastPitch = audioData.length > 0 ? audioData[audioData.length - 1].pitch.toFixed(0) : 0;
  const lastVolume = audioData.length > 0 ? audioData[audioData.length - 1].volume.toFixed(0) : 0;

  return (
    <Card className="border-secondary/20 bg-card shadow-md">
      <CardHeader className="flex flex-row justify-between items-start">
        <CardTitle className="font-headline text-lg flex items-center gap-2"><Mic className="h-5 w-5" /> Real-time Audio</CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Zap className={cn("h-4 w-4 transition-colors", +lastPitch > PITCH_THRESHOLD || +lastVolume > VOLUME_THRESHOLD ? "text-status-high" : "text-muted-foreground")} />
            <span>{lastPitch} Hz</span>
        </div>
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
                <YAxis domain={[0, 60]} hide={true} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    fontSize: '12px',
                    borderRadius: 'var(--radius)',
                  }}
                  labelFormatter={() => ''}
                  formatter={(value: number, name) => [value.toFixed(2), name.charAt(0).toUpperCase() + name.slice(1)]}
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
