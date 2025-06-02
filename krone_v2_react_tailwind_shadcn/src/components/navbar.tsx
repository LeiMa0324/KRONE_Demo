import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom"

export const NavBar = () => {
    return (
        <nav className="fixed w-full z-40 transition-all duration-300 bg-WPIRed">
            <div className="container flex items-left gap-4 px-3 py-3 items-center">
                <Link to="/">
                    <Avatar className="size-12">
                        <AvatarImage src="/cropped_wpi_logo.png" />
                        <AvatarFallback>WPI</AvatarFallback>
                    </Avatar>
                </Link>
                <Link to="/">
                    <a className="font-bold text-3xl text-gray-100">KRONE</a>
                </Link>
                <Link to="/file-upload">
                    <Button>File Upload</Button>
                </Link>
                <Link to="/visualize-tree">
                    <Button>Visualize Tree</Button>
                </Link>
                <Link to="/log-table">
                    <Button>Log Table</Button>
                </Link>
                <Link to="/about">
                    <Button>About</Button>
                </Link>
            </div>
        </nav>
    );
};