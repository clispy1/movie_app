const api_key = "fcf2233bcea67f1b4a068f62804d1ecb";
const IMG_PATH = "https://image.tmdb.org/t/p/w500/";
let count = 1;
const filter = document.getElementById("safesearch")

filter.addEventListener("change", () => {
	input.value === "" ? search() : searchMovie(input.value);
});

const SEARCH = `https://api.themoviedb.org/3/search/movie?api_key=fcf2233bcea67f1b4a068f62804d1ecb&language=en-US&page=${count}&include_adult=${filter.value}&query="`;

let searchCount = 1;



let input = document.querySelector(".search");
let form = document.querySelector("#form");
const main = document.querySelector("#main");
const rates = document.querySelector(".rating");

function search() {
	console.log(filter.value, SEARCH, "no search");
	main.innerHTML = "";

	const API_URL = `https://api.themoviedb.org/3/discover/movie?api_key=${api_key}&sort_by=popularity.desc&include_adult=${filter.value}&page=`;



	fetch(API_URL + count)
		.then((req) => req.json())
		.then((json) => displayMovie(json.results))
		.catch((err) => console.log(err));
}

search();


function displayMovie(movies) {

	main.innerHTML = "";

	movies.forEach((movie) => {
		const { poster_path: image, title, release_date: year, overview } = movie;

		const movieEl = document.createElement("div");
		movieEl.classList.add("movie");
		movieEl.innerHTML = `
      <img src="${IMG_PATH + image}" alt="">
      <div class="movie-info">
			<h3>${title}</h3>
			<span class="rating" style="color: white" >${year.split("-")[0]}</span>
        <div class="description">
            <h3>Overview</h3>
            ${overview}
        </div>
      </div>`;
		main.appendChild(movieEl);
	});

	if (main.innerHTML === "") main.innerHTML = "No movies";
}

let searchedMovies = "";

async function searchMovie(data) {
	
	let query = data;
	let response = `https://api.themoviedb.org/3/search/movie?api_key=fcf2233bcea67f1b4a068f62804d1ecb&language=en-US&page=${searchCount}&include_adult=${filter.value}&query="${query}`;
	let request = await fetch(response);
	
	const rep = await request.json();

	
	searchedMovies = rep.results;
	displayMovie(rep.results);
	document.querySelector(".results").innerHTML = rep.total_results
}

form.addEventListener("submit", (e) => {
	e.preventDefault();

	if (input.value !== "") searchMovie(input.value);
});

const next = document.getElementById("next");
next.addEventListener("click", () => {
	inc(searchedMovies);
});
const prev = document.getElementById("prev");
prev.addEventListener("click", () => {
	decrease(searchedMovies);
});

const num = document.getElementById("num");
num.innerHTML = "page: " + searchCount;

function inc(content) {
	if (input.value) {
		++searchCount;
		searchMovie(input.value);
		num.innerHTML = "page: " + searchCount;
	} else {
		++count;
		search();
		num.innerHTML = "page: " + count;
	}
}
function decrease(content) {
	if (input.value && searchCount > 1) {
		--searchCount;
		num.innerHTML = "page: " + searchCount;
		searchMovie(input.value);
	} else {
		if (count > 1) {
			--count;
			search();
			num.innerHTML = "page: " + count;
		}
		return;
	}
}
function classRate(rate) {
	if (rate >= 8) {
		return "green";
	} else if (rate >= 5) {
		return "orange";
	} else {
		return "red";
	}
}
