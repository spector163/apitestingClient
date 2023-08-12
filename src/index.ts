import fetch from "node-fetch";
import { createWriteStream } from 'fs';

const Concurrency: number = 100;
const TotalRequest: number = 10000;
const ApiEndpoint: string = 'https://collegebatch.in/api/listURL';
const LogFilePath: string = './log.json';

const fetchWithTimeout = async (url: string, timeout: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  return response;
};

const singleFetch = async (url: string): Promise<{ status: number; completionTime: string }> => {
  const start = Date.now();
  try {
    const response = await fetchWithTimeout(url, 10000);
    const result = await response.json();
    return { status: response.status, completionTime: `${Date.now() - start}ms` };
  } catch (error) {
    return { status: 0, completionTime: '0ms' };
  }
};

const logData = (data: any) => {
  const logStream = createWriteStream(LogFilePath, { flags: 'a', encoding: 'utf-8' });
  logStream.write(JSON.stringify(data) + '\n');
  logStream.end();
};

const startClient = async () => {
  const startTime = Date.now();

  const requestTimes: number[] = [];
  let totalRequestTime = 0;
  const logs = [];

  for (let i = 0; i < Math.ceil(TotalRequest / Concurrency); i++) {
    const batchStart = Date.now();
    try {
      const results = await fetchBatchData();

      const batchTime = Date.now() - batchStart;
      totalRequestTime += batchTime;

      results.forEach(({ status, completionTime }) => {
        requestTimes.push(parseInt(completionTime));
      });

      logs.push({
        batchNumber: i + 1,
        batchTime: batchTime,
        requestCount: results.length,
      });
    } catch (error) {
      logs.push({
        batchNumber: i + 1,
        error: true,
      });
    }
  }

  const endTime = Date.now();
  const totalTestTime = endTime - startTime;
  const averageRequestTime = requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length;
  const averageBatchTime = totalRequestTime / Math.ceil(TotalRequest / Concurrency);

  logData({
    totalTestTime: totalTestTime,
    averageRequestTime: averageRequestTime,
    averageBatchTime: averageBatchTime,
    logs: logs,
  });

  console.log('Client execution completed.');
};

const fetchBatchData = async () => {
  const fetchPromises: Promise<{ status: number; completionTime: string }>[] = Array.from({ length: Concurrency }, async () => {
    const result = await singleFetch(ApiEndpoint);
    return result;
  });

  return await Promise.all(fetchPromises);
};

(async () => {
  try {
    await startClient();
  } catch (error) {
    console.error(`Client execution failed: ${error.message}`);
  }
})();
