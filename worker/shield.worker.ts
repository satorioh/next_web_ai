"use client";

import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { S3_SIG_BUCKET, WASM_PATH } from "@/lib/constants";
import { ShieldModule } from "@/opencv/shield/main";
import { FrameData } from "@/lib/types";

let device = "webgl";
const modelName = "hand";
const modelFileName = "hand_landmarker.task";
const modelPath = `${S3_SIG_BUCKET}/tflite/model/${modelName}/${modelFileName}`;
let handLandmarker: HandLandmarker;
const runningMode = "VIDEO";
let shieldModule: ShieldModule | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

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
  shieldModule = new ShieldModule();
  load_model();
}

init();

async function load_model() {
  await initializeHandLandmarker();
  postMessage({ type: "modelLoaded", deviceName: device });
}

async function run_model(input: ImageData) {
  let startTimeMs = performance.now();
  const result = handLandmarker.detectForVideo(input, startTimeMs);
  return result.landmarks;
}

addEventListener("message", async (event: MessageEvent) => {
  try {
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
  } catch (e) {
    console.error(e);
  }
});

function initOffscreenCanvas(data: { type: string; canvas: OffscreenCanvas }) {
  const { canvas } = data;
  offscreenCtx = canvas.getContext("2d");
}

async function handleFrame(data: FrameData) {
  const { image, startTime } = data;
  const predict = await run_model(image);
  console.log("predict", predict);
  if (predict && shieldModule && offscreenCtx) {
    const result = shieldModule.process(image);
    offscreenCtx.clearRect(0, 0, result.width, result.height);
    offscreenCtx.putImageData(result, 0, 0);
    postMessage({ type: "modelResult" });
  }
}

function handleClose() {
  close();
}

function close() {
  shieldModule = null;
  offscreenCtx = null;
  handLandmarker.close();
  console.log("handLandmarker closed");
}
