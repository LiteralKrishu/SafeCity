import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="SafeCity home">
      <span className="brand-mark">
        <Image
          alt=""
          height={42}
          priority
          src="/safecity-logo.png"
          width={42}
        />
      </span>
      {!compact && (
        <span className="brand-name">
          Safe<span>City</span>
        </span>
      )}
    </Link>
  );
}
