import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react"; // Icons for the hamburger menu

// Constants
const BUTTON_STYLE =
    "bg-transparent font-WPIfont shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0 text-gray-100 relative after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-white after:transition-all after:duration-300 after:ease-in-out after:w-0 hover:after:w-full";
const navLinks = [
    { path: "/file-upload", label: "File Upload" },
    { path: "/visualize-tree", label: "Log Key Template Tree" },
    { path: "/sequence-tree", label: "Log Sequence Tree" },
    { path: "/knowledge-base", label: "Knowledge Base" },
    { path: "/about", label: "About" },
];

export const NavBar = () => {
    const location = useLocation();
    const isHeroPage = location.pathname === "/";
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <nav
            className={`fixed w-full z-40 bg-WPIRed ${isHeroPage ? "animate-slide-in-top" : ""
                }`}
        >
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
                        <span className="font-WPIfont font-bold text-3xl text-gray-100">
                            KRONE
                        </span>
                    </Link>
                </div>

                {/* Hamburger Menu for Mobile */}
                <div className="lg:hidden">
                    <Button
                        className="bg-transparent shadow-none border-none hover:bg-red-800 focus:outline-none focus:ring-0"
                        onClick={toggleMenu}
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                    >
                        {isMenuOpen ? (
                            <X className="text-gray-100 w-6 h-6" />
                        ) : (
                            <Menu className="text-gray-100 w-6 h-6" />
                        )}
                    </Button>
                </div>

                {/* Navigation Links */}
                <div
                    className={`flex-col lg:flex-row lg:flex items-center gap-4 absolute lg:static top-16 left-0 w-full lg:w-auto bg-WPIRed lg:bg-transparent transition-all duration-300 ${isMenuOpen ? "flex" : "hidden"
                        }`}
                >
                    {navLinks.map((link) => (
                        <Link key={link.path} to={link.path}>
                            <Button
                                className={`${BUTTON_STYLE} ${location.pathname === link.path
                                        ? "after:w-full after:bg-white font-semibold"
                                        : ""
                                    }`}
                            >
                                {link.label}
                            </Button>
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
};
