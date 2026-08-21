import Link from "next/link";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  href?: string;
}

export function SectionHeading({ eyebrow, title, href }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <p className="section-heading__eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {href ? <Link href={href} className="section-heading__link">View all <span aria-hidden="true">→</span></Link> : null}
    </div>
  );
}
