/**
 * SM-2 间隔重复算法 - 核心引擎
 * 
 * 这是整个系统的大脑：决定"什么时候该复习什么"
 * 
 * 原理简述：
 * - 每张卡片有一个"间隔天数"和"容易度"
 * - 你复习后给自己打分（1-5分）
 * - 分数高 → 间隔拉长（说明你记住了）
 * - 分数低 → 间隔重置（说明要重新学）
 */

class SpacedRepetition {
    /**
     * 创建一张新的学习卡片
     * @param {string} id - 唯一标识
     * @param {string} front - 正面（问题/提示）
     * @param {string} back - 背面（答案）
     * @param {string} subject - 科目（math/ds/code/other）
     * @returns {object} 卡片对象
     */
    static createCard(id, front, back, subject = 'other') {
        return {
            id,
            front,
            back,
            subject,
            // SM-2 算法参数
            repetitions: 0,      // 连续正确次数
            easeFactor: 2.5,     // 容易度因子（最低1.3）
            interval: 0,         // 当前间隔（天）
            // 时间信息
            nextReview: Date.now(),  // 下次复习时间戳
            lastReview: null,        // 上次复习时间戳
            createdAt: Date.now(),
            // 统计
            totalReviews: 0,     // 总复习次数
            correctCount: 0,     // 正确次数
            streak: 0,           // 当前连续正确
        };
    }

    /**
     * 核心：根据评分更新卡片的复习计划
     * 
     * @param {object} card - 卡片对象
     * @param {number} quality - 评分 0-5
     *   0 = 完全忘了（"啊？这是什么？"）
     *   1 = 完全错误但看到答案想起来了
     *   2 = 错误但感觉快想起来了
     *   3 = 答对了但很费劲
     *   4 = 答对了，小犹豫
     *   5 = 秒答，完全掌握
     * 
     * @returns {object} 更新后的卡片 + 获得的积分
     */
    static review(card, quality) {
        // 质量必须在 0-5 之间
        quality = Math.max(0, Math.min(5, Math.round(quality)));
        
        let pointsEarned = 0;
        const now = Date.now();
        
        // 更新统计
        card.totalReviews++;
        card.lastReview = now;

        if (quality >= 3) {
            // ===== 回答正确 =====
            card.correctCount++;
            card.streak++;

            if (card.repetitions === 0) {
                // 第一次正确：1天后复习
                card.interval = 1;
            } else if (card.repetitions === 1) {
                // 第二次正确：6天后复习
                card.interval = 6;
            } else {
                // 之后：间隔 × 容易度因子
                card.interval = Math.round(card.interval * card.easeFactor);
            }
            card.repetitions++;
            
            // 积分计算：越难记的卡片答对给越多分
            pointsEarned = Math.round(10 * (6 - card.easeFactor + quality));
            // 连续正确加成
            if (card.streak >= 3) pointsEarned += 5;
            if (card.streak >= 7) pointsEarned += 10;
            
        } else {
            // ===== 回答错误 =====
            card.repetitions = 0;
            card.interval = 1;  // 重置为明天
            card.streak = 0;
            
            // 错误也给少量积分（鼓励你至少来复习了）
            pointsEarned = 2;
        }

        // 更新容易度因子（SM-2 核心公式）
        card.easeFactor = card.easeFactor + 
            (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        
        // 容易度不能低于1.3（防止间隔太短导致疲劳）
        card.easeFactor = Math.max(1.3, card.easeFactor);

        // 计算下次复习时间
        card.nextReview = now + card.interval * 24 * 60 * 60 * 1000;

        return { card, pointsEarned };
    }

    /**
     * 获取今天需要复习的卡片，按紧急程度排序
     * 
     * @param {Array} cards - 所有卡片
     * @param {number} limit - 最多返回几张（防止一次太多）
     * @returns {Array} 排序后的待复习卡片
     */
    static getDueCards(cards, limit = 20) {
        const now = Date.now();
        
        return cards
            .filter(card => card.nextReview <= now)
            .sort((a, b) => {
                // 优先级：过期越久 → 越紧急
                const overdueA = now - a.nextReview;
                const overdueB = now - b.nextReview;
                return overdueB - overdueA;
            })
            .slice(0, limit);
    }

    /**
     * 计算某张卡片的"记忆保持率"（估算你现在还记得多少）
     * 用于界面展示和优先级计算
     */
    static getRetention(card) {
        if (!card.lastReview) return 0;
        
        const now = Date.now();
        const daysSinceReview = (now - card.lastReview) / (24 * 60 * 60 * 1000);
        const scheduledDays = card.interval || 1;
        
        // 简化的遗忘曲线：超过计划间隔后快速衰减
        if (daysSinceReview <= scheduledDays) {
            // 还在间隔内，保持率高
            return Math.max(0.5, 1 - 0.3 * (daysSinceReview / scheduledDays));
        } else {
            // 超过间隔，指数衰减
            const overdue = daysSinceReview - scheduledDays;
            return Math.max(0.05, 0.5 * Math.exp(-0.2 * overdue));
        }
    }
}

// 导出
if (typeof module !== 'undefined') module.exports = SpacedRepetition;
