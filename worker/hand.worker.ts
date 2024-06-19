"use client";

import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { S3_SIG_BUCKET, WASM_PATH } from "@/lib/constants";

let device = "webgl";
const modelName = "hand";
const modelFileName = "hand_landmarker.task";
const modelPath = `${S3_SIG_BUCKET}/tflite/model/${modelName}/${modelFileName}`;
let handLandmarker: HandLandmarker;
const runningMode = "VIDEO";

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
  postMessage({ type: "modelLoaded", deviceName: device });
}

async function run_model(input: ImageData) {
  let startTimeMs = performance.now();
  const result = handLandmarker.detectForVideo(input, startTimeMs);
  return result.landmarks;
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
  if (predict) {
    postMessage({ type: "modelResult", landmarks: predict, startTime });
  }
}

function handleClose() {
  close();
}

function close() {
  handLandmarker.close();
  console.log("handLandmarker closed");
}
