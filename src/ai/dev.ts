import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-incident-report.ts';
import '@/ai/flows/generate-safety-tips.ts';
import '@/ai/flows/analyze-audio-for-distress.ts';
