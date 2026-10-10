"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./door.module.css";

type Phase = "closed" | "opening" | "leaving";

const OPEN_MS = 1700; // doors swing open
const GO_MS = 2600; // the room fills the screen, then we arrive

function Leaf({ side }: { side: "left" | "right" }) {
  return (
    <div className={`${styles.leaf} ${styles[side]}`} aria-hidden>
      <i className={styles.panelTop} />
      <i className={styles.panelBottom} />
      <b className={styles.knob} />
    </div>
  );
}

/** The first page: closed doors. "Let's get in" opens them, the view moves into the lit room, then the dashboard. */
export function DoorEntry() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("closed");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    router.prefetch("/studio");
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, [router]);

  function enter() {
    if (phase !== "closed") return;
    // People who prefer less motion skip the animation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push("/studio");
      return;
    }
    setPhase("opening");
    timers.current.push(window.setTimeout(() => setPhase("leaving"), OPEN_MS));
    timers.current.push(window.setTimeout(() => router.push("/studio"), GO_MS));
  }

  const state = [styles.scene, phase !== "closed" ? styles.open : "", phase === "leaving" ? styles.leaving : ""].join(" ");

  return (
    <main className={state}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Interior design studio · Pune</p>
        <h1 className={styles.title}>Aangan Studio</h1>
        <div className={styles.rule} aria-hidden />
        <p className={styles.sub}>Every call answered, day or night. Step inside.</p>
      </header>

      <div className={styles.stageWrap} onClick={enter} aria-hidden>
        <div className={styles.bloom} />
        <div className={styles.frame}>
          <div className={styles.doorway}>
            <div className={styles.interior}>
              <div className={styles.arch} />
              <div className={styles.lamp} />
              <div className={styles.bench} />
              <div className={styles.floorIn} />
              <div className={styles.dim} />
            </div>
            <Leaf side="left" />
            <Leaf side="right" />
          </div>
        </div>
      </div>

      <div className={styles.floor}>
        <button type="button" className={styles.cta} onClick={enter} disabled={phase !== "closed"}>
          Let&rsquo;s get in
        </button>
        <Link href="/login" className={styles.staff}>
          Studio staff sign in
        </Link>
      </div>

      <div className={styles.veil} aria-hidden />
      <p className="sr-only" aria-live="polite">
        {phase === "closed" ? "" : "Opening the doors"}
      </p>
    </main>
  );
}
