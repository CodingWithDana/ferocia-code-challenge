/**
 * server.js
 * 
 * Local dev endpoint for Borrowing Calculator Code Challenge
 * 
 */

const http = require("http");

const PORT = 3000;
const VALID_PAT = "pat_abcdefghijklmnopqrstuvwxyz0123456789";

const HEM_MATRIX = {
    low:    { 0: 1600, 1: 2100, 2: 2500, 3: 2800 },
    medium: { 0: 2200, 1: 2700, 2: 3100, 3: 3500 },
    high:   { 0: 2600, 1: 3100, 2: 3600, 3: 4100 }
};


/**
 * Mock Tax Calculation
 */
function calcTax(income) {
    let tax = 0;

    if (income > 100000) {
        tax += (income - 100000) * 0.35;
        income = 100000;
    }

    if (income > 50000) {
        tax += (income - 50000) * 0.25;
        income = 50000;
    }

    if (income > 20000) {
        tax += (income - 20000) * 0.15;
    }

    return Math.round(tax);
}


/**
 * Mock HEM Calculation
 */
function calcHem(income, dependents) {
    const incomeTier = income > 150000 ? 'high' : income > 60000 ? 'medium' : 'low';
    const depCount = Math.min(Math.max(Math.floor(dependents), 0), 3);
    return HEM_MATRIX[incomeTier][depCount];
}


/**
 * Server
 */
function sendJSON(res, statusCode, body) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(body));
}

function errorJSON(res, statusCode, error, message) {
    return sendJSON(res, statusCode, { error, message });
}

function authenticate(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        errorJSON(res, 401, "Missing Personal Access Token", "Provide the token using the Authorization: Bearer <token> header.");
        return false;
    }

    const token = authHeader.slice(7);
    if (token !== VALID_PAT) {
        errorJSON(res, 401, "Invalid Personal Access Token", "The provided token is invalid.");
        return false;
    }

    return true;
}

function paramNumberCheck(params, key, label) {
    const rawValue = params.get(key);
    if (rawValue === null || rawValue.trim() === "") {
        return { error: `${label} is required`, message: `Provide ${key} parameter.` };
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) {
        return { error: `Invalid ${label.toLowerCase()}`, message: `${label} must be a non-negative number.` };
    }

    return { value: Math.round(value) };
}

function handleTax(params, res) {
    const incomeResult = paramNumberCheck(params, "income", "Income");
    if (incomeResult.error) {
        return errorJSON(res, 400, incomeResult.error, incomeResult.message);
    }

    return sendJSON(res, 200, {
        income: incomeResult.value,
        tax: calcTax(incomeResult.value)
    });
}

function handleHem(params, res) {
    const incomeResult = paramNumberCheck(params, "income", "Income");
    if (incomeResult.error) {
        return errorJSON(res, 400, incomeResult.error, incomeResult.message);
    }

    const dependentsResult = paramNumberCheck(params, "dependents", "Dependents");
    if (dependentsResult.error) {
        return errorJSON(res, 400, dependentsResult.error, dependentsResult.message);
    }

    return sendJSON(res, 200, {
        income: incomeResult.value,
        dependents: dependentsResult.value,
        hem: calcHem(incomeResult.value, dependentsResult.value)
    });
}

const server = http.createServer((req, res) => {
    if (!authenticate(req, res)) return;

    if (req.method !== "GET") {
        return errorJSON(res, 405, "Method Not Allowed", "Only GET requests are supported.");
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const params = url.searchParams;

    console.log("==============================");
    console.log("Request:");
    console.table({ method: req.method, path: url.pathname });
    console.log("Headers:");
    console.table(req.headers);
    console.log("Params:");
    console.table(Object.fromEntries(params));
    console.log("==============================");

    if (url.pathname === "/api/tax") {return handleTax(params, res);}
    if (url.pathname === "/api/hem") {return handleHem(params, res);}

    return errorJSON(res, 404, "Not Found", "The requested endpoint does not exist.");
});


server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});