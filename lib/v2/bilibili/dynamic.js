const got = require('@/utils/got');
const JSONbig = require('json-bigint');
const utils = require('./utils');
const { parseDate } = require('@/utils/parse-date');

/**
    @by CaoMeiYouRen 2020-05-05 添加注释
    注意1：以下均以card为根对象
    注意2：直接动态没有origin，转发动态有origin
    注意3：转发动态格式统一为：
        - user.uname: 用户名
        - item.content: 正文
        - item.tips: 原动态结果(例如：源动态已被作者删除、图文资源已失效)
        - origin: 与原动态一致
    注意4：本总结并不保证完善，而且未来B站可能会修改接口，因此仅供参考

    B站的动态种类繁多，大致可以总结为以下几种：
    - 文字动态
        - user.uname: 用户名
        - item.content: 正文
    - 图文动态
        - user.name: 用户名
        - item.title: 标题
        - item.description: 简介
        - item.pictures: { img_src: String }[] 图片数组，图片地址在每项的 img_src 中
    - 视频动态
        - aid: av号（以card为根对象没有bv号）
        - owner.name :用户名
        - pic: 封面
        - title: 视频标题
        - desc: 视频简介
    - 专栏动态
        - author.name: 用户名
        - image_urls: String[] 封面数组
        - id: cv号
        - title: 标题
        - summary: 简介
    - 音频动态
        - id: auId 音频id
        - upper: 上传的用户名称
        - title: 音频标题
        - author: 音频作者
        - cover: 音频封面
    - 投票动态
        - user.uname: 用户名
        - item.content: 正文
    - 活动专题页
        - user.uname 用户名
        - vest.content 正文
        - sketch.title 活动标题
        - sketch.desc_text 活动简介
        - sketch.cover_url 活动封面
        - sketch.target_url 活动地址
    - 番剧/电视剧/电影等专题页
        - cover 单集封面
        - index_title 单集标题
        - url 视频地址
        - apiSeasonInfo.title 番剧名称
        - apiSeasonInfo.cover 番剧封面
    - 直播间动态
        - roomid 直播间id
        - uname 用户名
        - title 直播间标题
        - cover 直播间封面
*/

module.exports = async (ctx) => {
    const uid = ctx.params.uid;
    const disableEmbed = ctx.params.disableEmbed;

    const response = await got({
        method: 'get',
        url: `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/space_history?host_uid=${uid}`,
        headers: {
            Referer: `https://space.bilibili.com/${uid}/`,
        },
        transformResponse: [(data) => data],
    });
    const data = JSONbig.parse(response.body).data.cards.filter((item) => item.desc.type === 8);

    ctx.state.data = {
        title: String(data[0].desc.user_profile.info.uname),
        link: `https://space.bilibili.com/${uid}/dynamic`,
        description: String(data[0].desc.user_profile.info.uname),
        image: data[0].desc.user_profile.info.face,
        item: data.map((item) => {
            const getTitle = (data) => (data ? data.title || data.description || data.content || (data.vest && data.vest.content) || '' : '');
            const getDes = (data) =>
                data.dynamic || data.desc || data.description || data.content || data.summary || (data.vest && data.vest.content) + (data.sketch && `<br>${data.sketch.title}<br>${data.sketch.desc_text}`) || data.intro || '';
            const getOriginDes = (data) => (data && (data.apiSeasonInfo && data.apiSeasonInfo.title && `//转发自: ${data.apiSeasonInfo.title}`) + (data.index_title && `<br>${data.index_title}`)) || '';
            const getOriginName = (data) => data.uname || (data.author && data.author.name) || (data.upper && data.upper.name) || (data.user && (data.user.uname || data.user.name)) || (data.owner && data.owner.name) || '';
            const getOriginTitle = (data) => (data.title ? `${data.title}<br>` : '');
            const getIframe = (data) => (!disableEmbed && data && data.aid ? `${utils.iframe(data.aid)}<br>` : '');

            const parsed = JSONbig.parse(item.card);

            const data = getTitle(parsed.item) ? parsed.item : parsed;
            const origin = parsed.origin ? JSONbig.parse(parsed.origin) : null;
            // video小视频
            let videoHTML = '';
            if (data.video_playurl) {
                videoHTML += `<video width="${data.width}" height="${data.height}" controls><source src="${unescape(data.video_playurl).replace(/^http:/, 'https:')}"><source src="${unescape(data.video_playurl)}"></video>`;
            }
            // some rss readers disallow http content.
            // 部分 RSS 阅读器要求内容必须使用https传输
            // bilibili short video does support https request, but https request may timeout ocassionally.
            // to maximize content availability, here add two source tags.
            // bilibili的API中返回的视频地址采用http，然而经验证，短视频地址支持https访问，但偶尔会返回超时错误(可能是网络原因)。
            // 因此保险起见加入两个source标签
            // link
            let link = '';
            if (data.dynamic_id) {
                link = `https://t.bilibili.com/${data.dynamic_id}`;
            } else if (item.desc && item.desc.dynamic_id) {
                link = `https://t.bilibili.com/${item.desc.dynamic_id}`;
            }

            // emoji
            let data_content = getDes(data);
            // 换行处理
            data_content = data_content.replace(new RegExp('\r\n', 'g'), '<br>').replace(new RegExp('\n', 'g'), '<br>');
            if (item.display.emoji_info) {
                const emoji = item.display.emoji_info.emoji_details;
                emoji.forEach((item) => {
                    data_content = data_content.replace(
                        new RegExp(`\\${item.text}`.replace(new RegExp('\\?', 'g'), '\\?'), 'g'),
                        `<img alt="${item.text}" src="${item.url}"style="margin: -1px 1px 0px; display: inline-block; width: 20px; height: 20px; vertical-align: text-bottom;" title="" referrerpolicy="no-referrer">`
                    );
                });
            }

            return {
                title: getTitle(data),
                description: (() => {
                    const description = data_content || getDes(data);
                    const originName = origin && getOriginName(origin) ? `<br><br>//转发自: @${getOriginName(origin)}: ${getOriginTitle(origin.item || origin)}${getDes(origin.item || origin)}` : getOriginDes(origin);

                    const videoHTMLSource = videoHTML ? `<br>${videoHTML}` : '';
                    return `${getIframe(data)}${getIframe(origin)}${videoHTMLSource}<br>${description}${originName}`;
                })(),
                pubDate: item.desc ? (item.desc.timestamp ? parseDate(item.desc.timestamp, 'X') : null) : null,
                link,
            };
        }),
    };
};
