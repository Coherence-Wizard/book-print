/** Runs in the isolated print window; page boxes are the sole PDF layout. */
export function paginateBookDocument(pageMultiple: 2 | 4 = 2): { pageCount: number; overflowPages: number[] } {
  const source = document.getElementById('book-source')!;
  const output = document.getElementById('book-pages')!;
  output.replaceChildren();
  let inner: HTMLDivElement;
  let count = 0;
  const newPage = () => {
    const page = document.createElement('div');
    page.className = 'book-page';
    page.dataset.side = (++count % 2 === 1) ? 'odd' : 'even';
    inner = document.createElement('div');
    inner.className = 'book-page-inner';
    page.appendChild(inner);
    const footer = document.createElement('div');
    footer.className = 'book-page-footer';
    footer.textContent = String(count);
    page.appendChild(footer);
    output.appendChild(page);
  };
  const fits = () => inner.scrollHeight <= inner.clientHeight + 1;
  const splitAt = (element: Element, offset: number): [Element, Element] => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let remaining = offset;
    let boundary: Node = element;
    let position = element.childNodes.length;
    while ((node = walker.nextNode())) {
      const n = node.textContent!.length;
      if (remaining <= n) { boundary = node; position = remaining; break; }
      remaining -= n;
    }
    const before = document.createRange();
    before.selectNodeContents(element);
    before.setEnd(boundary, position);
    const after = document.createRange();
    after.selectNodeContents(element);
    after.setStart(boundary, position);
    const a = element.cloneNode(false) as Element;
    const b = element.cloneNode(false) as Element;
    a.appendChild(before.cloneContents());
    b.appendChild(after.cloneContents());
    return [a, b];
  };
  const appendBlock = (original: Element) => {
    let block = original.cloneNode(true) as Element;
    for (;;) {
      inner.appendChild(block);
      if (fits()) return;
      inner.removeChild(block);
      // Split long text into the space left on this page, including below headings.
      // Move blocks with images as a unit so artwork is never cut in half.
      const usedHeight = inner.lastElementChild ? inner.lastElementChild.getBoundingClientRect().bottom - inner.getBoundingClientRect().top : 0;
      if (inner.childNodes.length && (block.querySelector('img') || inner.clientHeight - usedHeight < 44)) { newPage(); continue; }
      const text = block.textContent || '';
      if (text.length < 2 || block.querySelector('img')) throw new Error('A book element is taller than one page. Reduce the image or split this block.');
      let lo = 1, hi = text.length - 1, best = 0;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const [first] = splitAt(block, mid);
        inner.appendChild(first);
        const ok = fits();
        inner.removeChild(first);
        if (ok) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      if (!best && inner.childNodes.length) { newPage(); continue; }
      if (!best) throw new Error('A book element cannot fit within the print margins.');
      const space = text.slice(0, best).search(/\s+\S*$/);
      if (space > best / 2) best = space + 1;
      const [first, rest] = splitAt(block, best);
      inner.appendChild(first);
      block = rest;
      newPage();
    }
  };
  for (const section of Array.from(source.children)) {
    if (!count || inner!.childNodes.length) newPage();
    for (const block of Array.from(section.children)) {
      if (block.classList.contains('book-page-break')) { newPage(); continue; }
      if (block.tagName === 'H1' && inner!.childNodes.length) newPage();
      if (/^H[1-4]$/.test(block.tagName) && inner!.childNodes.length) {
        const probe = block.cloneNode(true) as HTMLElement;
        inner!.appendChild(probe);
        const remaining = inner!.clientHeight - probe.offsetTop + inner!.offsetTop - probe.offsetHeight;
        inner!.removeChild(probe);
        if (remaining < 36) newPage();
      }
      appendBlock(block);
    }
  }
  if (count > 1 && !inner!.childNodes.length) { output.lastElementChild!.remove(); count--; }
  if (!count) newPage();
  while (count % pageMultiple) newPage();
  const overflowPages = Array.from(output.children).flatMap((p, i) => {
    const content = p.querySelector('.book-page-inner') as HTMLElement;
    return content.scrollHeight > content.clientHeight + 1 ? [i + 1] : [];
  });
  source.remove();
  return { pageCount: count, overflowPages };
}
