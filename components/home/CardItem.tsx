import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function CardItem() {
  return (
    <div className="card-item">
      <Card>
        <CardHeader className="p-0 pb-6">
          <Image
            className="rounded-t-md"
            src="/images/od.png"
            alt="object detection"
            width={312}
            height={175}
            priority
          ></Image>
        </CardHeader>
        <CardContent>
          <CardTitle className="text-xl font-normal cursor-pointer">
            Object Detection
          </CardTitle>
          <CardDescription className="cursor-pointer">
            Track and label objects in webcam.{" "}
          </CardDescription>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="border rounded px-2 text-violet-600 hover:bg-violet-100 cursor-pointer">
            See demo
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
