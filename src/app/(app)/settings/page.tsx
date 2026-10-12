import { getDb } from "@/db";
import { addDesigner, saveDesignerEmail, saveEmails, saveMoney, saveOfficeHours, saveUsers, toggleDesigner } from "@/app/actions";
import { Notice, buttonPrimary, buttonQuiet, card, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDesigners } from "@/lib/queries";
import { FIXED_COST_KEYS, loadSettings } from "@/lib/settings";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TOOL_LABEL: Record<string, string> = { vercel: "Vercel", neon: "Neon", hubspot: "HubSpot", calcom: "Cal.com", resend: "Resend" };
const SAVED: Record<string, string> = {
  hours: "Office hours saved. They apply to calls from now on.",
  emails: "Email addresses saved.",
  money: "Money settings saved.",
  users: "Dashboard access saved.",
  designers: "Designers saved.",
};
const ERRORS: Record<string, string> = {
  hours: "The closing time must be after the opening time.",
  designer: "Enter the designer's name and a valid email address.",
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={`${card} p-6`}>
      <h2 className="text-[1.6rem] font-medium leading-tight">{title}</h2>
      {hint && <p className="mt-1 max-w-2xl text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireUser("owner");
  const { saved, error } = await searchParams;
  const db = await getDb();
  const [s, designers] = await Promise.all([loadSettings(db), getDesigners(db)]);

  return (
    <div className="space-y-6">
      <h1 className="text-[2.4rem] font-medium leading-tight">Settings</h1>
      <div className="space-y-3">
        {saved && SAVED[saved] && <Notice tone="success">{SAVED[saved]}</Notice>}
        {error && ERRORS[error] && <Notice tone="error">{ERRORS[error]}</Notice>}
      </div>

      <Section title="Office hours" hint="Calls outside these hours, or on a closed day, are counted as after hours. Times are IST.">
        <form action={saveOfficeHours} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens at (hour, 0 to 23)" id="startHour">
              <input id="startHour" name="startHour" type="number" min={0} max={23} defaultValue={s.officeHours.startHour} className={inputClass} />
            </Field>
            <Field label="Closes at (hour, 1 to 24)" id="endHour">
              <input id="endHour" name="endHour" type="number" min={1} max={24} defaultValue={s.officeHours.endHour} className={inputClass} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm text-muted">Closed on</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {DAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-2">
                  <input type="checkbox" name="closedDays" value={i} defaultChecked={s.officeHours.closedDays.includes(i)} className="size-4 accent-[#4F6B5A]" />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
          <button className={buttonPrimary}>Save office hours</button>
        </form>
      </Section>

      <Section title="Designers" hint="Every new lead goes automatically to the designer with the fewest leads so far. Turn someone off when they are away or leave. Each designer signs in with their email and sees only their own leads.">
        <ul className="divide-y divide-text/10">
          {designers.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 basis-56">
                <div className={d.active ? "font-medium" : "text-muted line-through"}>{d.name}</div>
                <form action={saveDesignerEmail} className="mt-1 flex items-center gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <label htmlFor={`email-${d.id}`} className="sr-only">
                    Email for {d.name}
                  </label>
                  <input id={`email-${d.id}`} name="email" type="email" defaultValue={d.email} className="w-64 max-w-full rounded-lg border border-text/10 bg-white px-2.5 py-1 text-sm" />
                  <button className="text-sm text-accent hover:underline">Save</button>
                </form>
              </div>
              <form action={toggleDesigner}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="active" value={String(d.active)} />
                <button className={buttonQuiet}>{d.active ? "Turn off" : "Turn on"}</button>
              </form>
            </li>
          ))}
          {designers.length === 0 && <li className="py-2 text-muted">No designers yet.</li>}
        </ul>
        <form action={addDesigner} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Name" id="dname">
            <input id="dname" name="name" required className={inputClass} />
          </Field>
          <Field label="Email" id="demail">
            <input id="demail" name="email" type="email" required className={inputClass} />
          </Field>
          <button className={buttonPrimary}>Add designer</button>
        </form>
      </Section>

      <Section title="Alert emails" hint="Complaints and weekly summaries go to the owner. Qualified leads with no booking go to the front desk.">
        <form action={saveEmails} className="space-y-4">
          <Field label="Owner email" id="ownerEmail">
            <input id="ownerEmail" name="ownerEmail" type="email" defaultValue={s.ownerEmail ?? ""} className={inputClass} />
          </Field>
          <Field label="Front desk email" id="frontDeskEmail">
            <input id="frontDeskEmail" name="frontDeskEmail" type="email" defaultValue={s.frontDeskEmail ?? ""} className={inputClass} />
          </Field>
          <Field label="Number callers dial (shown when there are no calls yet)" id="studioPhone">
            <input id="studioPhone" name="studioPhone" defaultValue={s.studioPhone ?? ""} className={inputClass} />
          </Field>
          <button className={buttonPrimary}>Save emails</button>
        </form>
      </Section>

      <Section title="Money" hint="Used for the pipeline estimate and the cost figures. All in rupees.">
        <form action={saveMoney} className="space-y-4">
          <Field label="Average project value (₹), used for the pipeline estimate" id="averageProjectValueInr">
            <input id="averageProjectValueInr" name="averageProjectValueInr" inputMode="numeric" defaultValue={s.averageProjectValueInr} className={inputClass} />
          </Field>
          <Field label="Rupees per US dollar (only used if Vaani reports costs in dollars)" id="usdToInr">
            <input id="usdToInr" name="usdToInr" inputMode="decimal" defaultValue={s.usdToInr} className={inputClass} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm text-muted">What each tool costs per month (₹)</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {FIXED_COST_KEYS.map((k) => (
                <Field key={k} label={TOOL_LABEL[k]} id={`fixed_${k}`}>
                  <input id={`fixed_${k}`} name={`fixed_${k}`} inputMode="numeric" defaultValue={s.fixedMonthlyCostsInr[k]} className={inputClass} />
                </Field>
              ))}
            </div>
          </fieldset>
          <button className={buttonPrimary}>Save money settings</button>
        </form>
      </Section>

      <Section title="Who can sign in" hint="One person per line: email, then a comma, then owner or front_desk. The front desk cannot see costs, reports or settings.">
        <form action={saveUsers} className="space-y-4">
          <label htmlFor="users" className="sr-only">
            People who can sign in
          </label>
          <textarea
            id="users"
            name="users"
            rows={5}
            defaultValue={s.users.map((u) => `${u.email}, ${u.role}`).join("\n")}
            className={`${inputClass} font-mono text-sm`}
          />
          <button className={buttonPrimary}>Save access</button>
        </form>
      </Section>
    </div>
  );
}
