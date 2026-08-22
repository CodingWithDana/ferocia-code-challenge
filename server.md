# Borrowing Calculator Development API Documentation


## Authentication

All requests require a Bearer token (development token = pat_abcdefghijklmnopqrstuvwxyz0123456789) to be passed in the `Authorization` header.

### Header format:

```http
Authorization: Bearer pat_abcdefghijklmnopqrstuvwxyz0123456789
```

## Endpoints

### 1. Calculate Tax

Returns the calculated annual income tax.

- URL: `/api/tax`
- Method: `GET`
- Query parameters:
  - `income` (required): non-negative number representing gross annual income.

#### Example Curl Request

```
curl -H "Authorization: Bearer pat_abcdefghijklmnopqrstuvwxyz0123456789" "http://localhost:3000/api/tax?income=125000"
```

#### Success response (200 OK)

```json
{
  "income": 125000,
  "tax": 25750
}
```

### 2. Calculate HEM Baseline

Returns the Household Expenditure Measure (HEM) monthly baseline cost.

- URL: `/api/hem`
- Method: `GET`
- Query parameters:
  - `income` (required): non-negative number representing gross annual income.
  - `dependents` (required): non-negative number representing the number of dependents. Values are capped at `3` internally.

#### Example Curl Request

```
curl -H "Authorization: Bearer pat_abcdefghijklmnopqrstuvwxyz0123456789" "http://localhost:3000/api/hem?income=125000&dependents=2"
```

#### Success response (200 OK)

```json
{
  "income": 125000,
  "dependents": 2,
  "hem": 3100
}
```

## Error responses

- `401 Unauthorized` — missing or invalid `Authorization` header token.
- `400 Bad Request` — missing, malformed, or negative query parameters.
- `404 Not Found` — endpoint path does not exist.
- `405 Method Not Allowed` — only `GET` is supported.

#### Example error payload

```json
{
  "error": "Income is required",
  "message": "Provide income parameter."
}
```