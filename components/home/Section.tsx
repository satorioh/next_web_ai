import styles from "@/styles/home.module.scss";
import React from "react";
import { cn } from "@/lib/utils";

export default function Section({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(styles.sectionWrap, className)}>
      <section className="section flex flex-col items-center justify-center w-full h-full py-8 px-8 md:px-16 max-w-[1300px] ml-auto mr-auto">
        {children}
      </section>
    </div>
  );
}
