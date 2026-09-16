import logoSvg from '../../assets/images/logo.svg';

export function Logo() {
  return (
    <a href="/" className="flex items-center no-underline">
      <img
        src={logoSvg}
        alt="Ukrainians in Texas"
        className="h-11.5 md:h-18 w-auto"
      />
    </a>
  );
}
