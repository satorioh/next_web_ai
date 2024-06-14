"use client";

import {
  ImageSegmenter,
  FilesetResolver,
  ImageSegmenterResult,
} from "@mediapipe/tasks-vision";
import { S3_SIG_BUCKET, MP_VERSION } from "@/lib/constants";

let device = "webgl";
const modelName = "seg";
const modelFileName = "selfie_segmenter.tflite";
const wasmPath = `${S3_SIG_BUCKET}/wasm/${MP_VERSION}`;
const modelPath = `${S3_SIG_BUCKET}/model/${modelName}/${modelFileName}`;
let imageSegmenter: ImageSegmenter;
const runningMode = "VIDEO";

const createImageSegmenter = async () => {
  const vision = await FilesetResolver.forVisionTasks(wasmPath);
  postMessage({ type: "modelLoading", progress: 50 });
  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelPath,
      delegate: "GPU",
    },
    runningMode: runningMode,
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
};

async function init() {
  console.log("init");
  load_model();
}

init();

async function load_model() {
  await createImageSegmenter();
  postMessage({ type: "modelLoaded", deviceName: device });
}

async function run_model(input: ImageData) {
  let startTimeMs = performance.now();
  imageSegmenter.segmentForVideo(input, startTimeMs, callbackForVideo);
}

function callbackForVideo(result: ImageSegmenterResult) {
  console.log("callback result", result);
  // const mask = result.categoryMask.getAsFloat32Array();
  // console.log("mask", mask);
  // postMessage({ type: "modelResult", result: predict, startTime });
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
  await run_model(input);
}

function handleClose() {
  close();
}

function close() {
  imageSegmenter.close();
  console.log("imageSegmenter closed");
}
