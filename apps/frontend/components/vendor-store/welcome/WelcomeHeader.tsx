interface WelcomeHeaderProps {
  title?: string;
  subtitle?: string;
}

export function WelcomeHeader({
  title = "Bienvenido",
  subtitle = "Aprovechá SSS al máximo para enfocarte en hacer crecer tu negocio.",
}: WelcomeHeaderProps) {
  return (
    <header className="border-b border-outline-variant pb-5">
      <h1 className="text-[32px] font-bold leading-tight tracking-tight text-on-background">
        {title}
      </h1>
      <p className="mt-1 text-base text-on-surface-variant">{subtitle}</p>
    </header>
  );
}
