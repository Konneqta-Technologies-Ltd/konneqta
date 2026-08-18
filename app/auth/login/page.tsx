'use client'

import { Toaster, toast } from "sonner";

import DarkModeToggle from "@/components/DarkModeToggle";
import Image from "next/image";
import Joi from "joi";
import Link from "next/link";
import SignInWithGoogle from "@/components/SignInWithGoogle";
import Spinner from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const loginSchema = Joi.object({
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
});

export default function LoginPage() {

    const supabase = createClient();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate with Joi before submitting
        const { error: validationError } = loginSchema.validate(
            { email, password },
            { abortEarly: false }
        );

        if (validationError) {
            validationError.details.forEach((detail) => {
                toast.error(detail.message);
            });
            return;
        }

        setIsLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            toast.error(error.message);
            setIsLoading(false);
            return;
        }
        
        router.push("/post-login");
    }

    return (
        <div className= "dark:bg-zinc-900 "> 

            <DarkModeToggle />
            <div className="dark:bg-zinc-900 md:max-w-md mx-auto h-screen dark:text-white text-zinc-900 ">
                <Image src="/k-logo.png" className="mx-auto pt-20" alt="Konneqta Logo" width={24} height={24} priority quality={75} />
                <div className="text-center pt-7 pb-14 mx-auto">
                    <h1 className="text-3xl font-extrabold ">Login your account</h1>
                    <p className="dark:text-[#737373]">Connect Smarter</p>
                </div>
                <form onSubmit={handleLogin} className="max-w-full px-6 mx-auto flex flex-col justify-between h-88">
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
                    <div className="pb-4 flex flex-col gap-1 mx-auto">
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
                        <Link href="/auth/forgot-password" className="self-end text-sm text-zinc-500 hover:text-(--main-orange) cursor-pointer">Forgot password?</Link>
                    </div>
                    </div>
                    <div>

                    <button className="bg-(--main-orange) text-white w-full cursor-pointer font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" type="submit" disabled={isLoading}>
                        {isLoading && <Spinner size="sm" className="text-white" />}
                        {isLoading ? "Logging in..." : "Continue"}
                    </button>

                    <div className="flex items-center gap-3 pt-4" aria-hidden="true">
                        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                        <span className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">or</span>
                        <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                    </div>

                    <div className="pt-4">
                        <SignInWithGoogle label="Sign in with Google" variant="auth" />
                    </div>

                    <p className="text-center pt-2 text-sm text-zinc-500 dark:text-zinc-400">{"Don't have an account?"}<Link href="/auth/signup" className="cursor-pointer hover:text-(--main-orange)"> Create one</Link> </p>
                    </div>
                </form>
            </div>
            <Toaster richColors position="top-right" />
        </div>
    )
}