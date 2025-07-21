import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

// CONSTANTS
const KRONE_DESC = "The newest state-of-the-art machine learning powered pinpoint log anomaly detector";
const BUTTON_LABEL = "Try Out Krone";

//Hero Component
export const HeroSection = () => {
    return (
        <section
            id="hero"
            className="relative flex flex-col min-h-[90vh] items-center justify-center px-4"
        >
            <div className="relative text-center flex flex-col items-center">
                {/* KRONE INTRODUCTION BLOCK */}
                <div className="inline-block relative animate-slide-in-left">
                    <div className="absolute inset-0 translate-x-4 translate-y-4 bg-white z-0"></div>
                    <div className="relative bg-WPIRed shadow-2xl px-14 py-8 z-10">
                        <h1 className="text-5xl md:text-7xl font-WPIfont font-extrabold tracking-tight text-white">
                            <span> Introducing </span>
                            <span className="ml-4 text-white"> Krone </span>
                        </h1>
                    </div>
                </div>

                {/* BRIEF KRONE DESC */}
                <div className="inline-block relative mt-8">
                    <p className="text-2xl md:text-3xl text-white max-w-3xl mx-auto font-WPIfont font-bold animate-slide-in-right" style={{ textShadow: "6px 6px 16px black" }}>
                        {KRONE_DESC}
                    </p>
                </div>
                
                {/* TEST BUTTON */}
                <div className="pt-8">
                    <Link to="/file-upload">
                        <Button className="text-xl font-WPIfont px-10 py-6 rounded-lg animate-slide-in-bot"> {BUTTON_LABEL} </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
};