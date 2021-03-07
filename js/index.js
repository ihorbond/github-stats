const baseUrl = "https://api.github.com";
const fetchOptions = {
    headers: {
        Authorization: ''
    }
}

const chartOptions = {
    title: {
        display: true,
        text: "Breakdown by language",
        fontSize: 16,
        fontColor: '#000'
    },
    legend: {
        position: 'bottom'
    },
    tooltips: {
        callbacks: {
            label: function(tooltipItem, data) {
                return data.labels[tooltipItem.index];
            }
        }
    }
}

/**
 * Draws doughnut chart
 * TODO: move off canvas into background worker?
 * @param {Map} chartData
 */
const drawChart = (chartData) => {
    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');

    const values = [...chartData.values()];
    const langs = [...chartData.keys()];
    const labels = langs.map((lang,idx) => generateLabel(lang, idx, values));
    const colors = langs.map(lang => langColors[lang].color || "gray");
    
    canvas.classList.remove('d-none');
    const myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [
                {
                    data: values,
                    backgroundColor: colors
                }
            ],
            labels: labels
         },
        options: chartOptions
    });

    setTimeout(() => {
        canvas.scrollIntoView(false);
    }, 100)
}

const generateLabel = (lang, currIndex, values) => {
    const value = values[currIndex];
    const sum = values.reduce((acc,val) => acc += val, 0);
    const percentage = (value * 100 / sum).toFixed(2) + "%";

    return `${lang}: ${percentage}`;
}

const reposCallback = async (e) => {
    const repos = await getRepos(user);
    updateRepos(repos);
    updateStars(repos);
}

const analyzeCallback = async (e) => {
    const chartData = await getChartData(userRepos, limit.remaining);
    drawChart(chartData);
}

const tokenCallback = (e) => {
    const token = e.target.value;
    if (token) {
        fetchOptions.headers.Authorization = `token ${token}`;
        updateLimit();
    }
}

const updateRepos = (repos) => {
    const count = repos.length;
    const reposElem = document.getElementById("repos");
    reposElem.innerText = reposElem.innerText.replace(/\d+/, count);
}

const updateStars = (repos) => {
    const count = repos.reduce((acc, val) => acc += val.stargazers_count, 0);
    const starsElem = document.getElementById("stars");
    starsElem.innerText = starsElem.innerText.replace(/\d+/, count);
}

const updateLimit = ({ remaining, limit, reset }) => {
    const analyzeBtn = document.getElementById("analyze");
    if (remaining === 0) {
        analyzeBtn.disabled = true;
    }

    const limitElem = document.getElementById("limit");
    const resetDate = new Date(reset * 1000);
    limitElem.innerText = limitElem.innerText
        .replace("{remaining}", remaining)
        .replace("{total}", limit)
        // .replace("{resetDate}", resetDate);
}

const getRepos = async (user) => {
    const includeForks = document.getElementById("forked").checked;
    const isOwner = document.getElementById("owner").checked;
    const searchParams = new URLSearchParams({
        per_page: 100
    });

    isOwner && searchParams.append("type", "owner");

    const url = `${baseUrl}/users/${user}/repos?${searchParams}`;

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    return includeForks 
        ? data 
        : data.filter(x => !x.fork);
}

/**
 *
 * @param {Array} repos
 * @param {int} remainingRequests
 * @returns Map of key value pairs
 */
const getChartData = async (repos, remainingRequests) => {
    // alert(JSON.stringify(repos));
    const langPromises = repos
        .slice(0, remainingRequests)
        .map(r => fetch(r.languages_url, fetchOptions));

    const responses = await Promise.all(langPromises);
    const data = responses.map(r => r.json());
    const langs = await Promise.all(data);

    return langs
        .flatMap(x => Object.entries(x))
        .reduce((acc, curr) => {
            const [key, value] = curr;
            const val = (acc.get(key) || 0) + value;
            acc.set(key, val);
            return acc;
    }, new Map());
}

const getLimit = async () => {
    const url = `${baseUrl}/rate_limit`;
    const res = await fetch(url, fetchOptions);
    const data = await res.json();
    return data.rate;
}

/**
 * TODO: Load differently/more efficiently ?
 * @returns colors json
 */
const getColors = async () => {
    const url = chrome.runtime.getURL('/data/colors.json');
    const res = await fetch(url);
    const data = await res.json();
    return data;
}

document.getElementById("forked").addEventListener("change", reposCallback);
document.getElementById("owner").addEventListener("change", reposCallback);
document.getElementById("token").addEventListener("blur", tokenCallback);
document.getElementById("analyze").addEventListener("click", analyzeCallback);

let limit;
let userRepos;
let langColors;
let user = 'ihorbond';

(async function() {
    limit = await getLimit();
    userRepos = await getRepos(user);
    langColors = await getColors();

    updateLimit(limit);
    updateRepos(userRepos);
    updateStars(userRepos);
})();
