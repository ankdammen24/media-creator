import { spawn } from 'node:child_process';

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

export async function probeAudio(inputPath: string) {
  return new Promise<unknown>((resolve, reject) => {
    const child = spawn('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function createPreviewMp3(inputPath: string, outputPath: string) {
  await run('ffmpeg', ['-y', '-i', inputPath, '-t', '90', '-codec:a', 'libmp3lame', '-b:a', '192k', outputPath]);
}

export async function createNormalizedWav(inputPath: string, outputPath: string) {
  await run('ffmpeg', ['-y', '-i', inputPath, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '2', outputPath]);
}
