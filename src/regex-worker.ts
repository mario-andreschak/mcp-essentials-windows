import { parentPort, workerData } from "node:worker_threads";
const { pattern, values } = workerData as { pattern: string; values: string[] };
const regex = new RegExp(pattern, "i");
const matches: number[] = [];
for (let index = 0; index < values.length && matches.length < 5; index++) {
  if (regex.test(values[index])) matches.push(index);
}
parentPort?.postMessage(matches);
