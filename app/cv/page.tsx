"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { When } from "react-if";

type Box = [number, number, number, number, string, number];

const yolo_classes = ["Paper", "Rock", "Scissors"];
let inferCount = 0;
let totalInferTime = 0;
let boxes: Box[] = [];
let isBusy = false;
let threadsCount = 0;
let device = "";
let requestId = 0;

export default function CVPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const workerRef = useRef<Worker>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./rps.worker.ts", import.meta.url),
    );

    const onMessageReceived = (event: MessageEvent) => {
      const data = event.data;
      switch (data.type) {
        case "modelLoading":
          onModelLoading(data);
          break;
        case "modelLoaded":
          onModelLoaded(data);
          break;
        case "modelResult":
          onModelResult(data);
          break;
      }
    };

    // Attach the callback function as an event listener.
    workerRef.current.addEventListener("message", onMessageReceived);

    return () => {
      reset();
    };
  }, []);

  const onModelLoading = (data: { progress: number }) => {
    const { progress } = data;
    console.log("progress", progress);
    setProgress(progress);
  };

  const onModelLoaded = (data: { threads: number; deviceName: string }) => {
    const { threads, deviceName } = data;
    threadsCount = threads;
    device = deviceName;
    setIsLoading(false);
    initWebcam();
  };

  const onModelResult = (data: { startTime: number; result: Float32Array }) => {
    const { startTime, result } = data;
    const endTime = performance.now(); // 记录结束时间
    const inferTime = endTime - startTime; // 计算执行时间
    inferCount++;
    totalInferTime += inferTime;
    const averageInferTime = parseInt(String(totalInferTime / inferCount));
    console.log(`Infer count: ${inferCount}`);
    console.log(`Average infer time: ${averageInferTime} ms`);

    if (canvasRef.current === null) return;
    boxes = process_output(
      result,
      canvasRef.current.width,
      canvasRef.current.height,
    );
    isBusy = false;
  };

  const initWebcam = async () => {
    const errorMessage =
      "You have to give browser the Webcam permission to run detection";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: "destructive",
        title: errorMessage,
      });
      return;
    }
    console.log("initWebcam");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: errorMessage,
      });
    }
  };

  const detect = async () => {
    if (canvasRef.current === null || videoRef.current === null) return;
    canvasRef.current.width = 640;
    canvasRef.current.height = 480;
    const context = canvasRef.current.getContext("2d");
    const process = () => {
      console.log("interval");
      if (context && videoRef.current && canvasRef.current) {
        context.drawImage(videoRef.current, 0, 0);
        draw_boxes(canvasRef.current, boxes);
        const input = prepare_input(canvasRef.current);
        if (!isBusy) {
          const startTime = performance.now(); // 记录开始时间
          workerRef.current?.postMessage({ input, startTime }); // 将开始时间发送到 worker
          isBusy = true;
        }
      }
      requestId = window.requestAnimationFrame(process);
    };
    process();
  };

  const start = async () => {
    console.log("start");
    await videoRef.current?.play();
    await detect();
  };

  const pause = async () => {
    console.log("pause");
    window.cancelAnimationFrame(requestId);
    videoRef.current?.pause();
  };

  const reset = async () => {
    console.log("reset");
    workerRef.current?.terminate();
    setIsLoading(true);
    inferCount = 0;
    totalInferTime = 0;
    boxes = [];
    isBusy = false;
    threadsCount = 0;
    device = "";
    requestId = 0;
  };

  const handleClick = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await start();
    }
    setIsPlaying(!isPlaying);
  };

  const prepare_input = (img: HTMLCanvasElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context || img.width === 0) return;
    context.drawImage(img, 0, 0, 640, 640);
    return context.getImageData(0, 0, 640, 640);
  };

  const process_output = (
    output: Float32Array,
    img_width: number,
    img_height: number,
  ) => {
    let boxes: Box[] = [];
    for (let index = 0; index < 8400; index++) {
      const [class_id, prob] = [
        ...Array.from(Array(yolo_classes.length).keys()),
      ]
        .map((col) => [col, output[8400 * (col + 4) + index]])
        .reduce((accum, item) => (item[1] > accum[1] ? item : accum), [0, 0]);
      if (prob < 0.5) {
        continue;
      }
      const label = yolo_classes[class_id];
      const xc = output[index];
      const yc = output[8400 + index];
      const w = output[2 * 8400 + index];
      const h = output[3 * 8400 + index];
      const x1 = ((xc - w / 2) / 640) * img_width;
      const y1 = ((yc - h / 2) / 640) * img_height;
      const x2 = ((xc + w / 2) / 640) * img_width;
      const y2 = ((yc + h / 2) / 640) * img_height;
      boxes.push([x1, y1, x2, y2, label, prob]);
    }

    boxes = boxes.sort((box1, box2) => box2[5] - box1[5]);
    const result = [];
    while (boxes.length > 0) {
      result.push(boxes[0]);
      boxes = boxes.filter((box) => iou(boxes[0], box) < 0.7);
    }
    return result;
  };

  const iou = (box1: Box, box2: Box) => {
    return intersection(box1, box2) / union(box1, box2);
  };

  const union = (box1: Box, box2: Box) => {
    const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
    const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
    const box1_area = (box1_x2 - box1_x1) * (box1_y2 - box1_y1);
    const box2_area = (box2_x2 - box2_x1) * (box2_y2 - box2_y1);
    return box1_area + box2_area - intersection(box1, box2);
  };

  const intersection = (box1: Box, box2: Box) => {
    const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
    const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
    const x1 = Math.max(box1_x1, box2_x1);
    const y1 = Math.max(box1_y1, box2_y1);
    const x2 = Math.min(box1_x2, box2_x2);
    const y2 = Math.min(box1_y2, box2_y2);
    return (x2 - x1) * (y2 - y1);
  };

  const draw_boxes = (canvas: HTMLCanvasElement, boxes: Box[]) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.font = "18px serif";
    boxes.forEach(([x1, y1, x2, y2, label]) => {
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = "#00ff00";
      const width = ctx.measureText(label).width;
      ctx.fillRect(x1, y1, width + 10, 25);
      ctx.fillStyle = "#000000";
      ctx.fillText(label, x1, y1 + 18);
    });

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
    ctx.fillText(`Threads count: ${threadsCount}`, 10, 60);
    ctx.fillText(`Device: ${device}`, 10, 80);
  };

  return (
    <div>
      <h2 className="text-center scroll-m-20 pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        Paper, Rock, Scissors WebCam Detection
      </h2>
      <video controls className="hidden" ref={videoRef}></video>
      <div className="flex flex-col justify-center items-center relative">
        <When condition={isLoading}>
          <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%]">
            <Progress value={progress} />
            <div>Loading model, please wait...</div>
          </div>
        </When>
        <canvas
          className="w-full text-center max-w-3xl"
          ref={canvasRef}
        ></canvas>
      </div>
      <div className="text-center space-x-4 mt-4">
        <When condition={!isLoading}>
          <Button
            onClick={handleClick}
            variant={isPlaying ? "destructive" : "default"}
          >
            {isPlaying ? "Pause" : "Start"}
          </Button>
        </When>
      </div>
    </div>
  );
}
