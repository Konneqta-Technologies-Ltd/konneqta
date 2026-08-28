'use client'

import DarkModeToggle from "@/components/DarkModeToggle";
import Image from "next/image";
import Joi from "joi";
import Link from "next/link";
import SignInWithGoogle from "@/components/SignInWithGoogle";
import { createClient } from "@/lib/supabase/client";
import {
    MIN_REFERRAL_CODE_LENGTH,
    REFERRAL_STORAGE_KEY,
    normalizeReferralCode,
    readStoredReferralCode,
    storeReferralCode,
} from "@/lib/referrals/shared";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const signupSchema = Joi.object({
    firstName: Joi.string()
        .required()
        .messages({
            "string.empty": "First name is required",
        }),
    lastName: Joi.string()
        .required()
        .messages({
            "string.empty": "Last name is required",
        }),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
            "string.empty": "Email is required",
            "string.email": "Please enter a valid email address",
        }),
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

export default function SignUpPage() {

    const supabase = createClient();
    const router = useRouter();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    // Referral code from ?ref= (or a previously stashed one). Stashed in
    // localStorage so it survives: signup → email confirmation / Google
    // OAuth → /auth/callback → onboarding, where it's attached to the
    // account. See lib/referrals/shared.ts.
    const [referralCode, setReferralCode] = useState<string | null>(null);

    useEffect(() => {
        // Sync browser-only state (URL + localStorage) after mount — setState
        // runs inside the timer callback, not the effect body (lint rule:
        // react-hooks/set-state-in-effect). The value is unknowable during SSR.
        const timer = setTimeout(() => {
            try {
                const raw = new URLSearchParams(window.location.search).get("ref");
                if (raw) {
                    const code = normalizeReferralCode(raw);
                    if (code.length >= MIN_REFERRAL_CODE_LENGTH) {
                        storeReferralCode(code);
                    } else {
                        // Garbage/short ?ref= — drop it rather than stash noise.
                        window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
                    }
                }
            } catch {
                // URLSearchParams/localStorage can throw in odd embeds — ignore.
            }
            setReferralCode(readStoredReferralCode());
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate with Joi before submitting
        const { error: validationError } = signupSchema.validate(
            { firstName, lastName, email, password, confirmPassword },
            { abortEarly: false }
        );
     
        if (validationError) {
            validationError.details.forEach((detail) => {
                toast.error(detail.message);
            });
            return;
        }                      

        setIsLoading(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    display_name: `${firstName} ${lastName}`
                },
            },
        });
        if (error) {
            toast.error(error.message);
            setIsLoading(false);
            return;
        }
        // Supabase returns empty identities when email is already registered
        if (!data.user?.identities?.length) {
            toast.error("This email is already registered. Please log in instead.");
            setIsLoading(false);
            return;
        }
        toast.success("Account created successfully! Please check your email to verify your account.");
        setIsLoading(false);
        router.push("/auth/login");
    }

    return (
        <div className="h-230 bg-white dark:bg-zinc-900">

            <DarkModeToggle />
            <div className="bg-white dark:bg-zinc-900 md:max-w-md mx-auto min-h-full dark:text-white text-zinc-900 ">
                <Image src="/k-logo.png" className="mx-auto pt-7" alt="Konneqta Logo" width={24} height={24} priority quality={75} />
                <div className="text-center pt-3 pb-12 mx-auto">
                    <h1 className="text-3xl font-extrabold ">Create your account</h1>
                    <p className="dark:text-[#737373]">Connect Smarter</p>
                    {referralCode && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-(--main-orange)/40 bg-(--main-orange)/5 px-3 py-1.5 text-xs font-medium text-(--main-orange)">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Invited with code {referralCode}
                        </div>
                    )}
                </div>
                <form onSubmit={handleSignUp} className="max-w-full px-6 mx-auto flex flex-col justify-between h-88">
                    <div>
                    <div className="pb-4 flex flex-col  mx-auto gap-1">
                        <label htmlFor="firstName">First Name</label>
                            <input type="text"
                                className="border pl-2 border-zinc-700 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none"
                                id="firstName"
                                name="firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Enter first name" />
                    </div>
                    <div className="pb-4 flex flex-col w-full mx-auto gap-1">
                        <label htmlFor="lastName">Last Name</label>
                            <input type="text"
                                className="border pl-2 border-zinc-700 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none"
                                id="lastName"
                                name="lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Enter last name" />
                    </div>
                    <div className="pb-4 flex flex-col w-full mx-auto gap-1">
                        <label htmlFor="email">Email</label>
                            <input type="email"
                                className="border pl-2 border-zinc-700 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none"
                                id="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@email.com" />
                    </div>
                    <div className="pb-4 flex flex-col gap-1 w-full mx-auto">
                        <label htmlFor="password">Password</label>
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"}
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="border border-zinc-700 pl-2 pr-10 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none" name="password" placeholder="Enter password" />
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
                                    className="border border-zinc-700 pl-2 pr-10 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none" name="confirmPassword" placeholder="Confirm password" />
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

                    <button className="bg-(--main-orange) text-white w-full cursor-pointer font-semibold mt-4 py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" type="submit" disabled={isLoading}>
                        {isLoading && (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {isLoading ? "Creating account..." : "Register"}
                    </button>

                    <div className="flex items-center gap-3 pt-4" aria-hidden="true">
                        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                        <span className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">or</span>
                        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                    </div>

                    <div className="pt-4">
                        <SignInWithGoogle label="Sign up with Google" variant="auth" />
                    </div>

                    <p className="text-center mb-10 pt-2 text-sm text-zinc-500 dark:text-zinc-400">{"Already have an account?"}<Link href="/auth/login" className="cursor-pointer hover:text-(--main-orange)"> Login</Link> </p>
                    </div>
                </form>
            </div>
        </div>
    )
}