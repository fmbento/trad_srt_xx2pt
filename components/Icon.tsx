
import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: 'upload' | 'file' | 'spinner' | 'download' | 'close' | 'translate';
}

const Icon: React.FC<IconProps> = ({ name, ...props }) => {
  switch (name) {
    case 'upload':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM21 6.75l-3.75-3.75L15.19 5.19 18.81 8.81 21 6.75z" />
        </svg>
      );
    case 'file':
        return (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        );
    case 'spinner':
        return (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props} className={`animate-spin ${props.className}`}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.75v1.5M12 17.75v1.5M19.25 12h-1.5M6.25 12h-1.5m11.364-5.364l-1.06 1.06m-9.192 9.192l-1.06 1.06M19.25 4.75l-1.06 1.061M6.25 19.25l-1.06 1.06M4.75 12a7.25 7.25 0 0114.5 0" />
            </svg>
        );
    case 'download':
        return (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
        );
    case 'close':
        return (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        );
    case 'translate':
        return (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.625M21 21l-5.25-11.625M3.75 5.25h16.5M4.5 12h15M5.25 18h13.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M4.5 12h15m-15 5.25h15" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
            </svg>
        )
    default:
      return null;
  }
};

export default Icon;
