export const HeroSection = () => {
    return (
        <section
            id="hero"
            className="relative min-h-screen flex flex-col items-center justify-center px-4"
        >
            <div className="container max-w-4xl mx-auto text-center z-10">
                <div className="space-y-6">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        <span> Introducing </span>
                        <span className="text-primary ml-2"> Krone </span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                        The newest state-of-the-art pinpoint log anomaly detection
                    </p>

                    <div className="pt-4">
                        <a href="#projects" className="text-primary underline">
                            Try Out Krone 
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};