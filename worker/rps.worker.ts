"use client";

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgpu";
import "@tensorflow/tfjs-backend-webgl";
import { BACKEND_URL_PREFIX } from "@/lib/constants";

let device = "webgl";
let model: null | tf.GraphModel = null;
const IDB_URL = "indexeddb://rps-model";
const modelName = "rps";

async function getModelLastUpdateTime() {
  try {
    const res = await fetch(
      `${BACKEND_URL_PREFIX}getModelLastUpdateTime?modelName=${modelName}`,
    );
    const { lastUpdateTime } = await res.json();
    return lastUpdateTime ? new Date(lastUpdateTime) : null;
  } catch (e) {
    console.log("getModelLastUpdateTime Error", e);
  }
}

async function isModelLatest(dateSaved: Date) {
  const lastUpdateTime = await getModelLastUpdateTime();
  if (!lastUpdateTime) return true;
  console.log(
    `model lastUpdateTime: ${lastUpdateTime.toLocaleString()}, savedTime: ${dateSaved.toLocaleString()}`,
  );
  return dateSaved.getTime() >= lastUpdateTime.getTime();
}

async function init() {
  console.log("init");
  if (navigator.gpu && (await navigator.gpu.requestAdapter())) {
    device = "webgpu";
  }
  load_model();
}

init();

async function load_model() {
  console.log("load_model with device: ", device);
  try {
    await tf.setBackend(device);
  } catch (e) {
    console.log("setBackend Error", e);
  }

  // 检测indexeddb是否有模型，如果有则直接加载；如果没有则下载模型并保存到indexeddb
  const modelInfo = await tf.io.listModels();
  console.log("modelInfo", modelInfo);
  if (modelInfo[IDB_URL]) {
    const dateSaved = modelInfo[IDB_URL].dateSaved;
    const isLatest = await isModelLatest(dateSaved);
    if (!isLatest) {
      // 清空indexeddb中的模型database
      console.log("model not latest, remove model...");
      await tf.io.removeModel(IDB_URL);
      console.log("model not latest, downloading...");
      await downloadModel();
    } else {
      console.log("model exists and latest");
      model = await tf.loadGraphModel(IDB_URL);
      postMessage({ type: "modelLoading", progress: 100 });
    }
  } else {
    console.log("model not exists, downloading...");
    await downloadModel();
  }
  console.log("model loaded", model);
  let threads = 0;
  postMessage({ type: "modelLoaded", threads, deviceName: device });
}

async function downloadModel() {
  model = await tf.loadGraphModel(
    "https://regulussig.s3.ap-southeast-1.amazonaws.com/tfjs/model/rps/model.json",
    {
      onProgress: (fractions) => {
        postMessage({ type: "modelLoading", progress: fractions * 100 });
      },
    },
  );
  const savedResult = await model.save(IDB_URL);
  console.log("model saved to db", savedResult);
}

async function run_model(input: ImageData) {
  if (model) {
    return tf.tidy(() => {
      const tf_img = tf.browser.fromPixels(input);
      const inputs = tf_img.div(255.0).expandDims().toFloat();
      const outputs = model?.predict(inputs);
      console.log("numTensors (in predict): " + tf.memory().numTensors);
      if (outputs instanceof tf.Tensor) {
        return outputs;
      }
    });
  } else {
    console.error("model not loaded");
  }
}

addEventListener("message", async (event: MessageEvent) => {
  const { input, startTime } = event.data;
  const predict = await run_model(input);
  if (predict) {
    const result = await predict.data();
    postMessage({ type: "modelResult", result, startTime });
    tf.dispose(predict);
  }
  console.log("numTensors (outside predict): " + tf.memory().numTensors);
});
