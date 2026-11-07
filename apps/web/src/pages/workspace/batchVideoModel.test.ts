import { expect, test } from "bun:test";
import { createBatchJobs, parseBatchPrompts, parseDevices } from "./batchVideoModel";

test("MooZ composer-style batch parsing keeps one independent prompt per row", () => {
  expect(parseBatchPrompts("Video A\n\n  Video B  \n")).toEqual(["Video A", "Video B"]);
  expect(() => parseBatchPrompts(" \n ")).toThrow();
  expect(() => parseBatchPrompts("a\n".repeat(101))).toThrow();
  expect(() => parseBatchPrompts("a".repeat(4001))).toThrow();
});

test("device IDs are distinct and bounded for per-Chrome concurrency", () => {
  expect(parseDevices("chrome-main, chrome-vm-01")).toEqual(["chrome-main", "chrome-vm-01"]);
  expect(() => parseDevices("chrome-main chrome-main")).toThrow();
  expect(() => parseDevices("chrome/other")).toThrow();
  expect(() => parseDevices("")).toThrow();
});

test("each batch job has its own task UUID and frozen prompt settings", () => {
  const jobs = createBatchJobs(["Cảnh 1", "Cảnh 2"], "9:16");
  expect(jobs).toHaveLength(2);
  expect(jobs[0].taskId).not.toBe(jobs[1].taskId);
  expect(jobs.map(j => j.status)).toEqual(["queued", "queued"]);
  expect(jobs.map(j => j.ratio)).toEqual(["9:16", "9:16"]);
});
