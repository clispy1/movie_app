const API_KEY = "fcf2233bcea67f1b4a068f62804d1ecb";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_PATH = "https://image.tmdb.org/t/p/w1280";
const POSTER_PATH = "https://image.tmdb.org/t/p/w500";
const CAST_PATH = "https://image.tmdb.org/t/p/w185";

let currentPage = 1;
let currentSearch = "";
let currentGenre = "all";
let sortBy = "popularity.desc";
let mediaType = "movie"; // 'movie' or 'tv'
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed')) || [];
let searchTimeout;
let isFetching = false;
let hasMoreMovies = true;

// DOM Elements
const main = document.getElementById("main");
const searchInput = document.getElementById("searchfield");
const resultsCount = document.querySelector(".results");
const genresContainer = document.getElementById("genres-container");
const heroSection = document.getElementById("hero");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const closeModal = document.querySelector(".close-modal");

// Controls
const safesearch = document.getElementById("safesearch");
const sortBySelect = document.getElementById("sort-by");
const filterYear = document.getElementById("filter-year");
const filterRating = document.getElementById("filter-rating");
const btnMovie = document.getElementById("toggle-movie");
const btnTv = document.getElementById("toggle-tv");
const filtersBtn = document.getElementById("filters-btn");
const filtersDropdown = document.getElementById("filters-dropdown");
const watchlistStats = document.getElementById("watchlist-stats");

// Create Intersection Observer for Infinite Scroll
const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isFetching && hasMoreMovies && currentGenre !== "watchlist") {
        currentPage++;
        loadMovies(true);
    }
}, observerOptions);

const scrollTrigger = document.createElement('div');
scrollTrigger.id = "scroll-trigger";
scrollTrigger.style.height = "20px";
scrollTrigger.style.width = "100%";

init();

async function init() {
    main.parentNode.insertBefore(scrollTrigger, main.nextSibling);
    await fetchGenres();
    loadMovies();
    setupEventListeners();
    setupParallax();
    setupEliteEffects();
    setupKeyboardNav();
    renderRecentlyViewed();
}

// =====================
// ELITE EFFECTS SETUP
// =====================
function setupEliteEffects() {
    const spotlight = document.getElementById('cursor-spotlight');
    const progressBar = document.getElementById('scroll-progress');

    // Cursor Spotlight
    document.addEventListener('mousemove', (e) => {
        spotlight.style.left = e.clientX + 'px';
        spotlight.style.top = e.clientY + 'px';
        // Update spotlight color to match dynamic glow
        const glow = getComputedStyle(document.documentElement).getPropertyValue('--dynamic-glow').trim();
        spotlight.style.background = `radial-gradient(circle, ${glow}18 0%, transparent 70%)`;
    });

    // Scroll Progress Bar
    const scrollArea = document.querySelector('.main-content');
    if (scrollArea) {
        scrollArea.addEventListener('scroll', () => {
            const scrolled = scrollArea.scrollTop;
            const total = scrollArea.scrollHeight - scrollArea.clientHeight;
            const pct = total > 0 ? (scrolled / total) * 100 : 0;
            progressBar.style.width = pct + '%';
        });
    } else {
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            const total = document.body.scrollHeight - window.innerHeight;
            const pct = total > 0 ? (scrolled / total) * 100 : 0;
            progressBar.style.width = pct + '%';
        });
    }
}

// Keyboard Navigation
function setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
        const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

        // Press '/' to focus search
        if (e.key === '/' && !isTyping) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }

        // Escape to close modal or blur search
        if (e.key === 'Escape') {
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
                const iframe = modal.querySelector('iframe');
                if (iframe) iframe.src = iframe.src;
            } else if (document.activeElement === searchInput) {
                searchInput.blur();
            }
        }
    });
}

