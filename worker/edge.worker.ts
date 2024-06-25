"use client";

import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { S3_SIG_BUCKET, WASM_PATH } from "@/lib/constants";
import { FrameData } from "@/lib/types";

let device = "webgl";
const modelName = "hand";
const modelFileName = "hand_landmarker.task";
const modelPath = `${S3_SIG_BUCKET}/tflite/model/${modelName}/${modelFileName}`;
let handLandmarker: HandLandmarker;
const runningMode = "VIDEO";
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
let inferCount = 0;
let totalInferTime = 0;

const initializeHandLandmarker = async () => {
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    postMessage({ type: "modelLoading", progress: 50 });
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: "GPU",
      },
      numHands: 2,
      runningMode: runningMode,
    });
  } catch (e) {
    console.error(e);
    console.log("retrying");
    await initializeHandLandmarker();
  }
};

async function init() {
  console.log("init");
  load_model();
}

init();

async function load_model() {
  await initializeHandLandmarker();
  postMessage({ type: "modelLoaded" });
}

async function run_model(input: ImageData) {
  let startTimeMs = performance.now();
  const result = handLandmarker.detectForVideo(input, startTimeMs);
  return result.landmarks;
}

addEventListener("message", async (event: MessageEvent) => {
  if (!event.data) return;
  const { type } = event.data;
  switch (type) {
    case "frame":
      await handleFrame(event.data);
      break;
    case "canvas":
      initOffscreenCanvas(event.data);
      break;
    case "close":
      handleClose();
      break;
  }
});

function initOffscreenCanvas(data: { type: string; canvas: OffscreenCanvas }) {
  const { canvas } = data;
  offscreenCtx = canvas.getContext("2d");
}

async function handleFrame(data: FrameData) {
  const { image } = data;
  const startTime = performance.now(); // 记录开始时间
  const predict = await run_model(image);
  calcTime(startTime);
  console.log("predict", predict);
  if (predict && offscreenCtx) {
    // offscreenCtx.clearRect(0, 0, result.width, result.height);
    // offscreenCtx.putImageData(result, 0, 0);
    drawParams(offscreenCtx);
    postMessage({ type: "modelResult" });
  }
}

function calcTime(startTime: number) {
  const endTime = performance.now(); // 记录结束时间
  const inferTime = endTime - startTime; // 计算执行时间
  inferCount++;
  totalInferTime += inferTime;
}

function drawParams(ctx: OffscreenCanvasRenderingContext2D) {
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 3;
  ctx.font = "18px serif";
  // 绘制 Infer count 和 Average infer time
  ctx.font = "16px Arial";
  ctx.fillStyle = "black";
  ctx.fillText(`Infer count: ${inferCount}`, 10, 20);
  ctx.fillText(
    `Average infer time: ${
      inferCount ? parseInt(String(totalInferTime / inferCount)) : 0
    } ms`,
    10,
    40,
  );
  ctx.fillText(`Device: ${device}`, 10, 60);
}

function handleClose() {
  close();
}

function close() {
  offscreenCtx = null;
  inferCount = 0;
  totalInferTime = 0;
  handLandmarker.close();
  console.log("handLandmarker closed");
}
