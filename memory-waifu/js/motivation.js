/**
 * Motivation System - 激励系统
 * 
 * 解决"坚持不下去"的核心模块
 * 
 * 设计理念：
 * 1. 渐进式奖励（前面密集，后面有盼头）
 * 2. 断签有保护（不是永久失去，是逐步失去）
 * 3. 利用收集癖 + 变量奖励驱动
 * 4. 壁纸有"模糊化"等视觉效果，解锁但看不清更有悬念
 */

class MotivationSystem {
    constructor() {
        // 从 localStorage 加载进度
        this.state = this._load();
    }

    // ==================== 每日签到 ====================

    /**
     * 完成一轮复习任务后的处理
     * @param {number} cardsReviewed - 复习的卡片数量
     * @param {number} pointsFromReview - 算法引擎返回的积分
     * @returns {object} 奖励详情（升级、解锁、变化等）
     */
    completeDailyReview(cardsReviewed, pointsFromReview) {
        const today = this._todayKey();
        const rewards = [];
        let newUnlocks = [];
        let newPenalties = [];
        let leveledUp = false;
        let oldLevel = this.state.level;

        // 1. 连续打卡天数
        if (this.state.lastActiveDate === null) {
            // 首次使用，直接算第1天
            this.state.streak = 1;
        } else if (this.state.lastActiveDate === today) {
            // 今天已经打过卡了，不重复计算
        } else if (this.state.lastActiveDate === this._yesterdayKey()) {
            // 昨天活跃，连签+1
            this.state.streak++;
        } else {
            // 断签了，进入惩罚流程
            const breakPenalties = this._handleBreak();
            this.state.streak = 1; // 重置为1（今天来了算1天）
        }
        this.state.lastActiveDate = today;

        // 2. 积分累加
        this.state.totalPoints += pointsFromReview;
        this.state.sessionPoints += pointsFromReview;

        // 3. 连签奖励（用数组定义不同天数的奖励）
        const streakRewards = this._getStreakRewards(this.state.streak);
        for (const reward of streakRewards) {
            if (!this.state.unlockedItems.includes(reward.id)) {
                // 解锁但标记为"未保存"（部分解锁）
                if (reward.canSaveAfter > 0) {
                    this.state.unlockedItems.push(reward.id);
                    this.state.lockedItems[reward.id] = {
                        status: 'unlocked', // 可查看但不可保存
                        canSaveAfter: reward.canSaveAfter,
                        canSaveFrom: this.state.streak,
                        progress: 0,
                    };
                } else {
                    this.state.unlockedItems.push(reward.id);
                    this.state.lockedItems[reward.id] = { status: 'free', canSaveAfter: 0 };
                }
                newUnlocks.push(reward);
            }
            rewards.push(reward);
        }

        // 4. 等级提升
        const newLevel = Math.floor(this.state.streak / 7) + 1;
        if (newLevel > this.state.level) {
            this.state.level = newLevel;
            leveledUp = true;
            // 升级奖励
            const levelReward = this._getLevelReward(newLevel);
            if (levelReward && !this.state.unlockedItems.includes(levelReward.id)) {
                this.state.unlockedItems.push(levelReward.id);
                this.state.lockedItems[levelReward.id] = { status: 'free', canSaveAfter: 0 };
                newUnlocks.push(levelReward);
            }
        }

        // 5. 随机彩蛋（5% 概率触发）
        if (Math.random() < 0.05) {
            const bonus = Math.floor(Math.random() * 20) + 5;
            this.state.totalPoints += bonus;
            rewards.push({ type: 'bonus', points: bonus, message: '🎰 彩蛋掉落！额外 +' + bonus + ' 积分' });
        }

        // 6. 更新"可保存进度"
        for (const [id, item] of Object.entries(this.state.lockedItems)) {
            if (item.status === 'unlocked' && item.canSaveAfter > 0) {
                item.progress = Math.min(item.progress + 1, item.canSaveAfter);
                if (item.progress >= item.canSaveAfter) {
                    item.status = 'saved'; // 现在可以永久保存了
                    newPenalties.push({ id, action: 'unlocked_save', message: '📥 壁纸已解锁保存权限！' });
                }
            }
        }

        this._save();

        return {
            streak: this.state.streak,
            pointsEarned: pointsFromReview,
            totalPoints: this.state.totalPoints,
            sessionPoints: this.state.sessionPoints,
            leveledUp,
            newLevel: this.state.level,
            newUnlocks,
            newPenalties,
            rewards,
            rewards,
        };
    }

    /**
     * 断签处理
     * 不是一刀砍，而是阶梯式惩罚
     */
    _handleBreak() {
        const breakDays = 1; // 当前这次断签天数
        const messages = [];
        
        for (const [id, item] of Object.entries(this.state.lockedItems)) {
            if (item.status === 'unlocked') {
                // 已解锁但未保存的 → 变成"模糊"状态
                item.status = 'blurred';
                messages.push({ id, action: 'blurred', message: '😔 断签了，壁纸变得模糊...继续努力才能恢复' });
            } else if (item.status === 'saved') {
                // 已保存的 → 不受影响（给了安全感）
            }
        }
        
        // 如果连续断签 ≥ 3天，永久失去
        if (this.state.streak === 0 && this._getConsecutiveBreakDays() >= 3) {
            for (const [id, item] of Object.entries(this.state.lockedItems)) {
                if (item.status === 'blurred') {
                    item.status = 'lost';
                    messages.push({ id, action: 'lost', message: '💔 壁纸永久失去了...要重新解锁' });
                }
            }
        }
        
        return messages;
    }

