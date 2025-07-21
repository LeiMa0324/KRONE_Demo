import {Angry} from "lucide-react";

const ERROR_MESSAGE = "Error 404: Page Not Found"

export const ErrorPage = () => {
    return (
        <>
            <div className="flex flex-col items-center justify-center text-center p-4 pt-[4.5rem]">
                <p className="text-WPIRed text-lg mt-2"> {ERROR_MESSAGE} </p>
                <Angry className="text-WPIRed"/>
            </div>
        </>
    )
}