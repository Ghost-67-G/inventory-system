import { csvImportQueue } from '../index';

interface CsvImportJobData {
  jobId: string;
  tenantId: string;
  userId: string;
  filePath: string;
  fileName: string;
}

export async function enqueueCsvImport(jobData: CsvImportJobData): Promise<void> {
  await csvImportQueue.add('csv:import', jobData, {
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
    jobId: `import:${jobData.jobId}`
  });
}
