'use server';
/**
 * @fileOverview Summarizes an incident report to provide a quick understanding of the key details.
 *
 * - summarizeIncidentReport - A function that takes an incident report and returns a summary.
 * - SummarizeIncidentReportInput - The input type for the summarizeIncidentReport function.
 * - SummarizeIncidentReportOutput - The return type for the summarizeIncidentReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeIncidentReportInputSchema = z.object({
  incidentReport: z
    .string()
    .describe('The full incident report text to be summarized.'),
});
export type SummarizeIncidentReportInput = z.infer<
  typeof SummarizeIncidentReportInputSchema
>;

const SummarizeIncidentReportOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the incident report.'),
});
export type SummarizeIncidentReportOutput = z.infer<
  typeof SummarizeIncidentReportOutputSchema
>;

export async function summarizeIncidentReport(
  input: SummarizeIncidentReportInput
): Promise<SummarizeIncidentReportOutput> {
  return summarizeIncidentReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeIncidentReportPrompt',
  input: {schema: SummarizeIncidentReportInputSchema},
  output: {schema: SummarizeIncidentReportOutputSchema},
  prompt: `Summarize the following incident report, focusing on the key events, people involved, and the outcome. Keep the summary concise and easy to understand.\n\nIncident Report:\n{{{incidentReport}}}`,
});

const summarizeIncidentReportFlow = ai.defineFlow(
  {
    name: 'summarizeIncidentReportFlow',
    inputSchema: SummarizeIncidentReportInputSchema,
    outputSchema: SummarizeIncidentReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
