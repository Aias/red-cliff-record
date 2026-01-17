import { cn } from '@/app/lib/utils';

export const RaindropLogo = ({ className }: { className?: string }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={cn('icon', className)}>
      <title>Raindrop</title>
      <g clipPath="url(#a)">
        <path
          fill="#0B7ED0"
          fillRule="evenodd"
          d="M74.19 20.262c13.36 12.982 13.36 34.027 0 47.008-.448.435-.903.856-1.366 1.26L50 89.474 27.176 68.531a35.947 35.947 0 0 1-1.368-1.26c-13.358-12.98-13.358-34.027 0-47.008 13.36-12.982 35.023-12.982 48.381 0Z"
          clipRule="evenodd"
          style={{ fill: '#0b7ed0', fillOpacity: 1 }}
        />
        <path
          fill="#2CD4ED"
          d="M25 39.473a25 25 0 0 1 25 25v25H25a25 25 0 0 1 0-50Z"
          style={{ fill: '#2cd4ed', fillOpacity: 1 }}
        />
        <mask
          id="b"
          width="50"
          height="51"
          x="0"
          y="39"
          maskUnits="userSpaceOnUse"
          style={{ maskType: 'luminance' }}
        >
          <path
            fill="#fff"
            d="M25 39.473a25 25 0 0 1 25 25v25H25a25 25 0 0 1 0-50Z"
            style={{ fill: '#fff', fillOpacity: 1 }}
          />
        </mask>
        <g mask="url(#b)">
          <path
            fill="#0DB4E2"
            fillRule="evenodd"
            d="M74.19 20.26c13.36 12.982 13.36 34.029 0 47.01-.448.435-.903.853-1.366 1.258L50 89.473 27.176 68.528a35.87 35.87 0 0 1-1.368-1.258c-13.358-12.981-13.358-34.026 0-47.01 13.36-12.982 35.023-12.982 48.381 0Z"
            clipRule="evenodd"
            style={{ fill: '#0db4e2', fillOpacity: 1 }}
          />
        </g>
        <path
          fill="#3169FF"
          d="M50 89.473v-25l.01-.71A25 25 0 1 1 75 89.472H50Z"
          style={{ fill: '#3169ff', fillOpacity: 1 }}
        />
        <mask
          id="c"
          width="51"
          height="51"
          x="50"
          y="39"
          maskUnits="userSpaceOnUse"
          style={{ maskType: 'luminance' }}
        >
          <path
            fill="#fff"
            d="M50 89.473v-25l.01-.71A25 25 0 1 1 75 89.472H50Z"
            style={{ fill: '#fff', fillOpacity: 1 }}
          />
        </mask>
        <g mask="url(#c)">
          <path
            fill="#3153FF"
            fillRule="evenodd"
            d="M74.19 20.26c13.36 12.982 13.36 34.029 0 47.01-.448.435-.903.853-1.366 1.258L50 89.473 27.176 68.528a35.87 35.87 0 0 1-1.368-1.258c-13.358-12.981-13.358-34.026 0-47.01 13.36-12.982 35.023-12.982 48.381 0Z"
            clipRule="evenodd"
            style={{ fill: '#3153ff', fillOpacity: 1 }}
          />
        </g>
      </g>
      <defs>
        <clipPath id="a">
          <path fill="#fff" d="M0 0h100v100H0z" style={{ fill: '#fff', fillOpacity: 1 }} />
        </clipPath>
      </defs>
    </svg>
  );
};
