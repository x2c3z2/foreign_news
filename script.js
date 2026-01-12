/**
 * Global News Hub - Real RSS Feed Integration
 * Fetches live news from international media sources
 * Using RSSHub as primary source for better reliability
 */

// RSS Feed Sources Configuration - Using RSSHub for most reliable access
const RSS_FEEDS = {
    bloomberg: {
        name: '彭博社',
        icon: '📈',
        color: 'bloomberg',
        tag: '财经热点',
        feeds: [
            'https://rsshub.app/bloomberg',
            'https://rsshub.app/bloomberg/markets',
            'https://feeds.bloomberg.com/markets/news.rss'
        ]
    },
    reuters: {
        name: '路透社',
        icon: '📡',
        color: 'reuters', 
        tag: '国际快讯',
        feeds: [
            'https://rsshub.app/reuters/world',
            'https://rsshub.app/reuters/theWire',
            'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best'
        ]
    },
    ap: {
        name: '美联社',
        icon: '📰',
        color: 'ap',
        tag: '今日焦点',
        feeds: [
            'https://rsshub.app/apnews/topics/apf-topnews',
            'https://rsshub.app/apnews/topics/world-news'
        ]
    },
    rfi: {
        name: '法广',
        icon: '📻',
        color: 'rfi',
        tag: '国际视角',
        feeds: [
            'https://rsshub.app/rfi/cn',
            'https://www.rfi.fr/cn/rss'
        ]
    },
    ft: {
        name: '金融时报',
        icon: '📊',
        color: 'ft',
        tag: '深度分析',
        feeds: [
            'https://rsshub.app/ft/chinese/hotstoryby7day',
            'https://rsshub.app/ft/chinese/news'
        ]
    },
    wsj: {
        name: '华尔街日报',
        icon: '💹',
        color: 'wsj',
        tag: '财经热榜',
        feeds: [
            'https://rsshub.app/wsj/en-us/world_news',
            'https://feeds.a]dowjones.io/public/rss/RSSWorldNews'
        ]
    },
    nikkei: {
        name: '日经中文网',
        icon: '🗾',
        color: 'nikkei',
        tag: '亚洲视野',
        feeds: [
            'https://rsshub.app/nikkei/cn/top',
            'https://rsshub.app/nikkei/cn'
        ]
    },
    zaobao: {
        name: '联合早报',
        icon: '🦁',
        color: 'zaobao',
        tag: '东南亚',
        feeds: [
            'https://rsshub.app/zaobao/realtime/china',
            'https://rsshub.app/zaobao/realtime/world'
        ]
    }
};

// CORS Proxy options (multiple fallbacks)
const CORS_PROXIES = [
    '', // Try direct first (for RSSHub which has CORS enabled)
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
];

/**
 * Fetch RSS feed with timeout and error handling
 */
async function fetchRSS(url, timeout = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.text();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Fetch with CORS proxy fallback
 */
async function fetchWithProxy(url) {
    for (const proxy of CORS_PROXIES) {
        try {
            const fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
            const result = await fetchRSS(fetchUrl);
            return result;
        } catch (error) {
            console.warn(`Proxy failed for ${url}:`, error.message);
            continue;
        }
    }
    throw new Error('All proxies failed');
}

/**
 * Parse RSS XML and extract news items
 */
function parseRSS(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parse errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Failed to parse RSS XML');
    }
    
    const items = [];
    
    // Try RSS 2.0 format first
    let itemElements = xmlDoc.querySelectorAll('item');
    
    // Try Atom format if RSS 2.0 not found
    if (itemElements.length === 0) {
        itemElements = xmlDoc.querySelectorAll('entry');
    }
    
    itemElements.forEach((item, index) => {
        if (index >= 8) return; // Limit to 8 items
        
        // Get title (RSS 2.0 or Atom)
        const titleEl = item.querySelector('title');
        let title = titleEl ? titleEl.textContent.trim() : '';
        
        // Clean up title (remove CDATA if present)
        title = title.replace(/^\s*<!\[CDATA\[(.*)\]\]>\s*$/s, '$1').trim();
        
        // Get link (RSS 2.0 or Atom)
        let link = '';
        const linkEl = item.querySelector('link');
        if (linkEl) {
            link = linkEl.getAttribute('href') || linkEl.textContent.trim();
        }
        
        // Get description
        const descEl = item.querySelector('description, summary, content');
        let description = descEl ? descEl.textContent.trim() : '';
        description = description.replace(/^\s*<!\[CDATA\[(.*)\]\]>\s*$/s, '$1').trim();
        
        // Get publication date
        const pubDateEl = item.querySelector('pubDate, published, updated, date');
        let pubDate = new Date();
        if (pubDateEl) {
            try {
                pubDate = new Date(pubDateEl.textContent);
            } catch (e) {}
        }
        
        if (title) {
            items.push({
                title,
                link,
                description,
                pubDate,
                isHot: index < 3 // Mark first 3 as hot
            });
        }
    });
    
    return items;
}

