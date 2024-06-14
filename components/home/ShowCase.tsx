import Section from "@/components/home/Section";
import CardItem from "@/components/home/CardItem";

const card_data = [
  {
    title: "Rock, Paper, Scissors",
    description: "Play rock, paper, scissors with webcam.",
    image: "/images/rps.png",
    link: "/cv/rps",
  },
  {
    title: "Object Detection",
    description: "Track and label objects in webcam.",
    image: "/images/od.png",
    link: "/cv/od",
  },
  {
    title: "Image Segmentation",
    description: "Locate objects and create image masks with labels. ",
    image: "/images/seg.png",
    link: "/cv/seg",
  },
];

export default function ShowCase() {
  return (
    <Section>
      <div className="mx-auto max-w-[860px]">
        <h2 className="text-xl md:text-2xl tracking-tight leading-tight mb-2">
          VISION
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {card_data.map((card, index) => (
            <CardItem key={index} {...card} />
          ))}
        </div>
      </div>
    </Section>
  );
}
