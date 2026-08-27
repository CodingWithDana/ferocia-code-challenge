import type {
    ApiResponse,
    TaxApiResponse,
    HemApiResponse,
    Result
} from "../types/borrowingCalculator";


// Global constant for mortgage simulation
const LOAN_TERM_MONTHS = 360; // 30 Years
const INTEREST_RATE = 7.0; // 7.0% baseline interest rate
const ASSESSMENT_RATE_BUFFER = 3.0; // 3.0% buffer added to interest rates


const API_BASE_URL = process.env.BORROWING_CALCULATOR_API_BASE_URL;

// Reads the API token at run time so API token never stored in source code
function getApiToken(): string {
    const apiToken = process.env.BORROWING_CALCULATOR_API_TOKEN;
    if (!apiToken) {
        throw new Error("BORROWING_CALCULATOR_API_TOKEN is required");
    }
    return apiToken;
}

// Helper function to handle the API request logic shared by getTax and getHem
async function fetchApiJson<ResponseType extends ApiResponse>(
    endpoint: string,
    queryParams: Record<string, string | number>,
    apiName: string
): Promise<ResponseType> {
    const params = new URLSearchParams(
        Object.entries(queryParams).map(([key, value]) => [key, String(value)])
    );
    const response = await fetch(`${API_BASE_URL}${endpoint}?${params}`, {
        headers: {
            Authorization: `Bearer ${getApiToken()}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(error.message || `${apiName} API request failed with status ${response.status}`);
    }

    return response.json() as Promise<ResponseType>;
}

// Gets the annual tax amount from the local development API
async function getTax(income: number): Promise<number> {
    const responseData = await fetchApiJson<TaxApiResponse>("/api/tax", { income }, "Tax");
    const annualTaxFromApi = responseData.tax;

    return annualTaxFromApi;
}

// Gets the monthly HEM baseline from the local development API
async function getHEM(income: number, dependents: number): Promise<number> {
    const responseData = await fetchApiJson<HemApiResponse>("/api/hem", { income, dependents }, "HEM");
    const baselineHEMFromApi = responseData.hem;

    return baselineHEMFromApi;
}

// Calculates the total borrowing power amount and the monthly repayment configuration
async function calculateBorrowingPower(
    income: number,
    dependents: number,
    expenses: number,
    creditLimits: number,
    annualAssessmentRate: number
): Promise<Result> {
    // 1. Calculate Net Monthly Income after tax deductions
    const annualTax = await getTax(income);
    const netMonthlyIncome = (income - annualTax) / 12;

    // 2. Determine living expenses (User declared expenses vs HEM baseline, whichever is higher)
    const baselineHEM = await getHEM(income, dependents);
    const totalLivingExpenses = Math.max(expenses, baselineHEM);

    // 3. Calculate credit card liability (~3% of total limits)
    const creditCardLiability = creditLimits * 0.03;

    // 4. Calculate monthly repayment capacity
    const maxMonthlyRepayment = netMonthlyIncome - totalLivingExpenses - creditCardLiability;

    // Return early if user cannot afford a loan at all
    if (maxMonthlyRepayment <= 0) {
        return {
            maxLoanAmount: 0,
            monthlyRepayment: 0,
            annualTax: Number(annualTax.toFixed(2)),
            baselineHEM: Number(baselineHEM.toFixed(2))
        };
    }

    // 5. Calculate the monthly interest rate
    const monthlyRate = (annualAssessmentRate / 100) / 12;

    // 6. Calculate maximum borrowing power using the following formula:
    // P = M * (1 - (1 + R)^-N) / R
    const maxLoanAmount = maxMonthlyRepayment * ((1 - Math.pow(1 + monthlyRate, - LOAN_TERM_MONTHS)) / monthlyRate);

    return {
        maxLoanAmount: Number(maxLoanAmount.toFixed(2)),
        monthlyRepayment: Number(maxMonthlyRepayment.toFixed(2)),
        annualTax: Number(annualTax.toFixed(2)),
        baselineHEM: Number(baselineHEM.toFixed(2)),
    };
}

// Repeats a console prompt until the user provides a valid non-negative number.
function promptForNumber(
    rl: { question: (prompt: string, callback: (answer: string) => void) => void },
    prompt: string,
    fieldName: string,
    wholeNumber: boolean,
    onValidAnswer: (value: number) => void
) {
    rl.question(prompt, (answer: string) => {
        const value = Number(answer.trim());
        const isValid = answer.trim() !== "" && Number.isFinite(value) && value >= 0 &&
            (!wholeNumber || Number.isInteger(value));

        if (!isValid) {
            const expectedValue = wholeNumber ? "a whole number" : "a number";
            console.log(`Please enter ${expectedValue} of zero or more for ${fieldName}`);
            promptForNumber(rl, prompt, fieldName, wholeNumber, onValidAnswer);
            return;
        }

        onValidAnswer(value);
    });
}

// Runs the interactive calculator in a terminal
function runConsoleMode(readline = require('readline')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log("Mortgage Borrowing Power Calculator");
    console.log("===================================");

    promptForNumber(rl, "Gross Annual Income: $", "gross annual income", true, (income) => {
        promptForNumber(rl, "Number of Dependents: ", "number of dependents", true, (dependents) => {
            promptForNumber(rl, "Declared Monthly Expenses: $", "declared monthly expenses", false, (expenses) => {
                promptForNumber(rl, "Total Credit Card Limits: $", "total credit card limits", true, async (creditLimits) => {

                    // Banks assess loans using base rate + buffer for safety
                    const assessmentRate = INTEREST_RATE + ASSESSMENT_RATE_BUFFER;

                    const result = await calculateBorrowingPower(
                        income,
                        dependents,
                        expenses,
                        creditLimits,
                        assessmentRate
                    );

                    console.log("\n--- Calculation Summary ---");
                    console.log(`Maximum Borrowing Power at ${assessmentRate}%: $${result.maxLoanAmount.toLocaleString()}`);
                    console.log(`Assumed Monthly Mortgage Repayment: $${result.monthlyRepayment.toLocaleString()} over 30 years`);
                    console.log(`Income Tax: $${result.annualTax.toLocaleString()}`);
                    console.log(`Household Expense Measure (HEM): $${result.baselineHEM.toLocaleString()}`);

                    rl.close();
                });
            });
        });
    });
}

/* c8 ignore start */
if (require.main === module) {
    runConsoleMode();
}
/* c8 ignore stop */

module.exports = { calculateBorrowingPower, getTax, getHEM, runConsoleMode };
