import { Link } from 'react-router-dom';

export function Button({ children, variant = 'primary', href, to, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-bold rounded-[25px] transition-colors cursor-pointer text-lg disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brand-red text-white px-6.25 py-3.75 hover:bg-red-700 dark:hover:bg-red-400',
    outline: 'border border-stroke text-dark-blue px-4 py-2 hover:bg-light-gray',
  };

  const classes = `${base} ${variants[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
