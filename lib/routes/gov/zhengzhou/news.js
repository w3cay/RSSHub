const got = require('@/utils/got');
const cheerio = require('cheerio');
const resolve_url = require('url').resolve;
const date = require('@/utils/date');

module.exports = async (ctx) => {
    const url = 'http://www.zhengzhou.gov.cn/news1/index.jhtml';
    const title = '郑州新闻';
    const response = await got({
        method: 'get',
        url,
    });

    const $ = cheerio.load(response.data);
    const list = $('.page-list a');

    ctx.state.data = {
        title,
        link: url,
        item: await Promise.all(
            list &&
                list
                    .map(async (index, item) => {
                        item = $(item);

                        // // 获取全文
                        const contenlUrl = item.attr('href');
                        const link = resolve_url(url, contenlUrl);
                        const htmlReturn = await ctx.cache.tryGet(link, async () => {
                            const fullText = await got({
                                method: 'get',
                                url: link,
                            });
                            const fullTextData = cheerio.load(fullText.data);
                            const date = fullTextData('meta[name="PubDate"]').attr('content');
                            return {
                                content: fullTextData('.content-txt').html(),
                                pubDate: date,
                            };
                        });
                        return {
                            title: item.find('span').text(),
                            description: htmlReturn.content,
                            pubDate: date(htmlReturn.pubDate, 8),
                            link,
                        };
                    })
                    .get()
        ),
    };
};