/**
 * Format time ago
 */
function formatTimeAgo(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return '刚刚更新';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) return '刚刚更新';
    if (diffMins < 1) return '刚刚更新';
    if (diffMins < 60) return `${diffMins}分钟前更新`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前更新`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}天前更新`;
}

/**
 * Generate random heat value for display
 */
function generateHeat(index) {
    const baseHeat = [1200000, 850000, 620000, 450000, 320000, 210000, 150000, 95000];
    const heat = baseHeat[index] || 50000;
    const variation = Math.floor(Math.random() * (heat * 0.3));
    return heat + variation - (heat * 0.15);
}

/**
 * Format heat number
 */
function formatHeat(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return Math.floor(num / 1000) + 'K';
    }
    return num.toString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create HTML for a news card
 */
function createNewsCard(sourceKey, config, items, updateTime) {
    const newsListHtml = items.map((item, index) => {
        const hotClass = item.isHot ? 'hot' : '';
        const heatHtml = item.isHot ? `<span class="item-heat">${formatHeat(generateHeat(index))}</span>` : '';
        
        return `
            <li class="news-item ${hotClass}" data-link="${escapeHtml(item.link || '')}">
                <span class="item-rank">${index + 1}</span>
                <span class="item-title">${escapeHtml(item.title)}</span>
                ${heatHtml}
            </li>
        `;
    }).join('');
    
    const tagClass = config.tag.includes('热') ? 'hot' : '';
    
    return `
        <article class="news-card" data-source="${sourceKey}">
            <div class="card-header ${config.color}">
                <div class="source-info">
                    <span class="source-icon">${config.icon}</span>
                    <span class="source-name">${config.name}</span>
                    <span class="source-tag ${tagClass}">${config.tag}</span>
                </div>
                <span class="update-time">${updateTime}</span>
            </div>
            <ul class="news-list">
                ${newsListHtml}
            </ul>
        </article>
    `;
}

/**
 * Create loading skeleton card
 */
function createSkeletonCard(sourceKey, config) {
    const skeletonItems = Array(8).fill(0).map((_, index) => `
        <li class="news-item skeleton-item">
            <span class="item-rank">${index + 1}</span>
            <span class="item-title skeleton"></span>
        </li>
    `).join('');
    
    return `
        <article class="news-card" data-source="${sourceKey}">
            <div class="card-header ${config.color}">
                <div class="source-info">
                    <span class="source-icon">${config.icon}</span>
                    <span class="source-name">${config.name}</span>
                    <span class="source-tag">${config.tag}</span>
                </div>
                <span class="update-time">加载中...</span>
            </div>
            <ul class="news-list">
                ${skeletonItems}
            </ul>
        </article>
    `;
}

/**
 * Create error card
 */
function createErrorCard(sourceKey, config, errorMsg) {
    return `
        <article class="news-card error" data-source="${sourceKey}">
            <div class="card-header ${config.color}">
                <div class="source-info">
                    <span class="source-icon">${config.icon}</span>
                    <span class="source-name">${config.name}</span>
                    <span class="source-tag">加载失败</span>
                </div>
                <span class="update-time">点击重试</span>
            </div>
            <div class="error-message">
                <p>⚠️ 无法加载新闻</p>
                <p class="error-detail">${escapeHtml(errorMsg)}</p>
                <button class="retry-btn" onclick="retryFeed('${sourceKey}')">重新加载</button>
            </div>
        </article>
    `;
}

/**
 * Fetch and render a single news source
 */
async function fetchAndRenderSource(sourceKey) {
    const config = RSS_FEEDS[sourceKey];
    const cardElement = document.querySelector(`[data-source="${sourceKey}"]`);
    
    if (!cardElement) return false;
    
    let lastError = null;
    
    // Try each feed URL
    for (const feedUrl of config.feeds) {
        try {
            console.log(`📡 Fetching ${config.name} from ${feedUrl}...`);
            const xmlText = await fetchWithProxy(feedUrl);
            const items = parseRSS(xmlText);
            
            if (items.length === 0) {
                throw new Error('No items found in feed');
            }
            
            // Get the latest item's date for update time
            const latestDate = items[0]?.pubDate || new Date();
            const updateTime = formatTimeAgo(latestDate);
            
            // Replace the card with the new content
            const newCard = createNewsCard(sourceKey, config, items, updateTime);
            cardElement.outerHTML = newCard;
            
            // Re-attach click handlers
            initNewsItemClickHandlers(sourceKey);
            
            console.log(`✅ ${config.name}: Loaded ${items.length} items`);
            return true;
            
        } catch (error) {
            console.warn(`❌ Failed to fetch ${config.name} from ${feedUrl}:`, error.message);
            lastError = error;
        }
    }
    
    // All attempts failed
    const errorCard = createErrorCard(sourceKey, config, lastError?.message || 'Unknown error');
    cardElement.outerHTML = errorCard;
    console.error(`❌ ${config.name}: All fetch attempts failed`);
    return false;
}

