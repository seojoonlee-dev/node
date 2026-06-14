import type { CSSProperties } from "react";

interface TintedImageProps {
  src: string;
  alt: string;
  tintColor?: string;
  className?: string;
}

export function TintedImage({
  src,
  alt,
  tintColor = 'var(--icon, #FFF0E3)',
  className,
}: TintedImageProps) {
  const overlayStyle: CSSProperties = {
    backgroundColor: tintColor,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  };

  return (
    <div className={className ? `tinted-image ${className}` : 'tinted-image'}>
      <img src={src} alt={alt} />
      <div className="tinted-image-overlay" style={overlayStyle} />
    </div>
  );
}