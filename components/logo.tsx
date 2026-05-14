import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="no-underline flex-shrink-0 mr-3">
      <span
        className="font-display-logo text-[var(--accent)] select-none"
        style={{
          fontSize: "clamp(22px, 3vw, 26px)",
          textShadow: "0 0 28px var(--accent-glow)",
        }}
      >
        CINEMIX
      </span>
    </Link>
  );
}
