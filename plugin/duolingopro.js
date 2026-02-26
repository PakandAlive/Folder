try {
    const obj = JSON.parse($response.body);
    if (obj.responses && obj.responses.length >= 2 && !('etag' in obj.responses[0].headers)) {
        console.log('[duolingoiosmax] 命中条件，准备修改响应');
        const now = Math.floor(Date.now() / 1000);
        const userdata = JSON.parse(obj.responses[0].body);
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
        obj.responses[0].body = JSON.stringify(userdata);
    } else {
        console.log('[duolingoiosmax] 未命中条件，不修改响应');
    }
    $done({ body: JSON.stringify(obj) });
} catch (e) {
    console.log('[duolingoiosmax] 解析或处理失败：' + (e && e.message ? e.message : e));
    $done({ body: $response.body });
}
