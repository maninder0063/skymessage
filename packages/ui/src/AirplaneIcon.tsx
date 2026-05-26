import { SvgIcon, type SvgIconProps } from '@mui/material';

export function AirplaneIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <path
        d="M3.2 11.6 21 4l-7.6 17.8-2.1-7.9-8.1-2.3z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="0.6"
      />
    </SvgIcon>
  );
}
