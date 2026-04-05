/** Flatten structured resume JSON for copy/paste into Word, email, etc. */
export function resumeToPlainText(data: any): string {
  if (!data?.personalInfo) return '';
  const lines: string[] = [];
  const pi = data.personalInfo;
  if (pi.name) lines.push(pi.name);
  const contact = [pi.email, pi.phone, pi.location, pi.portfolio, pi.linkedin].filter(Boolean).join(' · ');
  if (contact) lines.push(contact);
  if (pi.summary) {
    lines.push('');
    lines.push(pi.summary);
  }
  for (const sec of data.sections || []) {
    lines.push('');
    lines.push((sec.sectionTitle || '').toUpperCase());
    for (const it of sec.items || []) {
      const head = [it.heading, it.subheading ? `@ ${it.subheading}` : '', it.date ? `(${it.date})` : '']
        .filter(Boolean)
        .join(' ');
      if (head.trim()) lines.push(head);
      if (it.location) lines.push(it.location);
      for (const b of it.bullets || []) {
        if (typeof b === 'string' && b.trim()) lines.push(`• ${b.trim()}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n').trim();
}

export function sectionToPlainText(section: any): string {
  if (!section) return '';
  const lines: string[] = [];
  lines.push((section.sectionTitle || '').toUpperCase());
  for (const it of section.items || []) {
    const head = [it.heading, it.subheading ? `@ ${it.subheading}` : '', it.date ? `(${it.date})` : '']
      .filter(Boolean)
      .join(' ');
    if (head.trim()) lines.push(head);
    if (it.location) lines.push(it.location);
    for (const b of it.bullets || []) {
      if (typeof b === 'string' && b.trim()) lines.push(`• ${b.trim()}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
