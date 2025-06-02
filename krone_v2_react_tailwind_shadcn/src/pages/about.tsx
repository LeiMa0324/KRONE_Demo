import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import {Footer} from "@/components/footer"

//Add descriptions and images for each team member
const descriptions = ["placeholder description until I add more"]
const image_paths = ["/team_members/thanos_park.jpg"]

function CarouselSpacing() {
    return (
        <Carousel className="w-full max-w-sm justify-self-center bg-white">
            <CarouselContent className="-ml-1">
                {Array.from({ length: 5 }).map((_, index) => (
                    <CarouselItem key={index} className="pl-1 md:basis-1/2 lg:basis-1/3">
                        <div className="p-1">
                            <Card>
                                <CardContent className="flex-col overflow-hidden aspect-square items-center justify-center p-6">
                                    <img className="size-24" src={image_paths[0]}></img>
                                    <span className="text-2xl font-semibold">{descriptions[0]}</span>
                                </CardContent>
                            </Card>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
        </Carousel>
    )
}

//Export about section
export const About = () => {
    return (
        <div className="bg-gray-200"> {/* Outer div for padding area */}
            <div className="pt-[4.5rem]"></div> {/* Account for navbar */}

            {/* Outer div with padding and background color */}
            <div className="flex-col w-full h-screen bg-white py-12 px-24">
                {/* Inner div with a different background color */}
                <div className="flex-col bg-WPIRed h-full rounded-4xl items-center">
                    <div className="font-bold text-3xl text-gray-100 underline"> How KRONE Works </div>
                    <p> This is a sample description on how krone Works, This is a sample description on how krone Works, This is a sample description on how krone Works, This is a sample description on how krone Works, This is a sample description on how krone Works, This is a sample description on how krone Works </p>
                    <br></br>
                    <div className="font-bold text-3xl text-gray-100 underline"> Meet The Team </div>
                    <CarouselSpacing />
                </div>
            </div>
            <Footer></Footer>
        </div>
    );
};