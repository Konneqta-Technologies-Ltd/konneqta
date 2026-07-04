'use client'

import { Suspense, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

import DarkModeToggle from "@/components/DarkModeToggle";
import Image from "next/image";
import Joi from "joi";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const resetPasswordSchema = Joi.object({
    password: Joi.string()
        .min(6)
        .required()
        .messages({
            "string.empty": "Password is required",
            "string.min": "Password must be at least 6 characters",
        }),
    confirmPassword: Joi.string()
        .valid(Joi.ref("password"))
        .required()
        .messages({
            "string.empty": "Please confirm your password",
            "any.only": "Passwords do not match",
        }),
});

function ResetPasswordForm() {

    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [hasSession, setHasSession] = useState(false);

    // Guards against React StrictMode mounting the component twice in dev,
    // which would otherwise call exchangeCodeForSession twice and consume
    // the single-use PKCE code on the second call (surfacing as a fake
    // "expired link" error). The ref persists across the dev double-mount.
    const didExchangeRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        const code = searchParams.get("code");

        const verifySession = async () => {
            // First, see if a session already exists (e.g. a previous exchange
            // in this browser succeeded, or the user refreshed the page).
            let { data: { session } } = await supabase.auth.getSession();
            if (cancelled) return;

            if (!session && code) {
                if (!didExchangeRef.current) {
                    // First (or only) mount: perform the one-time code exchange
                    // client-side, where the PKCE code_verifier is stored.
                    didExchangeRef.current = true;
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) {
                        console.error("Code exchange error:", exchangeError.message);
                    }
                    session = (await supabase.auth.getSession()).data.session;
                } else {
                    // StrictMode second mount while the first mount's exchange
                    // is still in flight. Don't call exchange again (the code
                    // is single-use); instead briefly wait for the session
                    // established by the first mount to become visible.
                    for (let i = 0; i < 10 && !session; i++) {
                        await new Promise((r) => setTimeout(r, 150));
                        session = (await supabase.auth.getSession()).data.session;
                    }
                }
            }

            if (cancelled) return;

            if (session) {
                setHasSession(true);
                setIsVerifying(false);
            } else {
                toast.error("This password reset link is invalid or has expired. Please request a new one.");
                setTimeout(() => router.push("/auth/forgot-password"), 1200);
            }
        };

        verifySession();
        return () => { cancelled = true; };
    }, [searchParams, router, supabase]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        const { error: validationError } = resetPasswordSchema.validate(
            { password, confirmPassword },
            { abortEarly: false }
        );

        if (validationError) {
            validationError.details.forEach((detail) => {
                toast.error(detail.message);
            });
            return;
        }

        setIsLoading(true);

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            toast.error(error.message);
            setIsLoading(false);
            return;
        }

        toast.success("Password updated successfully! Please log in with your new password.");

        await supabase.auth.signOut();
        router.push("/auth/login");
    }

    return (
        <div className="dark:bg-zinc-900">

            <DarkModeToggle />
            <div className="dark:bg-zinc-900 md:max-w-md mx-auto h-screen dark:text-white text-zinc-900 ">
                <Image src="/k-logo.png" className="mx-auto pt-20" alt="Konneqta Logo" width={24} height={24} priority quality={75} />
                <div className="text-center pt-7 pb-14 mx-auto">
                    <h1 className="text-3xl font-extrabold ">Set a new password</h1>
                    <p className="dark:text-[#737373]">Choose a strong password</p>
                </div>
                {isVerifying ? (
                    <div className="flex justify-center">
                        <svg className="animate-spin h-8 w-8 text-(--main-orange)" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : hasSession ? (
                    <form onSubmit={handleResetPassword} className="max-w-full px-6 mx-auto flex flex-col justify-between h-88">
                        <div>
                            <div className="pb-4 flex flex-col gap-1 mx-auto">
                                <label htmlFor="password">New Password</label>
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"}
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="border border-zinc-700 pl-2 pr-10 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none" name="password" placeholder="Enter new password" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="pb-4 flex flex-col gap-1 w-full mx-auto">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <div className="relative">
                                    <input type={showConfirmPassword ? "text" : "password"}
                                        id="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="border border-zinc-700 pl-2 pr-10 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none" name="confirmPassword" placeholder="Confirm new password" />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                                        {showConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div>

                            <button className="bg-(--main-orange) text-white w-full cursor-pointer font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" type="submit" disabled={isLoading}>
                                {isLoading && (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                                {isLoading ? "Updating..." : "Update password"}
                            </button>
                            <p className="text-center pt-2 text-sm text-zinc-500 dark:text-zinc-400"><Link href="/auth/login" className="cursor-pointer hover:text-(--main-orange)">Back to login</Link> </p>
                        </div>
                    </form>
                ) : null}
            </div>
            <Toaster richColors position="top-right" />
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="dark:bg-zinc-900 flex justify-center items-center h-screen">
                <svg className="animate-spin h-8 w-8 text-(--main-orange)" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}