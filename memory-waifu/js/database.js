/**
 * Database Layer - IndexedDB 本地数据库
 * 
 * 所有数据存在浏览器本地，不需要后端服务器
 * IndexedDB 支持大量数据存储，比 localStorage 靠谱
 */

class Database {
    constructor(dbName = 'MemoryWaifuDB') {
        this.dbName = dbName;
        this.version = 1;
        this.db = null;
    }

    /**
     * 打开/初始化数据库
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 卡片存储
                if (!db.objectStoreNames.contains('cards')) {
                    const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
                    cardStore.createIndex('subject', 'subject', { unique: false });
                    cardStore.createIndex('nextReview', 'nextReview', { unique: false });
                }
                
                // 复习历史
                if (!db.objectStoreNames.contains('history')) {
                    const histStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                    histStore.createIndex('cardId', 'cardId', { unique: false });
                    histStore.createIndex('date', 'date', { unique: false });
                }
                
                // 壁纸/奖励素材
                if (!db.objectStoreNames.contains('rewards')) {
                    const rewardStore = db.createObjectStore('rewards', { keyPath: 'id' });
                    rewardStore.createIndex('type', 'type', { unique: false });
                    rewardStore.createIndex('rarity', 'rarity', { unique: false });
                }
                
                // 统计数据
                if (!db.objectStoreNames.contains('stats')) {
                    db.createObjectStore('stats', { keyPath: 'date' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // ==================== 卡片操作 ====================

    async addCard(card) {
        return this._put('cards', card);
    }

    async getCard(id) {
        return this._get('cards', id);
    }

    async updateCard(card) {
        return this._put('cards', card);
    }

    async deleteCard(id) {
        return this._delete('cards', id);
    }

    async getAllCards() {
        return this._getAll('cards');
    }

    async getCardsBySubject(subject) {
        return this._getByIndex('cards', 'subject', subject);
    }

    /**
     * 获取所有到期卡片
     */
    async getDueCards() {
        const allCards = await this._getAll('cards');
        const now = Date.now();
        return allCards.filter(card => card.nextReview <= now);
    }

    // ==================== 历史操作 ====================

    async addHistory(record) {
        record.date = Date.now();
        return this._put('history', record);
    }

    async getHistoryByCard(cardId) {
        return this._getByIndex('history', 'cardId', cardId);
    }

    // ==================== 奖励操作 ====================

    async addReward(reward) {
        return this._put('rewards', reward);
    }

    async getReward(id) {
        return this._get('rewards', id);
    }

    async getAllRewards() {
        return this._getAll('rewards');
    }

    // ==================== 统计操作 ====================

    async saveDayStats(stats) {
        const today = new Date().toISOString().split('T')[0];
        stats.date = today;
        return this._put('stats', stats);
    }

    async getStats(days = 30) {
        const allStats = await this._getAll('stats');
        return allStats.slice(-days);
    }

    // ==================== 批量导入 ====================

    /**
     * 批量导入卡片（方便录入一整章的知识点）
     * @param {Array} cards - 卡片数组
     */
    async importCards(cards) {
        const tx = this.db.transaction(['cards'], 'readwrite');
        const store = tx.objectStore('cards');
        for (const card of cards) {
            store.put(card);
        }
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(cards.length);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * 导出所有数据（备份用）
     */
    async exportAll() {
        const cards = await this._getAll('cards');
        const history = await this._getAll('history');
        const rewards = await this._getAll('rewards');
        const stats = await this._getAll('stats');
        return { cards, history, rewards, stats, exportedAt: Date.now() };
    }

    /**
     * 导入备份数据
     */
    async importAll(data) {
        if (data.cards) await this.importCards(data.cards);
        // history, rewards 类似...
    }

    // ==================== 底层操作 ====================

    _put(storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(item);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    _get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    _getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    _getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    _delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // ==================== 数据导出/导入 ====================

    /**
     * 导出所有数据
     * @returns {object} 完整数据备份
     */
    async exportAllData() {
        const cards = await this._getAll('cards');
        const history = await this._getAll('history');
        const rewards = await this._getAll('rewards');
        const stats = await this._getAll('stats');
        
        // 同时导出 localStorage 中的激励状态
        const motivationState = localStorage.getItem('memory_waifu_state');
        
        const backup = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            data: {
                cards,
                history,
                rewards,
                stats,
                motivationState: motivationState ? JSON.parse(motivationState) : null,
            }
        };
        
        return backup;
    }

    /**
     * 导入数据
     * @param {object} backup - 备份数据
     * @param {boolean} merge - 是否合并（false=覆盖）
     */
    async importAllData(backup, merge = false) {
        if (!backup || !backup.data) {
            throw new Error('无效的备份文件');
        }
        
        const { data } = backup;
        
        // 如果不是合并模式，先清空现有数据
        if (!merge) {
            await this._clearAll();
        }
        
        // 导入卡片
        if (data.cards && Array.isArray(data.cards)) {
            for (const card of data.cards) {
                await this._put('cards', card);
            }
        }
        
        // 导入历史记录
        if (data.history && Array.isArray(data.history)) {
            for (const record of data.history) {
                // 删除 id 让数据库自增
                const { id, ...recordWithoutId } = record;
                await this._put('history', recordWithoutId);
            }
        }
        
        // 导入奖励
        if (data.rewards && Array.isArray(data.rewards)) {
            for (const reward of data.rewards) {
                await this._put('rewards', reward);
            }
        }
        
        // 导入统计
        if (data.stats && Array.isArray(data.stats)) {
            for (const stat of data.stats) {
                await this._put('stats', stat);
            }
        }
        
        // 导入激励状态
        if (data.motivationState) {
            localStorage.setItem('memory_waifu_state', JSON.stringify(data.motivationState));
        }
        
        return {
            cards: data.cards?.length || 0,
            history: data.history?.length || 0,
            rewards: data.rewards?.length || 0,
            stats: data.stats?.length || 0,
        };
    }

    /**
     * 清空所有数据
     */
    async _clearAll() {
        const stores = ['cards', 'history', 'rewards', 'stats'];
        for (const storeName of stores) {
            await this._clear(storeName);
        }
    }

    _clear(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

if (typeof module !== 'undefined') module.exports = Database;
