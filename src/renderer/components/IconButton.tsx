interface Props {
  label: string;
  glyph: string;
  onClick: () => void;
}

export function IconButton({ label, glyph, onClick }: Props) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      class="icon grid size-[22px] cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent p-0 text-muted [-webkit-app-region:no-drag] hover:bg-active hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {glyph}
    </button>
  );
}
