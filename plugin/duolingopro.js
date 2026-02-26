// Duolingo Max 解锁脚本 v3
// 策略：直接篡改订阅相关接口的响应数据
// 不再等待"完整用户对象"，因为 Duolingo 使用 ?fields= 按需查询

if (typeof $response === 'undefined' || !$response || typeof $response.body !== 'string') {
    console.log('[duolingoiosmax] 缺少响应上下文，已退出');
    $done({});
} else try {
    const rawBody = $response.body || '';
    const bodyLen = rawBody.length;
    console.log('[duolingoiosmax] 响应体长度=' + bodyLen);

    // 快速跳过明显不需要处理的响应（太短或太长）
    if (bodyLen < 2) {
        $done({});
        return;
    }

    const obj = JSON.parse($response.body);
    const now = Math.floor(Date.now() / 1000);
    const topKeys = Object.keys(obj);
    const topKeysStr = topKeys.slice(0, 8).join(',');
    console.log('[duolingoiosmax] 顶层字段=' + topKeysStr + (topKeys.length > 8 ? '...(共' + topKeys.length + '个)' : ''));

    let modified = false;

    // ============================================
    // 策略 1：available-features 接口
    // 响应格式：{ subscriptionFeatures: [...], purchasableFeatures: [...] }
    // 目标：注入所有订阅功能为已拥有状态
    // ============================================
    if (topKeys.includes('subscriptionFeatures')) {
        console.log('[duolingoiosmax] ✅ 命中 available-features 接口');

        // 定义所有需要解锁的订阅功能
        const allSubscriptionFeatures = [
            'unlimited_hearts',
            'no_ads',
            'unlimited_tests',
            'legendary',
            'immersive_ai',
            'talking_ai',
            'ai_roleplay',
            'ai_call',
            'ai_proofread',
            'practice_hub',
            'max_feature_access',
            'gold_subscription',
            'premium_subscription',
            'live_subscription',
            'video_call',
            'mistake_review',
            'speaking_practice'
        ];

        // 方案：将所有功能全部放入 subscriptionFeatures
        obj.subscriptionFeatures = allSubscriptionFeatures;

        // 清空 purchasableFeatures，表示无需购买任何功能
        if (obj.purchasableFeatures) {
            obj.purchasableFeatures = [];
        }

        console.log('[duolingoiosmax] ✅ subscriptionFeatures 注入完成，共 ' + allSubscriptionFeatures.length + ' 项');
        modified = true;
    }

    // ============================================
    // 策略 2：subscription-optional-feature 接口
    // URL: /users/{id}/subscription-optional-feature?featureName=unlimited-hearts-retier
    // 响应可能是纯文本 "control" 或 JSON
    // 目标：返回表示用户拥有此功能的 JSON
    // ============================================
    // 注：此接口返回 "control" 纯文本（长度=7），在 JSON parse 阶段就报错了
    // 需要在 catch 中处理，或者在 parse 前检测

    // ============================================
    // 策略 3：subscription-catalog 接口
    // 响应格式：{ layout, productExperiments, plusPackageViewModels, subscriptionFeatureGroupId }
    // 目标：标记用户已订阅，不显示购买界面
    // ============================================
    if (topKeys.includes('plusPackageViewModels') && topKeys.includes('subscriptionFeatureGroupId')) {
        console.log('[duolingoiosmax] ✅ 命中 subscription-catalog 接口');

        // 修改 layout，使 UI 认为用户已订阅
        if (obj.plusPackageViewModels && Array.isArray(obj.plusPackageViewModels)) {
            // 标记每个 package 为已购买
            obj.plusPackageViewModels.forEach(pkg => {
                if (pkg) {
                    pkg.isCurrentPlan = true;
                    pkg.isSubscribed = true;
                    if (pkg.product) {
                        pkg.product.isOwned = true;
                    }
                }
            });
        }

        console.log('[duolingoiosmax] ✅ subscription-catalog 修改完成');
        modified = true;
    }

    // ============================================
    // 策略 4：batch 响应 — featureFlags 注入
    // ============================================
    if (obj.responses && Array.isArray(obj.responses)) {
        console.log('[duolingoiosmax] [batch] responses 数量=' + obj.responses.length);

        for (let i = 0; i < obj.responses.length; i++) {
            const item = obj.responses[i];
            if (!item || typeof item.body !== 'string' || item.body.length === 0) continue;

            let parsed;
            try { parsed = JSON.parse(item.body); } catch (e) { continue; }

            const keys = Object.keys(parsed);
            console.log('[duolingoiosmax] [batch] responses[' + i + '] 字段=' + keys.slice(0, 6).join(','));

            // featureFlags 注入
            if (keys.includes('featureFlags') && parsed.featureFlags && typeof parsed.featureFlags === 'object') {
                const maxFlags = {
                    'duolingo_max': true,
                    'max_subscription': true,
                    'gold_subscription': true,
                    'premium_features': true,
                    'unlimited_hearts': true,
                    'no_ads': true,
                    'immersive_ai': true,
                    'live_tutoring': true,
                    'video_call': true,
                    'speaking_practice': true,
                    'ai_roleplay': true
                };
                Object.assign(parsed.featureFlags, maxFlags);
                obj.responses[i].body = JSON.stringify(parsed);
                console.log('[duolingoiosmax] [batch] ✅ featureFlags 注入完成 index=' + i);
                modified = true;
            }

            // 如果 batch 内有 subscriptionFeatures — 也处理
            if (keys.includes('subscriptionFeatures')) {
                parsed.subscriptionFeatures = [
                    'unlimited_hearts', 'no_ads', 'unlimited_tests',
                    'legendary', 'immersive_ai', 'talking_ai',
                    'ai_roleplay', 'ai_call', 'ai_proofread',
                    'practice_hub', 'max_feature_access'
                ];
                if (parsed.purchasableFeatures) parsed.purchasableFeatures = [];
                obj.responses[i].body = JSON.stringify(parsed);
                console.log('[duolingoiosmax] [batch] ✅ subscriptionFeatures 注入完成 index=' + i);
                modified = true;
            }
        }
    }

    // ============================================
    // 策略 5：独立 config 响应 — featureFlags 注入
    // ============================================
    if (topKeys.includes('featureFlags') && obj.featureFlags && typeof obj.featureFlags === 'object') {
        console.log('[duolingoiosmax] ✅ 命中独立 config/featureFlags 接口');
        const maxFlags = {
            'duolingo_max': true,
            'max_subscription': true,
            'gold_subscription': true,
            'premium_features': true,
            'unlimited_hearts': true,
            'no_ads': true,
            'immersive_ai': true,
            'live_tutoring': true,
            'video_call': true,
            'speaking_practice': true,
            'ai_roleplay': true
        };
        Object.assign(obj.featureFlags, maxFlags);
        console.log('[duolingoiosmax] ✅ featureFlags 注入完成');
        modified = true;
    }

    // ============================================
    // 策略 6：sdui-shop 接口
    // 响应格式：{ responseState, uiConfig, dataModel, purchaseFlowResponse, sessionEndResponse }
    // 这是 App 内商店 UI 的 Server-Driven UI 数据
    // ============================================
    if (topKeys.includes('responseState') && topKeys.includes('uiConfig') && topKeys.includes('dataModel')) {
        console.log('[duolingoiosmax] ✅ 命中 sdui-shop 接口');
        // 修改 responseState 表示用户已订阅
        if (obj.dataModel && typeof obj.dataModel === 'object') {
            // 尝试修改数据模型中的订阅状态
            if (obj.dataModel.subscriberLevel !== undefined) {
                obj.dataModel.subscriberLevel = 'GOLD';
            }
            if (obj.dataModel.hasPlus !== undefined) {
                obj.dataModel.hasPlus = true;
            }
        }
        modified = true;
    }

    // ============================================
    // 策略 7：v1/features 接口
    // 响应可能是 batch 格式（有 responses 数组）
    // 如果是，已在策略 4 中处理
    // ============================================

    // ============================================
    // 策略 8：streakData、hasPlus 等顶层字段修改
    // 某些独立查询返回的用户部分字段
    // ============================================
    if (topKeys.includes('hasPlus')) {
        obj.hasPlus = true;
        console.log('[duolingoiosmax] ✅ hasPlus → true');
        modified = true;
    }
    if (topKeys.includes('subscriberLevel')) {
        obj.subscriberLevel = 'GOLD';
        console.log('[duolingoiosmax] ✅ subscriberLevel → GOLD');
        modified = true;
    }
    if (topKeys.includes('shopItems')) {
        // 注入 gold_subscription shopItem
        if (!Array.isArray(obj.shopItems)) obj.shopItems = [];
        const hasGold = obj.shopItems.some(item => item && item.id === 'gold_subscription');
        if (!hasGold) {
            obj.shopItems.push({
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
            console.log('[duolingoiosmax] ✅ shopItems 注入 gold_subscription');
        }
        modified = true;
    }

    if (modified) {
        console.log('[duolingoiosmax] === 响应已修改，返回篡改后数据 ===');
        $done({ body: JSON.stringify(obj) });
    } else {
        console.log('[duolingoiosmax] 未匹配任何注入条件，透传');
        $done({ body: rawBody });
    }

} catch (e) {
    // 处理 JSON 解析失败的情况（如 "control" 纯文本响应）
    const rawBody = $response.body || '';
    const bodyLen = rawBody.length;

    // subscription-optional-feature 接口返回 "control" 文本
    // 表示用户不在实验组，需要替换为表示已订阅的响应
    if (bodyLen <= 20 && rawBody.trim() === 'control') {
        console.log('[duolingoiosmax] ✅ 命中 subscription-optional-feature（control → treatment）');
        $done({ body: 'treatment' });
        return;
    }

    console.log('[duolingoiosmax] 解析或处理失败：' + (e && e.message ? e.message : e));
    $done({ body: rawBody });
}
