import { Worker } from "node:worker_threads";

/** Bound user regex execution without blocking cancellation on the server thread. */
export async function matchPattern(pattern: string, values: string[], signal?: AbortSignal): Promise<number[]> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./regex-worker.js", import.meta.url), { workerData: { pattern, values } });
    let finished = false;
    const finish = (error?: Error, matches?: number[]) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      void worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolve(matches ?? []);
    };
    const abort = () => finish(new Error("Search cancelled."));
    const timer = setTimeout(() => finish(new Error("Regular expression exceeded its 1 second execution limit.")), 1000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.once("message", matches => finish(undefined, matches));
    worker.once("error", error => finish(error));
    if (signal?.aborted) abort();
  });
}
