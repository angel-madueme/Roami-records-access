import { AI_CONFIG } from "@/lib/ai-config";

type Task<T> = () => Promise<T>;

const waitingTasks: Array<{
  task: Task<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

let activeGeminiExtractions = 0;

function runNext(): void {
  if (activeGeminiExtractions >= AI_CONFIG.concurrency.maxGeminiExtractions) return;

  const next = waitingTasks.shift();
  if (!next) return;

  activeGeminiExtractions += 1;

  next.task()
    .then(next.resolve, next.reject)
    .finally(() => {
      activeGeminiExtractions -= 1;
      runNext();
    });

  runNext();
}

/** Queues Gemini extraction work once the configured concurrency cap is reached. */
export function withGeminiConcurrency<T>(task: Task<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waitingTasks.push({
      task: task as Task<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    runNext();
  });
}

export function getGeminiConcurrencyState(): {
  active: number;
  queued: number;
  limit: number;
} {
  return {
    active: activeGeminiExtractions,
    queued: waitingTasks.length,
    limit: AI_CONFIG.concurrency.maxGeminiExtractions,
  };
}
