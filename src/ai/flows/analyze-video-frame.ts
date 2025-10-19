'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing a video frame for signs of distress.
 *
 * The flow takes an image data URI, and analyzes it for emotional distress or haphazard movement.
 * @interface AnalyzeVideoFrameInput - Input interface for the analyzeVideoFrame function.
 * @interface AnalyzeVideoFrameOutput - Output interface for the analyzeVideoFrame function.
 * @function analyzeVideoFrame - The main function to analyze a video frame.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeVideoFrameInputSchema = z.object({
  frameDataUri: z
    .string()
    .describe(
      "A video frame image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeVideoFrameInput = z.infer<typeof AnalyzeVideoFrameInputSchema>;

const AnalyzeVideoFrameOutputSchema = z.object({
  isHaphazardMovement: z
    .boolean()
    .describe('Whether or not the frame contains sudden, erratic, or haphazard movements that could indicate a struggle or fall.'),
  detectedEmotion: z
    .enum(['anger', 'fear', 'sadness', 'joy', 'surprise', 'disgust', 'neutral'])
    .describe('The dominant emotion detected from facial expressions in the frame. If no face is detected, return neutral.'),
});
export type AnalyzeVideoFrameOutput = z.infer<typeof AnalyzeVideoFrameOutputSchema>;

export async function analyzeVideoFrame(input: AnalyzeVideoFrameInput): Promise<AnalyzeVideoFrameOutput> {
  return analyzeVideoFrameFlow(input);
}

const analyzeVideoFramePrompt = ai.definePrompt({
  name: 'analyzeVideoFramePrompt',
  input: {schema: AnalyzeVideoFrameInputSchema},
  output: {schema: AnalyzeVideoFrameOutputSchema},
  prompt: `You are a security expert analyzing a video frame for signs of distress.
  
Analyze the following image for:
1.  **Haphazard Movement**: Determine if the subject's posture or the scene suggests a sudden, uncontrolled movement, like a fall, a struggle, or erratic action. Set 'isHaphazardMovement' to true if detected.
2.  **Emotion**: Analyze the facial expression of any person in the frame. Identify the dominant emotion. If multiple people are present, focus on the one showing the most distress. If no face is visible, default to 'neutral'.

Image: {{media url=frameDataUri}}`,
});

const analyzeVideoFrameFlow = ai.defineFlow(
  {
    name: 'analyzeVideoFrameFlow',
    inputSchema: AnalyzeVideoFrameInputSchema,
    outputSchema: AnalyzeVideoFrameOutputSchema,
  },
  async input => {
    try {
      const {output} = await analyzeVideoFramePrompt(input);
      return output!;
    } catch(e) {
      console.error("Error analyzing video frame: ", e);
      // In case of an error, assume no threat.
      return { isHaphazardMovement: false, detectedEmotion: 'neutral' };
    }
  }
);
