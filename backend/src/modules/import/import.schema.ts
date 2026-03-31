import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const numString = z.coerce.number().int().positive();

export const listImportJobsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: numString.max(50).optional().default(20)
  })
});

export const getImportJobSchema = z.object({
  params: z.object({
    jobId: mongoId
  })
});

export interface ListImportJobsQuery {
  cursor?: string;
  limit?: number;
}
