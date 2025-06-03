import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

export const HeroSection = () => {
    return (
        <section
            id="hero"
            className="relative min-h-screen flex flex-col items-center justify-center px-4"
        >
            <div className="absolute inset-0 bg-black opacity-55 z-0 pointer-events-none"/>
            <div className="relative text-center flex flex-col items-center z-10">
                <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight text-white mb-6">
                    Introducing <span className="text-primary ml-4 text-white">Krone</span>
                </h1>
                <p className="text-2xl md:text-3xl text-white max-w-3xl mx-auto font-bold mb-10">
                    The newest state-of-the-art machine learning powered pinpoint log anomaly detector
                </p>
                <Button className="text-xl px-10 py-6 rounded-lg"> Try Out Krone </Button>
            </div>
        </section>
    );
};