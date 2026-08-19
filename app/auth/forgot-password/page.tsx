'use client'

import { Toaster, toast } from "sonner";

import DarkModeToggle from "@/components/DarkModeToggle";
import Image from "next/image";
import Joi from "joi";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";
import { useState } from "react";

const forgotPasswordSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
            "string.empty": "Email is required",
            "string.email": "Please enter a valid email address",
        }),
});

export default function ForgotPasswordPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();

        const { error: validationError } = forgotPasswordSchema.validate(
            { email },
            { abortEarly: false }
        );

        if (validationError) {
            validationError.details.forEach((detail) => {
                toast.error(detail.message);
            });
            return;
        }

        setIsLoading(true);

        // Custom OTP flow: server generates a 6-digit code, HMAC-hashes it,
        // stores it in password_reset_tokens, and emails it via ZeptoMail
        // (security@konneqta.com). Always returns { ok: true } to prevent
        // user enumeration.
        try {
            const res = await fetch("/api/auth/request-reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "Something went wrong. Please try again.");
                setIsLoading(false);
                return;
            }

            setEmailSent(true);
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-900">

            <DarkModeToggle />
            <div className="bg-white dark:bg-zinc-900 md:max-w-md mx-auto h-screen dark:text-white text-zinc-900 ">
                <Image src="/k-logo.png" className="mx-auto pt-20" alt="Konneqta Logo" width={24} height={24} priority quality={75} />
                <div className="text-center pt-7 pb-14 mx-auto">
                    <h1 className="text-3xl font-extrabold ">Reset your password</h1>
                    <p className="dark:text-[#737373]">{"We'll email you a verification code"}</p>
                </div>
                {emailSent ? (
                    <div className="max-w-full px-6 mx-auto text-center">
                        <div className="flex justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-(--main-orange)">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                        <p className="mb-2">Check your inbox for a 6-digit verification code.</p>
                        <p className="text-sm dark:text-[#737373] text-zinc-500">{"Didn't get it? Check your spam folder or try again in a few minutes."}</p>
                        <button
                            className="mt-8 w-full bg-(--main-orange) text-white cursor-pointer font-semibold py-3 px-4 rounded-xl hover:opacity-90 transition"
                            onClick={() => router.push(`/auth/verify-reset?email=${encodeURIComponent(email)}`)}
                        >
                            Enter verification code
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleResetRequest} className="max-w-full px-6 mx-auto flex flex-col justify-between h-88">
                        <div>
                            <div className="pb-4 flex flex-col mx-auto gap-1">
                                <label htmlFor="email">Email</label>
                                <input type="email"
                                    className="border pl-2 border-zinc-700 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none"
                                    id="email"
                                    name="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@email.com" />
                            </div>
                        </div>
                        <div>

                            <button className="bg-(--main-orange) text-white w-full cursor-pointer font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" type="submit" disabled={isLoading}>
                                {isLoading && <Spinner size="sm" className="text-white" />}
                                {isLoading ? "Sending code..." : "Send reset code"}
                            </button>
                            <p className="text-center pt-2 text-sm text-zinc-500 dark:text-zinc-400">{"Remembered your password?"}<Link href="/auth/login" className="cursor-pointer hover:text-(--main-orange)"> Login</Link> </p>
                        </div>
                    </form>
                )}
            </div>
            <Toaster richColors position="top-right" />
        </div>
    )
}