// Recently Viewed
function trackRecentlyViewed(item, title, date) {
    // Remove if already exists
    recentlyViewed = recentlyViewed.filter(r => !(r.id === item.id && r.mediaType === mediaType));
    // Add to front
    recentlyViewed.unshift({
        id: item.id,
        title: title,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        date: date,
        mediaType: mediaType
    });
    // Keep max 12 items
    recentlyViewed = recentlyViewed.slice(0, 12);
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    const section = document.getElementById('recently-viewed-section');
    const list = document.getElementById('recently-viewed-list');
    if (!section || !list) return;

    if (recentlyViewed.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    list.innerHTML = recentlyViewed.map(item => `
        <div class="similar-card" onclick="openDetails(${item.id})" style="min-width: 130px;">
            <img 
                src="${item.poster_path ? POSTER_PATH + item.poster_path : 'https://via.placeholder.com/200x300'}" 
                alt="${item.title}"
                loading="lazy"
                onload="this.classList.add('loaded')"
            >
            <div class="similar-title">${item.title}</div>
        </div>
    `).join('');
}

// Enhanced Fetch with SessionStorage Caching
async function fetchWithCache(url, cacheKey) {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}

function showErrorState(message = "Oops! Something went wrong while loading content. Please check your connection.") {
    main.innerHTML = `
        <div class="error-boundary" style="grid-column: 1/-1; text-align: center; padding: 4rem; background: var(--surface-color); border-radius: var(--border-radius); border: 1px solid var(--danger-color);">
            <h2 style="color: var(--danger-color); margin-bottom: 1rem;">Connection Issue</h2>
            <p style="color: var(--text-muted);">${message}</p>
            <button class="btn-primary" onclick="loadMovies()" style="margin-top: 1.5rem;">Try Again</button>
        </div>
    `;
    isFetching = false;
}

async function fetchGenres() {
    try {
        const data = await fetchWithCache(`${BASE_URL}/genre/${mediaType}/list?api_key=${API_KEY}`, `genres_${mediaType}`);
        renderGenres(data.genres);
    } catch (err) {
        // Fallback silently or show minimal error
        genresContainer.innerHTML = '<p style="color:var(--text-muted); font-size: 0.8rem;">Genres unavailable</p>';
    }
}

function renderGenres(genres) {
    genresContainer.innerHTML = genres.map(genre => `
        <div class="genre-item" data-id="${genre.id}">
            <span>${genre.name}</span>
        </div>
    `).join('');

    document.querySelectorAll('.genre-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.genre-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentGenre = item.dataset.id;
            currentSearch = "";
            searchInput.value = "";
            currentPage = 1;
            hasMoreMovies = true;
            loadMovies();
        });
    });
}

function showSkeletons(append = false) {
    const skeletons = Array(12).fill(0).map(() => `
        <div class="movie skeleton" style="height: 350px;"></div>
    `).join('');

    if (append) main.insertAdjacentHTML('beforeend', skeletons);
    else main.innerHTML = skeletons;
}

