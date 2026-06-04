/**
 * AI Image Generator - 二次元图片生成
 * 
 * 使用多个二次元 API 源，确保图片可用
 * 每个 reward ID 对应固定的图片（缓存机制）
 */

class AIImageGenerator {
    constructor() {
        this.loadingStates = new Map();
        
        // 图片缓存（rewardId -> imageUrl）
        this.imageCache = this._loadCache();
        
        // 背景图片缓存
        this.bgCache = this._loadBgCache();
        
        // 预设的二次元图片池（备用，当 API 不可用时使用）
        // 使用稳定的 CDN 图片
        this.fallbackImages = [
            'https://cdn.nekos.life/neko/neko_025.jpg',
            'https://cdn.nekos.life/neko/neko_034.jpg',
            'https://cdn.nekos.life/neko/neko_045.jpg',
            'https://cdn.nekos.life/neko/neko_056.jpg',
            'https://cdn.nekos.life/neko/neko_067.jpg',
            'https://cdn.nekos.life/neko/neko_078.jpg',
            'https://cdn.nekos.life/neko/neko_089.jpg',
            'https://cdn.nekos.life/neko/neko_098.jpg',
            'https://cdn.nekos.life/neko/neko_107.jpg',
            'https://cdn.nekos.life/neko/neko_115.jpg',
            'https://cdn.nekos.life/neko/neko_124.jpg',
            'https://cdn.nekos.life/neko/neko_133.jpg',
            'https://cdn.nekos.life/neko/neko_142.jpg',
            'https://cdn.nekos.life/neko/neko_151.jpg',
            'https://cdn.nekos.life/neko/neko_160.jpg',
            'https://cdn.nekos.life/neko/neko_169.jpg',
            'https://cdn.nekos.life/neko/neko_178.jpg',
            'https://cdn.nekos.life/neko/neko_187.jpg',
            'https://cdn.nekos.life/neko/neko_196.jpg',
            'https://cdn.nekos.life/neko/neko_205.jpg',
        ];
    }

    // ==================== 缓存管理 ====================

    _loadCache() {
        try {
            const saved = localStorage.getItem('waifu_image_cache');
            return saved ? JSON.parse(saved) : {};
        } catch(e) {
            return {};
        }
    }

    _saveCache() {
        localStorage.setItem('waifu_image_cache', JSON.stringify(this.imageCache));
    }

    _loadBgCache() {
        try {
            const saved = localStorage.getItem('waifu_bg_cache');
            return saved ? JSON.parse(saved) : {};
        } catch(e) {
            return {};
        }
    }

    _saveBgCache() {
        localStorage.setItem('waifu_bg_cache', JSON.stringify(this.bgCache));
    }

    // ==================== 获取奖励图片 ====================

    /**
     * 获取奖励对应的图片 URL
     * @param {string} rewardId - 奖励 ID
     * @param {string} rarity - 稀有度
     * @returns {object} {url, loading}
     */
    async getRewardImage(rewardId, rarity = 'common') {
        // 检查缓存
        if (this.imageCache[rewardId]) {
            return { url: this.imageCache[rewardId], loading: false };
        }

        // 从 API 获取新图片
        try {
            const imageUrl = await this._fetchAnimeImage(rewardId);
            this.imageCache[rewardId] = imageUrl;
            this._saveCache();
            return { url: imageUrl, loading: false };
        } catch(e) {
            console.warn('获取二次元图片失败:', e);
            // 使用备用图片
            const fallbackUrl = this._getFallbackImage(rewardId);
            this.imageCache[rewardId] = fallbackUrl;
            this._saveCache();
            return { url: fallbackUrl, loading: false };
        }
    }

    /**
     * 同步获取奖励图片 URL（返回缓存或占位符）
     */
    getRewardImageSync(rewardId, rarity = 'common') {
        if (this.imageCache[rewardId]) {
            return this.imageCache[rewardId];
        }
        return null;
    }

    /**
     * 根据天数生成壁纸（用于 streak 奖励）
     */
    async generateStreakReward(day) {
        const cacheKey = `streak_${day}`;
        
        if (this.imageCache[cacheKey]) {
            return this.imageCache[cacheKey];
        }

        try {
            const imageUrl = await this._fetchAnimeImage(cacheKey);
            this.imageCache[cacheKey] = imageUrl;
            this._saveCache();
            return imageUrl;
        } catch(e) {
            const fallbackUrl = this._getFallbackImage(cacheKey);
            this.imageCache[cacheKey] = fallbackUrl;
            this._saveCache();
            return fallbackUrl;
        }
    }

    /**
     * 生成自定义角色
     */
    async generateCustomCharacter(description) {
        const cacheKey = 'custom_' + this._hashString(description).toString(36).substr(0, 8);
        
        if (this.imageCache[cacheKey]) {
            return this.imageCache[cacheKey];
        }

        try {
            const imageUrl = await this._fetchAnimeImage(cacheKey);
            this.imageCache[cacheKey] = imageUrl;
            this._saveCache();
            return imageUrl;
        } catch(e) {
            const fallbackUrl = this._getFallbackImage(cacheKey);
            this.imageCache[cacheKey] = fallbackUrl;
            this._saveCache();
            return fallbackUrl;
        }
    }

