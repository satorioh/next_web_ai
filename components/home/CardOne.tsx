import styles from "@/styles/home.module.scss";
import { SITE_TITLE } from "@/lib/constants";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Section from "@/components/home/Section";
import Link from "next/link";

export default function CardOne() {
  return (
    <Section>
      <div className="mx-auto max-w-[860px]">
        <h1 className="scroll-m-20 text-3xl md:text-7xl font-extrabold tracking-tight text-center leading-tight">
          <span className={styles.gradient}>Next</span> Web ML
        </h1>
        <p className="p-secondary [&:not(:first-child)]:mt-6 text-center text-sm md:text-xl my-2 md:mx-10">
          {SITE_TITLE} is a platform designed to showcase native AI applications
          building with web technology.
        </p>
        <div className="text-center my-10 flex flex-col justify-center items-center">
          <Image
            className="rounded-md"
            src="/images/rps.png"
            alt="rps game"
            width={640}
            height={359}
            priority
          ></Image>
          <Button
            asChild
            className="mt-8 rounded-md text-base py-6 px-6 bg-gradient-to-r from-indigo-500 to-violet-700"
          >
            <Link href="/cv/od">Try for fun</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