async function loadMovies(append = false) {
    if (isFetching || (!hasMoreMovies && append)) return;
    isFetching = true;

    const isAdult = safesearch.value === "true";
    const year = filterYear.value;
    const minRating = filterRating.value;

    if (currentGenre === "watchlist") {
        displayWatchlist();
        isFetching = false;
        return;
    }

    watchlistStats.style.display = 'none';
    showSkeletons(append);

    let url = "";
    if (currentSearch) {
        url = `${BASE_URL}/search/${mediaType}?api_key=${API_KEY}&query=${currentSearch}&page=${currentPage}&include_adult=${isAdult}`;
    } else {
        url = `${BASE_URL}/discover/${mediaType}?api_key=${API_KEY}&page=${currentPage}&include_adult=${isAdult}&sort_by=${sortBy}`;
        if (currentGenre !== "all") url += `&with_genres=${currentGenre}`;

        // Advanced Filters
        if (year) {
            url += mediaType === 'movie' ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`;
        }
        if (minRating) {
            url += `&vote_average.gte=${minRating}`;
        }
    }

    try {
        const cacheKey = `data_${mediaType}_${currentSearch}_${currentGenre}_${sortBy}_p${currentPage}_${isAdult}_y${year}_r${minRating}`;
        const data = await fetchWithCache(url, cacheKey);

        if (currentPage === 1 && !currentSearch && currentGenre === "all" && !append && !year && !minRating) {
            renderHero(data.results[0]);
            heroSection.style.display = "flex";
        } else if ((currentSearch || currentGenre !== "all" || year || minRating) && !append) {
            heroSection.style.display = "none";
        }

        hasMoreMovies = currentPage < data.total_pages;
        displayMovies(data.results, append);
        resultsCount.innerText = data.total_results || 0;

    } catch (err) {
        showErrorState();
    } finally {
        isFetching = false;
    }
}

// 🎨 Dynamic Color Extraction
function extractDominantColor(imgUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 50; canvas.height = 50; // Downsample for speed
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 50, 50);

            try {
                const data = ctx.getImageData(0, 0, 50, 50).data;
                let r = 0, g = 0, b = 0, count = 0;

                // Sample pixels, skipping a few for performance
                for (let i = 0; i < data.length; i += 16) {
                    r += data[i]; g += data[i + 1]; b += data[i + 2];
                    count++;
                }

                r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
                resolve(`rgb(${r}, ${g}, ${b})`);
            } catch (e) {
                resolve('#6c5ce7'); // Fallback primary color
            }
        };
        img.onerror = () => resolve('#6c5ce7');
        img.src = imgUrl;
    });
}

async function renderHero(item) {
    if (!item) return;

    try {
        const cacheKey = `videos_${mediaType}_${item.id}`;
        const videos = await fetchWithCache(`${BASE_URL}/${mediaType}/${item.id}/videos?api_key=${API_KEY}`, cacheKey);
        const trailer = videos.results.find(v => v.type === "Trailer" && v.site === "YouTube");

        const bgUrl = IMG_PATH + item.backdrop_path;
        heroSection.style.backgroundImage = `url(${bgUrl})`;

        // Apply Dynamic Color
        const dynamicColor = await extractDominantColor(bgUrl);
        document.documentElement.style.setProperty('--dynamic-glow', dynamicColor);

        const title = mediaType === 'movie' ? item.title : item.name;
        const date = mediaType === 'movie' ? item.release_date : item.first_air_date;

        heroSection.innerHTML = `
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <h1 class="hero-title">${title}</h1>
                <div class="hero-meta">
                    <span>⭐ ${item.vote_average.toFixed(1)}</span>
                    <span>📅 ${date ? date.split('-')[0] : 'N/A'}</span>
                    <span style="background: var(--dynamic-glow); color: white; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: bold;">
                        ${mediaType === 'movie' ? 'MOVIE' : 'TV SHOW'}
                    </span>
                </div>
                <div class="hero-buttons" style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button class="btn-primary" onclick="openDetails(${item.id})">View Details</button>
                    ${trailer ? `<button class="btn-secondary" onclick="openDetails(${item.id}, true)">Watch Trailer</button>` : ''}
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Error rendering hero:", err);
    }
}

function displayMovies(items, append = false) {
    if (!append) main.innerHTML = "";

    if (append) {
        document.querySelectorAll('.skeleton').forEach(el => el.remove());
    }

    if (!append && (!items || items.length === 0)) {
        main.innerHTML = `<h2 class="no-results" style="grid-column: 1/-1;">No results found</h2>`;
        observer.unobserve(scrollTrigger);
        return;
    }

    items.forEach((item, index) => {
        const title = mediaType === 'movie' ? item.title : item.name;
        const date = mediaType === 'movie' ? item.release_date : item.first_air_date;
        const { id, poster_path, vote_average } = item;

        const card = document.createElement("div");
        card.classList.add("movie");
        // Staggered entrance: cap at 400ms so the 50th card doesn't wait 8 seconds
        card.style.animationDelay = `${Math.min(index * 40, 400)}ms`;
        card.innerHTML = `
            <img 
                src="${poster_path ? POSTER_PATH + poster_path : 'https://via.placeholder.com/500x750?text=No+Poster'}" 
                alt="${title}"
                loading="lazy"
                onload="this.classList.add('loaded')"
            >
            <div class="movie-info">
                <h3>${title}</h3>
                <div class="movie-meta">
                    <span class="rating-badge">${vote_average.toFixed(1)}</span>
                    <span>${date ? date.split('-')[0] : 'N/A'}</span>
                </div>
            </div>
        `;

        // 💫 3D Tilt Effect
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xPct = (x / rect.width - 0.5) * 2;
            const yPct = (y / rect.height - 0.5) * 2;
            card.style.transform = `perspective(1000px) rotateX(${-yPct * 15}deg) rotateY(${xPct * 15}deg) scale3d(1.05, 1.05, 1.05)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        });

        card.addEventListener('click', () => openDetails(id));
        main.appendChild(card);
    });

    if (hasMoreMovies) observer.observe(scrollTrigger);
    else observer.unobserve(scrollTrigger);
}

// Stats Dashboard
function calculateStats() {
    if (watchlist.length === 0) return { count: 0, rating: '0.0' };

    const count = watchlist.length;
    const avgRating = watchlist.reduce((acc, curr) => acc + curr.vote_average, 0) / count;

    return { count, rating: avgRating.toFixed(1) };
}

function displayWatchlist() {
    heroSection.style.display = "none";
    observer.unobserve(scrollTrigger);
    displayMovies(watchlist);
    resultsCount.innerText = watchlist.length;

    // Show and update stats
    const stats = calculateStats();
    document.getElementById('stat-count').innerText = stats.count;
    document.getElementById('stat-rating').innerText = `⭐ ${stats.rating}`;
    watchlistStats.style.display = 'flex';
}

async function openDetails(id, scrollToTrailer = false) {
    try {
        const itemKey = `detail_${mediaType}_${id}`;
        const creditsKey = `credits_${mediaType}_${id}`;
        const videosKey = `videos_${mediaType}_${id}`;
        const similarKey = `similar_${mediaType}_${id}`;

        const [item, credits, videos, similar] = await Promise.all([
            fetchWithCache(`${BASE_URL}/${mediaType}/${id}?api_key=${API_KEY}`, itemKey),
            fetchWithCache(`${BASE_URL}/${mediaType}/${id}/credits?api_key=${API_KEY}`, creditsKey),
            fetchWithCache(`${BASE_URL}/${mediaType}/${id}/videos?api_key=${API_KEY}`, videosKey),
            fetchWithCache(`${BASE_URL}/${mediaType}/${id}/similar?api_key=${API_KEY}`, similarKey)
        ]);

        const trailer = videos.results.find(v => v.type === "Trailer" && v.site === "YouTube");
        const inWatchlist = watchlist.some(m => m.id === item.id && m.mediaType === mediaType);

        const title = mediaType === 'movie' ? item.title : item.name;
        const date = mediaType === 'movie' ? item.release_date : item.first_air_date;
        const duration = mediaType === 'movie' ? `${item.runtime} min` : `${item.number_of_seasons} Seasons`;

        // Track this view in recently viewed
        trackRecentlyViewed(item, title, date);

        modalBody.innerHTML = `
            <div class="modal-main">
                <div class="modal-sidebar">
                    <img src="${item.poster_path ? POSTER_PATH + item.poster_path : 'https://via.placeholder.com/500x750'}" alt="${title}">
                    <div class="modal-actions" style="margin-top: 2rem;">
                        <button class="btn-primary" id="watchlist-btn" style="width: 100%;">
                            ${inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        </button>
                    </div>
                </div>
                <div class="modal-info">
                    <h2>${title}</h2>
                    <div class="hero-meta">
                        <span>⭐ ${item.vote_average.toFixed(1)}</span>
                        <span>🕒 ${duration}</span>
                        <span>📅 ${date}</span>
                    </div>
                    <div class="genre-tags">
                        ${item.genres.map(g => `<span class="tag">${g.name}</span>`).join('')}
                    </div>
                    <p class="modal-overview">${item.overview}</p>
                    
                    ${trailer ? `
                        <div class="trailer-section" id="trailer-top">
                            <p class="section-title-sm">Watch Trailer</p>
                            <div class="trailer-container">
                                <iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>
                            </div>
                        </div>
                    ` : ''}

                    <div class="cast-section">
                        <p class="section-title-sm">Top Cast</p>
                        <div class="horizontal-scroll">
                            ${credits.cast.slice(0, 10).map(person => `
                                <div class="cast-card">
                                    <img 
                                        class="cast-img" 
                                        src="${person.profile_path ? CAST_PATH + person.profile_path : 'https://via.placeholder.com/150'}" 
                                        alt="${person.name}"
                                        loading="lazy"
                                        onload="this.classList.add('loaded')"
                                    >
                                    <span class="cast-name">${person.name}</span>
                                    <span class="cast-role">${person.character}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="similar-section">
                        <p class="section-title-sm">Similar ${mediaType === 'movie' ? 'Movies' : 'Shows'}</p>
                        <div class="horizontal-scroll">
                            ${similar.results.slice(0, 10).map(m => {
            const mTitle = mediaType === 'movie' ? m.title : m.name;
            return `
                                <div class="similar-card" onclick="openDetails(${m.id})">
                                    <img 
                                        src="${m.poster_path ? POSTER_PATH + m.poster_path : 'https://via.placeholder.com/200x300'}" 
                                        alt="${mTitle}"
                                        loading="lazy"
                                        onload="this.classList.add('loaded')"
                                    >
                                    <div class="similar-title">${mTitle}</div>
                                </div>
                                `
        }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('watchlist-btn').onclick = () => toggleWatchlist(item, title, date);
        modal.style.display = "flex";

        if (scrollToTrailer && trailer) {
            setTimeout(() => {
                const trailerEl = document.getElementById('trailer-top');
                if (trailerEl) trailerEl.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } else {
            setTimeout(() => modal.scrollTop = 0, 10);
        }
    } catch (err) {
        modalBody.innerHTML = `<h2 class="no-results" style="color:var(--danger-color)">Failed to load details.</h2>`;
        modal.style.display = "flex";
    }
}

function toggleWatchlist(item, title, date) {
    const index = watchlist.findIndex(m => m.id === item.id && m.mediaType === mediaType);
    if (index > -1) {
        watchlist.splice(index, 1);
    } else {
        watchlist.push({
            id: item.id,
            title: title,
            name: title, // Handle both
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            release_date: date,
            first_air_date: date,
            mediaType: mediaType
        });
    }
    localStorage.setItem('watchlist', JSON.stringify(watchlist));

    const btn = document.getElementById('watchlist-btn');
    const inWatchlist = watchlist.some(m => m.id === item.id && m.mediaType === mediaType);
    btn.innerText = inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist';

    if (currentGenre === "watchlist") displayWatchlist();
}

// Scrolling Parallax for Hero
function setupParallax() {
    window.addEventListener('scroll', () => {
        if (heroSection && heroSection.style.display !== 'none') {
            const scrollPos = window.scrollY;
            heroSection.style.backgroundPosition = `center ${scrollPos * 0.4}px`;
        }
    });
}

function setupEventListeners() {
    // TV / Movie Toggle
    btnMovie.onclick = () => switchMediaType('movie', btnMovie, btnTv);
    btnTv.onclick = () => switchMediaType('tv', btnTv, btnMovie);

    function switchMediaType(type, activeBtn, inactiveBtn) {
        if (mediaType === type) return;
        mediaType = type;
        activeBtn.classList.add('active');
        inactiveBtn.classList.remove('active');
        currentPage = 1;
        hasMoreMovies = true;
        currentSearch = searchInput.value;
        fetchGenres(); // Reload genres for TV
        loadMovies();
    }

    searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value;
            currentPage = 1;
            hasMoreMovies = true;
            loadMovies();
        }, 500);
    });

    sortBySelect.onchange = (e) => {
        sortBy = e.target.value;
        currentPage = 1;
        hasMoreMovies = true;
        loadMovies();
    };

    // Advanced Filters Toggle & Inputs
    filtersBtn.onclick = () => {
        filtersDropdown.classList.toggle('hidden');
    };

    const triggerFilterUpdate = () => {
        currentPage = 1;
        hasMoreMovies = true;
        loadMovies();
    };

    filterYear.addEventListener('change', triggerFilterUpdate);
    filterRating.addEventListener('change', triggerFilterUpdate);
    safesearch.addEventListener('change', triggerFilterUpdate);

    // Close Dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!filtersBtn.contains(e.target) && !filtersDropdown.contains(e.target)) {
            filtersDropdown.classList.add('hidden');
        }
    });

    closeModal.onclick = () => {
        modal.style.display = "none";
        // Stop trailer playback
        const iframe = modal.querySelector('iframe');
        if (iframe) iframe.src = iframe.src;
    };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
            const iframe = modal.querySelector('iframe');
            if (iframe) iframe.src = iframe.src;
        }
    };

    document.querySelector('[data-genre="all"]').onclick = (e) => {
        e.preventDefault();
        currentGenre = "all";
        currentSearch = "";
        searchInput.value = "";
        filterYear.value = "";
        filterRating.value = "";
        currentPage = 1;
        hasMoreMovies = true;
        loadMovies();
    };

    document.querySelector('[data-genre="watchlist"]').onclick = (e) => {
        e.preventDefault();
        currentGenre = "watchlist";
        loadMovies();
    };
}
