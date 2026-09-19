/**
 * Single source of truth for the site-wide copyright/attribution line.
 * Previously this text existed in three slightly different, inconsistent
 * forms (PublicPageShell, the landing page, and AppShell) and none of
 * them said "All rights reserved" or used the full registered entity
 * name. Import this everywhere instead of hand-writing the line again.
 *
 * Year is computed at render time rather than hardcoded so it never
 * goes stale.
 */
export function BrandCopyright() {
  const year = new Date().getFullYear();
  return (
    <span>
      © {year} Lotto IQ. All rights reserved. | Developed by{" "}
      <a
        href="https://www.lumtechsolutions.co.za"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        Lum Tech Solutions (Pty) Ltd
      </a>
    </span>
  );
}
