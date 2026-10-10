import { redirect } from "next/navigation";
import { requestLogin } from "@/app/actions";
import { Notice, buttonPrimary, inputClass } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  if (await getSession()) redirect("/");
  const { sent, error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-2xl font-medium">Aangan Studio</h1>
      <p className="mt-2 text-muted">Enter your email and we will send you a link to sign in. No password needed.</p>

      <div className="mt-8 space-y-4">
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
    </main>
  );
}
