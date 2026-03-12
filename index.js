const API_KEY = "fcf2233bcea67f1b4a068f62804d1ecb";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_PATH = "https://image.tmdb.org/t/p/w1280";
const POSTER_PATH = "https://image.tmdb.org/t/p/w500";
const CAST_PATH = "https://image.tmdb.org/t/p/w185";

let currentPage = 1;
let currentSearch = "";
let currentGenre = "all";
let sortBy = "popularity.desc";
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
let searchTimeout;
let isFetching = false;
let hasMoreMovies = true;

// DOM Elements
const main = document.getElementById("main");
const form = document.getElementById("form");
const searchInput = document.getElementById("searchfield");
const resultsCount = document.querySelector(".results");
const genresContainer = document.getElementById("genres-container");
const heroSection = document.getElementById("hero");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const closeModal = document.querySelector(".close-modal");
const safesearch = document.getElementById("safesearch");
const sortBySelect = document.getElementById("sort-by");

// Create Intersection Observer for Infinite Scroll
const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isFetching && hasMoreMovies && currentGenre !== "watchlist") {
        currentPage++;
        loadMovies(true);
    }
}, observerOptions);

// Add infinite scroll trigger point
const scrollTrigger = document.createElement('div');
scrollTrigger.id = "scroll-trigger";
scrollTrigger.style.height = "20px";
scrollTrigger.style.width = "100%";

init();

