const puppeteer = require('puppeteer');

/**
 * Asynchronous function to stop execution of the function by some miliseconds
 * 
 * @param {Number} ms 
 * @returns 
 */
function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gets element by its query. Waits until it loaded in the dom and then
 * performs fetching
 * 
 * @param {puppeteer.Frame | puppeteer.Page} treeDom 
 * @param {string} query - string query to identify object
 * @returns {puppeteer.ElementHandle<Element>} dom object to interact with
 */
const getElementByQuery = async (treeDom, query) => {
    try {
        await treeDom.waitForSelector(query, { visible: true });
    }
    catch (e){
        return null;
    }
    return await treeDom.$(query);
};

/**
 * Provide path to the executable and user data directory to bypass DUO security
 */
const argv = process.argv;
const executablePath = argv.length >= 2 ? argv[2] : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const userDataDir = argv.length >= 3 ? argv[3] : "/Users/sungkarb/Library/Application Support/Google/Chrome/Default";


(async () => {
    // Launch browser
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: executablePath,
        userDataDir: userDataDir,
        defaultViewport: null, // important: disables the 800x600 default
        args: [
            '--start-maximized',
            '--disable-web-security'
        ], // opens the window maximized
    });


    // Navigate to the speed quiz pages
    const page = await browser.newPage();
    await page.goto("https://canvas.wisc.edu/courses/463656/gradebook/speed_grader?assignment_id=2784832&student_id=385605", {
        waitUntil: "networkidle2"
    });


    // Intercept network requests and fetch the authorization token 
    const token = {
        value: null
    };
    page.on("request", async (request) => {
        if (request.url().endsWith("session_item_results?")){
            const headers = request.headers();
            if (headers.authorization){
                token.value = headers.authorization;
                console.log("Authorization Token:", token.value);
            }
        }
    });

    
    /**
     * Sometimes it is required to login into UW.
     * Check if there is an input field for username and fill them up
     */
    const userDom = await page.$("#j_username");
    if (userDom){
        await userDom.type("bolat");

        const passwordDom = await getElementByQuery(page, "#j_password");
        await passwordDom.type("RSM_agnum2016");

        await page.click("button");
        await page.waitForNavigation();
    }

    // Wait until authorization token will be available
    while (!token.value){
        await sleep(1000);
    }

    // Send a network request for the student quiz results
    const url = 'https://wisconsin--madison.quiz-api-iad-prod.instructure.com/api/quiz_sessions/68103/results/93854/session_item_results?';
    const responseData = await page.evaluate(async (url, token) => {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'authorization': token.value
            },
            credentials: 'include'
        });
        return response.json(); // Parse and return the JSON response
    }, url, token);
    console.log("HAHAHHAHAH", responseData);


    // Keep window open for a long time
    await sleep(20000000);
    await browser.close();
})();
