import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

import DOMPurify from 'dompurify';

type Part =

  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }
  | { type: 'display'; content: string }
  | { type: 'diagram'; format: 'image' | 'svg'; content: string; url?: string };

/**
 * Splits a string into text and math segments.
 * Handles: $$...$$, \[...\], $...$, \(...\)
 * Uses capture groups so inner content is extracted correctly.
 */
function splitLatex(text: string): Part[] {
  const parts: Part[] = [];
  // Group 1 = diagram type, 2 = diagram url, 3 = diagram content
  // Group 4 = $$...$$ display
  // Group 5 = \[...\] display
  // Group 6 = $...$ inline  (excludes $ and newlines inside)
  // Group 7 = \(...\) inline
  const re = /<diagram type="([^"]+)"(?: url="([^"]+)")?>([\s\S]*?)<\/diagram>|\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([^$\r\n]+?)\$|\\\(([\s\S]*?)\\\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', content: text.slice(last, m.index) });
    }

    if (m[1] !== undefined) {
      parts.push({ type: 'diagram', format: m[1] as 'image' | 'svg', url: m[2], content: m[3] || '' });
    } else if (m[4] !== undefined) {
      parts.push({ type: 'display', content: m[4].trim() });
    } else if (m[5] !== undefined) {
      parts.push({ type: 'display', content: m[5].trim() });
    } else if (m[6] !== undefined) {
      parts.push({ type: 'inline', content: m[6].trim() });
    } else if (m[7] !== undefined) {
      parts.push({ type: 'inline', content: m[7].trim() });
    }

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    parts.push({ type: 'text', content: text.slice(last) });
  }

  return parts;
}

function KatexSpan({ latex, display }: { latex: string; display: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(latex, ref.current, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: true,
      });
    } catch {
      if (ref.current) ref.current.textContent = latex;
    }
  }, [latex, display]);

  return (
    <span
      ref={ref}
      className={display ? 'block my-2 overflow-x-auto text-center' : 'inline-block align-middle'}
    />
  );
}

interface MathTextProps {
  children: string | null | undefined;
  className?: string;
  block?: boolean;
}

export function MathText({ children, className = '', block = false }: MathTextProps) {
  if (!children) return null;

  const parts = splitLatex(children);
  const hasDisplay = parts.some(p => p.type === 'display');
  const Tag = block || hasDisplay ? 'div' : 'span';

  return (
    <Tag className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <span key={i} style={{ whiteSpace: 'pre-wrap' }}>
              {part.content}
            </span>
          );
        }
        if (part.type === 'diagram') {
          if (part.format === 'image' && part.url) {
            return (
              <div key={i} className="my-6 flex justify-center">
                <img src={part.url} alt="Generated Diagram" className="max-w-full h-auto max-h-64 object-contain rounded-lg shadow-sm border border-border bg-white" />
              </div>
            );
          } else if (part.format === 'svg') {
            const cleanSvg = DOMPurify.sanitize(part.content, { USE_PROFILES: { svg: true } });
            return (
              <div
                key={i}
                className="my-6 flex justify-center bg-white rounded-lg p-4 max-w-full overflow-x-auto shadow-sm border border-border"
                dangerouslySetInnerHTML={{ __html: cleanSvg }}
              />
            );
          }
          return null;
        }
        return (
          <KatexSpan
            key={i}
            latex={part.content}
            display={part.type === 'display'}
          />
        );
      })}
    </Tag>
  );
}