async function init() {
    // Remove pagination controls as we use infinite scroll
    const pagination = document.querySelector('.pagination-container');
    if (pagination) pagination.style.display = 'none';

    // Insert scroll trigger after main but inside the main-content wrapper
    main.parentNode.insertBefore(scrollTrigger, main.nextSibling);

    await fetchGenres();
    loadMovies();
    setupEventListeners();
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

function showErrorState(message = "Oops! Something went wrong while loading movies. Please check your connection.") {
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
        const data = await fetchWithCache(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`, 'genres_list');
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

    if (append) {
        main.insertAdjacentHTML('beforeend', skeletons);
    } else {
        main.innerHTML = skeletons;
    }
}

async function loadMovies(append = false) {
    if (isFetching || (!hasMoreMovies && append)) return;
    isFetching = true;

    const isAdult = safesearch.value === "true";

    if (currentGenre === "watchlist") {
        displayWatchlist();
        isFetching = false;
        return;
    }

    showSkeletons(append);

    let url = "";
    if (currentSearch) {
        url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${currentSearch}&page=${currentPage}&include_adult=${isAdult}`;
    } else {
        url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&page=${currentPage}&include_adult=${isAdult}&sort_by=${sortBy}`;
        if (currentGenre !== "all") url += `&with_genres=${currentGenre}`;
    }

    try {
        const cacheKey = `movies_${currentSearch}_${currentGenre}_${sortBy}_p${currentPage}_${isAdult}`;
        const data = await fetchWithCache(url, cacheKey);

        if (currentPage === 1 && !currentSearch && currentGenre === "all" && !append) {
            renderHero(data.results[0]);
            heroSection.style.display = "flex";
        } else if ((currentSearch || currentGenre !== "all") && !append) {
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

async function renderHero(movie) {
    if (!movie) return;

    try {
        const cacheKey = `videos_${movie.id}`;
        const videos = await fetchWithCache(`${BASE_URL}/movie/${movie.id}/videos?api_key=${API_KEY}`, cacheKey);
        const trailer = videos.results.find(v => v.type === "Trailer" && v.site === "YouTube");

        heroSection.style.backgroundImage = `url(${IMG_PATH + movie.backdrop_path})`;
        heroSection.innerHTML = `
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <h1 class="hero-title">${movie.title}</h1>
                <div class="hero-meta">
                    <span>⭐ ${movie.vote_average.toFixed(1)}</span>
                    <span>📅 ${movie.release_date.split('-')[0]}</span>
                </div>
                <div class="hero-buttons" style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button class="btn-primary" onclick="openDetails(${movie.id})">View Details</button>
                    ${trailer ? `<button class="btn-secondary" onclick="openDetails(${movie.id}, true)">Watch Trailer</button>` : ''}
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Error rendering hero:", err);
    }
}

function displayMovies(movies, append = false) {
    if (!append) main.innerHTML = "";

    // Remove skeletons if appending
    if (append) {
        document.querySelectorAll('.skeleton').forEach(el => el.remove());
    }

    if (!append && (!movies || movies.length === 0)) {
        main.innerHTML = `<h2 class="no-results">No movies found</h2>`;
        observer.unobserve(scrollTrigger);
        return;
    }

    movies.forEach(movie => {
        const { id, title, poster_path, vote_average, release_date } = movie;
        const movieEl = document.createElement("div");
        movieEl.classList.add("movie");
        movieEl.innerHTML = `
            <img src="${poster_path ? POSTER_PATH + poster_path : 'https://via.placeholder.com/500x750?text=No+Poster'}" alt="${title}">
            <div class="movie-info">
                <h3>${title}</h3>
                <div class="movie-meta">
                    <span class="rating-badge">${vote_average.toFixed(1)}</span>
                    <span>${release_date ? release_date.split('-')[0] : 'N/A'}</span>
                </div>
            </div>
        `;
        movieEl.addEventListener('click', () => openDetails(id));
        main.appendChild(movieEl);
    });

    if (hasMoreMovies) {
        observer.observe(scrollTrigger);
    } else {
        observer.unobserve(scrollTrigger);
    }
}

async function openDetails(movieId, scrollToTrailer = false) {
    try {
        const movieKey = `detail_${movieId}`;
        const creditsKey = `credits_${movieId}`;
        const videosKey = `videos_${movieId}`;
        const similarKey = `similar_${movieId}`;

        // Fetch with cache
        const [movie, credits, videos, similar] = await Promise.all([
            fetchWithCache(`${BASE_URL}/movie/${movieId}?api_key=${API_KEY}`, movieKey),
            fetchWithCache(`${BASE_URL}/movie/${movieId}/credits?api_key=${API_KEY}`, creditsKey),
            fetchWithCache(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`, videosKey),
            fetchWithCache(`${BASE_URL}/movie/${movieId}/similar?api_key=${API_KEY}`, similarKey)
        ]);

        const trailer = videos.results.find(v => v.type === "Trailer" && v.site === "YouTube");
        const inWatchlist = watchlist.some(m => m.id === movie.id);

        modalBody.innerHTML = `
            <div class="modal-main">
                <div class="modal-sidebar">
                    <img src="${movie.poster_path ? POSTER_PATH + movie.poster_path : 'https://via.placeholder.com/500x750'}" alt="${movie.title}">
                    <div class="modal-actions" style="margin-top: 2rem;">
                        <button class="btn-primary" id="watchlist-btn" style="width: 100%;">
                            ${inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                        </button>
                    </div>
                </div>
                <div class="modal-info">
                    <h2>${movie.title}</h2>
                    <div class="hero-meta">
                        <span>⭐ ${movie.vote_average.toFixed(1)}</span>
                        <span>🕒 ${movie.runtime} min</span>
                        <span>📅 ${movie.release_date}</span>
                    </div>
                    <div class="genre-tags">
                        ${movie.genres.map(g => `<span class="tag">${g.name}</span>`).join('')}
                    </div>
                    <p class="modal-overview">${movie.overview}</p>
                    
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
                                    <img class="cast-img" src="${person.profile_path ? CAST_PATH + person.profile_path : 'https://via.placeholder.com/150'}" alt="${person.name}">
                                    <span class="cast-name">${person.name}</span>
                                    <span class="cast-role">${person.character}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="similar-section">
                        <p class="section-title-sm">Similar Movies</p>
                        <div class="horizontal-scroll">
                            ${similar.results.slice(0, 10).map(m => `
                                <div class="similar-card" onclick="openDetails(${m.id})">
                                    <img src="${m.poster_path ? POSTER_PATH + m.poster_path : 'https://via.placeholder.com/200x300'}" alt="${m.title}">
                                    <div class="similar-title">${m.title}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('watchlist-btn').onclick = () => toggleWatchlist(movie);
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
        console.error("Error fetching details:", err);
        modalBody.innerHTML = `<h2 class="no-results" style="color:var(--danger-color)">Failed to load movie details.</h2>`;
        modal.style.display = "flex";
    }
}

function toggleWatchlist(movie) {
    const index = watchlist.findIndex(m => m.id === movie.id);
    if (index > -1) {
        watchlist.splice(index, 1);
    } else {
        watchlist.push({
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            release_date: movie.release_date
        });
    }
    localStorage.setItem('watchlist', JSON.stringify(watchlist));

    const btn = document.getElementById('watchlist-btn');
    const inWatchlist = watchlist.some(m => m.id === movie.id);
    btn.innerText = inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist';

    if (currentGenre === "watchlist") displayWatchlist();
}

function displayWatchlist() {
    heroSection.style.display = "none";
    observer.unobserve(scrollTrigger);
    displayMovies(watchlist);
    resultsCount.innerText = watchlist.length;
}

function setupEventListeners() {
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
        currentPage = 1;
        hasMoreMovies = true;
        loadMovies();
    };

    document.querySelector('[data-genre="watchlist"]').onclick = (e) => {
        e.preventDefault();
        currentGenre = "watchlist";
        loadMovies();
    };

    safesearch.onchange = () => {
        currentPage = 1;
        hasMoreMovies = true;
        loadMovies();
    };
}
