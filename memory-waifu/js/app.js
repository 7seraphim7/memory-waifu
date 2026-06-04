/**
 * App Controller - 主应用控制器
 */

class MemoryWaifuApp {
    constructor() {
        this.db = new Database();
        this.motivation = new MotivationSystem();
        this.reminder = new ReminderSystem();
        this.currentCard = null;
        this.sessionCards = [];
        this.sessionIndex = 0;
        this.aiImage = new AIImageGenerator();
    }

    async init() {
        await this.db.init();
        await this.reminder.requestPermission();
        
        // 清空卡片容器并重置样式，返回首页状态
        const container = document.getElementById('card-container');
        if (container) {
            container.innerHTML = '';
            container.style.opacity = '1';
        }
        
        const state = this.motivation.getState();
        const dueCards = await this.db.getDueCards();
        
        this.renderDashboard(state, dueCards);
        this.updateStreakBadge(state.streak);
        this._updateNavActive('home');
        
        if (dueCards.length > 0) {
            const msg = this.reminder.generateReminderMessage(dueCards.length, state.streak);
            this.reminder.sendNotification('Memory Waifu', msg);
        }

        console.log('✅ Memory Waifu 初始化完成');
    }

    /**
     * 返回首页（供底部导航调用）
     */
    async goHome() {
        // 清空卡片容器
        const container = document.getElementById('card-container');
        if (container) {
            container.innerHTML = '';
        }
        
        // 显示首页背景
        this.aiImage.updateHomeBackground();
        
        // 重新渲染仪表盘
        const state = this.motivation.getState();
        const dueCards = await this.db.getDueCards();
        this.renderDashboard(state, dueCards);
        this._updateNavActive('home');
    }

