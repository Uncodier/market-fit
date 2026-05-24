import { useState, useEffect } from 'react';

export function useDominantColor(imageUrl: string | null | undefined) {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColor(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 1;
        canvas.height = 1;
        
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        
        if (a > 0) {
          setColor(`rgb(${r}, ${g}, ${b})`);
        }
      } catch (e) {
        console.error("Error extracting color from image", e);
      }
    };
  }, [imageUrl]);

  return color;
}
