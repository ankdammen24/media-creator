## Bakgrund
Användaren har verifierat att login mot `api.mediarosenqvist.com/auth/login` fungerar, men vill att frontend ska visa backendens faktiska felmeddelande istället för en generisk "Invalid email or password".

Backend returnerar:
- `401` → `{"error":"Invalid credentials"}`
- `400` → `{"error":"Validation error","details":{"fieldErrors":{"password":["String must contain at least 8 character(s)"]}}}`

## Ändringar
1. **`src/lib/auth.tsx`**: Uppdatera `login()` så att den vid `!res.ok` parsar response-bodyn och försöker extrahera `error` eller första `fieldErrors`-meddelandet. Kasta sedan `Error` med det faktiska meddelandet. Fallback till generiskt meddelande vid parse-fel.
2. **`src/routes/login.tsx`**: Ingen ändring behövs – den visar redan `err.message` i felmeddelandet.

## Testscenario
- Försök logga in med lösenord < 8 tecken → ska visa "String must contain at least 8 character(s)"
- Försök logga in med fel lösenord → ska visa "Invalid credentials"
- Nätverksfel → ska visa "Network error. Please try again."