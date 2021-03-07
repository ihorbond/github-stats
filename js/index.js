const baseUrl = "https://api.github.com";
const fetchOptions = {
    headers: {
        Authorization: ''
    }
}

let limits;
let userRepos;
let langColors;

/**
 * Draws doughnut chart
 * TODO: move off canvas into background worker?
 * TODO: show percentages
 * @param {Map} chartData 
 */
const drawChart = (chartData) => {
    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');

    canvas.classList.remove('d-none');

    const labels = [...chartData.keys()];
    const colors = labels.map(label => langColors[label].color || "gray");

    // const options = {
    //     tooltips: {
    //         enabled: false
    //     },
    //     plugins: {
    //         datalabels: {
    //             formatter: (value, ctx) => {
    //                 let sum = 0;
    //                 let dataArr = ctx.chart.data.datasets[0].data;
    //                 dataArr.map(data => {
    //                     sum += data;
    //                 });
    //                 let percentage = (value*100 / sum).toFixed(2)+"%";
    //                 return percentage;
    //             },
    //             color: '#fff',
    //         }
    //     }
    // };
    
    const myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [
                {
                    data: [...chartData.values()],
                    backgroundColor: colors
                }
            ],
            labels: labels
         },
        // options: options
    });
}

document.getElementById("analyze").addEventListener("click", async e => {
    const chartData = await getLanguages(userRepos, limit.remaining);
    drawChart(chartData);
});

document.getElementById("token").addEventListener("blur", e => {
    // alert(e.target.value);
    const token = e.target.value;
    if (token) {
        fetchOptions.headers.Authorization = `token ${token}`;
        updateLimit();
    }
});

const updateRepos = (repos) => {
    const count = repos.length;
    const reposElem = document.getElementById("repos");
    reposElem.innerText = reposElem.innerText
        .replace("{repos}", count);
}

const updateStars = (repos) => {
    const count = repos.reduce((acc, val) => acc += val.stargazers_count, 0);
    const starsElem = document.getElementById("stars");
    starsElem.innerText = starsElem.innerText
        .replace("{stars}", count);
}

const updateLimits = ({ remaining, limit, reset}) => {
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
    const forked = document.getElementById("forked").checked;
    const owner = document.getElementById("owner").checked;
    const searchParams = new URLSearchParams({
        owner
    });
    const url = `${baseUrl}/users/${user}/repos?${searchParams}`;

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    return data.filter(r => r.fork === forked);
}

/**
 * 
 * @param {Array} repos 
 * @param {int} remainingRequests
 * @returns Map of key value pairs
 */
const getLanguages = async (repos, remainingRequests) => {
    // alert(JSON.stringify(repos));
    const langPromises = repos
        .slice(remainingRequests)
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

const getLimits = async () => {
    const url = `${baseUrl}/rate_limit`;
    const res = await fetch(url, fetchOptions);
    const data = await res.json();
    return data.rate;
}

/**
 * Load differently/more efficiently ?
 * @returns colors json
 */
const getColors = async () => {
    const url = chrome.runtime.getURL('/data/colors.json');
    const res = await fetch(url);
    const data = await res.json();
    // alert(JSON.stringify(data));
    return data;
}

(async function() {
    limits = await getLimits();
    userRepos = await getRepos('ihorbond');
    langColors = await getColors();
    // alert(JSON.stringify(userRepos));
    
    updateLimits(limits);
    updateRepos(userRepos);
    updateStars(userRepos);
})();
