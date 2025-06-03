import { WPIBackground } from "@/components/WPIbackground";
import { HeroSection } from "@/components/hero"

export const Home = () => {
    return (
        <div className="min-h-screen text-foreground overflow-x-hidden">
            <WPIBackground></WPIBackground>
            <main> 
                <HeroSection></HeroSection> 
            </main>
        </div>
    );
}; // Looking good
