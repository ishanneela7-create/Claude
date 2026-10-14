/** A tiny, safe markdown reader: everything is escaped first, then simple patterns are added. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

export function renderMarkdown(source: string): string {
  const output: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) output.push('</ul>');
    listOpen = false;
  };
  for (const line of source.split(/\r?\n/)) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!listOpen) output.push('<ul>');
      listOpen = true;
      output.push(`<li>${inline(bullet[1] ?? '')}</li>`);
      continue;
    }
    closeList();
    if (heading) {
      const level = (heading[1]?.length ?? 1) + 2;
      output.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
    } else if (line.trim() === '') {
      output.push('');
    } else {
      output.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return output.join('');
}