    /**
     * 获取壁纸的模糊程度（0=清晰, 1=完全模糊）
     * 用于前端展示视觉效果
     * 
     * 调整说明：
     * - unlocked: 0.15 (轻微模糊，能看到大致内容)
     * - blurred: 0.5 (中度模糊，能看出轮廓)
     * - lost: 0.9 (严重模糊，只剩色块)
     */
    getBlurLevel(itemId) {
        const item = this.state.lockedItems[itemId];
        if (!item) return 0;
        switch (item.status) {
            case 'free': return 0;
            case 'unlocked': return 0.15;   // 轻微模糊，能看到大致内容
            case 'blurred': return 0.5;     // 中度模糊，能看出轮廓
            case 'lost': return 0.9;        // 严重模糊，只剩色块
            case 'saved': return 0;
            default: return 0;
        }
    }

    // ==================== 积分商店 ====================

    /**
     * 消耗积分兑换福利
     */
    spendPoints(cost, itemId) {
        if (this.state.totalPoints < cost) {
            return { success: false, reason: '积分不足' };
        }
        this.state.totalPoints -= cost;
        this._save();
        return { success: true, remaining: this.state.totalPoints };
    }

    // ==================== 等级 & 奖励定义 ====================

    /**
     * 连签奖励表 - 核心激励链
     * 
     * 设计逻辑：
     * - 第1-2天：快速回报，让你上钩
     * - 第3-7天：逐渐升级，壁纸模糊→清晰
     * - 第14天：动态壁纸（惊喜）
     * - 第30天：Live2D 角色（大目标）
     * - 第50天：自选角色定制权（终极目标）
     */
    _getStreakRewards(streak) {
        const rewards = [];
        
        // 第1天：基础壁纸（让你立刻看到回报）
        if (streak === 1) {
            rewards.push({
                id: 'wallpaper_01_basic',
                name: '🌱 千里之行始于足下',
                type: 'wallpaper',
                rarity: 'common',
                description: '第一步已经迈出，继续加油！',
                canSaveAfter: 2,
            });
        }
        
        // 第2天：主题壁纸
        if (streak === 2) {
            rewards.push({
                id: 'wallpaper_02_themed',
                name: '💪 坚持就是胜利',
                type: 'wallpaper',
                rarity: 'common',
                description: '第二天了，你正在养成好习惯',
                canSaveAfter: 3,
            });
        }
        
        // 第3天：解锁"查看"功能（不再完全模糊）
        if (streak === 3) {
            rewards.push({
                id: 'wallpaper_03_preview',
                name: '⭐ 每天进步一点点',
                type: 'wallpaper',
                rarity: 'uncommon',
                description: '三天了，你比昨天更强大',
                canSaveAfter: 4,
            });
        }
        
        // 第5天：高清壁纸
        if (streak === 5) {
            rewards.push({
                id: 'wallpaper_04_hd',
                name: '🔥 永不言弃',
                type: 'wallpaper',
                rarity: 'rare',
                description: '五天坚持，你正在超越自己',
                canSaveAfter: 5,
            });
        }
        
        // 第7天：动态壁纸（第一个"哇塞"时刻）
        if (streak === 7) {
            rewards.push({
                id: 'wallpaper_07_animated',
                name: '✨ 一周的坚持',
                type: 'wallpaper',
                rarity: 'epic',
                description: '一周了！你已经打败了90%的人',
                canSaveAfter: 7,
            });
        }
        
        // 第10天：第二张动态壁纸
        if (streak === 10) {
            rewards.push({
                id: 'wallpaper_10_dynamic',
                name: '🌊 乘风破浪',
                type: 'animated_wallpaper',
                rarity: 'rare',
                description: '十天了，习惯已经养成',
                canSaveAfter: 7,
            });
        }
        
        // 第14天：Live2D 角色登场
        if (streak === 14) {
            rewards.push({
                id: 'character_01_live2d',
                name: '🎭 破茧成蝶',
                type: 'live2d_character',
                rarity: 'legendary',
                description: '两周的坚持，你已经是全新的自己',
                canSaveAfter: 7,
            });
        }
        
        // 第21天：角色换装/新表情
        if (streak === 21) {
            rewards.push({
                id: 'character_02_alternate',
                name: '🌟 习惯成自然',
                type: 'live2d_character',
                rarity: 'legendary',
                description: '21天，习惯已经刻进DNA',
                canSaveAfter: 7,
            });
        }
        
        // 第30天：里程碑
        if (streak === 30) {
            rewards.push({
                id: 'character_03_new',
                name: '👑 三十而立',
                type: 'live2d_character',
                rarity: 'legendary',
                description: '一个月！你证明了坚持的力量',
                canSaveAfter: 7,
            });
        }
        
        // 第50天：终极目标
        if (streak === 50) {
            rewards.push({
                id: 'custom_character_01',
                name: '🏆 登峰造极',
                type: 'custom_character',
                rarity: 'mythic',
                description: '五十天！你是真正的传奇',
                canSaveAfter: 0,
            });
        }
        
        // 每7天重复给壁纸（保底）
        if (streak > 7 && streak % 7 === 0 && !rewards.find(r => r.id === `wallpaper_weekly_${streak}`)) {
            const weekNum = streak / 7;
            const weekQuotes = [
                '继续努力',
                '越来越好',
                '势不可挡',
                '持之以恒',
                '厚积薄发',
                '精益求精',
                '百尺竿头',
            ];
            const quote = weekQuotes[(weekNum - 1) % weekQuotes.length];
            rewards.push({
                id: `wallpaper_weekly_${streak}`,
                name: `📅 第${weekNum}周：${quote}`,
                type: 'wallpaper',
                rarity: streak >= 28 ? 'epic' : 'rare',
                description: `坚持了 ${streak} 天，${quote}！`,
                canSaveAfter: 7,
            });
        }
        
        // 每100天：传说级奖励
        if (streak === 100) {
            rewards.push({
                id: 'character_ultimate',
                name: '👑 百日筑基',
                type: 'live2d_premium',
                rarity: 'mythic',
                description: '一百天！你已经超越了昨天的自己',
                canSaveAfter: 0,
            });
        }
        
        return rewards;
    }

