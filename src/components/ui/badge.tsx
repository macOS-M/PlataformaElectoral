import { cn } from "@/lib/utils";
export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}
