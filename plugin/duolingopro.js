if (typeof $response === 'undefined' || !$response || typeof $response.body !== 'string') {
    console.log('[duolingoiosmax] 缺少响应上下文，可能是手动运行，已退出');
    $done({});
} else try {
    const rawBody = $response.body || '';
    console.log('[duolingoiosmax] 响应体长度=' + rawBody.length);

    const obj = JSON.parse($response.body);

    // === 非 batch 响应：直接透传 ===
    if (!obj.responses || !Array.isArray(obj.responses)) {
        console.log('[duolingoiosmax] 非 batch 响应，顶层字段=' + Object.keys(obj).join(','));
        $done({ body: JSON.stringify(obj) });
        return;
    }

    console.log('[duolingoiosmax] responses 数量=' + obj.responses.length);

    const now = Math.floor(Date.now() / 1000);
    let modified = false;

    // === 用户数据特征字段集合 ===
    // 真正的用户数据对象会包含这些字段，而 experiments/config 不会
    const userDataSignatures = [
        'username', 'email', 'courses', 'currentCourseId',
        'totalXp', 'streak', 'lingots', 'gems',
        'currentCourse', 'learningLanguage', 'fromLanguage',
        'hasPlus', 'roles', 'motivation', 'creationDate'
    ];

    // 判断一个解析后的对象是否为用户数据
    const isUserData = (parsed) => {
        if (!parsed || typeof parsed !== 'object') return false;
        const keys = Object.keys(parsed);
        // 用户数据对象通常字段很多，且至少命中 2 个特征字段
        const matchCount = userDataSignatures.filter(sig => keys.includes(sig)).length;
        return matchCount >= 2;
    };

    // === 遍历所有 responses，逐个检测 ===
    for (let i = 0; i < obj.responses.length; i++) {
        const item = obj.responses[i];
        if (!item || typeof item.body !== 'string' || item.body.length === 0) continue;

        let parsed;
        try {
            parsed = JSON.parse(item.body);
        } catch (e) {
            continue; // 解析失败，跳过
        }

        const keys = Object.keys(parsed);
        console.log('[duolingoiosmax] responses[' + i + '] 顶层字段=' + keys.slice(0, 8).join(',') + (keys.length > 8 ? '...(共' + keys.length + '个)' : ''));

        // --- 策略 A：精确匹配用户数据对象 ---
        if (isUserData(parsed)) {
            console.log('[duolingoiosmax] ✅ 命中用户数据 index=' + i);
            const originalLevel = parsed.subscriberLevel;
            const originalShopItems = Array.isArray(parsed.shopItems) ? parsed.shopItems.length : 0;
            console.log('[duolingoiosmax] 原 subscriberLevel=' + (originalLevel || '空') + ' shopItems数量=' + originalShopItems);

            // 注入订阅等级
            parsed.subscriberLevel = 'GOLD';

            // 注入 shopItems 订阅记录
            if (!parsed.shopItems) parsed.shopItems = [];
            const hasGold = parsed.shopItems.some(item =>
                item && item.id === 'gold_subscription' &&
                item.subscriptionInfo &&
                item.subscriptionInfo.productId === "com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.24Q2Max.168"
            );
            if (!hasGold) {
                parsed.shopItems.push({
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
                console.log('[duolingoiosmax] 已注入 shopItems 订阅记录');
            }

            // 注入 trackingProperties
            if (!parsed.trackingProperties) parsed.trackingProperties = {};
            parsed.trackingProperties.has_item_immersive_subscription = true;
            parsed.trackingProperties.has_item_premium_subscription = true;
            parsed.trackingProperties.has_item_live_subscription = true;
            parsed.trackingProperties.has_item_gold_subscription = true;
            parsed.trackingProperties.has_item_max_subscription = true;

            // 如果存在 hasPlus 字段，也一并修改
            if ('hasPlus' in parsed) {
                parsed.hasPlus = true;
                console.log('[duolingoiosmax] 已设置 hasPlus=true');
            }

            obj.responses[i].body = JSON.stringify(parsed);
            modified = true;
            console.log('[duolingoiosmax] ✅ 用户数据注入完成');
            // 不 break，继续检查后续 response（可能有多个 batch 包含用户数据）
        }

        // --- 策略 B：匹配 config/featureFlags 对象，注入功能开关 ---
        if (keys.includes('featureFlags') && typeof parsed.featureFlags === 'object') {
            console.log('[duolingoiosmax] 命中 config 对象 index=' + i + '，注入 featureFlags');
            // 在 featureFlags 中开启 Max 相关功能
            const maxFlags = {
                'duolingo_max': true,
                'max_subscription': true,
                'gold_subscription': true,
                'premium_features': true,
                'unlimited_hearts': true,
                'no_ads': true
            };
            Object.assign(parsed.featureFlags, maxFlags);
            obj.responses[i].body = JSON.stringify(parsed);
            modified = true;
            console.log('[duolingoiosmax] ✅ featureFlags 注入完成');
        }
    }

    if (!modified) {
        console.log('[duolingoiosmax] ⚠️ 未找到用户数据或 config 对象，所有 responses 均跳过');
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    console.log('[duolingoiosmax] 解析或处理失败：' + (e && e.message ? e.message : e));
    $done({ body: $response.body });
}
