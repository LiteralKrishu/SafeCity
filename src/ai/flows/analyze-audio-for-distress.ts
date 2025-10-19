'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing audio for signs of distress.
 *
 * The flow takes audio data, transcribes it, and analyzes the text for distress signals.
 * @interface AnalyzeAudioForDistressInput - Input interface for the analyzeAudioForDistress function.
 * @interface AnalyzeAudioForDistressOutput - Output interface for the analyzeAudioForDistress function.
 * @function analyzeAudioForDistress - The main function to analyze audio.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeAudioForDistressInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A chunk of audio as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeAudioForDistressInput = z.infer<typeof AnalyzeAudioForDistressInputSchema>;

const AnalyzeAudioForDistressOutputSchema = z.object({
  isDistress: z
    .boolean()
    .describe('Whether or not the audio contains signs of distress, such as screaming, fear, or urgent pleas for help.'),
});
export type AnalyzeAudioForDistressOutput = z.infer<typeof AnalyzeAudioForDistressOutputSchema>;

export async function analyzeAudioForDistress(input: AnalyzeAudioForDistressInput): Promise<AnalyzeAudioForDistressOutput> {
  return analyzeAudioForDistressFlow(input);
}

const analyzeAudioPrompt = ai.definePrompt({
  name: 'analyzeAudioPrompt',
  input: {schema: AnalyzeAudioForDistressInputSchema},
  output: {schema: AnalyzeAudioForDistressOutputSchema},
  prompt: `You are a security expert trained to detect signs of distress in audio.
  
Transcribe the following audio and analyze the transcription. Determine if the content contains signs of distress.
This could include screaming, phrases of fear, urgent pleas for help, or other indicators that the person is in danger.

Set isDistress to true if distress is detected.

Audio: {{media url=audioDataUri}}`,
});

const analyzeAudioForDistressFlow = ai.defineFlow(
  {
    name: 'analyzeAudioForDistressFlow',
    inputSchema: AnalyzeAudioForDistressInputSchema,
    outputSchema: AnalyzeAudioForDistressOutputSchema,
  },
  async input => {
    try {
      const {output} = await analyzeAudioPrompt(input);
      return output!;
    } catch(e) {
      console.error("Error analyzing audio: ", e);
      // In case of an error from the LLM, assume no distress.
      return { isDistress: false };
    }
  }
);
