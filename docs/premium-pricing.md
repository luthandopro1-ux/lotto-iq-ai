# Premium Pricing Catalog

**Owner:** Lum Tech Solutions

The Premium catalog uses South African Rand (ZAR) as the authoritative billing currency. All three plans are automatic-renewal subscriptions and are disabled for checkout until a verified billing provider and webhook flow are connected.

| Plan | Renewal interval | ZAR price | Annual discount |
|---|---:|---:|---:|
| 7-day Premium | Every 7 days | R70 | None |
| Monthly Premium | Every 30 days | R280 | None |
| Yearly Premium | Every 365 days | R3,024 | 10% |

The yearly price is calculated from twelve monthly periods: R280 × 12 = R3,360. A 10% discount is R336, resulting in R3,024 per year.

The application can read an edge country header such as `CF-IPCountry` and display the detected two-letter country code. It does not invent a converted local amount. For non-South-African visitors, the current safe behavior is to show the ZAR source amount and state that localized conversion is pending a verified FX or payment provider. The final payment currency and exchange calculation must come from the selected billing provider.

Before enabling checkout, configure provider price identifiers for weekly, monthly, and yearly subscriptions; verify webhook signatures; map successful payments to `workspace_entitlements`; store the interval, price, currency, renewal state, period end, and country code; handle cancellation, payment failure, refund, and chargeback events; and test that entitlement activation is idempotent.