    // ==================== API 请求 ====================

    /**
     * 从 API 获取二次元图片
     */
    async _fetchAnimeImage(seed) {
        // 尝试多个 API 源（按稳定性排序）
        const apis = [
            // nekos.life - 返回 JSON（稳定）
            async () => {
                const res = await fetch('https://nekos.life/api/v2/img/neko');
                const data = await res.json();
                return data.url;
            },
            // nekos.best - 返回 JSON
            async () => {
                const types = ['neko', 'waifu'];
                const type = types[this._hashString(seed) % types.length];
                const res = await fetch(`https://nekos.best/api/v2/${type}`);
                const data = await res.json();
                return data.results[0].url;
            },
            // waifu.pics - 返回 JSON
            async () => {
                const types = ['waifu', 'neko', 'shinobu', 'megumin', 'awoo'];
                const type = types[this._hashString(seed) % types.length];
                const res = await fetch(`https://api.waifu.pics/sfw/${type}`);
                const data = await res.json();
                return data.url;
            },
            // waifu.im - 返回 JSON（带参数）
            async () => {
                const res = await fetch('https://api.waifu.im/search?is_nsfw=false&order_by=RANDOM');
                const data = await res.json();
                return data.images[0].url;
            },
            // picsum.photos - 风景图备用（CORS 友好）
            async () => {
                const width = 600;
                const height = 800;
                const seed = this._hashString(seed);
                return `https://picsum.photos/seed/${seed}/${width}/${height}`;
            },
        ];
        
        // 依次尝试
        for (const api of apis) {
            try {
                const url = await api();
                if (url) return url;
            } catch(e) {
                console.warn('API 尝试失败:', e.message);
            }
        }
        
        throw new Error('所有 API 都失败了');
    }

    /**
     * 获取备用图片（基于 seed 选择）
     */
    _getFallbackImage(seed) {
        const index = this._hashString(seed) % this.fallbackImages.length;
        return this.fallbackImages[index];
    }

    // ==================== 首页背景 ====================

    /**
     * 生成首页背景图片
     */
    async generateHomeBackground() {
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const period = Math.floor(dayOfYear / 3);
        
        const cacheKey = `home_bg_${period}`;
        
        if (this.bgCache[cacheKey]) {
            return this.bgCache[cacheKey];
        }

        try {
            const imageUrl = await this._fetchAnimeImage(cacheKey);
            this.bgCache[cacheKey] = imageUrl;
            this._saveBgCache();
            return imageUrl;
        } catch(e) {
            const fallbackUrl = this._getFallbackImage(cacheKey);
            this.bgCache[cacheKey] = fallbackUrl;
            this._saveBgCache();
            return fallbackUrl;
        }
    }

    /**
     * 同步获取首页背景 URL
     */
    getHomeBackgroundSync() {
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const period = Math.floor(dayOfYear / 3);
        const cacheKey = `home_bg_${period}`;
        
        return this.bgCache[cacheKey] || null;
    }

    /**
     * 更新首页背景
     */
    async updateHomeBackground() {
        const bgElement = document.getElementById('home-background');
        if (!bgElement) return;
        
        // 先尝试同步获取缓存的背景
        const cachedBg = this.getHomeBackgroundSync();
        if (cachedBg) {
            bgElement.style.backgroundImage = `url(${cachedBg})`;
            bgElement.classList.remove('hidden');
        }
        
        // 异步获取新图片更新
        try {
            const url = await this.generateHomeBackground();
            if (url) {
                bgElement.style.backgroundImage = `url(${url})`;
                bgElement.classList.remove('hidden');
            }
        } catch(e) {
            console.warn('更新背景失败:', e);
        }
    }

    /**
     * 隐藏首页背景
     */
    hideHomeBackground() {
        const bgElement = document.getElementById('home-background');
        if (bgElement) {
            bgElement.classList.add('hidden');
        }
    }

    // ==================== 预加载 ====================

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            if (!url) {
                resolve(null);
                return;
            }
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = url;
        });
    }

    async preloadUpcoming(currentStreak) {
        const nextDays = [1, 2, 3, 5, 7, 10, 14, 21, 30, 50]
            .filter(d => d > currentStreak)
            .slice(0, 3);
        
        for (const day of nextDays) {
            try {
                const url = await this.generateStreakReward(day);
                if (url) {
                    await this.preloadImage(url);
                }
            } catch (e) {
                // 预加载失败不影响主流程
            }
        }
    }

    // ==================== 工具方法 ====================

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.imageCache = {};
        this.bgCache = {};
        localStorage.removeItem('waifu_image_cache');
        localStorage.removeItem('waifu_bg_cache');
    }
}

// 全局实例
const aiImage = new AIImageGenerator();

if (typeof module !== 'undefined') module.exports = AIImageGenerator;