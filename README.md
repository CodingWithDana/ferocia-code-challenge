# Borrowing Power Calculator

Hello and thanks so much for taking the time to do the Ferocia Junior Engineering Code Exercise.

This borrowing power calculator written in Javascript was started by one of our juniors, Gen (her full name is “Gen A. Eye”), but she she went on leave before she could finish it…

We need you to progress the code in her absence. Once you’ve submitted your work and we’ve reviewed it, you’ll sit down and explain the code to Gens team members (our interviewers) in a pairing session.

Keep in mind that we’ll expect you to be able to explain and expand on the code you submit.

If you haven’t done much Javascript before don’t worry. We’ll take your experience into account, just give it your best shot. 

You can see our online borrowing power calculator (Gens project is simplified so dont expect the number to match perfectly) to see how it work (https://www.bendigobank.com.au/personal/loans/calculators/borrowing-power/).

## Please try to complete the following:

### Replace the two placeholder functions
The code needs to calculate tax on income and a HEM (Household Expense Measure) value.
Currently this is performed by placeholder code in the following functions:
    getTax(income)
    getHEM(income, dependents)
You will need to replace the code in both with API calls.
We have provided a server.js which can you run locally to expose the following 2 development endpoints:
    http://localhost:3000/api/tax?income=[income]
    http://localhost:3000/api/hem?income=[income]&dependents=[dependents]
Both return JSON and require an authentication header with a valid PAT (Personal Access Token), see server.md for full documentation including the development PAT.

### Make it manageable
Gen planned to pull all the calculator functions into a class so she could extend it later, but we’ll leave it up to you to choose the approach (a well-formed class, an orchestrator function, a factory/closure pattern, or whatever)

### Test coverage
Of course we’ll need the test suite to pass and have full coverage.



## Rules:

Use whatever tools and resources help you get the job done. That includes AI, documentation, Stack Overflow, or anything else. What matters is that you understand every line you submit. In the follow-up pairing session, we'll ask you to walk us through your code, explain your decisions, and make changes on the fly - without an AI in Agent mode. If you can't do that confidently, it will count against you. The goal isn't to catch you out, it's to understand how you think.

## Setup

Make sure you have Node.js installed.

Install dependencies:
```
npm install
```

## Server

You wil need to run the development API in it's own terminal window.
(The server will be available at http://localhost:3000/).
To start the server run the following command:
```
npm run api
```
Note: You can stop the server with Ctrl+C


## Running

Run the calculator with:
```
npm start
```


## Testing

Run tests with:
```
npm test
```



