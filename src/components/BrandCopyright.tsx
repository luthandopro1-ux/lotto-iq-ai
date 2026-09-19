/**
 * Single source of truth for the site-wide copyright/attribution line.
 * Previously this text existed in three slightly different, inconsistent
 * forms (PublicPageShell, the landing page, and AppShell) and none of
 * them said "All rights reserved" or used the full registered entity
 * name. Import this everywhere instead of hand-writing the line again.
 */
export function BrandCopyright() {
  const year = new Date().getFullYear();
  return (
    <span>
      © {year} Lotto IQ AI. All rights reserved. Developed by Lum Tech Solutions (Pty) Ltd.
    </span>
  );
}
