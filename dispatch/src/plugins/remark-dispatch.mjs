// remark plugin: turns a plainly written issue into Dispatch's structure.
//
// Authoring convention (see src/content/issues/*.md):
//
//   Intro paragraphs (before any heading) become the standfirst.
//
//   ## catch · Thirty inches of Baffin Bay trout      ← category · headline
//   ![Trout at boatside](/dispatch/img/baffin-30.jpg)
//   Body text…
//   {station: 8771450 Galveston Pier 21}              ← link into the map
//   {youtube: dQw4w9WgXcQ}                            ← embed
//   {partner: Fishing Co.}                            ← marks a sponsored entry
//
// Each `##` starts an <section class="entry entry-<cat>"> with a category
// label; the first entry becomes the full-bleed lead. Everything else is
// ordinary markdown.

const CATEGORIES = {
  catch: 'Big catch',
  report: 'Trip report',
  conditions: 'Conditions',
  bite: 'The bite',
  tactics: 'Tactics',
  gear: 'Gear',
  conservation: 'Conservation',
  news: 'News',
  events: 'Events',
  note: 'Note',
};

const SEP = /^\s*([a-z]+)\s*(?:·|\||:|-|–|—)\s*(.+?)\s*$/i;
const SHORTCODE = /^\{\s*([a-z]+)\s*:\s*(.+?)\s*\}$/i;

function textOf(node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  return (node.children || []).map(textOf).join('');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function element(tag, className, children, extra = {}) {
  return {
    type: 'dispatchElement',
    data: { hName: tag, hProperties: { className: [className], ...extra } },
    children,
  };
}

function shortcode(kind, arg, section) {
  switch (kind.toLowerCase()) {
    case 'youtube': {
      const id = arg.trim().replace(/^.*(?:v=|youtu\.be\/|embed\/)([\w-]{6,}).*$/, '$1');
      return {
        type: 'html',
        value:
          `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${escapeAttr(id)}" ` +
          `title="YouTube video" loading="lazy" allowfullscreen ` +
          `allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`,
      };
    }
    case 'station': {
      // {station: 8771450 Galveston Pier 21}
      const m = arg.trim().match(/^(\d+)\s*(.*)$/);
      if (!m) return null;
      const name = m[2] || `station ${m[1]}`;
      return {
        type: 'html',
        value:
          `<p class="station-link"><a href="/?station=${escapeAttr(m[1])}">` +
          `Open ${escapeAttr(name)} in Slackwater <span aria-hidden="true">&rarr;</span></a></p>`,
      };
    }
    case 'partner': {
      const name = arg.trim();
      section.data.hProperties['data-partner'] = name;
      section.data.hProperties.className.push('partner');
      section.children[0].children = [{ type: 'text', value: `${section.meta.label} · Partner` }];
      return {
        type: 'html',
        value: `<p class="partner-note">Presented with ${escapeAttr(name)} &mdash; we only feature gear we have fished.</p>`,
      };
    }
    default:
      return null;
  }
}

export default function remarkDispatch() {
  return (tree) => {
    const intro = [];
    const sections = [];
    let current = null;

    for (const node of tree.children) {
      if (node.type === 'heading' && node.depth === 2) {
        const raw = textOf(node);
        const m = raw.match(SEP);
        const cat = m && CATEGORIES[m[1].toLowerCase()] ? m[1].toLowerCase() : 'note';
        const title = m && cat !== 'note' ? m[2] : raw;
        const label = CATEGORIES[cat];
        current = element('section', 'entry', [
          element('div', 'cat', [{ type: 'text', value: label }]),
          { type: 'heading', depth: 2, children: [{ type: 'text', value: title }] },
        ], { 'data-cat': cat });
        current.data.hProperties.className.push(`entry-${cat}`);
        current.meta = { cat, label };
        sections.push(current);
        continue;
      }

      if (current && node.type === 'paragraph' && node.children.length === 1 && node.children[0].type === 'text') {
        const m = node.children[0].value.trim().match(SHORTCODE);
        if (m) {
          const out = shortcode(m[1], m[2], current);
          if (out) current.children.push(out);
          continue;
        }
      }

      (current ? current.children : intro).push(node);
    }

    // Lead: the first entry. If it opens with a photo, lift that photo out of
    // the flow and hand it to CSS as the section's background.
    if (sections.length) {
      const lead = sections[0];
      lead.data.hProperties.className.push('lead');
      const i = lead.children.findIndex(
        (n) => n.type === 'paragraph' && n.children.length === 1 && n.children[0].type === 'image',
      );
      if (i !== -1) {
        const img = lead.children[i].children[0];
        lead.children.splice(i, 1);
        lead.data.hProperties.style = `--lead-img:url("${img.url}")`;
        lead.data.hProperties['data-lead-alt'] = img.alt || '';
      }
    }

    const out = [];
    if (sections.length) out.push(sections[0]);
    if (intro.length) out.push(element('div', 'intro', intro));
    if (sections.length > 1) out.push(element('div', 'entries', sections.slice(1)));
    tree.children = out;
  };
}
