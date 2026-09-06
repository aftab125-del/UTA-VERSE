import Link from "next/link";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  href?: string;
  align?: "left" | "center";
}

export function SectionHeading({ eyebrow, title, href, align = "left" }: SectionHeadingProps) {
  return (
    <div className={`section-heading ${align === "center" ? "section-heading--center" : ""}`.trim()}>
      <div>
        {eyebrow ? <p className="section-heading__eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {href ? <Link href={href} className="section-heading__link">View all <span aria-hidden="true">→</span></Link> : null}
    </div>
  );
}
