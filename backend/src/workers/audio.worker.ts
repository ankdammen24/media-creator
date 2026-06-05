import { processAudioJob } from '../services/processing.service.js';

const queue: string[] = [];
let running = false;

export function enqueueAudioJob(jobId: string) {
  queue.push(jobId);
  void drainQueue();
}

async function drainQueue() {
  if (running) return;
  running = true;

  try {
    while (queue.length > 0) {
      const jobId = queue.shift();
      if (!jobId) continue;
      try {
        await processAudioJob(jobId);
      } catch (error) {
        console.error(`Audio job failed: ${jobId}`, error);
      }
    }
  } finally {
    running = false;
  }
}
