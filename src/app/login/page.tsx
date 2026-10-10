import Link from "next/link";
import { redirect } from "next/navigation";
import { requestLogin } from "@/app/actions";
import { ArchMark } from "@/components/brand";
import { Notice, buttonPrimary, inputClass } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  if (await getSession()) redirect("/studio");
  const { sent, error } = await searchParams;

  return (
    <main className="dash-enter mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-16">
      <div className="text-center">
        <div className="flex justify-center">
          <ArchMark size={48} />
        </div>
        <h1 className="mt-4 text-5xl font-medium leading-none">Welcome back</h1>
        <p className="mt-4 text-muted">Enter your email and we will send you a link to sign in. No password needed.</p>
      </div>

      <div className="brass-rule my-8" aria-hidden />

      <div className="space-y-4">
        {sent && <Notice tone="success">If that email is allowed, a sign-in link is on its way. It works for 15 minutes.</Notice>}
        {error === "expired" && <Notice tone="error">That link has expired or was already replaced. Ask for a new one below.</Notice>}
        {error === "send" && <Notice tone="error">We could not send the email just now. Try again in a minute, or ask the studio owner to check the email settings.</Notice>}

        <form action={requestLogin} className="space-y-3">
          <label className="block text-sm text-muted" htmlFor="email">
            Email address
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" autoFocus className={inputClass} />
          <button className={`${buttonPrimary} w-full`}>Email me a sign-in link</button>
        </form>
      </div>

      <p className="mt-10 text-center text-sm">
        <Link href="/" className="text-muted hover:text-text">
          ← Back to the doors
        </Link>
      </p>
    </main>
  );
}
