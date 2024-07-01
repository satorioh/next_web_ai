import Link from "next/link";
import { Button } from "@/components/ui/button";

export const BackBtn = () => (
  <Button variant="link" className="absolute -top-1 -left-4" asChild>
    <Link href="/">Back</Link>
  </Button>
);
