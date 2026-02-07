import Badge from './Badge';

interface AvatarProps {
  src?: string | null;
  fallbackSeed: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isPersona?: boolean;
  className?: string;
}

export default function Avatar({
  src,
  fallbackSeed,
  size = 'sm',
  isPersona = false,
  className = '',
}: AvatarProps) {
  const sizeMap = {
    xs: 20,
    sm: 24,
    md: 32,
    lg: 64,
  };
  const sizePixels = sizeMap[size];

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      <img
        src={(src && src.trim() !== "") ? src : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fallbackSeed)}`}
        alt=""
        className="rounded-full object-cover"
        width={sizePixels}
        height={sizePixels}
      />
      {isPersona && <Badge variant="ai" className="absolute -bottom-0.5 -right-0.5" />}
    </div>
  );
}
