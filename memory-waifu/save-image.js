/**
 * 图片保存脚本 - 支持多源和关键词搜索
 * 
 * 用法:
 *   node save-image.js              # 随机保存 1 张
 *   node save-image.js -n 10         # 保存 10 张
 *   node save-image.js -k anime      # 搜索关键词保存
 *   node save-image.js --sync       # 同步模式：一直运行定时保存
 * 
 * 图片源:
 *   - pic.re (默认)
 *   - 备用源自动切换
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============ 配置 ============
const OUTPUT_DIR = './saved-images';
const INDEX_FILE = './saved-images/index.json';
const REQUEST_INTERVAL = 2000; // 请求间隔 ms
const MAX_RETRIES = 3; // 每个源最大重试次数
const DEFAULT_SYNC_INTERVAL = 1440; // 默认同步间隔（分钟），约每天1张匹配学习奖励节奏

// 图片源列表
const IMAGE_SOURCES = [
    { name: 'pic.re', url: 'https://pic.re', isRandom: true },
    { name: 'picsum', url: 'https://picsum.photos/800/600', isRandom: true },
    { name: 'neko', url: 'https://api.waifu.pics/sfw/neko', isJson: true },
    { name: 'waifu', url: 'https://api.waifu.pics/sfw/waifu', isJson: true },
    { name: 'dynamic-waifu', url: 'https://api.waifu.pics/sfw/dynamic', isJson: true },
];

// 二次元关键词池
const ANIME_KEYWORDS = [
    'anime girl', 'anime boy', 'sakura', 'neko', 'kawaii',
    'portrait', 'fantasy', 'nature', 'scenery', 'character',
    'cyberpunk', 'forest', 'ocean', 'sunset', 'mountain'
];

// ============ 工具函数 ============
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadIndex() {
    if (fs.existsSync(INDEX_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
        } catch {
            return { images: [], lastUpdated: null };
        }
    }
    return { images: [], lastUpdated: null };
}

function saveIndex(index) {
    index.lastUpdated = new Date().toISOString();
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function addToIndex(filepath, source, keyword) {
    const index = loadIndex();
    const stats = fs.statSync(filepath);
    const imageEntry = {
        id: Date.now(),
        filename: path.basename(filepath),
        path: filepath,
        source: source,
        keyword: keyword || null,
        size: stats.size,
        savedAt: new Date().toISOString()
    };
    index.images.push(imageEntry);
    saveIndex(index);
    return imageEntry;
}

function getRandomKeyword() {
    return ANIME_KEYWORDS[Math.floor(Math.random() * ANIME_KEYWORDS.length)];
}

function getRandomSource() {
    return IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)];
}

function getExtension(contentType, url) {
    if (contentType) {
        if (contentType.includes('png')) return '.png';
        if (contentType.includes('gif')) return '.gif';
        if (contentType.includes('webp')) return '.webp';
        if (contentType.includes('jpeg')) return '.jpg';
    }
    // 从 URL 推断
    if (url.includes('.png')) return '.png';
    if (url.includes('.gif')) return '.gif';
    if (url.includes('.webp')) return '.webp';
    return '.jpg';
}

// ============ 核心下载函数 ============
function downloadImage(source, keyword) {
    return new Promise((resolve, reject) => {
        let targetUrl = source.url;
        let displayName = source.name;

        // 如果源支持关键词，附加关键词参数
        if (keyword && source.isRandom) {
            // 部分源可以用关键词
            targetUrl = `https://pic.re?tag=${encodeURIComponent(keyword)}`;
            displayName = `${source.name} [${keyword}]`;
        }

        console.log(`  → 尝试 ${displayName}...`);

        const protocol = targetUrl.startsWith('https') ? https : http;
        const request = protocol.get(targetUrl, { redirect: true }, (response) => {
            // 处理 JSON 响应 (如 waifu.pics API)
            if (source.isJson || response.headers['content-type']?.includes('application/json')) {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const imageUrl = json.url || json.image;
                        if (imageUrl) {
                            // 递归下载实际图片
                            downloadFromUrl(imageUrl, source.name, keyword).then(resolve).catch(reject);
                        } else {
                            reject(new Error('JSON 无效字段'));
                        }
                    } catch {
                        reject(new Error('JSON 解析失败'));
                    }
                });
                return;
            }

            // 处理图片响应
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            const contentType = response.headers['content-type'];
            const ext = getExtension(contentType, targetUrl);
            const filename = `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}${ext}`;
            const filepath = path.join(OUTPUT_DIR, filename);

            const fileStream = fs.createWriteStream(filepath);
            let downloaded = 0;

            response.on('data', chunk => {
                downloaded += chunk.length;
                fileStream.write(chunk);
            });

            response.on('end', () => {
                fileStream.end();
                if (downloaded < 1000) {
                    // 图片太小可能是错误页
                    fs.unlinkSync(filepath);
                    reject(new Error('图片太小，可能是错误响应'));
                    return;
                }
                console.log(`  ✓ ${displayName}: ${filename} (${(downloaded / 1024).toFixed(1)} KB)`);
                addToIndex(filepath, source.name, keyword);
                resolve({ filename, filepath, source: source.name });
            });

            response.on('error', err => {
                fileStream.end();
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                reject(err);
            });
        });

        request.on('error', reject);
        request.setTimeout(15000, () => {
            request.destroy();
            reject(new Error('请求超时'));
        });
    });
}

function downloadFromUrl(url, sourceName, keyword) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        console.log(`  → 下载实际图片...`);

        const request = protocol.get(url, { redirect: true }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            const contentType = response.headers['content-type'];
            const ext = getExtension(contentType, url);
            const filename = `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}${ext}`;
            const filepath = path.join(OUTPUT_DIR, filename);

            const fileStream = fs.createWriteStream(filepath);
            let downloaded = 0;

            response.on('data', chunk => {
                downloaded += chunk.length;
                fileStream.write(chunk);
            });

            response.on('end', () => {
                fileStream.end();
                console.log(`  ✓ ${sourceName}: ${filename} (${(downloaded / 1024).toFixed(1)} KB)`);
                addToIndex(filepath, sourceName, keyword);
                resolve({ filename, filepath, source: sourceName });
            });

            response.on('error', err => {
                fileStream.end();
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                reject(err);
            });
        });

        request.on('error', reject);
        request.setTimeout(15000, () => {
            request.destroy();
            reject(new Error('下载超时'));
        });
    });
}

// ============ 主函数 ============
async function saveImage(options = {}) {
    const { count = 1, keyword = null, sync = false, interval = DEFAULT_SYNC_INTERVAL } = options;

    ensureDir(OUTPUT_DIR);

    if (sync) {
        console.log(`\n🕐 同步模式：每 ${interval / 60000} 分钟保存一张图片，按 Ctrl+C 停止\n`);
        const run = async () => {
            const kw = getRandomKeyword();
            const source = getRandomSource();
            console.log(`\n[${new Date().toLocaleString()}] 随机选择: ${source.name} | 关键词: ${kw}`);
            try {
                await downloadWithFallback(source, kw);
            } catch (err) {
                console.error(`  ✗ 失败: ${err.message}`);
            }
            setTimeout(run, interval);
        };
        run();
    } else {
        const results = [];
        for (let i = 0; i < count; i++) {
            const kw = keyword || getRandomKeyword();
            const source = getRandomSource();
            console.log(`\n(${i + 1}/${count}) 关键词: ${kw}`);
            try {
                const result = await downloadWithFallback(source, kw);
                results.push({ success: true, ...result });
            } catch (err) {
                console.error(`  ✗ 全部源失败: ${err.message}`);
                results.push({ success: false, error: err.message });
            }
            if (i < count - 1) await new Promise(r => setTimeout(r, REQUEST_INTERVAL));
        }

        // 统计
        const index = loadIndex();
        console.log(`\n========== 完成 ==========`);
        console.log(`本次成功: ${results.filter(r => r.success).length}/${count}`);
        console.log(`图片库总计: ${index.images.length} 张`);
        console.log(`保存位置: ${path.resolve(OUTPUT_DIR)}`);
    }
}

async function downloadWithFallback(preferredSource, keyword) {
    // 按顺序尝试多个源
    const sources = [
        preferredSource,
        ...IMAGE_SOURCES.filter(s => s.name !== preferredSource.name)
    ];

    for (const source of sources) {
        for (let retry = 0; retry < MAX_RETRIES; retry++) {
            try {
                return await downloadImage(source, keyword);
            } catch (err) {
                if (retry < MAX_RETRIES - 1) {
                    console.log(`    重试 (${retry + 1}/${MAX_RETRIES})...`);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
    }
    throw new Error('所有源均失败');
}

// ============ 命令行解析 ============
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { count: 1 };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '-n':
            case '--number':
                options.count = parseInt(args[i + 1]) || 1;
                i++;
                break;
            case '-k':
            case '--keyword':
                options.keyword = args[i + 1];
                i++;
                break;
            case '--sync':
                options.sync = true;
                break;
            case '--interval':
                options.interval = parseInt(args[i + 1]) * 60000 || DEFAULT_SYNC_INTERVAL * 60000;
                i++;
                break;
            case '-h':
            case '--help':
                showHelp();
                process.exit(0);
                break;
            case '--stats':
                showStats();
                process.exit(0);
                break;
            case '--list':
                listImages();
                process.exit(0);
                break;
        }
    }
    return options;
}

function showHelp() {
    console.log(`
用法: node save-image.js [选项]

选项:
  -n, --number <数量>      保存图片数量 (默认: 1)
  -k, --keyword <词>      指定关键词搜索
  --sync                   同步模式（定时保存，默认每天1张）
  --interval <分钟>        同步模式间隔 (默认: 1440分钟=每天)
  --stats                  显示图片库统计
  --list                   列出所有已保存图片
  -h, --help               显示帮助

示例:
  node save-image.js                     # 随机保存 1 张
  node save-image.js -n 10               # 保存 10 张
  node save-image.js -k anime            # 用关键词保存
  node save-image.js --sync              # 每天自动保存1张
  node save-image.js --sync --interval 60 # 每小时自动保存
    `);
}

function showStats() {
    const index = loadIndex();
    console.log('\n========== 图片库统计 ==========');
    console.log(`总计: ${index.images.length} 张`);
    
    // 按源统计
    const bySource = {};
    index.images.forEach(img => {
        bySource[img.source] = (bySource[img.source] || 0) + 1;
    });
    console.log('\n按来源:');
    Object.entries(bySource).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
    });

    // 总大小
    const totalSize = index.images.reduce((sum, img) => sum + (img.size || 0), 0);
    console.log(`\n总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`最后更新: ${index.lastUpdated || '无'}\n`);
}

function listImages() {
    const index = loadIndex();
    console.log('\n========== 已保存图片 ==========');
    if (index.images.length === 0) {
        console.log('(空)');
    } else {
        index.images.slice(-20).reverse().forEach(img => {
            console.log(`  ${img.filename} | ${img.source} | ${(img.size / 1024).toFixed(1)} KB`);
        });
    }
    console.log();
}

// ============ 启动 ============
const options = parseArgs();
saveImage(options).catch(console.error);
