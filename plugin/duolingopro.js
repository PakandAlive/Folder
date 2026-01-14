// 检查 $response 是否存在
if (typeof $response === 'undefined' || !$response.body) {
    $done({});
    return;
}

let obj = JSON.parse($response.body);
if (!obj.responses || obj.responses.length < 2 || 'etag' in obj.responses[0].headers) {
    $done({ body: JSON.stringify(obj) });
    return;
}
try {
    const timestamp = Math.floor(Date.now() / 1000);
    const userdata = JSON.parse(obj.responses[0].body);
    userdata.shopItems.push({
        id: 'gold_subscription',
        purchaseDate: timestamp - 172800,
        purchasePrice: 0,
        subscriptionInfo: {
            expectedExpiration: timestamp + 31536000,
            productId: "com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.24Q2Max.168",
            renewer: 'APPLE',
            renewing: true,
            tier: 'twelve_month',
            type: 'gold'
        }
    });
    userdata.subscriberLevel = 'GOLD';
    userdata.trackingProperties.has_item_immersive_subscription = true;
    userdata.trackingProperties.has_item_premium_subscription = true;
    userdata.trackingProperties.has_item_live_subscription = true;
    userdata.trackingProperties.has_item_gold_subscription = true;
    userdata.trackingProperties.has_item_max_subscription = true;
    obj.responses[0].body = JSON.stringify(userdata);
} catch (e) { }
$done({ body: JSON.stringify(obj) });
