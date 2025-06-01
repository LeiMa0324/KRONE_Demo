import { WPIBackground } from "@/components/WPIbackground";
import { NavBar } from "@/components/navbar"
import { HeroSection } from "@/components/hero"

export const Home = () => {
    return (
        <div className="min-h-screen text-foreground overflow-x-hidden">
            <WPIBackground></WPIBackground>
            <NavBar></NavBar>
            <main> 
                <HeroSection></HeroSection>
            </main>
        </div>
    );
};
