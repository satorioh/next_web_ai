import styles from "@/styles/home.module.scss";
import Section from "@/components/home/Section";
import CardItem from "@/components/home/CardItem";
import Link from "next/link";

export default function ShowCase() {
  return (
    <Section>
      <div className="mx-auto max-w-[860px]">
        <Link href="/cv/od">
          <CardItem></CardItem>
        </Link>
      </div>
    </Section>
  );
}
