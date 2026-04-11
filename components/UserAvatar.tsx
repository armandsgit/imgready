interface UserAvatarProps {
  email?: string | null;
  image?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-14 w-14 text-lg',
};

function getInitial(email?: string | null) {
  return email?.trim().charAt(0).toUpperCase() || 'U';
}

export default function UserAvatar({ email, image, size = 'md', className = '' }: UserAvatarProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(236,72,153,0.9),rgba(124,58,237,0.9)_45%,rgba(24,24,27,0.95)_100%)] font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)] ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    >
      {image ? (
        <img src={image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        <span>{getInitial(email)}</span>
      )}
    </span>
  );
}
