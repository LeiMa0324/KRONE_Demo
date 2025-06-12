import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react"; // Icons for the hamburger menu

export const NavBar = () => {
    const location = useLocation();
    const isHeroPage = location.pathname === "/";
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <nav className={`fixed w-full z-40 bg-WPIRed ${isHeroPage ? "animate-slide-in-top" : ""}`}>
            <div className="flex w-full justify-between items-center px-4 py-3">
                {/* Logo Section */}
                <div className="flex items-center gap-4">
                    <Link to="/">
                        <Avatar className="size-12">
                            <AvatarImage src="/cropped_wpi_logo.png" />
                            <AvatarFallback>WPI</AvatarFallback>
                        </Avatar>
                    </Link>
                    <Link to="/">
                        <span className="font-WPIfont font-bold text-3xl text-gray-100">KRONE</span>
                    </Link>
                </div>

                {/* Hamburger Menu for Mobile */}
                <div className="lg:hidden">
                    <Button
                        className="bg-transparent shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0"
                        onClick={toggleMenu}
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"} // Add accessible name
                    >
                        {isMenuOpen ? <X className="text-gray-100 w-6 h-6" /> : <Menu className="text-gray-100 w-6 h-6" />}
                    </Button>
                </div>

                {/* Navigation Links */}
                <div
                    className={`flex-col lg:flex-row lg:flex items-center gap-4 absolute lg:static top-16 left-0 w-full lg:w-auto bg-WPIRed lg:bg-transparent transition-all duration-300 ${
                        isMenuOpen ? "flex" : "hidden"
                    }`}
                >
                    <Link to="/file-upload">
                        <Button className="bg-transparent font-WPIfont shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0 text-gray-100">
                            File Upload
                        </Button>
                    </Link>
                    <Link to="/visualize-tree">
                        <Button className="bg-transparent font-WPIfont shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0 text-gray-100">
                            Visualize Tree
                        </Button>
                    </Link>
                    <Link to="/log-table">
                        <Button className="bg-transparent font-WPIfont shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0 text-gray-100">
                            Log Table
                        </Button>
                    </Link>
                    <Link to="/about">
                        <Button className="bg-transparent font-WPIfont shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0 text-gray-100">
                            About
                        </Button>
                    </Link>
                    <Link to="/visualze-tree-horizontal">
                        <Button className="bg-transparent shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0 text-gray-100">
                            Visualize Tree Horizontal
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
};