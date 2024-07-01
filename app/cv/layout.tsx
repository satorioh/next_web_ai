import { Metadata } from "next";
import { SITE_TITLE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${SITE_TITLE} | CV`,
  description: "CV",
};

export default function CVLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col p-4 h-[100vh]">
        <div className="flex-1 h-full">{children}</div>
      </div>
    </>
  );
}
