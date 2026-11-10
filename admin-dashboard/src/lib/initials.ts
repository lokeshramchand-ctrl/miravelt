/** Avatar initials: first + last word of the full name, else the email's first letter. Shared by server and client components. */
export function initialsFor(name: string | null, email: string): string {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}
