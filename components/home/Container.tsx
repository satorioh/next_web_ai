import Header from "@/components/home/Header";
import ShowCase from "@/components/home/ShowCase";

export default function Container() {
  return (
    <div className="home-container flex flex-col flex-1 overflow-hidden">
      <Header />
      <ShowCase />
    </div>
  );
}
