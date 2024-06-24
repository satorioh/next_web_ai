"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { When } from "react-if";
import { LandMarkerResult, LandMark, FrameData } from "@/lib/types";
import { BackBtn } from "@/components/common/BackBtn";

let inferCount = 0;
let totalInferTime = 0;
let isBusy = false;
let device = "";
let requestId = 0;
let result: LandMark[][] | undefined;
// let context: CanvasRenderingContext2D | null;
let offscreen: OffscreenCanvas;

export default function ShieldPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const workerRef = useRef<Worker>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../../../worker/shield.worker.ts", import.meta.url),
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
    const { deviceName } = data;
    device = deviceName;
    setIsLoading(false);
    initWebcam();
  };

  const onModelResult = (data: LandMarkerResult) => {
    // const { startTime, landmarks } = data;
    // if (landmarks?.length > 0) {
    //   const endTime = performance.now(); // 记录结束时间
    //   const inferTime = endTime - startTime; // 计算执行时间
    //   inferCount++;
    //   totalInferTime += inferTime;
    //   const averageInferTime = parseInt(String(totalInferTime / inferCount));
    //   console.log(`Infer count: ${inferCount}`);
    //   console.log(`Average infer time: ${averageInferTime} ms`);
    //
    //   process_output(landmarks);
    // }
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
    // context = canvasRef.current.getContext("2d") as CanvasRenderingContext2D;
    offscreen = canvasRef.current.transferControlToOffscreen();
    workerRef.current?.postMessage({ type: "canvas", canvas: offscreen }, [
      offscreen,
    ]);

    const process = () => {
      console.log("interval");
      if (videoRef.current && canvasRef.current) {
        const image = prepare_input(videoRef.current);
        if (!isBusy) {
          const startTime = performance.now(); // 记录开始时间
          workerRef.current?.postMessage({
            type: "frame",
            image,
            startTime,
          } as FrameData); // 将开始时间发送到 worker
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

  const closeWorker = () => {
    workerRef.current?.postMessage({ type: "close" });
    workerRef.current?.terminate();
  };

  const reset = async () => {
    console.log("reset");
    closeWorker();
    pause();
    setIsLoading(true);
    inferCount = 0;
    totalInferTime = 0;
    isBusy = false;
    result = undefined;
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

  const prepare_input = (img: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(img, 0, 0, 640, 480);
    return context.getImageData(0, 0, 640, 480);
  };

  const process_output = (landmarks: LandMark[][]) => {
    result = landmarks;
  };

  return (
    <div>
      <div className="relative">
        <BackBtn />
        <h2 className="text-center scroll-m-20 pb-2 text-2xl font-semibold tracking-tight first:mt-0">
          Doctor Stranger&apos; Magic Shield
        </h2>
      </div>
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
