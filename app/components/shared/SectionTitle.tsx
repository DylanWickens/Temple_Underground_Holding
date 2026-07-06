interface props {
    title: string;
    label: string;
}

export default function SectionTitle({ title, label }:props) {
  return (
    <div className="flex gap-x-4 md:gap-x-6">
      <h3 className="display-hero">{title}</h3>
      <span
        aria-label="Section number"
        className="mono-section-caption text-text-muted pt-1">
        {label}
      </span>
    </div>
  );
}
