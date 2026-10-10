import React from 'react';

interface ArticleBodyProps {
  content: string;
}

/**
 * Clean, lightweight editorial Markdown parser and renderer tailored
 * specifically for Auren's quiet luxury magazine typography without
 * requiring heavy external dependencies.
 */
export function ArticleBody({ content }: ArticleBodyProps) {
  const blocks = content.split(/\n\s*\n/);

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-fg">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Blockquote
        if (trimmed.startsWith('>')) {
          const quoteText = trimmed.replace(/^>\s*/, '').replace(/\\n/g, ' ');
          return (
            <blockquote
              key={index}
              className="type-title-md my-8 border-l-2 border-accent-text pl-6 font-serif text-fg italic"
            >
              {quoteText}
            </blockquote>
          );
        }

        // H1
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={index} className="type-display-sm mt-10 mb-4 font-serif text-fg first:mt-0">
              {trimmed.replace(/^#\s+/, '')}
            </h1>
          );
        }

        // H2
        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={index}
              className="type-title-lg mt-8 mb-3 border-b border-line/40 pb-2 font-serif text-fg"
            >
              {trimmed.replace(/^##\s+/, '')}
            </h2>
          );
        }

        // H3
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={index} className="type-title-md mt-6 mb-2 font-serif text-fg">
              {trimmed.replace(/^###\s+/, '')}
            </h3>
          );
        }

        // Unordered list
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim());
          return (
            <ul key={index} className="my-4 list-disc space-y-2 pl-6 type-body-sm text-fg/90">
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
        }

        // Standard Paragraph
        return (
          <p key={index} className="type-body-sm leading-relaxed text-fg/90">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}
