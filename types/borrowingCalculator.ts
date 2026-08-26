export type Result = {
    maxLoanAmount: number,
    monthlyRepayment: number,
    annualTax: number,
    baselineHEM: number
}

export type TaxApiResponse = {
    tax: number;
};

// Restrict each API call to only these two types
export type ApiResponse = TaxApiResponse | HemApiResponse;
