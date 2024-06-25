"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { When } from "react-if";
import { FrameData } from "@/lib/types";
import { BackBtn } from "@/components/common/BackBtn";
import { STUN_SERVER, BACKEND_URL_PREFIX } from "@/lib/constants";

let isBusy = false;
let requestId = 0;
let offscreen: OffscreenCanvas | null;
let pc: RTCPeerConnection | null = null;

export default function EdgePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const workerRef = useRef<Worker>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../../../worker/edge.worker.ts", import.meta.url),
    );

    const onMessageReceived = (event: MessageEvent) => {
      const data = event.data;
      switch (data.type) {
        case "modelLoading":
          onModelLoading(data);
          break;
        case "modelLoaded":
          onModelLoaded();
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

  const onModelLoaded = () => {
    setIsLoading(false);
    if (!pc) {
      createPeerConnection();
    }
    initWebcam();
  };

  const onModelResult = (data: { type: string }) => {
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
      stream.getTracks().forEach((track) => {
        if (pc) pc.addTrack(track, stream);
      });
      negotiate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: errorMessage,
      });
    }
  };

  const initOffscreenCanvas = () => {
    if (canvasRef.current === null) return;
    canvasRef.current.width = 640;
    canvasRef.current.height = 480;
    offscreen = canvasRef.current.transferControlToOffscreen();
    workerRef.current?.postMessage({ type: "canvas", canvas: offscreen }, [
      offscreen,
    ]);
  };

  const createPeerConnection = () => {
    const config = {
      sdpSemantics: "unified-plan",
      iceServers: [{ urls: [STUN_SERVER] as string[] }],
    };

    pc = new RTCPeerConnection(config);

    // register some listeners to help debugging
    pc.addEventListener(
      "icegatheringstatechange",
      () => {
        console.log(
          "ice gathering state change ->",
          pc && pc.iceGatheringState,
        );
      },
      false,
    );

    pc.addEventListener(
      "iceconnectionstatechange",
      () => {
        console.log(
          "ice connection state change -->",
          pc && pc.iceConnectionState,
        );
      },
      false,
    );

    pc.addEventListener(
      "signalingstatechange",
      () => {
        console.log("signaling state change -->", pc && pc.signalingState);
      },
      false,
    );

    // connect audio / video
    pc.addEventListener("track", (evt) => {
      console.log("get backend track ->", evt);
      if (videoRef.current && evt.track.kind === "video")
        videoRef.current.srcObject = evt.streams[0];
    });
  };

  const negotiate = async () => {
    if (!pc) return;
    console.log("start negotiate...");
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc && pc.iceGatheringState === "complete") {
          console.log("negotiate: iceGatheringState Complete");
          resolve();
        } else {
          const checkState = () => {
            console.log("checkState");
            if (pc && pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              console.log("negotiate: iceGatheringState Complete");
              resolve();
            }
          };
          pc && pc.addEventListener("icegatheringstatechange", checkState);
        }
      });

      const finalOffer = pc.localDescription;
      if (finalOffer) {
        const response = await fetch(`${BACKEND_URL_PREFIX}webrtc/offer`, {
          body: JSON.stringify({
            sdp: finalOffer.sdp,
            type: finalOffer.type,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        const answer = await response.json();
        await pc.setRemoteDescription(answer);
      }
    } catch (e) {
      alert(e);
    }
  };

  const detect = async () => {
    if (videoRef.current === null) return;
    if (!offscreen) {
      initOffscreenCanvas();
    }

    const process = () => {
      console.log("interval");
      if (videoRef.current && canvasRef.current) {
        const image = prepare_input(videoRef.current);
        if (!isBusy) {
          workerRef.current?.postMessage({
            type: "frame",
            image,
          } as FrameData);
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
    isBusy = false;
    offscreen = null;
    requestId = 0;
    pc = null;
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

  return (
    <div>
      <div className="relative">
        <BackBtn />
        <h2 className="text-center scroll-m-20 pb-2 text-2xl font-semibold tracking-tight first:mt-0">
          Edge Detection
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
