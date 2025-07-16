import {CircleAlert} from "lucide-react";

export const SmallViewportWarning = () => {
    return (
        <div className="lg:hidden flex flex-col items-center justify-center text-center p-4">
            <p className="text-WPIGrey/110 text-lg mt-2">Please switch to a larger screen</p>
            <CircleAlert className="size-10 mt-2" />
        </div>
    );
}