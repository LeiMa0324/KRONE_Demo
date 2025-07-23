import { useRef } from "react";
import { WPIBackground } from "@/components/WPIbackground";
import { HeroSection } from "@/components/hero";
import { FeaturesDescription } from "@/components/home_features_description/FeaturesDescription";

export const Home = () => {
    const featuresRef = useRef<HTMLDivElement>(null);

    const scrollToFeatures = () => {
        const navbarHeight = 70;
        if (featuresRef.current) {
            const top = featuresRef.current.getBoundingClientRect().top + window.scrollY - navbarHeight;
            window.scrollTo({ top, behavior: "smooth" });
        }
    };

    return (
        <div className="min-h-screen text-foreground overflow-x-hidden relative">
            <WPIBackground />
            <main>
                <HeroSection />
                <div className="flex justify-center" style={{ marginBottom: "10vh" }}>
                    <button
                        onClick={scrollToFeatures}
                        aria-label="Scroll to Features"
                        className="animate-bounce p-2 rounded-full bg-white/80 hover:bg-white shadow-lg"
                    >
                        {/* Down Arrow SVG */}
                        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </main>
            <div ref={featuresRef}>
                <FeaturesDescription />
            </div>
        </div>
    );
};
