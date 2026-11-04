(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FluxChangelog = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  function parseNotes(text) {
    const blocks = String(text || '').trim().split(/\r?\n\s*\r?\n/).filter(Boolean);
    const result = []; let current = { title: 'Highlights', items: [] };
    for (const [index, block] of blocks.entries()) {
      const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const knownHeading = /^(?:new features|ui changes|fixed bugs|removed items|accounts|fixes)$/i.test(lines[0]);
      const heading = lines.length === 1 && index < blocks.length - 1 && lines[0].length < 70 &&
        !/[.!?]/.test(lines[0]) && (knownHeading || !/^(?:[-•]|added\b|changed\b|fixed\b|removed\b|made\b|improved\b|updated\b)/i.test(lines[0]));
      if (heading) {
        if (current.items.length) result.push(current);
        current = { title: lines[0].replace(/:$/, ''), items: [] };
      } else current.items.push(...lines.map(line => line.replace(/^[-•]\s*/, '')));
    }
    if (current.items.length) result.push(current);
    return result;
  }
  function sections(entry) {
    const groups = Array.isArray(entry?.sections) ? entry.sections.map(section => ({
      title: String(section?.title || 'Highlights'),
      items: (Array.isArray(section?.items) ? section.items : []).filter(item => typeof item === 'string' && item.trim())
    })).filter(section => section.items.length) : [];
    return groups.length ? groups : parseNotes(entry?.large);
  }
  function render(doc, target, releases) {
    const fragment = doc.createDocumentFragment();
    const node = (tag, className, text) => {
      const element = doc.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = String(text);
      return element;
    };
    for (const [index, release] of releases.entries()) {
      const card = node('article', 'changelog-card'), header = node('div', 'changelog-header-row'), intro = node('div');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(release.date || '') && !Number.isNaN(Date.parse(release.date)) ? release.date : '';
      if (index === 0 || date) {
        const meta = node('div', 'changelog-meta');
        if (index === 0) meta.append(node('span', 'changelog-latest', 'LATEST UPDATE'));
        if (date) {
          const time = node('time', '', new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
          time.dateTime = date; meta.append(time);
        }
        intro.append(meta);
      }
      intro.append(node('h3', 'changelog-title', release.name), node('p', 'changelog-mini', release.mini));
      header.append(intro, node('span', 'changelog-version-tag', 'v' + release.v));
      const body = node('div', 'changelog-sections');
      for (const section of sections(release)) {
        const group = node('section', 'changelog-section'), list = node('ul');
        for (const note of section.items) list.append(node('li', '', note));
        group.append(node('h4', '', section.title), list); body.append(group);
      }
      card.append(header, body); fragment.append(card);
    }
    target.replaceChildren(fragment);
  }
  return { parseNotes, sections, render };
});
