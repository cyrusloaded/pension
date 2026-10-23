/**
 * Minimal CSV serializer for report exports.
 */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const escape = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return lines.join("\r\n");
}
