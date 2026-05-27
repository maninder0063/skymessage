'use client';

interface PrintButtonProps {
  label?: string;
  variant?: 'toolbar' | 'big';
}

export function PrintButton({ label = 'Print', variant = 'toolbar' }: PrintButtonProps) {
  const cls = variant === 'big' ? 'qr-btn qr-btn-big' : 'qr-btn';
  return (
    <button type="button" className={cls} onClick={() => window.print()}>
      {label}
    </button>
  );
}
