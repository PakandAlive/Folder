if (typeof $response === 'undefined' || !$response || typeof $response.body !== 'string') {
    console.log('[duolingoiosmax] 缺少响应上下文，可能是手动运行，已退出');
    $done({});
} else try {
    const rawBody = $response.body || '';
    console.log('[duolingoiosmax] 响应体长度=' + rawBody.length);

    const obj = JSON.parse($response.body);
    const now = Math.floor(Date.now() / 1000);

    // === 用户数据特征字段（宽松匹配：命中任意 1 个即视为用户数据） ===
    const userDataPrimaryKeys = [
        'username', 'courses', 'currentCourseId', 'totalXp',
        'streak', 'lingots', 'gems', 'learningLanguage',
        'fromLanguage', 'hasPlus', 'motivation', 'creationDate',
        'currentCourse', 'roles', 'acquisitionSurveyReason'
    ];

    // 判断一个对象是否为用户数据
    const isUserData = (parsed) => {
        if (!parsed || typeof parsed !== 'object') return false;
        const keys = Object.keys(parsed);
        // 用户数据通常字段很多（>10），且至少命中 1 个核心特征
        const matchCount = userDataPrimaryKeys.filter(sig => keys.includes(sig)).length;
        return matchCount >= 1;
    };

    // 注入订阅数据到用户数据对象
    const injectSubscription = (userdata, label) => {
        const originalLevel = userdata.subscriberLevel;
        const originalShopItems = Array.isArray(userdata.shopItems) ? userdata.shopItems.length : 0;
        console.log('[duolingoiosmax] [' + label + '] 原 subscriberLevel=' + (originalLevel || '空') + ' shopItems=' + originalShopItems);

        // 设置订阅等级
        userdata.subscriberLevel = 'GOLD';

        // 注入 shopItems
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
            console.log('[duolingoiosmax] [' + label + '] 已注入 shopItems 订阅记录');
        }

        // 注入 trackingProperties
        if (!userdata.trackingProperties) userdata.trackingProperties = {};
        userdata.trackingProperties.has_item_immersive_subscription = true;
        userdata.trackingProperties.has_item_premium_subscription = true;
        userdata.trackingProperties.has_item_live_subscription = true;
        userdata.trackingProperties.has_item_gold_subscription = true;
        userdata.trackingProperties.has_item_max_subscription = true;

        // hasPlus 字段
        if ('hasPlus' in userdata) {
            userdata.hasPlus = true;
        }

        console.log('[duolingoiosmax] [' + label + '] ✅ 订阅注入完成');
    };

    // 注入 featureFlags
    const injectFeatureFlags = (parsed, label) => {
        if (parsed.featureFlags && typeof parsed.featureFlags === 'object') {
            const maxFlags = {
                'duolingo_max': true,
                'max_subscription': true,
                'gold_subscription': true,
                'premium_features': true,
                'unlimited_hearts': true,
                'no_ads': true
            };
            Object.assign(parsed.featureFlags, maxFlags);
            console.log('[duolingoiosmax] [' + label + '] ✅ featureFlags 注入完成');
        }
    };

    const topKeys = Object.keys(obj);
    console.log('[duolingoiosmax] 顶层字段=' + topKeys.slice(0, 10).join(',') + (topKeys.length > 10 ? '...(共' + topKeys.length + '个)' : ''));

    // ============================================
    // 路径 A：batch 响应（有 responses 数组）
    // ============================================
    if (obj.responses && Array.isArray(obj.responses)) {
        console.log('[duolingoiosmax] [batch] responses 数量=' + obj.responses.length);
        let modified = false;

        for (let i = 0; i < obj.responses.length; i++) {
            const item = obj.responses[i];
            if (!item || typeof item.body !== 'string' || item.body.length === 0) continue;

            let parsed;
            try { parsed = JSON.parse(item.body); } catch (e) { continue; }

            const keys = Object.keys(parsed);
            console.log('[duolingoiosmax] [batch] responses[' + i + '] 字段=' + keys.slice(0, 6).join(','));

            if (isUserData(parsed)) {
                console.log('[duolingoiosmax] [batch] ✅ 命中用户数据 index=' + i);
                injectSubscription(parsed, 'batch-' + i);
                obj.responses[i].body = JSON.stringify(parsed);
                modified = true;
            }

            if (keys.includes('featureFlags')) {
                injectFeatureFlags(parsed, 'batch-' + i);
                obj.responses[i].body = JSON.stringify(parsed);
                modified = true;
            }
        }

        if (!modified) {
            console.log('[duolingoiosmax] [batch] ⚠️ 未命中用户数据或 config');
        }
        $done({ body: JSON.stringify(obj) });
        return;
    }

    // ============================================
    // 路径 B：非 batch 响应 — 直接就是用户数据
    // ============================================
    if (isUserData(obj)) {
        console.log('[duolingoiosmax] [direct] ✅ 命中独立用户数据响应');
        injectSubscription(obj, 'direct');
        $done({ body: JSON.stringify(obj) });
        return;
    }

    // ============================================
    // 路径 C：非 batch 响应 — config/featureFlags
    // ============================================
    if (topKeys.includes('featureFlags')) {
        console.log('[duolingoiosmax] [direct] 命中独立 config 响应');
        injectFeatureFlags(obj, 'direct');
        $done({ body: JSON.stringify(obj) });
        return;
    }

    // ============================================
    // 路径 D：未匹配，透传
    // ============================================
    console.log('[duolingoiosmax] 未匹配任何注入条件，透传');
    $done({ body: JSON.stringify(obj) });

} catch (e) {
    console.log('[duolingoiosmax] 解析或处理失败：' + (e && e.message ? e.message : e));
    $done({ body: $response.body });
}
