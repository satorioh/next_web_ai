"use client";

import { Button } from "@/components/ui/button";

export default function CVPage() {
  return (
    <div>
      <h2 className="text-center scroll-m-20 pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        Paper, Rock, Scissors WebCam Detection
      </h2>
      <video controls className="hidden"></video>
      <br />
      <div className="wrap">
        <div id="loading">
          <div className="loader"></div>
          <div>Loading model, please wait...</div>
        </div>
        <canvas></canvas>
      </div>
      <div className="text-center space-x-4">
        <Button id="play" className="btn">
          Start
        </Button>
        <Button variant="secondary" id="pause" className="btn">
          Pause
        </Button>
      </div>
    </div>
  );
}
