if (typeof $response === 'undefined' || !$response || typeof $response.body !== 'string') {
    console.log('[duolingoiosmax] 缺少响应上下文，可能是手动运行，已退出');
    $done({});
} else try {
    const rawBody = $response.body || '';
    console.log('[duolingoiosmax] 响应体长度=' + rawBody.length);
    const safeSnippet = text => {
        if (!text) return '';
        return text.length > 200 ? text.slice(0, 200) + '...<截断>' : text;
    };
    const obj = JSON.parse($response.body);
    if (!obj.responses || !Array.isArray(obj.responses)) {
        console.log('[duolingoiosmax] 响应缺少 responses 数组，跳过');
        console.log('[duolingoiosmax] 顶层字段=' + Object.keys(obj).join(','));
        console.log('[duolingoiosmax] 响应体片段=' + safeSnippet(rawBody));
        $done({ body: JSON.stringify(obj) });
        return;
    }
    console.log('[duolingoiosmax] responses 数量=' + obj.responses.length);
    obj.responses.slice(0, 3).forEach((item, index) => {
        const bodyLength = item && typeof item.body === 'string' ? item.body.length : 0;
        const headerKeys = item && item.headers ? Object.keys(item.headers).join(',') : '';
        const status = item && (item.status || item.statusCode || item.status_code);
        console.log('[duolingoiosmax] responses[' + index + '] status=' + (status || '未知') + ' bodyLen=' + bodyLength + ' headers=' + headerKeys);
    });
    const targetIndex = obj.responses.findIndex(item => item && typeof item.body === 'string' && item.body.length > 0);
    if (targetIndex === -1) {
        console.log('[duolingoiosmax] responses 未找到可解析 body，跳过');
        $done({ body: JSON.stringify(obj) });
        return;
    }
    console.log('[duolingoiosmax] 命中条件，准备修改响应 index=' + targetIndex);
    const now = Math.floor(Date.now() / 1000);
    const userdata = JSON.parse(obj.responses[targetIndex].body);
    console.log('[duolingoiosmax] userdata 顶层字段=' + Object.keys(userdata).join(','));
    const originalLevel = userdata.subscriberLevel;
    const originalShopItems = Array.isArray(userdata.shopItems) ? userdata.shopItems.length : 0;
    console.log('[duolingoiosmax] 原 subscriberLevel=' + (originalLevel || '空') + ' shopItems数量=' + originalShopItems);
        if (!userdata.shopItems) userdata.shopItems = [];
        const hasGold = userdata.shopItems.some(item =>
            item && item.id === 'gold_subscription' &&
            item.subscriptionInfo &&
            item.subscriptionInfo.productId === "com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.24Q2Max.168"
        );
        if (!hasGold) {
            userdata.shopItems.push({
                id: 'gold_subscription',
                purchaseDate: now - 172800,
                purchasePrice: 0,
                subscriptionInfo: {
                    expectedExpiration: now + 31536000,
                    productId: "com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.24Q2Max.168",
                    renewer: 'APPLE',
                    renewing: true,
                    tier: 'twelve_month',
                    type: 'gold'
                }
            });
            console.log('[duolingoiosmax] 已注入订阅记录');
        } else {
            console.log('[duolingoiosmax] 已存在订阅记录，跳过注入');
        }
        userdata.subscriberLevel = 'GOLD';
        if (!userdata.trackingProperties) userdata.trackingProperties = {};
        userdata.trackingProperties.has_item_immersive_subscription = true;
        userdata.trackingProperties.has_item_premium_subscription = true;
        userdata.trackingProperties.has_item_live_subscription = true;
        userdata.trackingProperties.has_item_gold_subscription = true;
        userdata.trackingProperties.has_item_max_subscription = true;
    obj.responses[targetIndex].body = JSON.stringify(userdata);
    $done({ body: JSON.stringify(obj) });
} catch (e) {
    console.log('[duolingoiosmax] 解析或处理失败：' + (e && e.message ? e.message : e));
    $done({ body: $response.body });
}