    /**
     * 更新底部导航激活状态
     */
    _updateNavActive(page) {
        const nav = document.getElementById('bottom-nav');
        if (!nav) return;
        
        const buttons = nav.querySelectorAll('.nav-btn');
        buttons.forEach(btn => {
            if (btn.dataset.page === page) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // ==================== 复习流程 ====================

    async startReview() {
        this.sessionCards = await this.db.getDueCards();
        this.sessionIndex = 0;
        
        if (this.sessionCards.length === 0) {
            this.showMessage('🎉 太棒了！今天没有需要复习的卡片！', 'success');
            return;
        }
        
        const dashboard = document.getElementById('dashboard');
        if (dashboard) dashboard.innerHTML = '';
        
        this.transitionTo(this.sessionCards[0], 'card');
        this.updateProgress(0, this.sessionCards.length);
    }

    showCard(card) {
        this.currentCard = card;
        const container = document.getElementById('card-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="review-card" id="review-card">
                <div class="card-subject">${this._subjectLabel(card.subject)}</div>
                <div class="card-front">${card.front}</div>
                <div class="card-retention">
                    记忆保持率: ${Math.round(SpacedRepetition.getRetention(card) * 100)}%
                </div>
                <button class="btn-show-answer" onclick="app.showAnswer()">
                    👁️ 显示答案
                </button>
            </div>
        `;
    }

    showAnswer() {
        const card = this.currentCard;
        const container = document.getElementById('card-container');
        if (!container || !card) return;
        
        container.innerHTML = `
            <div class="review-card flipped">
                <div class="card-subject">${this._subjectLabel(card.subject)}</div>
                <div class="card-front">${card.front}</div>
                <hr>
                <div class="card-back">${card.back}</div>
                <div class="rating-buttons">
                    <button class="btn-rate rate-1" onclick="app.rateCard(1)">
                        😵
                    </button>
                    <button class="btn-rate rate-2" onclick="app.rateCard(2)">
                        😣
                    </button>
                    <button class="btn-rate rate-3" onclick="app.rateCard(3)">
                        🤔
                    </button>
                    <button class="btn-rate rate-4" onclick="app.rateCard(4)">
                        😊
                    </button>
                    <button class="btn-rate rate-5" onclick="app.rateCard(5)">
                        😎
                    </button>
                </div>
            </div>
        `;
    }

    async rateCard(quality) {
        if (!this.currentCard) return;
        
        const { card: updatedCard, pointsEarned } = SpacedRepetition.review(this.currentCard, quality);
        await this.db.updateCard(updatedCard);
        
        await this.db.addHistory({
            cardId: updatedCard.id,
            quality,
            pointsEarned,
            interval: updatedCard.interval,
        });
        
        this.showPointsAnimation(pointsEarned);
        
        this.sessionIndex++;
        if (this.sessionIndex < this.sessionCards.length) {
            this.transitionTo(this.sessionCards[this.sessionIndex], 'card');
            this.updateProgress(this.sessionIndex, this.sessionCards.length);
        } else {
            await this.completeSession();
        }
    }

    async completeSession() {
        const totalPoints = this.sessionCards.reduce((sum) => sum + 10, 0);
        const result = this.motivation.completeDailyReview(
            this.sessionCards.length,
            totalPoints
        );
        
        // 展示仪式感转换
        this.showRewardReveal(result);
    }

    // ==================== 界面转换动画 ====================

    /**
     * 页面切换的仪式感转换
     */
    transitionTo(content, type = 'card') {
        const container = document.getElementById('card-container');
        if (!container) return;
        
        // 淡出当前内容
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            if (type === 'card') {
                this.showCard(content);
            }
            // 淡入新内容
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }, 200);
    }

    /**
     * 奖励揭晓动画
     */
    async showRewardReveal(result) {
        const container = document.getElementById('card-container');
        if (!container) return;

        // 第一阶段：展示奖励图片
        if (result.newUnlocks && result.newUnlocks.length > 0) {
            // 先展示加载动画
            container.innerHTML = `
                <div class="reward-reveal">
                    <div class="reveal-icon">🎁</div>
                    <h2 class="reveal-title">恭喜获得新奖励！</h2>
                    <div class="reveal-loading">
                        <div class="loading-spinner"></div>
                        <span>正在揭开神秘面纱...</span>
                    </div>
                </div>
            `;
            container.style.opacity = '1';
            
            // 加载奖励图片
            await this._loadRewardImages(result.newUnlocks);
            
            // 第二阶段：展示奖励详情
            setTimeout(() => {
                this.showSessionComplete(result);
            }, 1500);
        } else {
            this.showSessionComplete(result);
        }
    }

    /**
     * 加载奖励图片
     */
    async _loadRewardImages(unlocks) {
        for (const unlock of unlocks) {
            const { url, loading } = await this.aiImage.getRewardImage(unlock.id, unlock.rarity);
            if (url && !loading) {
                // 图片加载成功，可以更新 UI
                console.log(`图片加载成功: ${unlock.id}`);
            }
        }
    }

    // ==================== 卡片管理 ====================

    async addCard(front, back, subject = 'other') {
        const id = 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const card = SpacedRepetition.createCard(id, front, back, subject);
        await this.db.addCard(card);
        return card;
    }

    async importFromText(text, subject = 'other') {
        const lines = text.trim().split('\n').filter(l => l.includes('|'));
        const cards = [];
        
        for (const line of lines) {
            const [front, back] = line.split('|').map(s => s.trim());
            if (front && back) {
                const id = 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                cards.push(SpacedRepetition.createCard(id, front, back, subject));
            }
        }
        
        if (cards.length > 0) {
            await this.db.importCards(cards);
        }
        
        return cards.length;
    }

    // ==================== UI 渲染 ====================

    renderDashboard(state, dueCards) {
        const dashboard = document.getElementById('dashboard');
        if (!dashboard) return;
        
        dashboard.innerHTML = `
            <div class="stats-bar">
                <div class="stat">
                    <span class="stat-icon">🔥</span>
                    <span class="stat-number">${state.streak}</span>
                    <span class="stat-label">连签</span>
                </div>
                <div class="stat">
                    <span class="stat-icon">⭐</span>
                    <span class="stat-number">${state.totalPoints}</span>
                    <span class="stat-label">积分</span>
                </div>
                <div class="stat">
                    <span class="stat-icon">📈</span>
                    <span class="stat-number">Lv.${state.level}</span>
                    <span class="stat-label">等级</span>
                </div>
                <div class="stat">
                    <span class="stat-icon">📚</span>
                    <span class="stat-number">${dueCards.length}</span>
                    <span class="stat-label">待复习</span>
                </div>
            </div>
            
            <div class="action-buttons">
                ${dueCards.length > 0 
                    ? `<button class="btn-primary" onclick="app.startReview()">
                        开始复习 (${dueCards.length} 张)
                       </button>`
                    : `<div class="all-done">✨ 今天的任务都完成了！</div>`
                }
                <button class="btn-secondary" onclick="app.showAddCard()">+ 添加卡片</button>
                <button class="btn-secondary" onclick="app.showCollection()">🎨 我的收藏</button>
            </div>
        `;
    }

    updateStreakBadge(streak) {
        const badge = document.getElementById('streak-badge');
        if (badge) {
            badge.textContent = `🔥 ${streak}`;
        }
    }

    showSessionComplete(result) {
        const container = document.getElementById('card-container');
        if (!container) return;
        
        let unlocksHtml = '';
        if (result.newUnlocks && result.newUnlocks.length > 0) {
            const unlockItems = result.newUnlocks.map(u => `
                <div class="unlock-item rarity-${u.rarity}">
                    <div class="unlock-icon">${this._getRarityEmoji(u.rarity)}</div>
                    <span class="unlock-name">${u.name}</span>
                    <span class="unlock-desc">${u.description}</span>
                    ${u.canSaveAfter > 0 ? `<span class="unlock-hint">再坚持 ${u.canSaveAfter} 天即可保存</span>` : ''}
                </div>
            `).join('');
            
            unlocksHtml = `
                <div class="new-unlocks">
                    <h3>🎉 新解锁！</h3>
                    ${unlockItems}
                </div>
            `;
        }
        
        container.innerHTML = `
            <div class="session-complete">
                <div class="complete-icon">🎊</div>
                <h2>复习完成！</h2>
                <div class="complete-stats">
                    <div>📚 复习了 ${this.sessionCards.length} 张卡片</div>
                    <div>⭐ 获得 ${result.pointsEarned} 积分</div>
                    <div>🔥 连续打卡 ${result.streak} 天</div>
                    ${result.leveledUp ? `<div class="level-up">🆙 升级到 Lv.${result.newLevel}！</div>` : ''}
                </div>
                ${unlocksHtml}
                <button class="btn-primary" onclick="app.init()">返回首页</button>
            </div>
        `;
        container.style.opacity = '1';
    }

    _getRarityEmoji(rarity) {
        const emojis = {
            'common': '🌸',
            'uncommon': '🌿',
            'rare': '⭐',
            'epic': '💫',
            'legendary': '🔥',
            'mythic': '🌈'
        };
        return emojis[rarity] || '🎁';
    }

    showPointsAnimation(points) {
        const el = document.createElement('div');
        el.className = 'points-float';
        el.textContent = `+${points}`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    }

    showMessage(text, type = 'info') {
        const container = document.getElementById('card-container');
        if (container) {
            container.innerHTML = `<div class="message message-${type}">${text}</div>`;
        }
    }

    updateProgress(current, total) {
        const bar = document.getElementById('progress-bar');
        if (bar) {
            bar.style.width = `${(current / total) * 100}%`;
            bar.textContent = `${current + 1} / ${total}`;
        }
    }

    showAddCard() {
        const container = document.getElementById('card-container');
        if (!container) return;
        
        // 隐藏首页背景
        this.aiImage.hideHomeBackground();
        
        // 清空仪表盘
        const dashboard = document.getElementById('dashboard');
        if (dashboard) dashboard.innerHTML = '';
        
        container.innerHTML = `
            <div class="add-card-form">
                <h3>添加新卡片</h3>
                <select id="card-subject">
                    <option value="math">📐 高数</option>
                    <option value="ds">🌳 数据结构</option>
                    <option value="code">💻 编程</option>
                    <option value="other">📝 其他</option>
                </select>
                <textarea id="card-front" placeholder="正面：问题/概念/提示"></textarea>
                <textarea id="card-back" placeholder="背面：答案/解释/代码"></textarea>
                <button class="btn-primary" onclick="app.submitCard()">添加</button>
                <hr>
                <h4>批量导入（每行一组，用 | 分隔）</h4>
                <textarea id="bulk-import" placeholder="什么是栈？|后进先出(LIFO)的线性数据结构&#10;极限的定义？|当x趋近于a时，f(x)无限接近L"></textarea>
                <button class="btn-secondary" onclick="app.bulkImport()">批量导入</button>
                <button class="btn-back" onclick="app.goHome()">← 返回</button>
            </div>
        `;
        container.style.opacity = '1';
        this._updateNavActive('add');
    }

    async submitCard() {
        const front = document.getElementById('card-front').value.trim();
        const back = document.getElementById('card-back').value.trim();
        const subject = document.getElementById('card-subject').value;
        
        if (!front || !back) {
            this.showMessage('请填写正面和背面内容', 'error');
            return;
        }
        
        await this.addCard(front, back, subject);
        this.showMessage('✅ 卡片已添加！', 'success');
        
        document.getElementById('card-front').value = '';
        document.getElementById('card-back').value = '';
    }

    async bulkImport() {
        const text = document.getElementById('bulk-import').value;
        const subject = document.getElementById('card-subject').value;
        
        if (!text.trim()) {
            this.showMessage('请输入内容', 'error');
            return;
        }
        
        const count = await this.importFromText(text, subject);
        this.showMessage(`✅ 成功导入 ${count} 张卡片！`, 'success');
        document.getElementById('bulk-import').value = '';
    }

    // ==================== 收藏页 ====================

    async showCollection() {
        const state = this.motivation.getState();
        const container = document.getElementById('card-container');
        if (!container) return;
        
        const items = Object.entries(state.lockedItems);
        
        // 隐藏首页背景
        this.aiImage.hideHomeBackground();
        
        container.innerHTML = `
            <div class="collection">
                <h3 class="collection-title">🎨 我的收藏</h3>
                <p class="collection-subtitle">${state.collectionProgress.saved} 张已保存 / ${state.collectionProgress.total} 张已解锁</p>
                <div class="collection-grid" id="collection-grid">
                    ${items.length === 0 ? '<p class="empty-tip">还没有收藏，开始复习来解锁吧！🌟</p>' : ''}
                </div>
                <button class="btn-back" onclick="app.goHome()">← 返回首页</button>
            </div>
        `;
        container.style.opacity = '1';
        this._updateNavActive('collection');
        
        // 加载图片
        if (items.length > 0) {
            const grid = document.getElementById('collection-grid');
            
            // 批量获取所有图片 URL
            const imagePromises = items.map(async ([id, item]) => {
                const reward = this._getRewardFromId(id, state.lockedItems);
                const { url } = await this.aiImage.getRewardImage(id, reward?.rarity || 'common');
                return { id, item, reward, url };
            });
            
            const imageResults = await Promise.all(imagePromises);
            
            for (const { id, item, reward, url } of imageResults) {
                const blurLevel = this.motivation.getBlurLevel(id);
                
                const itemHtml = `
                    <div class="collection-item status-${item.status}" onclick="app.showWallpaperDetail('${id}')">
                        <div class="item-preview" style="filter: blur(${blurLevel * 8}px)">
                            ${this._renderPreviewImage(url, reward?.rarity)}
                        </div>
                        <div class="item-name">${this._prettyName(id)}</div>
                        <div class="item-status">${this._statusLabel(item.status)}</div>
                        ${item.status === 'unlocked' ? `<div class="save-progress">保存进度: ${item.progress}/${item.canSaveAfter}</div>` : ''}
                    </div>
                `;
                
                grid.innerHTML += itemHtml;
            }
        }
    }

    _renderPreviewImage(url, rarity) {
        if (!url) {
            return '<div class="loading-placeholder"><div class="mini-spinner"></div></div>';
        }
        if (url.startsWith('http')) {
            const emoji = this._getRarityEmoji(rarity);
            return `<img src="${url}" alt="preview" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'emoji-preview\\'>${emoji}</span>'">`;
        }
        // emoji 占位图
        return `<span class="emoji-preview">${url}</span>`;
    }

    _getRewardFromId(id, lockedItems) {
        const rewardMap = {
            'wallpaper_01_basic': { rarity: 'common' },
            'wallpaper_02_themed': { rarity: 'common' },
            'wallpaper_03_preview': { rarity: 'uncommon' },
            'wallpaper_04_hd': { rarity: 'rare' },
            'wallpaper_07_animated': { rarity: 'epic' },
            'wallpaper_10_dynamic': { rarity: 'rare' },
            'character_01_live2d': { rarity: 'legendary' },
            'character_02_alternate': { rarity: 'legendary' },
            'character_03_new': { rarity: 'legendary' },
            'custom_character_01': { rarity: 'mythic' }
        };
        return rewardMap[id] || { rarity: 'common' };
    }

    async showWallpaperDetail(itemId) {
        const state = this.motivation.getState();
        const item = state.lockedItems[itemId];
        if (!item) return;

        const container = document.getElementById('card-container');
        const blurLevel = this.motivation.getBlurLevel(itemId);
        const reward = this._getRewardFromId(itemId, state.lockedItems);
        const canSave = item.status === 'saved' || item.status === 'free';
        
        // 先显示 loading 状态
        container.innerHTML = `
            <div class="wallpaper-detail">
                <div class="wallpaper-image-wrapper">
                    ${this._renderDetailImage(null, reward?.rarity, blurLevel, true)}
                </div>
                <h3>${this._prettyName(itemId)}</h3>
                <div class="wallpaper-meta">
                    <span class="rarity-badge rarity-${reward?.rarity}">${this._getRarityEmoji(reward?.rarity)} ${reward?.rarity}</span>
                    <span>${this._statusLabel(item.status)}</span>
                </div>
                ${item.status === 'unlocked' ? `
                    <p class="wallpaper-hint">再坚持 ${item.canSaveAfter - item.progress} 天就能永久保存这张壁纸！</p>
                ` : ''}
                ${item.status === 'blurred' ? `
                    <p class="wallpaper-warning">😢 因为断签壁纸变模糊了...继续复习即可恢复！</p>
                ` : ''}
                <button class="btn-back" onclick="app.showCollection()">← 返回收藏</button>
            </div>
        `;
        container.style.opacity = '1';
        
        // 异步加载图片
        const { url } = await this.aiImage.getRewardImage(itemId, reward?.rarity);
        
        // 更新图片显示
        const wrapper = container.querySelector('.wallpaper-image-wrapper');
        if (wrapper && url) {
            wrapper.innerHTML = this._renderDetailImage(url, reward?.rarity, blurLevel, false);
            
            // 更新下载按钮
            if (canSave) {
                const btnContainer = document.createElement('div');
                btnContainer.innerHTML = `
                    <button class="btn-primary" onclick="app.downloadWallpaper('${url}')">
                        📥 保存到手机
                    </button>
                `;
                const backBtn = container.querySelector('.btn-back');
                container.insertBefore(btnContainer.firstChild, backBtn);
            }
        }
    }

    _renderDetailImage(url, rarity, blurLevel, loading) {
        if (loading) {
            return `<div class="wallpaper-loading"><div class="loading-spinner"></div><span>加载中...</span></div>`;
        }
        if (!url) {
            return `<div class="wallpaper-placeholder">${this._getRarityEmoji(rarity)}</div>`;
        }
        if (url.startsWith('http')) {
            const emoji = this._getRarityEmoji(rarity);
            // 调整模糊系数：轻微模糊 0.15 * 6 = 0.9px，中度模糊 0.5 * 6 = 3px
            return `<img class="wallpaper-image" src="${url}" style="filter: blur(${blurLevel * 6}px)" alt="wallpaper" onerror="this.outerHTML='<div class=\\'wallpaper-placeholder\\'>${emoji}</div>'">`;
        }
        return `<div class="wallpaper-emoji">${url}</div>`;
    }

    async downloadWallpaper(url) {
        if (!url || !url.startsWith('http')) {
            this.showMessage('此图片暂不支持下载', 'error');
            return;
        }
        
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `memory-waifu-${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(link.href);
            this.showMessage('📥 壁纸已保存！', 'success');
        } catch(e) {
            window.open(url, '_blank');
        }
    }

    // ==================== 统计页 ====================

    async showStats() {
        const container = document.getElementById('card-container');
        if (!container) return;
        
        // 隐藏首页背景
        this.aiImage.hideHomeBackground();

        const state = this.motivation.getState();
        const stats = await this.db.getStats(30);
        const cards = await this.db.getAllCards();
        const history = await this.db.getAllRewards();
        
        // 计算掌握率
        const masteredCards = cards.filter(c => SpacedRepetition.getRetention(c) >= 0.9).length;
        const masteryRate = cards.length > 0 ? Math.round(masteredCards / cards.length * 100) : 0;
        
        // 复习趋势数据
        const reviewTrend = this._calculateReviewTrend(stats);
        
        container.innerHTML = `
            <div class="stats-page">
                <h3 class="stats-title">📊 学习统计</h3>
                
                <div class="stats-overview">
                    <div class="stats-card">
                        <span class="stats-value">${state.streak}</span>
                        <span class="stats-label">连续打卡</span>
                    </div>
                    <div class="stats-card">
                        <span class="stats-value">${state.totalPoints}</span>
                        <span class="stats-label">总积分</span>
                    </div>
                    <div class="stats-card">
                        <span class="stats-value">Lv.${state.level}</span>
                        <span class="stats-label">当前等级</span>
                    </div>
                    <div class="stats-card">
                        <span class="stats-value">${masteryRate}%</span>
                        <span class="stats-label">掌握率</span>
                    </div>
                </div>

                <div class="stats-section">
                    <h4>📚 卡片统计</h4>
                    <div class="stats-row">
                        <span>总卡片数</span>
                        <span>${cards.length}</span>
                    </div>
                    <div class="stats-row">
                        <span>已掌握</span>
                        <span>${masteredCards}</span>
                    </div>
                    <div class="stats-row">
                        <span>学习中</span>
                        <span>${cards.length - masteredCards}</span>
                    </div>
                </div>

                <div class="stats-section">
                    <h4>🎨 收藏统计</h4>
                    <div class="stats-row">
                        <span>已解锁</span>
                        <span>${state.collectionProgress.total}</span>
                    </div>
                    <div class="stats-row">
                        <span>已保存</span>
                        <span>${state.collectionProgress.saved}</span>
                    </div>
                    <div class="stats-row">
                        <span>模糊中</span>
                        <span>${state.collectionProgress.blurred}</span>
                    </div>
                </div>

                ${reviewTrend.length > 0 ? `
                <div class="stats-section">
                    <h4>📈 近30天复习趋势</h4>
                    <div class="trend-chart">
                        ${this._renderTrendChart(reviewTrend)}
                    </div>
                </div>
                ` : ''}

                <div class="stats-section">
                    <h4>💾 数据备份</h4>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px;">
                        定期备份防止数据丢失，可导出到文件或复制文本
                    </p>
                    <div class="backup-buttons">
                        <button class="btn-secondary" onclick="app.exportData()">📤 导出备份</button>
                        <button class="btn-secondary" onclick="app.showImportDialog()">📥 导入恢复</button>
                        <button class="btn-secondary btn-danger" onclick="app.clearAllData()">🗑️ 清空数据</button>
                    </div>
                </div>

                <button class="btn-back" onclick="app.goHome()">← 返回首页</button>
            </div>
        `;
        container.style.opacity = '1';
        this._updateNavActive('stats');
    }

    _calculateReviewTrend(stats) {
        // 返回最近7天的复习数据
        const last7 = stats.slice(-7);
        return last7.map(s => ({
            date: s.date,
            reviewed: s.reviewed || 0,
            correct: s.correct || 0
        }));
    }

    _renderTrendChart(data) {
        if (data.length === 0) return '<p class="no-data">暂无数据</p>';
        
        const maxVal = Math.max(...data.map(d => d.reviewed), 1);
        const bars = data.map(d => {
            const height = Math.max((d.reviewed / maxVal) * 100, 5);
            const day = new Date(d.date).getDate();
            return `<div class="chart-bar" style="height: ${height}%">
                <span class="chart-value">${d.reviewed}</span>
                <span class="chart-label">${day}日</span>
            </div>`;
        }).join('');
        
        return `<div class="bar-chart">${bars}</div>`;
    }

    // ==================== 辅助方法 ====================

    _prettyName(id) {
        return id.replace(/^wallpaper_|^character_|^bonus_|^custom_/g, '')
                 .replace(/_/g, ' ')
                 .replace(/^\w/, c => c.toUpperCase());
    }

    _subjectLabel(subject) {
        const labels = { math: '📐 高数', ds: '🌳 数据结构', code: '💻 编程', other: '📝 其他' };
        return labels[subject] || labels.other;
    }

    _statusLabel(status) {
        const labels = {
            'free': '✅ 已保存',
            'unlocked': '🔓 已解锁',
            'blurred': '😢 模糊中',
            'lost': '💔 已失去',
            'saved': '📥 永久保存',
        };
        return labels[status] || status;
    }

    // ==================== 调试/测试方法 ====================

    /**
     * 模拟完成复习（用于测试壁纸解锁）n     * @param {number} days - 模拟的连签天数
     */
    async simulateReview(days = 1) {
        // 模拟完成复习
        const result = this.motivation.completeDailyReview(3, 50 * days);
        
        // 手动设置连签天数（用于测试）
        if (days > 1) {
            this.motivation.state.streak = days;
            this.motivation._save();
        }
        
        // 显示结果
        this.showMessage(`✅ 模拟完成！连签 ${this.motivation.state.streak} 天，解锁 ${result.newUnlocks.length} 个奖励`, 'success');
        
        // 刷新首页
        await this.goHome();
        
        return result;
    }

    /**
     * 快速解锁所有壁纸（测试用）
     */
    async unlockAllForTest() {
        const testRewards = [
            { id: 'wallpaper_01_basic', rarity: 'common', canSaveAfter: 2, status: 'saved', progress: 2 },
            { id: 'wallpaper_02_themed', rarity: 'common', canSaveAfter: 3, status: 'unlocked', progress: 1 },
            { id: 'wallpaper_03_preview', rarity: 'uncommon', canSaveAfter: 4, status: 'unlocked', progress: 3 },
            { id: 'wallpaper_04_hd', rarity: 'rare', canSaveAfter: 5, status: 'blurred', progress: 2 },
            { id: 'wallpaper_07_animated', rarity: 'epic', canSaveAfter: 7, status: 'unlocked', progress: 0 },
            { id: 'wallpaper_10_dynamic', rarity: 'rare', canSaveAfter: 10, status: 'saved', progress: 10 },
            { id: 'character_01_live2d', rarity: 'legendary', canSaveAfter: 14, status: 'unlocked', progress: 5 },
        ];
        
        for (const reward of testRewards) {
            if (!this.motivation.state.unlockedItems.includes(reward.id)) {
                this.motivation.state.unlockedItems.push(reward.id);
            }
            this.motivation.state.lockedItems[reward.id] = {
                status: reward.status,
                canSaveAfter: reward.canSaveAfter,
                canSaveFrom: 1,
                progress: reward.progress,
            };
        }
        
        this.motivation.state.streak = 7;
        this.motivation.state.totalPoints = 500;
        this.motivation.state.level = 2;
        this.motivation._save();
        
        // 更新连签徽章
        this.updateStreakBadge(this.motivation.state.streak);
        
        // 显示加载提示
        this.showMessage('🔄 正在从二次元 API 获取图片...', 'info');
        
        // 真正从 API 获取图片
        for (const reward of testRewards) {
            try {
                const { url } = await this.aiImage.getRewardImage(reward.id, reward.rarity);
                console.log(`✅ ${reward.id}: ${url}`);
            } catch(e) {
                console.warn(`❌ ${reward.id} 获取失败`);
            }
        }
        
        this.showMessage('🎉 测试数据：已解锁 7 张壁纸！', 'success');
        
        // 跳转到收藏页查看
        await this.showCollection();
    }

    // ==================== 数据备份/恢复 ====================

    /**
     * 导出所有数据
     */
    async exportData() {
        try {
            const backup = await this.db.exportAllData();
            const json = JSON.stringify(backup, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // 创建下载链接
            const a = document.createElement('a');
            a.href = url;
            a.download = `memory-waifu-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showMessage('✅ 备份已下载！请妥善保存文件', 'success');
        } catch (e) {
            this.showMessage('❌ 导出失败: ' + e.message, 'error');
        }
    }

    /**
     * 显示导入对话框
     */
    showImportDialog() {
        const container = document.getElementById('card-container');
        if (!container) return;
        
        // 隐藏首页背景
        this.aiImage.hideHomeBackground();
        
        container.innerHTML = `
            <div class="import-dialog">
                <h3>📥 导入数据</h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 12px 0;">
                    选择备份文件恢复数据，或粘贴 JSON 文本
                </p>
                <div class="import-options">
                    <div class="import-option">
                        <label class="btn-secondary" style="display: inline-block; cursor: pointer;">
                            📁 选择文件
                            <input type="file" id="import-file" accept=".json" style="display: none;" onchange="app.handleFileImport(this)">
                        </label>
                    </div>
                    <div class="import-divider">或</div>
                    <textarea id="import-text" placeholder="粘贴 JSON 备份文本..." style="width: 100%; height: 120px; margin: 8px 0;"></textarea>
                    <button class="btn-primary" onclick="app.handleTextImport()">📋 从文本导入</button>
                </div>
                <div class="import-warning" style="background: rgba(255, 59, 48, 0.1); padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 0.8rem; color: var(--error);">
                    ⚠️ 警告：导入会覆盖现有数据！建议先导出备份当前数据。
                </div>
                <button class="btn-back" onclick="app.showStats()">← 返回</button>
            </div>
        `;
        container.style.opacity = '1';
    }

    /**
     * 处理文件导入
     */
    async handleFileImport(input) {
        const file = input.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            await this.performImport(backup);
        } catch (e) {
            this.showMessage('❌ 文件解析失败: ' + e.message, 'error');
        }
    }

    /**
     * 处理文本导入
     */
    async handleTextImport() {
        const textarea = document.getElementById('import-text');
        const text = textarea.value.trim();
        
        if (!text) {
            this.showMessage('请输入备份数据', 'error');
            return;
        }
        
        try {
            const backup = JSON.parse(text);
            await this.performImport(backup);
        } catch (e) {
            this.showMessage('❌ JSON 解析失败: ' + e.message, 'error');
        }
    }

    /**
     * 执行导入
     */
    async performImport(backup) {
        if (!confirm('⚠️ 确定要导入吗？这将覆盖现有数据！')) {
            return;
        }
        
        try {
            const result = await this.db.importAllData(backup, false);
            
            // 重新加载激励状态
            const savedState = localStorage.getItem('memory_waifu_state');
            if (savedState) {
                this.motivation.state = JSON.parse(savedState);
            }
            
            this.showMessage(`✅ 导入成功！卡片: ${result.cards}, 历史: ${result.history}`, 'success');
            
            setTimeout(() => {
                this.goHome();
            }, 1500);
        } catch (e) {
            this.showMessage('❌ 导入失败: ' + e.message, 'error');
        }
    }

    /**
     * 清空所有数据
     */
    async clearAllData() {
        if (!confirm('⚠️ 警告：确定要清空所有数据吗？此操作不可恢复！')) {
            return;
        }
        
        if (!confirm('再次确认：真的要删除所有卡片、学习记录和解锁的壁纸吗？')) {
            return;
        }
        
        try {
            await this.db._clearAll();
            localStorage.removeItem('memory_waifu_state');
            
            this.showMessage('🗑️ 数据已清空', 'success');
            
            setTimeout(() => {
                location.reload();
            }, 1500);
        } catch (e) {
            this.showMessage('❌ 清空失败: ' + e.message, 'error');
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MemoryWaifuApp();
    app.init();
});
