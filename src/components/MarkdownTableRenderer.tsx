import React from 'react';
import { MathRenderer } from './MathRenderer';

interface MarkdownTableRendererProps {
  markdown: string;
  className?: string;
}

export const MarkdownTableRenderer: React.FC<MarkdownTableRendererProps> = ({
  markdown,
  className = '',
}) => {
  if (!markdown || !markdown.includes('|')) return null;

  // Split lines and filter empty lines
  const lines = markdown
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 2) return null;

  // Parse header
  const headerCells = lines[0]
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());

  // Check if second line is a delimiter line (e.g. | :--- | :---: | ---: |)
  const isDelimiter = lines[1].includes('---');
  const bodyLines = isDelimiter ? lines.slice(2) : lines.slice(1);

  return (
    <div className={`w-full my-3 overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#070e1a] shadow-2xs ${className}`}>
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-zinc-100/80 dark:bg-[#0c182b] border-b border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
            {headerCells.map((cell, idx) => (
              <th
                key={idx}
                className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[11px] first:pl-4 last:pr-4"
              >
                <MathRenderer content={cell} inline />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/60 dark:divide-white/5">
          {bodyLines.map((line, rIdx) => {
            const cells = line
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());

            return (
              <tr
                key={rIdx}
                className="hover:bg-zinc-50/80 dark:hover:bg-[#0f1d33]/50 transition-colors text-zinc-800 dark:text-zinc-200"
              >
                {cells.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3.5 py-2 font-medium first:pl-4 last:pr-4">
                    <MathRenderer content={cell} inline />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
