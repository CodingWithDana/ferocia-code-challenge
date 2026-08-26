import type {
    ApiResponse,
    TaxApiResponse,
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

function getHEM(income, dependents) {
    // REPLACE THIS
    // Write your HEM API call code here.
    return 2000 + (dependents * 400);
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
    const baselineHEM = getHEM(income, dependents);
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

// Runs the interactive calculator in a terminal
function runConsoleMode(readline = require('readline')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log("Mortgage Borrowing Power Calculator");
    console.log("===================================");

        rl.question("Gross Annual Income: $", (income: string) => {
            rl.question("Number of Dependents: ", (dependents: string) => {
                rl.question("Declared Monthly Expenses: $", (expenses: string) => {
                    rl.question("Total Credit Card Limits: $",  async (creditLimits: string) => {
                        const incomeNumber = parseFloat(income);
                        const dependentsNumber = parseInt(dependents, 10);
                        const expensesNumber = parseFloat(expenses);
                        const creditLimitsNumber = parseFloat(creditLimits);

                        // Banks assess loans using base rate + buffer for safety
                        const assessmentRate = INTEREST_RATE + ASSESSMENT_RATE_BUFFER;

                        const result = await calculateBorrowingPower(
                            incomeNumber,
                            dependentsNumber,
                            expensesNumber,
                            creditLimitsNumber,
                            assessmentRate
                        );

                        console.log("\n--- Calculation Summary ---");
                        console.log(`Maximum Borrowing Power at ${assessmentRate}%: $${result.maxLoanAmount.toLocaleString()}`);
                        console.log(`Assumed Monthly Mortgage Repayment: $${result.monthlyRepayment.toLocaleString()} over 30 years`);
                        console.log(`Income Tax: $${result.annualTax.toLocaleString()}`);
                        
                        rl.close();
                });
            });
        });
    });
}

if (require.main === module) {
    runConsoleMode();
}

module.exports = { calculateBorrowingPower };