/**
 * Retry fetching a specific feed
 */
window.retryFeed = async function(sourceKey) {
    const config = RSS_FEEDS[sourceKey];
    const cardElement = document.querySelector(`[data-source="${sourceKey}"]`);
    
    // Show loading state
    cardElement.outerHTML = createSkeletonCard(sourceKey, config);
    
    await fetchAndRenderSource(sourceKey);
};

/**
 * Initialize click handlers for news items in a specific card
 */
function initNewsItemClickHandlers(sourceKey) {
    const cardElement = document.querySelector(`[data-source="${sourceKey}"]`);
    if (!cardElement) return;
    
    const newsItems = cardElement.querySelectorAll('.news-item');
    newsItems.forEach(item => {
        item.addEventListener('click', () => {
            const link = item.dataset.link;
            if (link && link !== 'undefined' && link !== '') {
                window.open(link, '_blank');
            }
        });
    });
}

/**
 * Initialize all news cards with loading state
 */
function initializeCards() {
    const cardsGrid = document.querySelector('.cards-grid');
    
    // Create skeleton cards for all sources
    const skeletonCards = Object.entries(RSS_FEEDS).map(([key, config]) => 
        createSkeletonCard(key, config)
    ).join('');
    
    cardsGrid.innerHTML = skeletonCards;
}

/**
 * Fetch all news sources
 */
async function fetchAllSources() {
    console.log('🌐 Fetching news from all sources...');
    
    // Fetch all sources in parallel
    const fetchPromises = Object.keys(RSS_FEEDS).map(sourceKey => 
        fetchAndRenderSource(sourceKey)
    );
    
    const results = await Promise.allSettled(fetchPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - successful;
    
    console.log(`📊 Fetch complete: ${successful} succeeded, ${failed} failed`);
    
    // Update footer with timestamp
    updateFooter();
}

/**
 * Update footer with current time
 */
function updateFooter() {
    const footer = document.querySelector('.footer p');
    if (footer) {
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        footer.textContent = `数据来源于各媒体 RSS (via RSSHub) · 最后更新：${timeStr}`;
    }
}

/**
 * Add skeleton animation styles
 */
function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .skeleton {
            background: linear-gradient(
                90deg,
                var(--bg-tertiary) 25%,
                var(--bg-secondary) 50%,
                var(--bg-tertiary) 75%
            );
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
            min-height: 1em;
            display: inline-block;
            width: 80%;
        }
        
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        .skeleton-item .item-title {
            width: 100%;
        }
        
        .error-message {
            padding: 20px;
            text-align: center;
            color: var(--text-secondary);
        }
        
        .error-message p {
            margin: 8px 0;
        }
        
        .error-detail {
            font-size: 0.75rem;
            color: var(--text-muted);
        }
        
        .retry-btn {
            margin-top: 12px;
            padding: 8px 16px;
            background: var(--accent-blue);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            transition: all 0.2s ease;
        }
        
        .retry-btn:hover {
            background: #4d9aef;
            transform: translateY(-1px);
        }
        
        .news-item {
            cursor: pointer;
        }
        
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Initialize navigation
 */
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Refresh all feeds when clicking on "实时"
            if (link.textContent.trim() === '实时') {
                initializeCards();
                fetchAllSources();
            }
        });
    });
}

/**
 * Auto-refresh every 5 minutes
 */
function setupAutoRefresh() {
    setInterval(() => {
        console.log('⏰ Auto-refreshing news...');
        fetchAllSources();
    }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Initialize the application
 */
async function init() {
    console.log('🌐 Global News Hub - Initializing...');
    console.log('📡 Using RSSHub as primary RSS source for better reliability');
    
    addStyles();
    initNavigation();
    initializeCards();
    
    // Start fetching real data
    await fetchAllSources();
    
    // Setup auto-refresh
    setupAutoRefresh();
    
    console.log('✅ Initialization complete');
}

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
