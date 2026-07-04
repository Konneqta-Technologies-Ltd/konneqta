import DarkModeToggle from '@/components/DarkModeToggle';
import Link from 'next/link';
import SignInWithGoogle from '@/components/SignInWithGoogle';
import Hero from '@/components/home/Hero';
import WhatIsSection from '@/components/home/WhatIsSection';
import CtaSection from '@/components/home/CtaSection';
import Footer from '@/components/home/Footer';

export default function Home() {
  return (
    // <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
    //   <DarkModeToggle />
    //   <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
    //     Connect Smarter, Beyond The Internet
    //   </h1>
    //   <div className="mt-6 flex-col items-center justify-center space-y-4">
    //      <p className="border py-2 text-center px-4 hover:bg-black hover:text-white dark:border-white rounded-4xl cursor-pointer dark:text-white">
    //       <Link href="/auth/signup">
    //         Sign Up
    //       </Link>
    //     </p>
    //     <p className="border py-2 text-center px-4 hover:bg-black hover:text-white dark:border-white rounded-4xl cursor-pointer dark:text-white">
    //       <Link href="/auth/login">
    //         Login
    //       </Link>
    //     </p>
    //     <SignInWithGoogle />
    //   </div>
    // </main>
    <main>
      <Hero />
      <WhatIsSection />
      <CtaSection />
      <Footer />
    </main>
  );
}
