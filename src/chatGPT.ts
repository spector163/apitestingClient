//@ts-nocheck
import fetch from "node-fetch";
import pLimit from 'p-limit';
import winston from 'winston';
import { createWriteStream, WriteStream } from 'fs';
import { promisify } from 'util';

// Configuration
const Concurrency: number = 100;
const TotalRequest: number = 10000;
const ApiEndpoint: string = 'https://collegebatch.in/api/listURL';
const LogFilePath: string = './log.csv';

// Logging Setup
const logStream: WriteStream = createWriteStream(LogFilePath, { flags: 'a', encoding: 'utf-8' });
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.Stream({ stream: logStream }),
  ],
});

// Throttling requests
const requestLimit = pLimit(Concurrency);

// Fetch with timeout
const fetchWithTimeout = async (url: string, timeout: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  return response;
};

// Single API Request
const singleFetch = async (url: string): Promise<{ status: number; completionTime: string }> => {
  const start = Date.now();
  try {
    const response = await requestLimit(() => fetchWithTimeout(url, 10000)); // 10-second timeout
    const result = await response.json();
    return { status: response.status, completionTime: `${Date.now() - start}ms` };
  } catch (error) {
    logger.error(`Request to ${url} failed: ${error.message}`);
    return { status: 0, completionTime: '0ms' };
  }
};

// Batch API Requests
const batchRequest = async (concurrency: number, url: string) => {
  return await Promise.all(Array.from({ length: concurrency }, () => singleFetch(url)));
};

// Client Entry Point
const startClient = async () => {
  for (let i = 0; i < Math.ceil(TotalRequest / Concurrency); i++) {
    const start = Date.now();
    try {
      const result = await batchRequest(Concurrency, ApiEndpoint);
      logger.info(`Batch ${i + 1} finished in ${Date.now() - start}ms`);
      result.forEach((v, i) => {
        logger.info(`Request ${i + 1}, Status:${v.status},time:${v.completionTime}`);
      });
    } catch (error) {
      logger.error(`Batch ${i + 1} failed: ${error.message}`);
    }
    logger.info('------------------------------------------');
  }
};

// Execute Client
(async () => {
  try {
    await startClient();
    logger.info('Client execution completed.');
  } catch (error) {
    logger.error(`Client execution failed: ${error.message}`);
  } finally {
    logStream.end();
  }
})();
