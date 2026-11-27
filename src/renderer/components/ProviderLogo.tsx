interface Props {
  /** Name of the service: its first letter stands in until its icon is known. */
  label: string;
  /** The service's own icon (a data URL), once learned. */
  icon?: string;
  /** Size of the tile (and of the letter). */
  class?: string;
}

/**
 * The icon of a service, on a small tile. The tile is light behind the icon so that a dark icon
 * stays readable in the dark theme.
 */
export function ProviderLogo({ label, icon, class: size = 'size-4 text-[9px]' }: Props) {
  return (
    <span
      aria-hidden="true"
      class={`provider-logo grid flex-none place-items-center overflow-hidden rounded-[5px] leading-none ${size} ${icon ? 'bg-white/90 p-px' : 'bg-active font-semibold text-ink'}`}
    >
      {icon ? (
        <img src={icon} alt="" draggable={false} class="size-full object-contain" />
      ) : (
        label.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
