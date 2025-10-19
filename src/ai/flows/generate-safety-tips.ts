'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating personalized safety tips based on location and risk assessment.
 *
 * The flow takes location and risk assessment as input and returns safety tips.
 * @interface GenerateSafetyTipsInput - Input interface for the generateSafetyTips function.
 * @interface GenerateSafetyTipsOutput - Output interface for the generateSafetyTips function.
 * @function generateSafetyTips - The main function to generate safety tips.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSafetyTipsInputSchema = z.object({
  location: z.string().describe('The current location of the user.'),
  riskAssessment: z.string().describe('The risk assessment for the user.'),
});
export type GenerateSafetyTipsInput = z.infer<typeof GenerateSafetyTipsInputSchema>;

const GenerateSafetyTipsOutputSchema = z.object({
  safetyTips: z.string().describe('Personalized safety tips for the user.'),
});
export type GenerateSafetyTipsOutput = z.infer<typeof GenerateSafetyTipsOutputSchema>;

export async function generateSafetyTips(input: GenerateSafetyTipsInput): Promise<GenerateSafetyTipsOutput> {
  return generateSafetyTipsFlow(input);
}

const generateSafetyTipsPrompt = ai.definePrompt({
  name: 'generateSafetyTipsPrompt',
  input: {schema: GenerateSafetyTipsInputSchema},
  output: {schema: GenerateSafetyTipsOutputSchema},
  prompt: `Based on your current location: {{{location}}} and a risk assessment of: {{{riskAssessment}}}, provide personalized safety tips to ensure your safety.`,
});

const generateSafetyTipsFlow = ai.defineFlow(
  {
    name: 'generateSafetyTipsFlow',
    inputSchema: GenerateSafetyTipsInputSchema,
    outputSchema: GenerateSafetyTipsOutputSchema,
  },
  async input => {
    const {output} = await generateSafetyTipsPrompt(input);
    return output!;
  }
);
