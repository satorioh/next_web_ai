"use client";

import { ObjectDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { S3_SIG_BUCKET, MP_VERSION } from "@/lib/constants";

let device = "webgl";
const modelName = "od";
const modelFileName = "efficientdet_lite0.tflite";
const wasmPath = `${S3_SIG_BUCKET}/wasm/${MP_VERSION}`;
const modelPath = `${S3_SIG_BUCKET}/model/${modelName}/${modelFileName}`;
let objectDetector: ObjectDetector;
const runningMode = "VIDEO";

const initializeObjectDetector = async () => {
  const vision = await FilesetResolver.forVisionTasks(wasmPath);
  postMessage({ type: "modelLoading", progress: 50 });
  objectDetector = await ObjectDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelPath,
      delegate: "GPU",
    },
    scoreThreshold: 0.5,
    runningMode: runningMode,
  });
};

async function init() {
  console.log("init");
  load_model();
}

init();

async function load_model() {
  await initializeObjectDetector();
  postMessage({ type: "modelLoaded", deviceName: device });
}

async function run_model(input: ImageData) {
  let startTimeMs = performance.now();
  const result = objectDetector.detectForVideo(input, startTimeMs);
  return result.detections;
}

addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;
  switch (type) {
    case "frame":
      await handleFrame(event.data);
      break;
    case "close":
      handleClose();
      break;
  }
});

async function handleFrame(data: { input: ImageData; startTime: number }) {
  const { input, startTime } = data;
  const predict = await run_model(input);
  if (predict && predict.length > 0) {
    postMessage({ type: "modelResult", result: predict, startTime });
  }
}

function handleClose() {
  close();
}

function close() {
  objectDetector.close();
  console.log("objectDetector closed");
}
