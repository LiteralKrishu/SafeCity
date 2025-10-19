'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Video, Bot, PersonStanding, Smile, Frown } from 'lucide-react';
import type { AlertLevel } from '@/lib/types';
import { analyzeVideoFrame } from '@/ai/flows/analyze-video-frame';
import { cn } from '@/lib/utils';

const FRAME_CAPTURE_INTERVAL = 500; // 0.5 seconds
const THREAT_COOLDOWN = 10000; // 10 seconds

interface CameraFeedProps {
  alertLevel: AlertLevel;
  setAlertLevel: (level: AlertLevel) => void;
}

export function CameraFeed({ alertLevel, setAlertLevel }: CameraFeedProps) {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState('neutral');
  const [haphazardMovement, setHaphazardMovement] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastThreatTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions to use the live feed.',
        });
      }
    };

    getCameraPermission();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if(intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [toast]);

  useEffect(() => {
    const analyzeFrame = async () => {
      if (isAnalyzing || !videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      setIsAnalyzing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if(context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameDataUri = canvas.toDataURL('image/jpeg');

        try {
          const result = await analyzeVideoFrame({ frameDataUri });
          setDetectedEmotion(result.detectedEmotion);
          setHaphazardMovement(result.isHaphazardMovement);

          const now = Date.now();
          if (now - lastThreatTimeRef.current > THREAT_COOLDOWN) {
            if (result.isHaphazardMovement || result.detectedEmotion === 'fear' || result.detectedEmotion === 'anger') {
              lastThreatTimeRef.current = now;
              setAlertLevel('HIGH_RISK');
            }
          }
        } catch (error) {
          console.error('Frame analysis failed:', error);
        }
      }

      setIsAnalyzing(false);
    };

    if (hasCameraPermission) {
      intervalRef.current = setInterval(analyzeFrame, FRAME_CAPTURE_INTERVAL);
    } else {
        if(intervalRef.current) clearInterval(intervalRef.current);
    }
    
    return () => {
        if(intervalRef.current) clearInterval(intervalRef.current);
    }

  }, [hasCameraPermission, isAnalyzing, setAlertLevel]);

  const EmotionIcon = detectedEmotion === 'fear' || detectedEmotion === 'anger' ? Frown : Smile;
  const isThreatDetected = haphazardMovement || detectedEmotion === 'fear' || detectedEmotion === 'anger';

  return (
    <Card className="border-secondary/20 bg-card shadow-md flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="font-headline text-lg flex items-center gap-2">
          <Video className="h-5 w-5" /> Live Feed
        </CardTitle>
        <div className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full", isAnalyzing ? "bg-blue-500/20 text-blue-300" : "bg-secondary")}>
            <Bot className="h-3 w-3"/>
            <span>{isAnalyzing ? 'Analyzing...' : 'Monitoring'}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <div className="aspect-video w-full overflow-hidden rounded-md bg-muted flex-grow relative">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {hasCameraPermission === false && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Alert variant="destructive" className="m-4">
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>
                  Please allow camera access to use this feature.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-4 text-xs pt-4">
        <div className="flex items-center gap-2">
            <PersonStanding className={cn("h-4 w-4", haphazardMovement ? 'text-status-high' : 'text-muted-foreground')} />
            <span className="text-muted-foreground">Movement:</span>
            <span className={cn("font-semibold", haphazardMovement ? 'text-status-high' : 'text-foreground')}>{haphazardMovement ? 'Erratic' : 'Normal'}</span>
        </div>
        <div className="flex items-center gap-2">
            <EmotionIcon className={cn("h-4 w-4", isThreatDetected ? 'text-status-high' : 'text-muted-foreground')} />
            <span className="text-muted-foreground">Emotion:</span>
            <span className={cn("font-semibold capitalize", isThreatDetected ? 'text-status-high' : 'text-foreground')}>{detectedEmotion}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
