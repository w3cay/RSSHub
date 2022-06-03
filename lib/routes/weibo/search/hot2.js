const got = require('@/utils/got');
const dayjs = require('dayjs');

module.exports = async (ctx) => {
    const {
        data: { data },
    } = await got({
        method: 'get',
        url: 'https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot&title=%E5%BE%AE%E5%8D%9A%E7%83%AD%E6%90%9C&extparam=filter_type%3Drealtimehot%26mi_cid%3D100103%26pos%3D0_0%26c_type%3D30%26display_time%3D1540538388&luicode=10000011&lfid=231583',
        headers: {
            Referer: 'https://s.weibo.com/top/summary?cate=realtimehot',
            'MWeibo-Pwa': 1,
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
        },
    });

    const getTitlePrefix = (iconUrl) => {
        let prefix = '';
        if (iconUrl) {
            if (iconUrl.indexOf('new') > -1) {
                prefix = '【新】';
            } else if (iconUrl.indexOf('hot') > -1) {
                prefix = '【热】';
            } else if (iconUrl.indexOf('fei') > -1) {
                prefix = '【沸】';
            }
        }
        return prefix;
    };

    const listData = data.cards[0].card_group.slice(0, 16).map((item, index) => {
        const title = item.desc;
        const link = `https://s.weibo.com/weibo?q=${item.desc}&Refer=top`;
        const prefix = getTitlePrefix(item?.icon);
        return {
            title: `${title}${prefix}`,
            description: `详情链接：<a href="${link}">${link}</a>`,
            link,
            pubDate: dayjs(new Date().getTime() - index * 1000).valueOf(),
        };
    });

    ctx.state.data = {
        title: '微博热搜榜',
        link: 'https://s.weibo.com/top/summary?cate=realtimehot',
        description: '实时热点，每分钟更新一次',
        item: listData,
    };
};
