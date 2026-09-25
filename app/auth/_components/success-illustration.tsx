import Image from "next/image";

// Shared by the two success screens (account created, password reset
// successful) — same container footprint for both, different image per
// screen. Sizing must stay exactly as it was under the previous SVG version.
export function SuccessIllustration({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-36 w-56">
      <Image src={src} alt={alt} fill className="object-contain" />
    </div>
  );
}
