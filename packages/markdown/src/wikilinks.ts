import type MarkdownIt from 'markdown-it';

/** Parse links as Markdown inline tokens so literal code and escapes stay intact. */
export function installWikilinks(md: InstanceType<typeof MarkdownIt>, removeLinks = false): void {
  md.inline.ruler.before('link', 'book_wikilink', (state, silent) => {
    const embed = state.src.startsWith('![[', state.pos);
    if (!embed && !state.src.startsWith('[[', state.pos)) return false;
    const start = state.pos + (embed ? 3 : 2);
    const end = state.src.indexOf(']]', start);
    if (end < 0 || end + 2 > state.posMax || /[\r\n]/.test(state.src.slice(start, end))) return false;
    const [target, ...alias] = state.src.slice(start, end).split('|');
    if (!target.trim()) return false;
    if (!silent) {
      if (embed) {
        const token = state.push('image', 'img', 0);
        token.attrs = [['src', target.trim()], ['alt', '']];
        token.content = alias.join('|').trim() || target.trim();
        const text = new state.Token('text', '', 0);
        text.content = token.content;
        token.children = [text];
      } else if (!removeLinks) {
        const token = state.push('text', '', 0);
        token.content = alias.length ? alias.join('|').trim() : target.trim().split('/').pop()!.replace(/\.md(?=#|$)/, '');
      }
    }
    state.pos = end + 2;
    return true;
  });
}

/**
  Resolves Obsidian Wikilinks [[Target|Alias]] into plain text or HTML.
 */

export function resolveWikilinks(markdown: string): string {
  // 1. Process Embed Images ![[path/to/image.png]]
  let result = markdown.replace(/!\[\[([^\]]+)\]\]/g, (_match, p1) => {
    const parts = p1.split('|');
    const imagePath = parts[0].trim();
    const altText = parts[1] ? parts[1].trim() : imagePath;
    return `![${altText}](${imagePath})`;
  });

  // 2. Process Standard Wikilinks [[Target|Alias]] -> Alias or Target
  result = result.replace(/\[\[([^\]]+)\]\]/g, (_match, p1) => {
    const parts = p1.split('|');
    if (parts.length > 1) {
      return parts[1].trim(); // Use alias
    }
    const target = parts[0].trim();
    // Return note title without path extension
    const baseName = target.split('/').pop()?.replace(/\.md$/, '') || target;
    return baseName;
  });

  return result;
}
