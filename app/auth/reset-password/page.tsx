import DarkModeToggle from "@/components/DarkModeToggle";
import Image from "next/image";
import { RESET_COOKIE_NAME } from "@/lib/auth/reset-constants";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import { getResetSession } from "@/lib/auth/password-reset";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * "Set a new password" page — final step of the custom OTP reset flow.
 *
 * Server-gated: reads the `kq_reset_session` cookie (set by
 * /api/auth/verify-reset after a successful OTP), looks up the matching
 * DB reset session, and only renders the form if the session is valid and
 * unexpired. Otherwise redirects to forgot-password.
 *
 * The form POSTs to /api/auth/update-password, which uses the Supabase admin
 * API to set the new password and invalidates the session.
 */
export default async function ResetPasswordPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(RESET_COOKIE_NAME)?.value;

    const session = await getResetSession(sessionId);

    if ("none" in session) {
        // No valid reset session — restart the flow.
        redirect("/auth/forgot-password");
    }

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-900">
            <DarkModeToggle />
            <div className="bg-white dark:bg-zinc-900 md:max-w-md mx-auto h-screen dark:text-white text-zinc-900 ">
                <Image src="/k-logo.png" className="mx-auto pt-20" alt="Konneqta Logo" width={24} height={24} priority quality={75} />
                <div className="text-center pt-7 pb-14 mx-auto">
                    <h1 className="text-3xl font-extrabold ">Set a new password</h1>
                    <p className="dark:text-[#737373]">Choose a strong password</p>
                </div>
                <ResetPasswordForm />
            </div>
            <Toaster richColors position="top-right" />
        </div>
    );
}