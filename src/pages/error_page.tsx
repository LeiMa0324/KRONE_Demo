const ERROR_MESSAGE = "Error 404: Page Not Found"

export const ErrorPage = () => {
    return (
        <>
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <div className="text-9xl font-WPIfont text-WPIRed"> {ERROR_MESSAGE} </div>
            </div>
        </>
    )
}