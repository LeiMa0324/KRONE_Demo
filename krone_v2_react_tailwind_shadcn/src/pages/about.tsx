import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import {Footer} from "@/components/footer"
import {Button} from "@/components/ui/button"

function CarouselSpacing() {
    const descriptions = [
        "PHD Student at Worcester Polytechnic Institute (Main Author)",
        "Faculty Advisor at WPI",
        "PHD Student at WPI",
        "Visiting Undergraduate Summer Researcher",
        "WPI Summer Undergraduate Researcher",
        "Visiting Undergraduate Summer Researcher"
    ];

    const names = [
        "Lei Ma",
        "Elke Rundensteiner",
        "Peter VanNostrand",
        "Suhani Chaudhary",
        "Ethan Shanbaum",
        "Athanasios Tassiadamis"
    ];

    const image_paths = [
        "/team_members/lei_m.png",
        "/team_members/elke_r.jpg",
        "/team_members/peter_v.png",
        "/team_members/suhani_c.jpeg",
        "/team_members/ethan.jpg",
        "/team_members/thanos_park.jpg"
    ];

    return (
        <Carousel className="w-full max-w-5xl justify-self-center bg-WPIRed">
            <CarouselContent className="-ml-2">
                {names.map((name, index) => (
                    <CarouselItem
                        key={index}
                        className="pl-2 md:basis-1/3 lg:basis-1/3"
                    >
                        <div className="p-2 h-full">
                            <Card className="h-full">
                                <CardContent className="flex flex-col h-full items-center justify-between p-4">
                                    <div className="flex-grow flex items-center justify-center w-full">
                                        <img
                                            className="object-contain h-48 w-full rounded-xl"
                                            src={image_paths[index]}
                                            alt={name}
                                        />
                                    </div>
                                    <span className="text-lg font-semibold text-center mt-4">
                                        {name}
                                    </span>
                                    <p className="text-center text-sm text-gray-700 px-2 mt-2">
                                        {descriptions[index]}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
        </Carousel>
    );
}


const KRONE_desc = "KRONE is a novel log anomaly detection method designed to overcome the limitations of existing deep learning models like RNNs, LSTMs, and Transformers, which struggle with flat log structures and hierarchical anomalies. Unlike traditional approaches that rely on sequential or sliding window techniques—often grouping unrelated logs—KRONE restructures logs into a hierarchical format during training to better capture contextual relationships. Inspired by GraphRAG, KRONE decomposes logs into meaningful sequences (Krone Seqs) representing status, action, and entity, allowing for more precise anomaly detection. It incorporates Level-Decoupled Detection and Cross-Level LLM Detection to flexibly switch between high-level patterns and low-level details depending on the context. This architecture allows KRONE to pinpoint anomalies with higher accuracy and better precision than most state-of-the-art models, making it a powerful tool for identifying system failures and security breaches."

//Export about section
export const About = () => {
    return (
        <div className="bg-white"> {/* Outer div for padding area */}
            <div className="pt-[4.5rem]"></div> {/* Account for navbar */}

            {/* Outer div with padding and background color */}
            <div className="flex-col w-full min-h-screen bg-white py-6 px-24"> {/* Changed h-screen to min-h-screen */}
                {/* Inner div with a different background color */}
                <div className="flex-col bg-WPIRed h-fit rounded-4xl items-center py-12">
                    <div className="font-bold text-3xl text-gray-100"> How KRONE Works </div>
                    <br></br>
                    <p className="text-white px-32"> {KRONE_desc} </p>
                    <br></br>
                    <Button variant="outline"> Read the Paper </Button>
                    <br></br>
                    <br></br>
                    <div className="font-bold text-3xl text-gray-100"> Meet The Team </div>
                    <CarouselSpacing />
                </div>
            </div>
            <div className="pb-6"></div> {/* Added padding to prevent bleeding into the footer */}
            <Footer></Footer>
        </div>
    );
};
