'use client'

import { Suspense, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

import DarkModeToggle from "@/components/DarkModeToggle";
import Image from "next/image";
import Joi from "joi";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";

const otpSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),
    otp: Joi.string()
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            "string.empty": "Enter the 6-digit code",
            "string.pattern.base": "Code must be exactly 6 digits",
        }),
});

function VerifyResetForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialEmail = searchParams.get("email") ?? "";

    const [email, setEmail] = useState(initialEmail);
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [isLoading, setIsLoading] = useState(false);
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

    const handleOtpChange = (index: number, value: string) => {
        // Only allow digits.
        const digit = value.replace(/\D/g, "").slice(-1);
        const next = [...otp];
        next[index] = digit;
        setOtp(next);

        // Auto-advance to the next box.
        if (digit && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (pasted.length > 0) {
            const next = pasted.split("");
            while (next.length < 6) next.push("");
            setOtp(next);
            inputsRef.current[Math.min(pasted.length, 5)]?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = otp.join("");

        const { error: validationError } = otpSchema.validate(
            { email, otp: code },
            { abortEarly: false }
        );

        if (validationError) {
            toast.error(validationError.details[0].message);
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/verify-reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp: code }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                toast.error(data?.error || "Verification failed. Please try again.");
                setIsLoading(false);
                return;
            }

            // Verified → go to the set-password page.
            router.push("/auth/reset-password");
        } catch {
            toast.error("Network error. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-full px-6 mx-auto flex flex-col justify-between h-88">
            <div>
                <div className="pb-4 flex flex-col mx-auto gap-1">
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        className="border pl-2 border-zinc-700 dark:border-white/50 w-full h-13 rounded-xl focus:border-(--main-orange) focus:outline-none"
                        id="email"
                        name="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                    />
                </div>
                <div className="pb-4 flex flex-col mx-auto gap-1">
                    <label>Verification code</label>
                    <div className="flex justify-between gap-2" onPaste={handlePaste}>
                        {otp.map((digit, i) => (
                            <input
                                key={i}
                                ref={(el) => { inputsRef.current[i] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                className="border border-zinc-700 dark:border-white/50 w-12 h-14 rounded-xl text-center text-2xl font-bold focus:border-(--main-orange) focus:outline-none"
                            />
                        ))}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Enter the 6-digit code from your email.
                    </p>
                </div>
            </div>
            <div>
                <button
                    className="bg-(--main-orange) text-white w-full cursor-pointer font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading && <Spinner size="sm" className="text-white" />}
                    {isLoading ? "Verifying..." : "Verify code"}
                </button>
                <p className="text-center pt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <Link href="/auth/forgot-password" className="cursor-pointer hover:text-(--main-orange)">
                        {"Didn't get a code?"}
                    </Link>
                </p>
            </div>
        </form>
    );
}

export default function VerifyResetPage() {
    return (
        <div className="dark:bg-zinc-900">
            <DarkModeToggle />
            <div className="dark:bg-zinc-900 md:max-w-md mx-auto h-screen dark:text-white text-zinc-900 ">
                <Image src="/k-logo.png" className="mx-auto pt-20" alt="Konneqta Logo" width={24} height={24} priority quality={75} />
                <div className="text-center pt-7 pb-14 mx-auto">
                    <h1 className="text-3xl font-extrabold">Enter your code</h1>
                    <p className="dark:text-[#737373]">We sent a 6-digit code to your email</p>
                </div>
                <Suspense fallback={
                    <div className="flex justify-center">
                        <Spinner size="md" className="text-(--main-orange)" />
                    </div>
                }>
                    <VerifyResetForm />
                </Suspense>
            </div>
            <Toaster richColors position="top-right" />
        </div>
    );
}