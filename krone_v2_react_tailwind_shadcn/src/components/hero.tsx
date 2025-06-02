import { Button } from "@/components/ui/button"

export const HeroSection = () => {
    return (
        <section
            id="hero"
            className="relative min-h-screen flex flex-col items-center justify-center px-4"
        >
            <div className="container max-w-4xl mx-auto text-center z-10">
                <div className="space-y-6">
                    <h1 className="text-4xl w-fit px-6 py-3 md:text-6xl font-bold tracking-tight bg-WPIRed/85 text-center mx-auto">
                        <span className="text-white"> Introducing </span>
                        <span className="text-white ml-2"> Krone </span>
                    </h1>

                    <p className="text-lg md:text-xl py-2 text-white max-w-2xl mx-auto bg-WPIRed/85">
                        The newest state-of-the-art machine learning powered pinpoint log anomaly detector
                    </p>

                    <div className="pt-4">
                        <Button > Try Out Krone </Button>
                    </div>
                </div>
            </div>
        </section>
    );
};