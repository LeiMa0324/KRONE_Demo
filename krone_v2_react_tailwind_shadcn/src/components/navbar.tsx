import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "react-router-dom"

export const NavBar = () => {
    const location = useLocation();
    const isHeroPage = location.pathname === "/";

    return (
        <nav className={`fixed w-full z-40 bg-WPIRed ${isHeroPage ? "animate-slide-in-top" : ""}`}>
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
                    <Button className="bg-transparent shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0">File Upload</Button>
                </Link>
                <Link to="/visualize-tree">
                    <Button className="bg-transparent shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0">Visualize Tree</Button>
                </Link>
                <Link to="/log-table">
                    <Button className="bg-transparent shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0">Log Table</Button>
                </Link>
                <Link to="/about">
                    <Button className="bg-transparent shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0">About</Button>
                </Link>
            </div>
        </nav>
    );
};