import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      ["What it does", "/#does"],
      ["How it works", "/#works"],
      ["Enter STILL", "/still"],
      ["Integrations", "/app/integrations"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Sign in", "/login"],
      ["Create account", "/signup"],
      ["Forgot password", "/forgot-password"],
    ],
  },
  {
    title: "Trust",
    links: [
      ["Privacy", "/legal/privacy"],
      ["Terms", "/legal/terms"],
      ["Security", "/legal/security"],
      ["Data & deletion", "/legal/data"],
      ["Subprocessors", "/legal/subprocessors"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help", "/help"],
      ["Contact", "/contact"],
      ["Report a problem", "/contact"],
      ["Accessibility", "/accessibility"],
      ["Status", "/status"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="still-frame site-footer-inner">
        <div className="site-footer-brand">
          <p className="site-footer-mark">STILL</p>
          <p>The things that still matter.</p>
        </div>
        <div className="site-footer-columns">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p>{column.title}</p>
              <ul>
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="site-footer-base">
          <p>© 2026 STILL</p>
          <p>AI proposes. You decide.</p>
        </div>
      </div>
    </footer>
  );
}
