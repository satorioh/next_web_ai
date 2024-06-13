import styles from "@/styles/home.module.scss";
import { SITE_TITLE } from "@/lib/constants";
import Section from "@/components/home/Section";

export default function Header() {
  return (
    <Section>
      <div className="mx-auto max-w-[860px]">
        <h1 className="scroll-m-20 text-3xl md:text-7xl font-extrabold tracking-tight text-center leading-tight">
          <span className={styles.gradient}>Next</span> Web ML
        </h1>
        <p className="p-secondary [&:not(:first-child)]:mt-6 text-center text-sm md:text-xl my-2 md:mx-10">
          Explore the AI applications built with web technology.
        </p>
      </div>
    </Section>
  );
}
