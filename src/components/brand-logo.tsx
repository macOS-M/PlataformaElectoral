import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return <Image src={inverse ? "/brand/sipec-white.svg" : "/brand/sipec-color.svg"}
    alt="SIPEC" width={1393} height={483} unoptimized loading="eager"
    className={cn("h-auto w-[180px] shrink-0", className)} />;
}
