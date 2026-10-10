// Indian number formats: lakh and crore grouping, ₹ sign.

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,24,500 */
export function formatInr(n: number): string {
  const rounded = Math.round(n);
  return `${rounded < 0 ? "-" : ""}₹${inr.format(Math.abs(rounded))}`;
}

/** ₹1.2 lakh, ₹3.4 crore, or the full figure under a lakh. */
export function formatInrShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} crore`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} lakh`;
  return formatInr(n);
}

/** 54 -> "54", 1234 -> "1,234" */
export function formatCount(n: number): string {
  return inr.format(n);
}

/** Short duration for a table: 252 -> "4 min 12 sec" */
export function formatDuration(sec: number | null): string {
  if (sec === null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min ${s} sec` : `${s} sec`;
}
