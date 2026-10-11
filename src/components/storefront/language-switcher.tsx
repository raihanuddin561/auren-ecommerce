'use client';

import { useTranslation } from '@/lib/i18n/context';
import { cn } from '@/lib/cn';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'header' | 'footer' | 'mobile';
}

export function LanguageSwitcher({ className, variant = 'header' }: LanguageSwitcherProps) {
  const { locale, setLocale, toggleLocale } = useTranslation();

  if (variant === 'footer') {
    return (
      <div className={cn('inline-flex items-center gap-2', className)}>
        <Globe className="h-3.5 w-3.5 text-fg-muted select-none" />
        <span className="type-small text-fg-muted select-none">Language / ভাষা:</span>
        <div className="inline-flex rounded-xs border border-line bg-page p-0.5">
          <button
            type="button"
            onClick={() => setLocale('en')}
            aria-pressed={locale === 'en'}
            className={cn(
              'rounded-xs px-2 py-0.5 font-sans text-xs font-medium transition-all duration-200',
              locale === 'en'
                ? 'shadow-2xs bg-raised font-semibold text-fg'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLocale('bn')}
            aria-pressed={locale === 'bn'}
            className={cn(
              'rounded-xs px-2 py-0.5 font-sans text-xs font-medium transition-all duration-200',
              locale === 'bn'
                ? 'shadow-2xs bg-raised font-semibold text-accent-text'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            বাংলা
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className={cn('flex items-center justify-between border-t border-line pt-4', className)}>
        <span className="type-small text-fg-muted">Language (ভাষা)</span>
        <button
          type="button"
          onClick={toggleLocale}
          aria-label="Toggle language between English and Bangla"
          className="inline-flex items-center gap-1.5 rounded-xs border border-line bg-raised px-3 py-1.5 text-xs font-medium text-fg transition-all active:scale-95"
        >
          <span className={locale === 'en' ? 'font-semibold text-accent-text' : 'text-fg-muted'}>
            EN
          </span>
          <span className="text-line select-none">/</span>
          <span className={locale === 'bn' ? 'font-semibold text-accent-text' : 'text-fg-muted'}>
            বাংলা
          </span>
        </button>
      </div>
    );
  }

  // Default: Header pill
  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label="Toggle between English and Bangla"
      title={locale === 'en' ? 'Switch to বাংলা' : 'Switch to English'}
      className={cn(
        'touch-target relative mx-1 inline-flex h-8 items-center gap-1 rounded-xs border border-line/80 bg-raised/50 px-2 font-mono text-xs font-medium text-fg transition-all duration-200 hover:border-gold/60 hover:text-accent-text active:scale-95',
        className,
      )}
    >
      <span
        className={cn(
          'transition-colors',
          locale === 'en' ? 'font-semibold text-accent-text' : 'text-fg-muted',
        )}
      >
        EN
      </span>
      <span className="text-line/60 select-none">|</span>
      <span
        className={cn(
          'font-sans transition-colors',
          locale === 'bn' ? 'font-semibold text-accent-text' : 'text-fg-muted',
        )}
      >
        বাং
      </span>
    </button>
  );
}
