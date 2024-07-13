import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface CardItemProps {
  title: string;
  description: string;
  image: string;
  link: string;
}

export default function CardItem(props: CardItemProps) {
  const { title, description, image, link } = props;
  return (
    <div className="card-item">
      <Link href={link}>
        <Card>
          <CardHeader className="p-0 pb-6">
            <Image
              className="rounded-t-md w-auto"
              src={image}
              alt={title}
              width={312}
              height={175}
              priority
            ></Image>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-xl font-normal cursor-pointer truncate">
              {title}
            </CardTitle>
            <CardDescription className="cursor-pointer truncate">
              {description}
            </CardDescription>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="border rounded px-2 text-violet-600 hover:bg-violet-100 cursor-pointer">
              See demo
            </p>
          </CardFooter>
        </Card>
      </Link>
    </div>
  );
}
