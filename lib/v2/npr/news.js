const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const category = ctx.params.category || 'news';

    const rootUrl = 'https://www.npr.org/sections/';

    const currentUrl = `${rootUrl}/${category}`;

    const response = await got({
        method: 'get',
        url: currentUrl,
    });

    const $ = cheerio.load(response.data);

    const list = $('.item-info .title')
        .map((_, item) => {
            item = $(item);

            return {
                title: item.text(),
                link: item.find('a').attr('href'),
            };
        })
        .get();

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const detailResponse = await got({
                    method: 'get',
                    url: item.link,
                });
                const content = cheerio.load(detailResponse.data);

                item.pubDate = parseDate(content('time').attr('datetime'));
                content('.enlarge_measure').remove();
                content('.enlarge_html').remove();
                content('.bucket.img').remove();
                item.description = content('#storytext').html();

                return item;
            })
        )
    );

    ctx.state.data = {
        title: 'NPR NEWS',
        link: currentUrl,
        item: items,
    };
};
