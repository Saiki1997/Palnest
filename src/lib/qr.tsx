import { encode } from "uqr";

export function QrSvg({ value, label }: { value: string; label?: string }) {
  const { data, size } = encode(value, { ecc: "M", boostEcc: false, border: 2 });
  const cells: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y]?.[x]) cells.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return (
    <figure className="m-0 inline-flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-36 rounded-md bg-foreground"
        role="img"
        aria-label={label || value}
      >
        <rect width={size} height={size} fill="currentColor" className="text-foreground" />
        <path d={cells.join(" ")} fill="#0c1110" />
      </svg>
      {label ? <figcaption className="max-w-36 text-center text-xs text-muted-foreground">{label}</figcaption> : null}
    </figure>
  );
}
