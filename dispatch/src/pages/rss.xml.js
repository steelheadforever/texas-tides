// /dispatch/rss.xml — one item per issue. A newsletter provider can ingest
// this directly when email delivery is switched on.
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const issues = (await getCollection('issues', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
  return rss({
    title: 'Slackwater Dispatch',
    description: 'Texas inshore fishing, twice a week: catch reports, conditions, tactics, and conservation.',
    site: context.site,
    items: issues.map((i) => ({
      title: `Dispatch No. ${i.data.number} — ${i.data.title}`,
      pubDate: i.data.date,
      description: i.data.summary ?? '',
      link: `/dispatch/${i.id}/`,
    })),
    customData: '<language>en-us</language>',
  });
}
