import type { ReactNode } from 'react';

// One drawn icon family: 1.6px round strokes on a 24px grid. Always decorative;
// the surrounding control carries the accessible name.
type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg className={`icon${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const ArrowUpRightIcon = (props: IconProps) => <Icon {...props}><path d="M7 17 17 7M9 7h8v8" /></Icon>;
export const ArrowDownIcon = (props: IconProps) => <Icon {...props}><path d="M12 5v14m-6-6 6 6 6-6" /></Icon>;
export const MinusIcon = (props: IconProps) => <Icon {...props}><path d="M6 12h12" /></Icon>;
export const PlusIcon = (props: IconProps) => <Icon {...props}><path d="M12 6v12M6 12h12" /></Icon>;
