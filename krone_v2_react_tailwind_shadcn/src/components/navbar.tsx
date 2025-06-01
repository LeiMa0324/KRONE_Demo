import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const NavBar = () => {
    return (
        <nav className="fixed w-full z-40 transition-all duration-300 bg-amber-600">
            <div className="container flex items-left gap-4 px-3 py-3 items-center">
                <Avatar className="size-12">
                    <AvatarImage src="/cropped_wpi_logo.png" />
                    <AvatarFallback>WPI</AvatarFallback>
                </Avatar>
                <a className="font-bold text-3xl text-gray-100">KRONE</a>
                <Button>File Upload</Button>
                <Button>Visualize Tree</Button>
                <Button>Log Table</Button>
                <Button>About</Button>
            </div>
        </nav>
    );
};