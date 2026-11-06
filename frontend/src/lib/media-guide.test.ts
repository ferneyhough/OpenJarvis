import { describe, expect, it } from 'vitest';
import { parseM3U, parseXMLTV } from './media-guide';

describe('M3U and XMLTV parsing', () => {
  it('reads channel metadata and stream URLs from an extended playlist', () => {
    const channels = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="news.us" tvg-name="World, News" tvg-language="English" group-title="News",World News HD
https://streams.example/news.m3u8
#EXTINF:-1 group-title="Sports",Sports One
https://streams.example/sports.m3u8
`);

    expect(channels).toEqual([
      {
        id: 'news.us',
        name: 'World, News',
        group: 'News',
        language: 'English',
        logo: '',
        url: 'https://streams.example/news.m3u8',
      },
      {
        id: '',
        name: 'Sports One',
        group: 'Sports',
        language: '',
        logo: '',
        url: 'https://streams.example/sports.m3u8',
      },
    ]);
  });

  it('matches XMLTV program entries by channel and converts timezone offsets', () => {
    const schedule = parseXMLTV(`<tv>
      <programme channel="news.us" start="20250101120000 +0200" stop="20250101130000 +0200">
        <title>News &amp; Weather</title>
      </programme>
    </tv>`);

    expect(schedule.get('news.us')).toEqual([
      {
        title: 'News & Weather',
        start: Date.UTC(2025, 0, 1, 10),
        stop: Date.UTC(2025, 0, 1, 11),
      },
    ]);
  });
});
