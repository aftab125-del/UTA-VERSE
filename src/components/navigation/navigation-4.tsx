"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CreatePlaylistModal } from "@/components/ui/create-playlist-modal";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "Discover",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/playlists",
    label: "Playlists",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function Navigation4() {
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <>
      {/* Desktop Vertical Sidebar */}
      <aside className="nav4-sidebar" aria-label="Main sidebar navigation">
        {/* Top: Brand Logo Orb */}
        <div className="nav4-brand-container">
          <Link className="nav4-brand" href="/" aria-label="UTA-VERSE home">
            <div className="nav4-brand__orb" aria-hidden="true" />
          </Link>
        </div>

        {/* Center: Vertical Dock Navigation with Hover Scaling & Tooltips */}
        <nav className="nav4-dock" aria-label="Navigation dock">
          <div className="nav4-dock__items">
            {navItems.map((item, idx) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={item.href}
                  className="nav4-dock__wrapper"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <Link
                    href={item.href}
                    className={`nav4-dock__btn${isActive ? " nav4-dock__btn--active" : ""}${isHovered ? " nav4-dock__btn--hovered" : ""}`}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="nav4-dock__icon">{item.icon}</span>
                  </Link>

                  {/* Right-Floating Dock Tooltip */}
                  <div
                    className={`nav4-tooltip${isHovered ? " nav4-tooltip--visible" : ""}`}
                    role="tooltip"
                    aria-hidden={!isHovered}
                  >
                    <span className="nav4-tooltip__text">{item.label}</span>
                    <div className="nav4-tooltip__arrow" />
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom spacer / mark */}
        <div className="nav4-footer-mark" aria-hidden="true" />
      </aside>

      {/* Mobile Bottom Tab Bar (With Labels & Create Button matching reference) */}
      <nav className="nav4-bottom-bar" aria-label="Mobile navigation">
        <div className="nav4-bottom-bar__items">
          {/* Home */}
          <Link
            href="/"
            className={`nav4-bottom-bar__btn${pathname === "/" ? " nav4-bottom-bar__btn--active" : ""}`}
            aria-label="Home"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <span className="nav4-bottom-bar__icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill={pathname === "/" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
              </svg>
            </span>
            <span className="nav4-bottom-bar__label">Home</span>
          </Link>

          {/* Search */}
          <Link
            href="/search"
            className={`nav4-bottom-bar__btn${pathname.startsWith("/search") ? " nav4-bottom-bar__btn--active" : ""}`}
            aria-label="Search"
            aria-current={pathname.startsWith("/search") ? "page" : undefined}
          >
            <span className="nav4-bottom-bar__icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <span className="nav4-bottom-bar__label">Search</span>
          </Link>

          {/* Your Library */}
          <Link
            href="/playlists"
            className={`nav4-bottom-bar__btn${pathname.startsWith("/playlists") ? " nav4-bottom-bar__btn--active" : ""}`}
            aria-label="Your Library"
            aria-current={pathname.startsWith("/playlists") ? "page" : undefined}
          >
            <span className="nav4-bottom-bar__icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            <span className="nav4-bottom-bar__label">Your Library</span>
          </Link>

          {/* Discover */}
          <Link
            href="/discover"
            className={`nav4-bottom-bar__btn${pathname.startsWith("/discover") ? " nav4-bottom-bar__btn--active" : ""}`}
            aria-label="Discover"
            aria-current={pathname.startsWith("/discover") ? "page" : undefined}
          >
            <span className="nav4-bottom-bar__icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </span>
            <span className="nav4-bottom-bar__label">Discover</span>
          </Link>

          {/* Create */}
          <button
            type="button"
            className="nav4-bottom-bar__btn nav4-bottom-bar__btn--create"
            onClick={() => setCreateModalOpen(true)}
            aria-label="Create playlist"
          >
            <span className="nav4-bottom-bar__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            <span className="nav4-bottom-bar__label">Create</span>
          </button>
        </div>
      </nav>

      {/* Quick Create Playlist Modal */}
      <CreatePlaylistModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(pl) => {
          setCreateModalOpen(false);
          router.push(`/playlists/${pl.id}`);
        }}
      />
    </>
  );
}
