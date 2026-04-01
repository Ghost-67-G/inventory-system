import { useEffect, useState } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

function readWindowSize(): WindowSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

export function useWindowSize() {
  const [size, setSize] = useState<WindowSize>(() => readWindowSize());

  useEffect(() => {
    let timeoutId: number | null = null;

    const handleResize = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        setSize(readWindowSize());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return {
    ...size,
    isMobile: size.width < 640,
    isTablet: size.width >= 640 && size.width < 1024,
    isDesktop: size.width >= 1024
  };
}
