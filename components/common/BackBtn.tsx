import Link from "next/link";
import { Button } from "@/components/ui/button";

export const BackBtn = () => (
  <Button variant="outline" className="absolute -top-1" asChild>
    <Link href="/">Back</Link>
  </Button>
);
