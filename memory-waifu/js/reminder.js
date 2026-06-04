/**
 * Notification & Reminder System - 推送提醒系统
 * 
 * 在最佳时间提醒你：该复习什么了
 * 支持浏览器原生推送 + 页面内提醒
 */

class ReminderSystem {
    constructor() {
        this.permission = 'default';
        this.scheduledReminders = [];
    }

    /**
     * 请求推送权限
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('浏览器不支持 Notification API');
            return 'unsupported';
        }
        this.permission = await Notification.requestPermission();
        return this.permission;
    }

    /**
     * 发送推送通知
     * @param {string} title - 标题
     * @param {string} body - 内容
     * @param {object} options - 额外配置
     */
    sendNotification(title, body, options = {}) {
        if (this.permission !== 'granted') {
            // 回退到页面内提醒
            this._showInPageReminder(title, body);
            return;
        }

        const notification = new Notification(title, {
            body,
            icon: options.icon || '/assets/icon-192.png',
            badge: '/assets/badge-72.png',
            tag: options.tag || 'review-reminder',
            requireInteraction: true, // 不自动消失
            ...options,
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
            if (options.onClick) options.onClick();
        };
    }

    /**
     * 计算最佳提醒时间
     * 
     * 策略：
     * 1. 避免深夜（23:00 - 08:00）
     * 2. 优先在"碎片时间"提醒（课间、午休、晚饭后）
     * 3. 快到期的卡片优先提醒
     * 
     * @param {Array} dueCards - 待复习卡片
     * @returns {Array} 提醒计划
     */
    calculateReminderSchedule(dueCards) {
        const now = new Date();
        const hour = now.getHours();
        const reminders = [];

        // 定义可用时间段
        const timeSlots = [
            { start: 8, end: 9, label: '早起' },
            { start: 10, end: 10.5, label: '课间' },
            { start: 12, end: 13, label: '午休' },
            { start: 15, end: 15.5, label: '下午课间' },
            { start: 18, end: 19, label: '晚饭后' },
            { start: 21, end: 22, label: '睡前' },
        ];

        // 找到下一个可用时间段
        const nextSlot = timeSlots.find(slot => slot.start > hour) || timeSlots[0];

        // 每张到期卡分配到最近的时间段
        const cardsPerSlot = Math.ceil(dueCards.length / timeSlots.length);
        
        for (let i = 0; i < dueCards.length; i++) {
            const slotIndex = Math.floor(i / cardsPerSlot) % timeSlots.length;
            const slot = timeSlots[slotIndex];
            reminders.push({
                card: dueCards[i],
                scheduledHour: slot.start,
                label: slot.label,
            });
        }

        return reminders;
    }

    /**
     * 智能提醒：根据当前到期卡片数量生成提醒文案
     */
    generateReminderMessage(dueCount, streak) {
        const messages = [
            // 温柔催促
            `📚 有 ${dueCount} 张卡片等着你~ 快来翻翻`,
            `🌸 ${dueCount} 个知识点快忘了，来拯救一下？`,
            `⏰ 最佳复习时间到了！${dueCount} 张卡片到期`,
            // 带激励的
            `🔥 连续 ${streak} 天了！别让火苗熄灭~（${dueCount} 张卡待复习）`,
            `✨ 再复习 ${dueCount} 张就能接近下一个奖励了！`,
            // 带损失暗示的
            `😱 你的壁纸正在慢慢变模糊...来复习就能恢复！`,
            `🔒 继续摸鱼的话，已解锁的壁纸就要锁回去了哦`,
        ];
        
        // 根据连签天数和卡片数量选择合适的语气
        if (streak > 7) {
            return messages[3]; // 鼓励保持
        } else if (streak === 0) {
            return messages[5]; // 损失暗示
        } else {
            return messages[Math.floor(Math.random() * 4)];
        }
    }

    /**
     * 页面内提醒（Notification 不可用时的降级方案）
     */
    _showInPageReminder(title, body) {
        const reminder = document.createElement('div');
        reminder.className = 'in-page-reminder';
        reminder.innerHTML = `
            <div class="reminder-title">${title}</div>
            <div class="reminder-body">${body}</div>
            <button class="reminder-dismiss">知道了</button>
        `;
        document.body.appendChild(reminder);
        
        reminder.querySelector('.reminder-dismiss').addEventListener('click', () => {
            reminder.remove();
        });
        
        // 10秒后自动消失
        setTimeout(() => reminder.remove(), 10000);
    }

    /**
     * 注册 Service Worker 定时推送（PWA 核心）
     */
    async registerPeriodicSync() {
        if ('serviceWorker' in navigator && 'periodicSync' in registration) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.periodicSync.register('review-check', {
                    minInterval: 2 * 60 * 60 * 1000, // 每2小时检查一次
                });
                console.log('✅ 定期同步已注册');
            } catch (e) {
                console.warn('定期同步不支持:', e);
            }
        }
    }
}

if (typeof module !== 'undefined') module.exports = ReminderSystem;
