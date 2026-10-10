import Link from "next/link";

/** The studio's mark: a doorway arch with a pendant light. Small, so it reads as a monogram. */
export function ArchMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M6 29V15a10 10 0 0 1 20 0v14" stroke="#B08D4B" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 6v6" stroke="#B08D4B" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12.5 17.5a3.5 3.5 0 0 1 7 0z" fill="#B08D4B" />
      <path d="M4 29h24" stroke="#B08D4B" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ href = "/studio" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <ArchMark />
      <span className="font-display text-[1.7rem] font-medium leading-none tracking-wide text-text">Aangan Studio</span>
    </Link>
  );
}