    _getLevelReward(level) {
        if (level === 2) {
            return { id: 'bonus_wallpaper_lv2', name: '⭐ 更上一层楼', type: 'wallpaper', rarity: 'rare', description: '等级2专属奖励，继续加油！', canSaveAfter: 3 };
        }
        if (level === 5) {
            return { id: 'bonus_animated_lv5', name: '✨ 学无止境', type: 'animated_wallpaper', rarity: 'epic', description: '等级5专属奖励，你已经很优秀了！', canSaveAfter: 5 };
        }
        return null;
    }

    // ==================== 断签恢复辅助 ====================

    /**
     * 使用"免罚卡"（每周获得一张）
     */
    useSkipCard() {
        if (this.state.skipCards <= 0) {
            return { success: false, reason: '没有免罚卡了' };
        }
        this.state.skipCards--;
        this.state.streak++; // 恢复连签
        this._save();
        return { success: true, remaining: this.state.skipCards, streak: this.state.streak };
    }

    /**
     * 每周末检查：发放下周免罚卡
     */
    _weeklyBonus() {
        const lastBonus = this.state.lastWeeklyBonus;
        if (!lastBonus) {
            this.state.skipCards = 2;
            this.state.lastWeeklyBonus = this._todayKey();
            this._save();
            return;
        }
        const lastDate = new Date(lastBonus);
        const now = new Date();
        if (now - lastDate > 7 * 24 * 60 * 60 * 1000) {
            this.state.skipCards = Math.min(5, this.state.skipCards + 2);
            this.state.lastWeeklyBonus = this._todayKey();
            this._save();
        }
    }

    // ==================== 持久化 ====================

    _load() {
        const saved = localStorage.getItem('memory_waifu_state');
        if (saved) {
            try { return JSON.parse(saved); } catch(e) {}
        }
        return this._defaultState();
    }

    _save() {
        localStorage.setItem('memory_waifu_state', JSON.stringify(this.state));
    }

    _defaultState() {
        return {
            totalPoints: 0,
            sessionPoints: 0,
            streak: 0,
            lastActiveDate: null,
            lastWeeklyBonus: null,
            skipCards: 2,
            level: 1,
            unlockedItems: [],
            lockedItems: {},
        };
    }

    _todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    
    _yesterdayKey() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    _getConsecutiveBreakDays() {
        // 简化：基于上次活跃日期推算
        if (this.state.lastActiveDate === this._yesterdayKey()) return 1;
        const diff = (new Date() - new Date(this.state.lastActiveDate)) / (24 * 60 * 60 * 1000);
        return Math.floor(diff);
    }

    // ==================== 状态查询 ====================

    getState() {
        this._weeklyBonus();
        return {
            ...this.state,
            collectionProgress: this._getCollectionProgress(),
        };
    }

    _getCollectionProgress() {
        const total = Object.keys(this.state.lockedItems).length;
        const saved = Object.values(this.state.lockedItems).filter(i => i.status === 'saved').length;
        const blurred = Object.values(this.state.lockedItems).filter(i => i.status === 'blurred').length;
        const unlocked = Object.values(this.state.lockedItems).filter(i => i.status === 'unlocked').length;
        return { total, saved, blurred, unlocked, percentage: total ? Math.round(saved / total * 100) : 0 };
    }
}

if (typeof module !== 'undefined') module.exports = MotivationSystem;
