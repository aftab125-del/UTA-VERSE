"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/discover", label: "Discover", icon: "✦" },
  { href: "/search", label: "Search", icon: "⌕" },
  { href: "/playlists", label: "Playlists", icon: "≡" },
];

export function PrimaryNavigation() {
  const pathname = usePathname();

  return (
    <nav className="primary-navigation" aria-label="Primary navigation">
      <p className="navigation-label">Explore</p>
      <div className="primary-navigation__links">
        {navigationItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link className={`navigation-link${active ? " navigation-link--active" : ""}`} href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
              <span className="navigation-link__icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
