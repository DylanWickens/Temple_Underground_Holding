"use client";

import { useLenis } from "lenis/react";

const NAV_LINKS = [
  { label: "About", id: "about" },
  { label: "Equipment", id: "equipment" },
  // { label: "Team", id: "team" },
  // { label: "Book", id: "book" },
];

export default function Navbar() {
  const lenis = useLenis();

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;

    if (lenis) {
      lenis.scrollTo(target);
    } else {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="flex justify-end">
      <nav className="fixed top-9 right-8 z-100 flex gap-x-4 md:gap-x-6">
        {NAV_LINKS.map(({ label, id }) => (
          <a
            key={id}
            href={`#${id}`}
            className="nav"
            onClick={(e) => handleClick(e, id)}>
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
