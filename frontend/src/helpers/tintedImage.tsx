import type { CSSProperties } from "react";

interface TintedImageProps {
  src: string;
  alt: string;
  tintColor?: string;
  blendMode?: CSSProperties['mixBlendMode'];
  className?: string;
}

export function TintedImage({
  src,
  alt,
  tintColor = '#FFF0E3',
  blendMode = 'multiply',
  className,
}: TintedImageProps) {
  // tint and mask depend on props, so they have to stay inline
  const overlayStyle: CSSProperties = {
    backgroundColor: tintColor,
    mixBlendMode: blendMode,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
  };

  return (
    <div className={className ? `tinted-image ${className}` : 'tinted-image'}>
      <img src={src} alt={alt} />
      <div className="tinted-image-overlay" style={overlayStyle} />
    </div>
  );
}