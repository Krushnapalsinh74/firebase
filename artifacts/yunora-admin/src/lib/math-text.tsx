import React, { useEffect, useRef, useMemo } from 'react';
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

/** Renders a string that may contain $math$ segments into KaTeX HTML. */
function renderMathToHtml(raw: string): string {
  return raw.replace(/\$([^$]+)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        throwOnError: false,
        strict: false,
        trust: true,
      });
    } catch {
      return math;
    }
  });
}

/**
 * Renders an SVG diagram, post-processing any <text> elements that contain
 * $math$ expressions by replacing them with <foreignObject> + KaTeX HTML.
 */
function SvgDiagram({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanSvg = useMemo(() =>
    DOMPurify.sanitize(content, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['foreignObject'],
      ADD_ATTR: ['xmlns', 'requiredFeatures'],
    }),
    [content]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    const textEls = Array.from(svg.querySelectorAll('text'));
    for (const textEl of textEls) {
      const raw = textEl.textContent || '';
      if (!raw.includes('$')) continue;

      // Gather style/position from the original <text> element
      const x = parseFloat(textEl.getAttribute('x') || '0');
      const y = parseFloat(textEl.getAttribute('y') || '0');
      const fill = textEl.getAttribute('fill') || textEl.style.fill || '#ffffff';
      const fontSizeAttr = textEl.getAttribute('font-size') || textEl.style.fontSize || '14';
      const fontSize = parseFloat(fontSizeAttr) || 14;
      const textAnchor = textEl.getAttribute('text-anchor') || 'start';

      // Build KaTeX HTML for the label
      const htmlContent = renderMathToHtml(raw);

      // Size the foreignObject to comfortably hold the label
      const foWidth = Math.max(200, raw.length * fontSize * 0.7);
      const foHeight = fontSize * 3;

      // Align horizontally the same way the <text> element would
      let foX = x;
      if (textAnchor === 'middle') foX = x - foWidth / 2;
      else if (textAnchor === 'end') foX = x - foWidth;

      // y in SVG text is the baseline; shift up so the label is centred
      const foY = y - fontSize * 1.4;

      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('x', String(foX));
      fo.setAttribute('y', String(foY));
      fo.setAttribute('width', String(foWidth));
      fo.setAttribute('height', String(foHeight));

      const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      const styles: string[] = [
        `color: ${fill}`,
        `font-size: ${fontSize}px`,
        `height: ${foHeight}px`,
        `display: flex`,
        `align-items: center`,
        `line-height: 1`,
        `white-space: nowrap`,
      ];
      if (textAnchor === 'middle') styles.push('justify-content: center');
      else if (textAnchor === 'end') styles.push('justify-content: flex-end');

      (div as HTMLElement).style.cssText = styles.join('; ');
      (div as HTMLElement).innerHTML = htmlContent;

      fo.appendChild(div);
      textEl.parentNode?.replaceChild(fo, textEl);
    }
  }, [cleanSvg]);

  return (
    <div
      ref={containerRef}
      className="my-6 flex justify-center bg-slate-900 rounded-lg p-4 max-w-full overflow-x-auto shadow-sm border border-border"
      dangerouslySetInnerHTML={{ __html: cleanSvg }}
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
            return <SvgDiagram key={i} content={part.content} />;
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
