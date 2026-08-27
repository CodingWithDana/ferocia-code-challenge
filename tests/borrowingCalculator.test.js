/**
 * Borrowing Power Calculator Test Suite
 */

const assert = require('assert');

process.env.BORROWING_CALCULATOR_API_TOKEN = 'test-api-token';
process.env.BORROWING_CALCULATOR_API_BASE_URL = 'http://api.example.test';

const {
  calculateBorrowingPower,
  getTax,
  getHEM,
  runConsoleMode
} = require('../src/borrowingCalculator.ts');

describe('Borrowing Power Calculator Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = async (url, options) => {
      assert.strictEqual(
        options.headers.Authorization,
        'Bearer test-api-token'
      );

      const requestUrl = new URL(url);
      const income = Number(requestUrl.searchParams.get('income'));

      return {
        ok: true,
        json: async () => requestUrl.pathname === '/api/tax'
          ? { tax: income === 120000 ? 24000 : 1500 }
          : { hem: income === 120000 ? 3100 : 2800 }
      };
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Checks that borrowing power and repayment are zero when income is insufficient
  it('should return 0 when repayment capacity is zero or below', async () => {
    const result = await calculateBorrowingPower(30000, 3, 4000, 5000, 7.5);
    assert.strictEqual(result.maxLoanAmount, 0);
    assert.strictEqual(result.monthlyRepayment, 0);
  });

  // Checks that getTax fails before making a request when the API token is missing
  it('should throw error when the API token is missing', async () => {
    const originalToken = process.env.BORROWING_CALCULATOR_API_TOKEN;
    delete process.env.BORROWING_CALCULATOR_API_TOKEN;

    try {
      await assert.rejects(
        getTax(120000),
        /BORROWING_CALCULATOR_API_TOKEN is required/
      );
    } finally {
      if (originalToken === undefined) {
        delete process.env.BORROWING_CALCULATOR_API_TOKEN;
      } else {
        process.env.BORROWING_CALCULATOR_API_TOKEN = originalToken;
      }
    }
  });

  // Checks that getTax throws the API's JSON error message
  it('should throw the tax API error message from a JSON response', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Income must be a non-negative number.' })
    });

    await assert.rejects(
      getTax(-1),
      /Income must be a non-negative number\./
    );
  });

  // Checks that an unauthorized response tells the user to update their local token.
  it('should explain how to fix an invalid API token', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid Personal Access Token' })
    });

    await assert.rejects(
      getTax(120000),
      /API token is incorrect\. Please check and try again\./
    );
  });

  // Checks that getTax uses a fallback message when an error response is not JSON
  it('should throw a fallback error when the tax API error response is not JSON', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError('Invalid JSON'); }
    });

    await assert.rejects(getTax(120000), /Tax API request failed with status 500/);
  });

  // Checks that getTax sends the income and returns the tax value
  it('should request tax with the income and return the tax from the API', async () => {
    let requestedUrl;
    let requestOptions;

    global.fetch = async (url, options) => {
      requestedUrl = new URL(url);
      requestOptions = options;
      return { ok: true, json: async () => ({ tax: 24000 }) };
    };

    const tax = await getTax(120000);

    assert.strictEqual(requestedUrl.origin, 'http://api.example.test');
    assert.strictEqual(requestedUrl.pathname, '/api/tax');
    assert.strictEqual(requestedUrl.searchParams.get('income'), '120000');
    assert.strictEqual(
      requestOptions.headers.Authorization,
      'Bearer test-api-token'
    );
    assert.strictEqual(tax, 24000);
  });

  // Checks that getHEM sends income and dependents and returns the HEM value
  it('should request HEM with income and dependents and return the HEM from the API', async () => {
    let requestedUrl;
    let requestOptions;

    global.fetch = async (url, options) => {
      requestedUrl = new URL(url);
      requestOptions = options;
      return { ok: true, json: async () => ({ hem: 3100 }) };
    };

    const hem = await getHEM(120000, 2);

    assert.strictEqual(requestedUrl.pathname, '/api/hem');
    assert.strictEqual(requestedUrl.searchParams.get('income'), '120000');
    assert.strictEqual(requestedUrl.searchParams.get('dependents'), '2');
    assert.strictEqual(
      requestOptions.headers.Authorization,
      'Bearer test-api-token'
    );
    assert.strictEqual(hem, 3100);
  });

  // Checks that the calculation uses tax, HEM and credit-card liability
  it('should use HEM, tax and credit-card liability in the normal calculation', async () => {
    const result = await calculateBorrowingPower(120000, 2, 3000, 10000, 7.5);

    assert.deepStrictEqual(result, {
      maxLoanAmount: 657881.09,
      monthlyRepayment: 4600,
      annualTax: 24000,
      baselineHEM: 3100
    });
  });

  // Checks that declared expenses are used when higher than HEM
  it('should use declared expenses when they are higher than HEM', async () => {
    const result = await calculateBorrowingPower(120000, 2, 3500, 10000, 7.5);

    assert.strictEqual(result.monthlyRepayment, 4200);
    assert.strictEqual(result.maxLoanAmount, 600674.03);
  });

  // Checks that all returned money values are rounded to two decimals
  it('should round all monetary values to two decimal places', async () => {
    global.fetch = async (url) => ({
      ok: true,
      json: async () => new URL(url).pathname === '/api/tax'
        ? { tax: 12345.678 }
        : { hem: 2000.555 }
    });

    const result = await calculateBorrowingPower(
      100001,
      1,
      2200.554,
      1234.56,
      7.1
    );

    assert.deepStrictEqual(result, {
      maxLoanAmount: 753984.88,
      monthlyRepayment: 5067.02,
      annualTax: 12345.68,
      baselineHEM: 2000.56
    });
  });

  // Uses fake terminal input to test every prompt and summary line without real user input
  it('should collect console input and display a calculation summary', async () => {
    const answers = ['120000', '2', '3000', '10000'];
    const prompts = [];
    const output = [];
    let closed = false;
    // Supplies each answer immediately and records the prompts shown to the user
    const readline = {
      createInterface: () => ({
        question: (prompt, callback) => {
          prompts.push(prompt);
          callback(answers.shift());
        },
        close: () => { closed = true; }
      })
    };
    // Captures summary output so it can be checked without writing to the test terminal
    const originalConsoleLog = console.log;
    console.log = (message) => output.push(message);

    try {
      runConsoleMode(readline);
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      console.log = originalConsoleLog;
    }

    assert.deepStrictEqual(prompts, [
      'Gross Annual Income: $',
      'Number of Dependents: ',
      'Declared Monthly Expenses: $',
      'Total Credit Card Limits: $'
    ]);
    assert.strictEqual(closed, true);
    assert.deepStrictEqual(output, [
      'Mortgage Borrowing Power Calculator',
      '===================================',
      '\n--- Calculation Summary ---',
      'Maximum Borrowing Power at 10%: $524,173.77',
      'Assumed Monthly Mortgage Repayment: $4,600 over 30 years',
      'Income Tax: $24,000',
      'Household Expense Measure (HEM): $3,100'
    ]);
  });

  // Checks that console will ask users to reenter if they didn't enter valid input
  it('should ask again when console input is not a valid number', async () => {
    const answers = ['85000.5', '85000', '1.5', '1', 'four thousands', '4000.25', '0.5', '0'];
    const prompts = [];
    const output = [];
    let closed = false;
    const readline = {
      createInterface: () => ({
        question: (prompt, callback) => {
          prompts.push(prompt);
          callback(answers.shift());
        },
        close: () => { closed = true; }
      })
    };
    const originalConsoleLog = console.log;
    console.log = (message) => output.push(message);

    try {
      runConsoleMode(readline);
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      console.log = originalConsoleLog;
    }

    assert.deepStrictEqual(prompts, [
      'Gross Annual Income: $',
      'Gross Annual Income: $',
      'Number of Dependents: ',
      'Number of Dependents: ',
      'Declared Monthly Expenses: $',
      'Declared Monthly Expenses: $',
      'Total Credit Card Limits: $',
      'Total Credit Card Limits: $'
    ]);
    assert.ok(output.includes('Please enter a whole number of zero or more for gross annual income'));
    assert.ok(output.includes('Please enter a number of zero or more for declared monthly expenses'));
    assert.strictEqual(closed, true);
  });

  // Checks that an API request without valid token closes the console and returns the reason message
  it('should close the console and explain an invalid API token', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid Personal Access Token' })
    });
    const answers = ['120000', '2', '3000', '10000'];
    const errors = [];
    let closed = false;
    const readline = {
      createInterface: () => ({
        question: (_prompt, callback) => callback(answers.shift()),
        close: () => { closed = true; }
      })
    };
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalExitCode = process.exitCode;
    console.log = () => {};
    console.error = (message) => errors.push(message);

    try {
      runConsoleMode(readline);
      await new Promise((resolve) => setImmediate(resolve));

      assert.strictEqual(closed, true);
      assert.deepStrictEqual(errors, [
        'Unable to calculate borrowing power: API token is incorrect. Update BORROWING_CALCULATOR_API_TOKEN in .env and restart the calculator.'
      ]);
      assert.strictEqual(process.exitCode, 1);
    } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      if (originalExitCode === undefined) {
        delete process.exitCode;
      } else {
        process.exitCode = originalExitCode;
      }
    }
  });

  // Checks that the console still closes cleanly if an unexpected error has no message.
  it('should show a fallback message for an unknown calculation error', async () => {
    global.fetch = async () => { throw 'unexpected failure'; };
    const answers = ['120000', '2', '3000', '10000'];
    const errors = [];
    const readline = {
      createInterface: () => ({
        question: (_prompt, callback) => callback(answers.shift()),
        close: () => {}
      })
    };
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalExitCode = process.exitCode;
    console.log = () => {};
    console.error = (message) => errors.push(message);

    try {
      runConsoleMode(readline);
      await new Promise((resolve) => setImmediate(resolve));

      assert.deepStrictEqual(errors, ['Unable to calculate borrowing power: Unknown calculation error']);
    } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      if (originalExitCode === undefined) {
        delete process.exitCode;
      } else {
        process.exitCode = originalExitCode;
      }
    }
  });
});
